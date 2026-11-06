// 集成测试：用 fake Cordis context 驱动真实引擎，覆盖路由挂载、请求处理、监听器接线。
// 与 match.test.mjs（纯函数单测）互补——这里的缺陷（inject 缺失导致路由没挂、校验缺失、
// 非原子写、幽灵待确认项）单测抓不到。
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, access, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const engineUrl = new URL('../lib/index.js', import.meta.url).href
const cleanups = []
after(async () => {
  for (const dir of cleanups) {
    try { await rm(dir, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  }
})

// ---------- fake harness ----------
function makeRes() {
  return {
    statusCode: 0,
    body: '',
    headers: {},
    writeHead(code, headers) {
      this.statusCode = code
      if (headers !== undefined) this.headers = headers
      return this
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk)
    },
  }
}

function makeReq(method, url, body) {
  const req = { method, url, headers: {} }
  req[Symbol.asyncIterator] = async function* () {
    if (body !== undefined) yield Buffer.from(body, 'utf8')
  }
  return req
}

const AGENT = { session: { id: 'session-1', header: { cwd: 'C:/work' } } }

/**
 * Boot a fresh engine instance against a fake context and an isolated DSH_HOME.
 * @returns route table, captured listeners, and a request helper.
 */
async function boot(options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dperm-itest-'))
  cleanups.push(dir)
  process.env.DSH_HOME = dir

  const routes = []
  const listeners = new Map()
  const sections = []
  const webServer = { register: (route) => { routes.push(route); return () => {} } }
  const approvalListeners = []
  let approvalCalls = 0
  let lastApprovalRequest
  const approval = options.noApproval ? undefined : {
    config: { policy: options.policy ?? 'ask' },
    overrideOf: () => undefined,
    request: async (req) => {
      approvalCalls += 1
      lastApprovalRequest = req
      return options.approvalOutcome ?? 'allowed-once'
    },
  }
  const ctx = {
    get(name) {
      if (name === 'webServer') return webServer
      if (name === 'approval') return approval
      if (name === 'systemPrompt') return { section: (s) => { sections.push(s); return () => {} } }
      if (name === 'workspaceRegistry') {
        if (options.noWorkspaceRegistry) return undefined
        return {
          resolveByPath: async () => undefined,
          list: () => options.workspaces ?? [{ id: 'ws-1', title: 'demo' }, { id: 'ws-2', title: 'other' }],
        }
      }
      if (name === 'connection') return { isAuthenticated: () => options.authenticated !== false }
      return undefined
    },
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, [])
      listeners.get(name).push(listener)
      if (name === 'approval/request') approvalListeners.push(listener)
      return () => {}
    },
    effect(fn, label) {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    emit() {},
  }

  const mod = await import(engineUrl)
  mod.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 30))

  const route = routes.find((r) => r.path === '/api/dperm')
  assert.ok(route !== undefined, 'engine must register the /api/dperm prefix route')
  assert.equal(route.kind, 'prefix')

  async function call(method, url, body) {
    const res = makeRes()
    await route.handler(makeReq(method, url, body === undefined ? undefined : JSON.stringify(body)), res)
    let json
    try { json = JSON.parse(res.body) } catch (e) { json = undefined }
    return { status: res.statusCode, json, raw: res.body }
  }

  async function gate(exec, nextResult = { kind: 'allow' }) {
    const list = listeners.get('tools/pre-execute') ?? []
    assert.ok(list.length > 0, 'engine must register a tools/pre-execute listener')
    let delegated = false
    const decision = await list[0](exec, async () => { delegated = true; return nextResult })
    return { decision, delegated }
  }

  return {
    dir, routes, listeners, approvalListeners, sections, call, gate,
    get approvalCalls() { return approvalCalls },
    get lastApprovalRequest() { return lastApprovalRequest },
    statePath: path.join(dir, 'dsh-permissions-state.json'),
    historyPath: path.join(dir, 'dsh-permissions-history.jsonl'),
  }
}

