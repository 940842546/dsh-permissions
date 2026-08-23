// dsh-permissions 匹配器单元测试（node:test，零依赖）
// 运行：node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compileRule, mergeRules, primaryArgOf, normPath, matchPathPattern,
  candidateArgs, matchRule, evaluate, evaluateScopes,
} from '../lib/match.js'

const R = (raw) => { const c = compileRule(raw); assert.ok(c.ok, raw); return c }

// ---------- compileRule ----------
test('compileRule: bare tool name', () => {
  const c = compileRule('pwsh')
  assert.equal(c.tool, 'pwsh')
  assert.equal(c.match, undefined)
})
test('compileRule: prefix pattern', () => {
  const c = compileRule('pwsh(npm run)')
  assert.equal(c.tool, 'pwsh')
  assert.equal(c.match.value, 'npm run')
})
test('compileRule: trailing star preserved', () => {
  const c = compileRule('pwsh(rm -rf *)')
  assert.equal(c.match.value, 'rm -rf *')
})
test('compileRule: empty pattern is invalid', () => {
  assert.equal(compileRule('write()').ok, false)
})
test('compileRule: non-identifier is invalid', () => {
  assert.equal(compileRule('读取 文件').ok, false)
  assert.equal(compileRule('wri te(x)').ok, false)
  assert.equal(compileRule('').ok, false)
  // 注意：write(a)(b) 是"合法"的——整个 a)(b 被当作模式串（宽松语法，引擎历史行为）
  const c = compileRule('write(a)(b)')
  assert.equal(c.ok, true)
  assert.equal(c.match.value, 'a)(b')
})

// ---------- primaryArgOf（语义字段提取，不依赖键顺序） ----------
test('primaryArgOf: write uses file_path even when content comes first', () => {
  const args = { content: 'should never reach matching', file_path: 'C:\\x\\k.pem' }
  assert.equal(primaryArgOf('write', args), 'C:\\x\\k.pem')
})
test('primaryArgOf: pwsh uses command', () => {
  assert.equal(primaryArgOf('pwsh', { timeoutMs: 5000, command: 'rm -rf /tmp' }), 'rm -rf /tmp')
})
test('primaryArgOf: grep/glob use pattern', () => {
  assert.equal(primaryArgOf('grep', { pattern: 'TODO', path: 'C:\\src' }), 'TODO')
  assert.equal(primaryArgOf('glob', { pattern: '**/*.pem' }), '**/*.pem')
})
test('primaryArgOf: first string scalar fallback', () => {
  assert.equal(primaryArgOf('subagent', { prompt: '研究一下', x: 1 }), '研究一下')
})

// ---------- 命令匹配：大小写 + 空白归一 ----------
test('command match is case-insensitive', () => {
  const rule = R('pwsh(Remove-Item -Recurse)')
  assert.ok(matchRule({ ...rule, tool: 'pwsh' }, 'pwsh', { command: 'remove-item -recurse x' }))
  assert.ok(matchRule({ ...rule, tool: 'pwsh' }, 'pwsh', { command: 'REMOVE-ITEM -RECURSE' }))
})
test('command match squashes whitespace', () => {
  const rule = { tool: 'pwsh', match: { value: 'rm -rf ' } }
  assert.ok(matchRule(rule, 'pwsh', { command: 'rm   -rf\t/tmp' }))
  assert.ok(matchRule(rule, 'pwsh', { command: '  rm -rf /tmp' }) === false)
})
test('command prefix mismatch does not hit', () => {
  const rule = { tool: 'pwsh', match: { value: 'npm run' } }
  assert.equal(matchRule(rule, 'pwsh', { command: 'git status' }), false)
})

