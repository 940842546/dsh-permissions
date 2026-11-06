// 契约测试：升级 dsh 后的"探雷器"。
//
// 本项目四次生产故障里，三次都属于本文件能提前发现的那类：
//   - dsh 0.1.7 移除 ctx.settings.register          → 静态断言：源码不得再调用它
//   - 漏声明 inject: ['webServer'] 导致路由没挂      → 静态断言：inject 必须含 webServer
//   - 误用 connection.authorizeIndex                → 静态断言：源码不得使用它
// 其余部分是针对 dsh 安装包的类型/符号检查：找不到安装包时整段跳过（CI 里通常跳过，
// 但你本地升级 dsh 后跑 npm test 就会真的比对一遍）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(path.join(pkgRoot, rel), 'utf8')
// 去掉注释后再做"源码不得使用某 API"的断言，避免被说明文字误伤
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// ---------- 源码级回归断言（不依赖 dsh） ----------
test('engine declares the services it requires', () => {
  const src = read('lib/index.js')
  const m = /export const inject = \[([^\]]*)\]/.exec(src)
  assert.ok(m !== null, 'inject must be declared explicitly')
  const injected = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  assert.ok(
    injected.includes('webServer'),
    'webServer must be injected: without it ctx.get("webServer") can be undefined at activation, '
      + 'the /api/dperm routes never mount, and the settings page sees a "not found" JSON error',
  )
})

test('engine no longer depends on the removed settings API', () => {
  const code = stripComments(read('lib/index.js'))
  assert.ok(!code.includes('ctx.settings'), 'dsh >= 0.1.7 removed ctx.settings.register; rules are self-managed in JSON')
})

test('engine does not misuse connection.authorizeIndex on API routes', () => {
  const code = stripComments(read('lib/index.js'))
  assert.ok(
    !code.includes('authorizeIndex'),
    'authorizeIndex only handles the "/" index path and writes 303/401 itself; use connection.isAuthenticated for API routes',
  )
})

test('engine emits localized approval text through displayReason', () => {
  const code = stripComments(read('lib/index.js'))
  assert.ok(code.includes('displayReason'), 'ask prompts should use the localized displayReason channel')
  assert.ok(code.includes('askTexts'), 'expected the shared bilingual prompt helper')
  assert.ok(!code.includes('ctx.settings'), 'sanity: still self-managed state')
})

test('disabled rules use the "!" prefix convention', () => {
  const engine = stripComments(read('lib/index.js'))
  const client = stripComments(read('lib/client.js'))
  assert.ok(engine.includes("DISABLED_PREFIX = '!'"), 'engine must own the disabled-rule convention')
  assert.ok(client.includes("DISABLED_PREFIX = '!'"), 'client must agree with the engine on the convention')
  assert.ok(engine.includes('isDisabledRule('), 'engine filters disabled rules out of the prompt summary')
})

test('package manifest keeps the dual-face contract', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-permissions')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.exports['./package.json'], './package.json', 'client-modules resolves <pkg>/package.json; it must be exported')
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml', 'install_bundle requires a bundle patch')
  assert.equal(pkg.dsh.client.platform, 'web')
})

test('client bundle registers under the package name', () => {
  const src = read('lib/client.js')
  const pkg = JSON.parse(read('package.json'))
  const m = /__ModuleLoader__\.load\(\{\s*\n\s*id:\s*'([^']+)'/.exec(src)
  assert.ok(m !== null, 'client bundle must call window.__ModuleLoader__.load with a string id')
  assert.equal(m[1], pkg.name, 'the module id must equal the package name or the boot manifest will not resolve it')
})