// ---------- route mounting ----------
test('registers exactly one /api/dperm prefix route', async () => {
  const app = await boot()
  const ours = app.routes.filter((r) => r.path === '/api/dperm')
  assert.equal(ours.length, 1)
})

test('registers pre-execute, ask-responder and prompt sections', async () => {
  const app = await boot()
  assert.ok((app.listeners.get('tools/pre-execute') ?? []).length >= 1)
  assert.equal(app.approvalListeners.length, 1, 'session-grant ask responder must be registered')
  assert.ok(app.sections.some((s) => s.name === 'active-permission-rules'))
})

// ---------- rules route ----------
test('GET /rules returns the default rule set', async () => {
  const app = await boot()
  const { status, json } = await app.call('GET', '/api/dperm/rules')
  assert.equal(status, 200)
  assert.equal(json.ok, true)
  assert.equal(json.value.enabled, true)
  assert.equal(json.value.hard.length, 16)
  assert.deepEqual(json.value.deny, ['pwsh(rm -rf *)'])
})

test('POST /rules merges partial bodies over defaults (does not empty rules)', async () => {
  const app = await boot()
  const { status, json } = await app.call('POST', '/api/dperm/rules', { enabled: false })
  assert.equal(status, 200)
  assert.equal(json.value.enabled, false)
  assert.equal(json.value.hard.length, 16, 'omitted fields keep defaults instead of being wiped')
  assert.equal(json.value.deny.length, 1)
})

test('POST /rules persists atomically and leaves valid JSON', async () => {
  const app = await boot()
  await app.call('POST', '/api/dperm/rules', { enabled: true, hard: ['write(.ssh)'] })
  await app.call('POST', '/api/dperm/rules', { enabled: true, hard: ['write(.ssh)', 'edit(.ssh)'] })
  const text = await readFile(app.statePath, 'utf8')
  const parsed = JSON.parse(text)
  assert.deepEqual(parsed.hard, ['write(.ssh)', 'edit(.ssh)'])
  // 第二次保存应留下上一版备份
  await access(app.statePath + '.bak')
  // 所有临时文件都应已 rename 掉，不留残渣
  const leftovers = (await readdir(app.dir)).filter((f) => f.startsWith('dsh-permissions-state.json.tmp'))
  assert.deepEqual(leftovers, [], 'temporary files must not be left behind')
})

test('concurrent saves serialize without corrupting the file', async () => {
  const app = await boot()
  await Promise.all([
    app.call('POST', '/api/dperm/rules', { enabled: true, hard: ['write(a)'] }),
    app.call('POST', '/api/dperm/rules', { enabled: true, hard: ['write(b)'] }),
    app.call('POST', '/api/dperm/rules', { enabled: true, hard: ['write(c)'] }),
  ])
  const parsed = JSON.parse(await readFile(app.statePath, 'utf8'))
  assert.equal(parsed.hard.length, 1, 'each save is a whole section; the last one wins')
  assert.ok(['write(a)', 'write(b)', 'write(c)'].includes(parsed.hard[0]))
  const leftovers = (await readdir(app.dir)).filter((f) => f.startsWith('dsh-permissions-state.json.tmp'))
  assert.deepEqual(leftovers, [], 'concurrent saves must not leave temporary files')
})

test('POST /rules rejects malformed field types with 400', async () => {
  const app = await boot()
  const cases = [
    { body: { hard: 'abc' }, hint: 'hard' },
    { body: { deny: [1, 2] }, hint: 'deny' },
    { body: { enabled: 'yes' }, hint: 'enabled' },
    { body: { workspaces: { w1: { ask: 'x' } } }, hint: 'workspaces.w1.ask' },
    { body: [], hint: 'JSON object' },
  ]
  for (const c of cases) {
    const { status, json } = await app.call('POST', '/api/dperm/rules', c.body)
    assert.equal(status, 400, 'expected 400 for ' + JSON.stringify(c.body))
    assert.ok(json.error.includes(c.hint), 'error should name ' + c.hint + ', got: ' + json.error)
  }
})