// ---------- 路径匹配 ----------
test('path: segment matches anywhere (case/slash normalized)', () => {
  const rule = { tool: 'write', match: { value: '.ssh' } }
  assert.ok(matchRule(rule, 'write', { file_path: 'C:\\Users\\Me\\.ssh\\id_rsa' }))
  assert.ok(matchRule(rule, 'write', { file_path: '/home/u/.SSH/config' }))
  assert.equal(matchRule(rule, 'write', { file_path: 'C:\\ssh-notes.txt' }), false)
})
test('path: appdata segment matches real AppData', () => {
  const rule = { tool: 'write', match: { value: 'appdata' } }
  assert.ok(matchRule(rule, 'write', { file_path: 'C:\\Users\\rika\\AppData\\Local\\Temp\\x' }))
})
test('path: suffix wildcard *.pem', () => {
  const rule = { tool: 'write', match: { value: '*.pem' } }
  assert.ok(matchRule(rule, 'write', { file_path: 'D:\\keys\\server-key.pem' }))
  assert.equal(matchRule(rule, 'write', { file_path: 'D:\\keys\\readme.md' }), false)
})
test('path: contains wildcard *secret*', () => {
  const rule = { tool: 'write', match: { value: '*secret*' } }
  assert.ok(matchRule(rule, 'write', { file_path: 'C:\\proj\\my-secret-file.txt' }))
  assert.equal(matchRule(rule, 'write', { file_path: 'C:\\proj\\file.txt' }), false)
})
test('path: absolute prefix (trailing star optional)', () => {
  const rule = { tool: 'write', match: { value: 'C:\\Users\\rika\\*' } }
  assert.ok(matchRule(rule, 'write', { file_path: 'C:\\Users\\rika\\docs\\a.md' }))
  assert.equal(matchRule(rule, 'write', { file_path: 'C:\\Users\\other\\a.md' }), false)
  // 分段语义：c:/users/* 不会误匹配 c:/users-evil/...（段边界更严）
  const strict = { tool: 'write', match: { value: 'c:/users/*' } }
  assert.equal(matchRule(strict, 'write', { file_path: 'C:\\users-evil\\x' }), false)
  const rule2 = { tool: 'write', match: { value: '/var/log' } }
  assert.ok(matchRule(rule2, 'write', { file_path: '/var/log/syslog' }))
})
test('path: multi-star ordered segments', () => {
  // 绝对路径 + 中间星：统一走分段匹配（v1.1.0 起，之前中间星被当字面量）
  const rule = { tool: 'read', match: { value: 'c:/users/*/.ssh/*' } }
  assert.ok(matchRule(rule, 'read', { file_path: 'C:\\Users\\bob\\.ssh\\id_rsa' }))
  assert.equal(matchRule(rule, 'read', { file_path: 'C:\\Users\\bob\\docs\\id_rsa' }), false)
})
test('path: bare star matches everything', () => {
  assert.ok(matchPathPattern(normPath('a/b/c'), '*'))
})
test('path: empty pattern never matches', () => {
  assert.equal(matchPathPattern('x', ''), false)
})

// ---------- grep 双参数 ----------
test('grep matches pattern and path', () => {
  // grep 在 FILE_TOOLS 里：pattern 与 path 两个候选都按路径语义匹配（段/通配）
  const byPattern = { tool: 'grep', match: { value: 'TODO' } }  // 精确段 === 匹配
  assert.ok(matchRule(byPattern, 'grep', { pattern: 'TODO', path: 'C:\\src' }))
  assert.equal(matchRule(byPattern, 'grep', { pattern: 'TODOO', path: 'C:\\src' }), false)
  // .env 是完整段匹配（.env.local 是不同段名，不命中——要用 *.env* 或 *env* 才中）
  const byPath = { tool: 'grep', match: { value: '.env' } }
  assert.ok(matchRule(byPath, 'grep', { pattern: 'apikey', path: 'C:\\proj\\.env\\settings' }))
  assert.equal(matchRule(byPath, 'grep', { pattern: 'apikey', path: 'C:\\proj\\.env.local' }), false)
})

// ---------- 合并优先级 ----------
test('merge order: hard > deny > ask > allow', () => {
  const scopes = [{ source: 'global', set: { hard: [], deny: [], ask: ['pwsh'], allow: ['pwsh(git)'] } }]
  const merged = mergeRules(scopes)
  assert.equal(merged.length, 2)
  assert.equal(merged[0].action, 'ask')
  assert.equal(merged[1].action, 'allow')
})
test('evaluate: deny beats allow via merge order', () => {
  const scopes = [{ source: 'global', set: { hard: [], deny: ['write(*.key)'], ask: [], allow: ['write'] } }]
  const hit = evaluateScopes(scopes, 'write', { file_path: 'a.key' })
  assert.equal(hit.action, 'deny')
})
test('merge: workspace rules stack after global, invalid rows skipped', () => {
  const merged = mergeRules([
    { source: 'global', set: { hard: ['write(.ssh)'], deny: [], ask: [], allow: [] } },
    { source: 'ws:x', set: { hard: ['write()'], deny: ['pwsh'], ask: [], allow: [] } },
  ])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].raw, 'write(.ssh)')
  assert.equal(merged[1].raw, 'pwsh')
})

// ---------- 回归：历史 bug 场景 ----------
test('regression: write content-first key order still matches path rule', () => {
  const rule = { tool: 'write', match: { value: 'appdata' } }
  assert.ok(matchRule(rule, 'write', { content: 'x', file_path: 'C:\\Users\\u\\AppData\\Local\\t' }))
})
test('regression: workspace entity id vs name irrelevant to matching', () => {
  // 作用域键只是字符串，匹配器不关心 workspace 标识形态
  const scopes = [{ source: 'ws:anything', set: { hard: [], deny: [], ask: [], allow: ['read'] } }]
  assert.equal(evaluateScopes(scopes, 'read', { file_path: 'x' }).action, 'allow')
})
