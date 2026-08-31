import z from '@deepseek-ai/schemastery'
import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { ACTIONS, FILE_TOOLS, EMPTY, compileRule, mergeRules, primaryArgOf, normPath, matchPathPattern, candidateArgs, matchRule, evaluate } from './match.js'

export const name = 'permissions-engine'
export const inject = ['settings']

const DEFAULT_HARD = [
  'write(.ssh)', 'edit(.ssh)', 'write(.aws)', 'edit(.aws)',
  'write(.gnupg)', 'edit(.gnupg)', 'write(appdata)', 'edit(appdata)',
  'write(*.pem)', 'edit(*.pem)', 'write(*.key)', 'edit(*.key)',
  'write(*.env)', 'edit(*.env)', 'write(*.htpasswd)', 'edit(*.htpasswd)',
]
const DEFAULT_DENY = ['pwsh(rm -rf *)']
const DEFAULT_ASK = ['pwsh', 'edit', 'write']
const DEFAULT_ALLOW = ['read', 'glob', 'grep', 'web_search']

const RuleSet = z.object({
  hard: z.array(z.string()).description('永不允许（高于 full access，不可豁免）').default([]),
  deny: z.array(z.string()).description('不允许').default([]),
  ask: z.array(z.string()).description('每次询问').default([]),
  allow: z.array(z.string()).description('始终允许').default([]),
})
const Schema = z.object({
  enabled: z.boolean().description('启用权限规则引擎').default(true),
  hard: z.array(z.string()).description('永不允许（高于 full access，不可豁免）').default(DEFAULT_HARD),
  deny: z.array(z.string()).description('不允许').default(DEFAULT_DENY),
  ask: z.array(z.string()).description('每次询问（全访问 never 策略下自动放行）').default(DEFAULT_ASK),
  allow: z.array(z.string()).description('始终允许').default(DEFAULT_ALLOW),
  workspaces: z.dict(z.string(), RuleSet)
    .description('按 workspace 的规则（键为 workspace id，与全局规则合并判定）')
    .default({}),
})

// ---------- 规则编译/合并（前缀语义 + 通配符） ----------
function sourceLabel(source) {
  return source === 'global' ? 'global' : source.slice(0, 3) === 'ws:' ? 'workspace ' + source.slice(3) : source
}

// ---------- 模型可见的规则摘要（systemPrompt 段） ----------
function summaryText(current) {
  if (!current || !current.enabled) return ''
  const parts = []
  const push = (label, list) => {
    if (!list || list.length === 0) return
    parts.push(label + ': ' + list.slice(0, 8).join('; ') + (list.length > 8 ? '; …' : ''))
  }
  push('Hard', current.hard)
  push('Deny', current.deny)
  push('Ask', current.ask)
  push('Allow', current.allow)
  const ws = current.workspaces || {}
  for (const id of Object.keys(ws).slice(0, 3)) {
    const w = ws[id] || EMPTY
    push('Hard(ws:' + id + ')', w.hard)
    push('Deny(ws:' + id + ')', w.deny)
    push('Allow(ws:' + id + ')', w.allow)
  }
  if (parts.length === 0) return ''
  return '[active-permission-rules]\n' + parts.join('\n') + '\n优先级: hard > deny > ask > allow；hard 高于 full access，被拒的调用请勿重试。'
}