// ---------- matcher / diagnostics routes ----------
test('GET /match-test reports the winning rule', async () => {
  const app = await boot()
  const deny = await app.call('GET', '/api/dperm/match-test?tool=pwsh&arg=' + encodeURIComponent('rm -rf /tmp/x'))
  assert.equal(deny.json.outcome, 'deny')
  assert.equal(deny.json.rule.raw, 'pwsh(rm -rf *)')
  const hard = await app.call('GET', '/api/dperm/match-test?tool=write&arg=' + encodeURIComponent('C:/Users/u/.ssh/id_rsa'))
  assert.equal(hard.json.outcome, 'hard')
  const allowed = await app.call('GET', '/api/dperm/match-test?tool=read&arg=' + encodeURIComponent('C:/docs/a.md'))
  assert.equal(allowed.json.outcome, 'allow')
  const none = await app.call('GET', '/api/dperm/match-test?tool=read_image&arg=' + encodeURIComponent('C:/p/x.png'))
  assert.equal(none.json.outcome, 'none')
})

test('GET /log, /stats, /grants respond with ok payloads', async () => {
  const app = await boot()
  for (const p of ['/api/dperm/log', '/api/dperm/stats', '/api/dperm/grants']) {
    const r = await app.call('GET', p)
    assert.equal(r.status, 200, p)
    assert.equal(r.json.ok, true, p)
  }
})

test('GET /workspaces lists id/title pairs from the registry', async () => {
  const app = await boot()
  const r = await app.call('GET', '/api/dperm/workspaces')
  assert.equal(r.status, 200)
  assert.equal(r.json.ok, true)
  assert.deepEqual(r.json.workspaces, [{ id: 'ws-1', title: 'demo' }, { id: 'ws-2', title: 'other' }])
})

test('GET /workspaces degrades to an empty list without a registry', async () => {
  const app = await boot({ workspaces: null, noWorkspaceRegistry: true })
  const r = await app.call('GET', '/api/dperm/workspaces')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.workspaces, [])
})

test('unknown sub-path is 404', async () => {
  const app = await boot()
  const r = await app.call('GET', '/api/dperm/nope')
  assert.equal(r.status, 404)
})

// ---------- auth wall ----------
test('unauthenticated requests are refused with 401 when connection reports so', async () => {
  const app = await boot({ authenticated: false })
  const r = await app.call('GET', '/api/dperm/rules')
  assert.equal(r.status, 401)
  assert.equal(r.json.ok, false)
})

// ---------- pre-execute gate ----------
test('pre-execute denies a hard/deny match, including whitespace and case variants', async () => {
  const app = await boot()
  const deny = await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  assert.equal(deny.decision.kind, 'deny')
  assert.equal(deny.delegated, false)
  assert.ok(deny.decision.reason.includes('[global · deny]'))

  const hard = await app.gate({ name: 'write', arguments: { file_path: 'C:/Users/u/.ssh/id_rsa' }, agent: AGENT })
  assert.equal(hard.decision.kind, 'deny')
  assert.ok(hard.decision.reason.includes('hard-deny'))

  const squashed = await app.gate({ name: 'pwsh', arguments: { command: 'RM   -rf\t/tmp/x' }, agent: AGENT })
  assert.equal(squashed.decision.kind, 'deny', 'case + whitespace variants must still match')
})

test('pre-execute delegates allow and unmatched calls', async () => {
  const app = await boot()
  const allowed = await app.gate({ name: 'read', arguments: { file_path: 'C:/docs/a.md' }, agent: AGENT })
  assert.equal(allowed.delegated, true)
  assert.equal(allowed.decision.kind, 'allow')

  const unmatched = await app.gate({ name: 'read_image', arguments: { file_path: 'C:/p/x.png' }, agent: AGENT })
  assert.equal(unmatched.delegated, true)
})

