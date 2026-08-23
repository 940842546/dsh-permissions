import z from '@deepseek-ai/schemastery'
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

  // ---------- 决策引擎（含审计环形缓冲） ----------
  const audit = []
  let auditSeq = 0
  function clipText(text) {
    const s = String(text === undefined || text === null ? '' : text)
    return s.length > 80 ? s.slice(0, 80) : s
  }
  function pushAudit(entry) {
    audit.push(Object.assign({ seq: ++auditSeq }, entry))
    if (audit.length > 200) audit.shift()
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
        try {
          const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
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