export function apply(ctx) {
  const scope = ctx.settings.register('dsh-permissions', Schema, { applies: 'live' })
  let current = scope.get()
  let rulesRev = 0
  const wsCache = new Map()
  // 编译缓存：按「作用域组合 + 规则修订号」缓存合并后的扁平规则表，
  // 避免每次工具调用都重编译全部规则（settings 变更时整体失效）。
  const mergedCache = new Map()
  ctx.effect(() => scope.watch((next) => {
    current = next
    rulesRev += 1
    wsCache.clear()
    mergedCache.clear()
  }))

  const workspaceRegistry = ctx.get('workspaceRegistry')
  const approval = ctx.get('approval')
  const systemPrompt = ctx.get('systemPrompt')

  // ---------- 会话授予（"本会话总是允许"） ----------
  // grants: sessionId -> Set<ruleKey>；pending: callId -> {resolve, tool, arg, rule, agent}
  const grants = new Map()
  const pendingAsks = new Map()
  const ASK_PREFIX = '[dsh-permissions-ask] '
  function grantKeyOf(rule) {
    return rule.source + '|' + rule.action + '|' + rule.raw
  }
  function hasGrant(agent, rule) {
    const sid = agent && agent.session ? String(agent.session.id) : ''
    const set = grants.get(sid)
    return set !== undefined && set.has(grantKeyOf(rule))
  }
  function addGrant(agent, rule) {
    const sid = agent && agent.session ? String(agent.session.id) : ''
    if (sid === '') return
    let set = grants.get(sid)
    if (set === undefined) { set = new Set(); grants.set(sid, set) }
    set.add(grantKeyOf(rule))
  }
  function grantsOfSession(sid) {
    const set = grants.get(sid)
    if (set === undefined) return []
    return [...set].map((key) => {
      const sep1 = key.indexOf('|')
      const sep2 = key.indexOf('|', sep1 + 1)
      return { source: key.slice(0, sep1), action: key.slice(sep1 + 1, sep2), raw: key.slice(sep2 + 1) }
    })
  }

  // 抢答器：拦截自家 ask 问询（reason 带 ASK_PREFIX），改走 /api/dperm/ask 的三选 UI
  if (approval !== undefined) {
    ctx.on('approval/request', (req, next) => {
      if (req.signal && req.signal.aborted) return next()
      if (typeof req.reason !== 'string' || !req.reason.startsWith(ASK_PREFIX)) return next()
      const callId = String(req.callId !== undefined ? req.callId : Math.random().toString(36).slice(2))
      return new Promise((resolve) => {
        pendingAsks.set(callId, { resolve, toolName: req.toolName, agent: req.agent, rule: req.reason.slice(ASK_PREFIX.length) })
        try { ctx.emit('dsh-permissions/ask-pending', callId) } catch (e) {}
      })
    }, { prepend: true })
  }

  function settleAsk(callId, choice) {
    const p = pendingAsks.get(callId)
    if (p === undefined) return false
    pendingAsks.delete(callId)
    if (choice === 'always') {
      // rule 字符串就是 grantKey 格式（source|action|raw 由引擎拼装传入 reason）
      const sid = p.agent && p.agent.session ? String(p.agent.session.id) : ''
      if (sid !== '') {
        let set = grants.get(sid)
        if (set === undefined) { set = new Set(); grants.set(sid, set) }
        set.add(p.rule)
      }
      p.resolve('allowed-once')
    } else if (choice === 'once') {
      p.resolve('allowed-once')
    } else {
      p.resolve('rejected')
    }
    return true
  }

  function getMerged(keys) {
    const key = keys.join('|')
    const hit = mergedCache.get(key)
    if (hit !== undefined && hit.rev === rulesRev) return hit.rules
    const ws = (current && current.workspaces) || {}
    const rules = mergeRules(keys.map((k) => ({
      source: k,
      set: k === 'global'
        ? { hard: current.hard || [], deny: current.deny || [], ask: current.ask || [], allow: current.allow || [] }
        : (ws[k.slice(3)] || EMPTY),
    })))
    mergedCache.set(key, { rev: rulesRev, rules })
    return rules
  }

  // ---------- 作用域解析（Workspace 实体字段是 id；SessionHeader.cwd 锚定） ----------
  async function resolveWorkspaceId(agent) {
    if (agent === undefined || agent === null) return undefined
    const sess = agent.session
    const cwd = sess && sess.header ? sess.header.cwd : undefined
    if (cwd === undefined || cwd === null || cwd === '') return undefined
    if (wsCache.has(cwd)) return wsCache.get(cwd)
    let id
    try {
      const ws = workspaceRegistry ? await workspaceRegistry.resolveByPath(cwd) : undefined
      id = ws && ws.id ? String(ws.id) : undefined
    } catch (e) { id = undefined }
    wsCache.set(cwd, id)
    return id
  }

  // ---------- 会话审批策略（仅 ask 跟随；hard/deny 永不受影响） ----------
  function effectivePolicy(agent) {
    if (approval === undefined) return 'ask'
    let policy
    try {
      const sess = agent && agent.session
      policy = sess ? approval.overrideOf(sess) : undefined
    } catch (e) { policy = undefined }
    if (policy !== undefined && policy !== null) return policy
    const cfg = approval.config
    return cfg && cfg.policy ? cfg.policy : 'ask'
  }

  // ---------- 决策引擎（含审计环形缓冲 + 规则命中计数 + JSONL 持久化） ----------
  const audit = []
  let auditSeq = 0
  const ruleHits = new Map() // key: source|action|raw → count
  const historyFile = path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'dsh-permissions-history.jsonl')
  function countHit(rule) {
    const key = rule.source + '|' + rule.action + '|' + rule.raw
    ruleHits.set(key, (ruleHits.get(key) || 0) + 1)
  }
  function clipText(text) {
    const s = String(text === undefined || text === null ? '' : text)
    return s.length > 80 ? s.slice(0, 80) : s
  }
  // 启动时重放历史尾部：恢复日志环 + 命中计数（异步，不阻塞启动）
  ;(async () => {
    try {
      const text = await readFile(historyFile, 'utf8')
      const lines = text.split('\n').filter((l) => l.trim() !== '')
      const tail = lines.slice(-200)
      for (const line of tail) {
        try {
          const e = JSON.parse(line)
          if (e.seq > auditSeq) auditSeq = e.seq
          audit.push(e)
          if (e.ruleRaw && e.decision && e.decision !== 'fallback' && e.decision !== 'engine-error') {
            // 重放命中计数：日志行带 ruleKey 时直接用；否则按 ruleRaw 反推（作用域不可知，归 global）
            const key = e.ruleKey || ('global|' + (e.decision === 'allow' ? 'allow' : e.decision === 'ask' ? 'ask' : e.decision) + '|' + e.ruleRaw)
            ruleHits.set(key, (ruleHits.get(key) || 0) + 1)
          }
        } catch (err) { /* 跳过坏行 */ }
      }
    } catch (e) { /* 文件不存在即首次启动 */ }
  })()
  let historyBytes = 0
  let trimScheduled = false
  function pushAudit(entry) {
    const full = Object.assign({ seq: ++auditSeq }, entry)
    audit.push(full)
    if (audit.length > 200) audit.shift()
    // 持久化：追加一行 JSON（含 ruleKey 供重放）；文件超 2MB 时截断为尾部 200 行
    const key = entry.ruleRaw !== undefined && entry.decision !== 'fallback' && entry.decision !== 'engine-error'
      ? ((entry.source !== 'none' && entry.source !== 'policy-never' && entry.source !== 'grant' ? entry.source : 'global') + '|' + (entry.decision === 'allow' ? 'allow' : entry.decision === 'ask' ? 'ask' : entry.decision) + '|' + entry.ruleRaw)
      : undefined
    const line = JSON.stringify(Object.assign({}, full, key !== undefined ? { ruleKey: key } : {})) + '\n'
    historyBytes += line.length
    appendFile(historyFile, line, 'utf8').catch(() => {})
    if (historyBytes > 2 * 1024 * 1024 && !trimScheduled) {
      trimScheduled = true
      ;(async () => {
        try {
          await mkdir(path.dirname(historyFile), { recursive: true })
          const keep = audit.map((e) => JSON.stringify(e) + '\n').join('')
          await writeFile(historyFile, keep, 'utf8')
          historyBytes = keep.length
        } catch (e) { /* 截断失败下次再试 */ }
        trimScheduled = false
      })()
    }
  }
  ctx.on('tools/pre-execute', async (exec, next) => {
    let tool = '?'
    try {
      tool = exec.name
      if (!current || !current.enabled) return next()
      if (exec.agent === undefined || exec.agent === null) return next()
      const arg = clipText(primaryArgOf(tool, exec.arguments))
      let wsId
      try { wsId = await resolveWorkspaceId(exec.agent) } catch (e) { wsId = undefined }
      const keys = wsId !== undefined ? ['global', 'ws:' + wsId] : ['global']
      const rule = evaluate(getMerged(keys), tool, exec.arguments)
      if (rule === undefined) {
        pushAudit({ tool, arg, decision: 'fallback', source: 'none' })
        return next()
      }
      countHit(rule)
      if (rule.action === 'hard') {
        pushAudit({ tool, arg, decision: 'hard', source: rule.source, ruleRaw: rule.raw })
        return { kind: 'deny', reason: '[dsh-permissions] hard-deny (above full access, not exemptable) [' + sourceLabel(rule.source) + ' · hard]: ' + rule.raw }
      }
      if (rule.action === 'deny') {
        pushAudit({ tool, arg, decision: 'deny', source: rule.source, ruleRaw: rule.raw })
        return { kind: 'deny', reason: '[dsh-permissions] denied by rule [' + sourceLabel(rule.source) + ' · deny]: ' + rule.raw }
      }
      if (rule.action === 'allow') {
        pushAudit({ tool, arg, decision: 'allow', source: rule.source, ruleRaw: rule.raw })
        return next()
      }
      if (effectivePolicy(exec.agent) === 'never') {
        pushAudit({ tool, arg, decision: 'allow', source: 'policy-never', ruleRaw: rule.raw })
        return next()
      }
      // 会话授予：本会话已"总是允许"过这条规则 → 直接放行
      if (hasGrant(exec.agent, rule)) {
        pushAudit({ tool, arg, decision: 'allow', source: 'grant', ruleRaw: rule.raw })
        return next()
      }
      // 走自定义三选审批（仅本次 / 本会话总是允许 / 拒绝）；approval 缺失则回退注册表 ask（fail closed）
      if (approval !== undefined) {
        pushAudit({ tool, arg, decision: 'ask', source: rule.source, ruleRaw: rule.raw })
        const outcome = await approval.request({
          agent: exec.agent,
          toolName: tool,
          callId: exec.callId,
          reason: ASK_PREFIX + grantKeyOf(rule),
          signal: exec.signal,
        })
        if (outcome === 'allowed-once') {
          pushAudit({ tool, arg, decision: 'allow', source: rule.source, ruleRaw: rule.raw })
          return next()
        }
        return { kind: 'deny', reason: '[dsh-permissions] user rejected ' + tool + ' (rule [' + sourceLabel(rule.source) + ' · ask]: ' + rule.raw + ')' }
      }
      pushAudit({ tool, arg, decision: 'ask', source: rule.source, ruleRaw: rule.raw })
      return { kind: 'ask', reason: '[dsh-permissions] rule requires confirmation [' + sourceLabel(rule.source) + ' · ask]: ' + rule.raw }
    } catch (err) {
      pushAudit({ tool, arg: '', decision: 'engine-error', source: 'none' })
      return next()
    }
  })

  if (systemPrompt !== undefined) {
    ctx.effect(() => systemPrompt.section({
      name: 'active-permission-rules',
      order: 108,
      text: () => summaryText(current),
    }))
  }

  // ---------- 设置页专用 HTTP 路由 ----------
  // api-proxy 的 settings.describe 只暴露硬编码白名单命名空间，自定义命名空间
  // 无法经官方 settings API 触达。引擎用自己持有的 SettingsScope 直读直写，
  // 通过自建路由 /api/dperm/* 服务自己的设置页（同源 fetch，无 CORS）。
  // 子路由：GET/POST /rules（读写规则）、GET /log（决策日志）、GET /match-test（试算器）。
  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/api/dperm',
      handler: async (req, res) => {
        const send = (code, body) => {
          res.writeHead(code, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache',
          })
          res.end(JSON.stringify(body))
        }
        // 浏览器认证（dsh ≥ 0.1.2-alpha.2）：connection.authorizeIndex 校验
        // cookie/token；未认证时它已接管响应（401/303），直接返回。
        // 旧版（rc.x）无 connection 服务或无此方法——放行（彼时无认证墙）。
        try {
          const connection = ctx.get('connection')
          if (connection !== undefined && typeof connection.authorizeIndex === 'function') {
            const okAuth = connection.authorizeIndex(req, res)
            if (!okAuth) return
          }
        } catch (e) { /* 认证检查异常不阻塞（保守：记录但继续） */ }
        try {
          const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
          if (pathname === '/api/dperm/ask' && req.method === 'GET') {
            const list = []
            for (const entry of pendingAsks) {
              list.push({ callId: entry[0], toolName: entry[1].toolName })
            }
            send(200, { ok: true, pending: list })
            return
          }
          if (pathname === '/api/dperm/ask/answer' && req.method === 'POST') {
            let raw = ''
            for await (const chunk of req) raw += chunk
            let body
            try {
              body = JSON.parse(raw)
            } catch (e) {
              send(400, { ok: false, error: 'invalid JSON body' })
              return
            }
            const ok = settleAsk(String(body.callId || ''), String(body.choice || ''))
            send(200, { ok })
            return
          }
          if (pathname === '/api/dperm/grants' && req.method === 'GET') {
            const q = new URL(req.url ?? '/', 'http://x').searchParams
            const sid = q.get('session')
            if (sid) {
              send(200, { ok: true, grants: grantsOfSession(sid) })
              return
            }
            // 无参数：列出全部会话的授予（含 sessionId）
            const all = []
            for (const entry of grants) {
              for (const g of grantsOfSession(entry[0])) {
                all.push(Object.assign({ sessionId: entry[0] }, g))
              }
            }
            send(200, { ok: true, grants: all })
            return
          }
          if (pathname === '/api/dperm/grants/revoke' && req.method === 'POST') {
            let raw = ''
            for await (const chunk of req) raw += chunk
            let body
            try {
              body = JSON.parse(raw)
            } catch (e) {
              send(400, { ok: false, error: 'invalid JSON body' })
              return
            }
            const sid = String(body.session || '')
            const key = String(body.key || '')
            const set = grants.get(sid)
            if (set !== undefined) {
              if (key === '') set.clear()
              else set.delete(key)
            }
            send(200, { ok: true })
            return
          }
          if (pathname === '/api/dperm/stats' && req.method === 'GET') {
            const hits = []
            for (const entry of ruleHits) {
              const [key, count] = entry
              const sep1 = key.indexOf('|')
              const sep2 = key.indexOf('|', sep1 + 1)
              hits.push({ source: key.slice(0, sep1), action: key.slice(sep1 + 1, sep2), raw: key.slice(sep2 + 1), count })
            }
            send(200, { ok: true, totalDecisions: auditSeq, hits })
            return
          }
          if (pathname === '/api/dperm/log' && req.method === 'GET') {
            const q = new URL(req.url ?? '/', 'http://x').searchParams
            const limit = Math.min(Number(q.get('limit')) || 60, 200)
            send(200, { ok: true, entries: audit.slice(-limit).reverse() })
            return
          }
          if (pathname === '/api/dperm/match-test' && req.method === 'GET') {
            const q = new URL(req.url ?? '/', 'http://x').searchParams
            const tool = String(q.get('tool') || '')
            const arg = String(q.get('arg') || '')
            const wsId = q.get('workspaceId')
            const keys = wsId ? ['global', 'ws:' + wsId] : ['global']
            const merged = getMerged(keys)
            const rule = evaluate(merged, tool, arg)
            send(200, {
              ok: true,
              outcome: rule ? rule.action : 'none',
              rule: rule ? { action: rule.action, raw: rule.raw, source: rule.source } : null,
              scopes: keys,
              mergedCount: merged.length,
            })
            return
          }
          if (pathname === '/api/dperm/rules') {
            if (req.method === 'GET') {
              send(200, { ok: true, value: scope.get() })
              return
            }
            if (req.method === 'POST') {
              let raw = ''
              for await (const chunk of req) raw += chunk
              let section
              try {
                section = JSON.parse(raw)
              } catch (e) {
                send(400, { ok: false, error: 'invalid JSON body' })
                return
              }
              if (section === null || typeof section !== 'object' || Array.isArray(section)) {
                send(400, { ok: false, error: 'body must be a JSON object' })
                return
              }
              await scope.replace(section)
              send(200, { ok: true, value: scope.get() })
              return
            }
          }
          send(404, { ok: false, error: 'not found' })
        } catch (e) {
          send(500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    }), 'dsh-permissions: rules route')
  }
}