test('ask rules consult approval; without approval they surface as an ask decision', async () => {
  // 有 approval：引擎自己发起审批，允许后放行（不返回 ask 决策）
  const asking = await boot()
  const asked = await asking.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  assert.equal(asked.delegated, true)
  assert.equal(asking.approvalCalls, 1, 'ask rule must go through approval')

  // 无 approval：fail-closed 交给注册表的 ask 管线
  const bare = await boot({ noApproval: true })
  const surfaced = await bare.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  assert.equal(surfaced.decision.kind, 'ask')
  assert.ok(surfaced.decision.reason.includes('[global · ask]'))
})

test('ask rules pass straight through under the never policy without prompting', async () => {
  const fullAccess = await boot({ policy: 'never' })
  const passed = await fullAccess.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  assert.equal(passed.delegated, true, 'ask rules auto-pass under the never policy')
  assert.equal(fullAccess.approvalCalls, 0, 'never policy must not raise a prompt')
})

test('pre-execute denies when approval rejects', async () => {
  const app = await boot({ approvalOutcome: 'rejected' })
  const r = await app.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  assert.equal(r.decision.kind, 'deny')
  assert.ok(r.decision.reason.includes('user rejected'))
})

test('engine disabled means full transparency', async () => {
  const app = await boot()
  await app.call('POST', '/api/dperm/rules', { enabled: false })
  const r = await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  assert.equal(r.delegated, true, 'disabled engine must never block')
})

// ---------- session grants ----------
test('session grants: always-allow records a grant and later calls bypass the prompt', async () => {
  const app = await boot()
  const controller = new AbortController()
  const responder = app.approvalListeners[0]
  const parked = responder(
    { toolName: 'pwsh', callId: 'call-1', agent: AGENT, signal: controller.signal, reason: '[dsh-permissions-ask] global|ask|pwsh' },
    () => 'unavailable',
  )

  const pending = await app.call('GET', '/api/dperm/ask')
  assert.equal(pending.json.pending.length, 1)
  assert.equal(pending.json.pending[0].callId, 'call-1')

  const answered = await app.call('POST', '/api/dperm/ask/answer', { callId: 'call-1', choice: 'always' })
  assert.equal(answered.json.ok, true)
  assert.equal(await parked, 'allowed-once', 'always-allow settles as a one-time grant')

  const grants = await app.call('GET', '/api/dperm/grants')
  assert.equal(grants.json.grants.length, 1)
  assert.equal(grants.json.grants[0].raw, 'pwsh')

  // 授予生效后，ask 规则不再询问（approval 计数不增加）
  const callsBefore = app.approvalCalls
  const after = await app.gate({ name: 'pwsh', arguments: { command: 'echo again' }, agent: AGENT })
  assert.equal(after.delegated, true, 'granted session should pass without asking')
  assert.equal(app.approvalCalls, callsBefore, 'a granted rule must not raise a new prompt')

  // 撤销后重新开始询问
  await app.call('POST', '/api/dperm/grants/revoke', { session: 'session-1', key: 'global|ask|pwsh' })
  const revoked = await app.gate({ name: 'pwsh', arguments: { command: 'echo third' }, agent: AGENT })
  assert.equal(revoked.delegated, true)
  assert.equal(app.approvalCalls, callsBefore + 1, 'revoked grant must prompt again')
})

test('pending asks are cleared when the call is aborted (no phantom prompts)', async () => {
  const app = await boot()
  const controller = new AbortController()
  const parked = app.approvalListeners[0](
    { toolName: 'edit', callId: 'call-abort', agent: AGENT, signal: controller.signal, reason: '[dsh-permissions-ask] global|ask|edit' },
    () => 'unavailable',
  )
  assert.equal((await app.call('GET', '/api/dperm/ask')).json.pending.length, 1)

  controller.abort()
  assert.equal(await parked, 'cancelled')
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal((await app.call('GET', '/api/dperm/ask')).json.pending.length, 0, 'aborted ask must not linger')
})