test('client hooks stay above early returns', () => {
  const src = read('lib/client.js')
  // 只检查设置页组件体内（徽章组件是另一个函数，有自己的 hook 顶部）
  const start = src.indexOf('function PermissionsSettingsPage(')
  const end = src.indexOf('function PermissionsBadge(')
  assert.ok(start > 0 && end > start, 'expected both components to exist')
  const body = src.slice(start, end)
  const earlyReturn = body.indexOf("if (draft === null && loadError === '')")
  assert.ok(earlyReturn > 0, 'expected the loading early-return to exist')
  const after = body.slice(earlyReturn)
  for (const hook of ['React.useState(', 'React.useEffect(', 'React.useRef(', 'useSyncExternalStore(']) {
    assert.ok(!after.includes(hook), hook + ' must not appear after an early return inside the component body')
  }
})

// ---------- 针对已安装 dsh 的 API 令牌检查 ----------
function findDshRoots() {
  const roots = []
  const push = (p) => { if (p !== undefined && existsSync(p)) roots.push(p) }
  for (const env of [process.env.DSH_DIR, process.env.DSH_CHECKOUT]) push(env)

  // npx 缓存：<cache>/_npx/<hash>/node_modules/@deepseek-ai
  const caches = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'),
    path.join(homedir(), '.npm', '_npx'),
    path.join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx'),
  ].filter(Boolean)
  for (const cache of caches) {
    if (!existsSync(cache)) continue
    let entries = []
    try { entries = readdirSync(cache) } catch (e) { continue }
    for (const entry of entries) {
      const scope = path.join(cache, entry, 'node_modules', '@deepseek-ai')
      if (existsSync(path.join(scope, 'dsh-tools'))) roots.push(scope)
    }
  }

  try {
    const require = createRequire(path.join(pkgRoot, 'package.json'))
    const manifest = require.resolve('@deepseek-ai/dsh-tools/package.json')
    roots.push(path.dirname(path.dirname(manifest)))
  } catch (e) { /* 未安装 */ }

  return [...new Set(roots)]
}

const TEXT = /\.(js|mjs|cjs|ts|d\.ts|json)$/
function dirContains(dir, needle, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return false
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch (e) { return false }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'src') continue
      if (dirContains(full, needle, depth + 1)) return true
      continue
    }
    if (!TEXT.test(entry.name)) continue
    try { if (statSync(full).size > 4 * 1024 * 1024) continue } catch (e) { continue }
    try { if (readFileSync(full, 'utf8').includes(needle)) return true } catch (e) { /* ignore */ }
  }
  return false
}

const roots = findDshRoots()

test('dsh API surface still matches what the plugin uses', { skip: roots.length === 0 ? 'no dsh installation found (set DSH_DIR to compare)' : false }, async (t) => {
  const root = roots[0]
  t.diagnostic('comparing against ' + root)
  const checks = [
    ['dsh-tools', 'tools/pre-execute', 'the pre-execute waterfall the engine listens on'],
    ['dsh-tools', 'PreToolDecision', 'the decision union (allow/deny/ask)'],
    ['dsh-tools', "'deny'", 'deny variant'],
    ['dsh-user-approval', 'overrideOf', 'approval policy read (ask follows session policy)'],
    ['dsh-user-approval', 'displayReason', 'the localized prompt channel (ApprovalRequest.displayReason)'],
    ['dsh-user-approval', 'approval/request', 'the ask waterfall the session-grant responder hooks'],
    ['dsh-client-connection', 'isAuthenticated', 'the browser-auth check on /api/dperm routes'],
    ['dsh-host-webserver', 'register(route', 'route registration for /api/dperm'],
    ['dsh-workspace', 'resolveByPath', 'cwd to workspace resolution for per-workspace rules'],
    ['dsh-client-modules', '__ModuleLoader__', 'the client bundle loader'],
  ]
  const missing = []
  for (const [pkg, token, why] of checks) {
    const dir = path.join(root, pkg)
    if (!existsSync(dir)) { missing.push(pkg + ' is not installed'); continue }
    if (!dirContains(dir, token)) missing.push(pkg + ' no longer exposes ' + JSON.stringify(token) + ' (' + why + ')')
  }
  assert.deepEqual(missing, [], 'dsh API drift detected:\n  ' + missing.join('\n  '))
})