test('rejecting an ask settles as rejected and records no grant', async () => {
  const app = await boot()
  const parked = app.approvalListeners[0](
    { toolName: 'edit', callId: 'call-reject', agent: AGENT, reason: '[dsh-permissions-ask] global|ask|edit' },
    () => 'unavailable',
  )
  await app.call('POST', '/api/dperm/ask/answer', { callId: 'call-reject', choice: 'deny' })
  assert.equal(await parked, 'rejected')
  assert.equal((await app.call('GET', '/api/dperm/grants')).json.grants.length, 0)
})

// ---------- disabled rules ('!' prefix) ----------
test('disabled rules are inert but preserved in the draft', async () => {
  const app = await boot()
  const posted = await app.call('POST', '/api/dperm/rules', {
    enabled: true,
    deny: ['!pwsh(rm -rf *)'],
    hard: ['!write(.ssh)'],
    ask: ['!pwsh', '!edit', '!write'],
    allow: [],
  })
  assert.equal(posted.status, 200)
  assert.deepEqual(posted.json.value.deny, ['!pwsh(rm -rf *)'], 'disabled rules stay in storage')

  // 匹配层面完全跳过
  const deny = await app.call('GET', '/api/dperm/match-test?tool=pwsh&arg=' + encodeURIComponent('rm -rf /tmp/x'))
  assert.equal(deny.json.outcome, 'none', 'a disabled deny rule must not match')
  const hard = await app.call('GET', '/api/dperm/match-test?tool=write&arg=' + encodeURIComponent('C:/u/.ssh/id_rsa'))
  assert.equal(hard.json.outcome, 'none', 'a disabled hard rule must not match')

  // 执行层面也放行
  const gate = await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  assert.equal(gate.delegated, true, 'disabled rules never block')
})

test('re-enabling a rule makes it match again', async () => {
  const app = await boot()
  await app.call('POST', '/api/dperm/rules', { enabled: true, deny: ['!pwsh(rm -rf *)'] })
  const off = await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  assert.equal(off.delegated, true)

  await app.call('POST', '/api/dperm/rules', { enabled: true, deny: ['pwsh(rm -rf *)'] })
  const on = await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  assert.equal(on.decision.kind, 'deny')
})

// ---------- localized approval text ----------
test('ask carries a bilingual displayReason', async () => {
  const app = await boot({ noApproval: true })
  const r = await app.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  assert.equal(r.decision.kind, 'ask')
  assert.ok(r.decision.displayReason !== undefined, 'ask decision must carry displayReason for the UI')
  assert.ok(r.decision.displayReason.en.includes('requires confirmation'))
  assert.ok(r.decision.displayReason.zh.includes('要求确认'))
})

test('the approval request carries displayReason while reason keeps the internal marker', async () => {
  const app = await boot()
  await app.gate({ name: 'pwsh', arguments: { command: 'echo hi' }, agent: AGENT })
  const seen = app.lastApprovalRequest
  assert.ok(seen !== undefined, 'engine must call approval.request for ask rules')
  assert.ok(seen.reason.startsWith('[dsh-permissions-ask] '), 'reason keeps the marker so our responder claims it')
  assert.ok(seen.displayReason !== undefined, 'approval prompt text must go through the localized channel')
  assert.ok(seen.displayReason.en.includes('requires confirmation'))
  assert.ok(seen.displayReason.zh.includes('要求确认'))
})

// ---------- decision log ----------
test('decisions are appended to the history file', async () => {
  const app = await boot()
  await app.gate({ name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: AGENT })
  await new Promise((resolve) => setTimeout(resolve, 30))
  const text = await readFile(app.historyPath, 'utf8')
  const lines = text.trim().split('\n').filter(Boolean)
  assert.ok(lines.length >= 1)
  const first = JSON.parse(lines[0])
  assert.equal(first.decision, 'deny')
  assert.equal(first.tool, 'pwsh')
})
