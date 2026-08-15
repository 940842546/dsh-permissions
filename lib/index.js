// dsh-permissions —— Claude 风格权限规则引擎（生产版，host 组合行）
// 持久化：设置命名空间 `dsh-permissions`（扁平 schema，客户端经 settingsScope 编辑，落盘跨重启）。
// 规则语义与动态原型 dperm-1/pkg-9 完全一致：
//   优先级 hard > deny > ask > allow；hard 高于 full access（never 策略）不被豁免；
//   ask 跟随会话审批策略（never 时放行）；路径工具支持片段/前缀/后缀/包含/多星通配。
import z from '@deepseek-ai/schemastery'

export const name = 'permissions-engine'
export const inject = ['settings']

const ACTIONS = ['hard', 'deny', 'ask', 'allow']
const FILE_TOOLS = ['read', 'write', 'edit', 'glob', 'grep', 'read_image']
const EMPTY = { hard: [], deny: [], ask: [], allow: [] }

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
function compileRule(raw) {
  const text = String(raw).trim()
  const m = /^([A-Za-z0-9_-]+)(?:\((.+)\))?$/.exec(text)
  if (!m) return { ok: false }
  const tool = m[1]
  const inner = m[2]
  let match
  if (inner !== undefined) {
    if (inner === '') return { ok: false }
    match = { value: inner }
  }
  return { ok: true, tool, match }
}
function mergeRules(scopes) {
  const out = []
  for (const action of ACTIONS) {
    for (const sc of scopes) {
      const rows = sc.set[action] || []
      for (let i = 0; i < rows.length; i++) {
        const c = compileRule(rows[i])
        if (c.ok) out.push({ action, tool: c.tool, match: c.match, source: sc.source, raw: String(rows[i]).trim(), index: i })
      }
    }
  }
  return out
}

// ---------- 参数提取（按工具语义字段，不依赖模型发参顺序） ----------
function primaryArgOf(tool, args) {
  if (args === undefined || args === null) return ''
  if (typeof args === 'string') return args
  if (Array.isArray(args)) return primaryArgOf(tool, args[0])
  if (typeof args !== 'object') return String(args)
  if (tool === 'pwsh') { const c = args.command; return typeof c === 'string' ? c : '' }
  if (tool === 'grep' || tool === 'glob') { const p = args.pattern; return typeof p === 'string' ? p : '' }
  if (FILE_TOOLS.includes(tool)) {
    const p = args.file_path !== undefined ? args.file_path : args.path
    if (typeof p === 'string') return p
  }
  for (const k of Object.keys(args)) {
    const v = args[k]
    if (typeof v === 'string') return v
  }
  return ''
}
function pathArgOf(args) {
  if (args === undefined || args === null || typeof args !== 'object' || Array.isArray(args)) return ''
  const v = args.path
  return typeof v === 'string' && v !== '' ? v : ''
}

// ---------- 路径匹配 ----------
function normPath(p) {
  let s = String(p).trim()
  if (s === '') return s
  s = s.replace(/\\/g, '/')
  while (s.includes('//')) s = s.replace(/\/\//g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s.toLowerCase()
}
function looksAbsolute(p) {
  return /^[a-z]:/i.test(p) || p.startsWith('/') || p.startsWith('~/')
}
function segMatch(c, p) {
  return c === p || c.startsWith(p + '/') || c.includes('/' + p + '/') || c.endsWith('/' + p)
}
// *x = 结尾；x* = 片段开头；*x* = 包含；多星按序分段；绝对路径按完整前缀（支持尾星）
function matchPathPattern(c, raw) {
  const t = raw.trim()
  if (t === '') return false
  if (t === '*') return true
  if (looksAbsolute(t)) return c.startsWith(normPath(t.replace(/\*$/, '')))
  if (t.includes('*')) {
    const parts = t.split('*')
    const nonEmpty = parts.filter((p) => p !== '')
    if (nonEmpty.length === 1 && t.endsWith('*') && !t.startsWith('*')) {
      return segMatch(c, normPath(t.slice(0, -1)))
    }
    let idx = 0
    let lastSeg = ''
    for (let i = 0; i < parts.length; i++) {
      const seg = normPath(parts[i])
      if (seg === '') continue
      if (i === 0) {
        if (!c.startsWith(seg)) return false
        idx = seg.length
      } else {
        const found = c.indexOf(seg, idx)
        if (found < 0) return false
        idx = found + seg.length
      }
      lastSeg = seg
    }
    if (lastSeg !== '' && !t.endsWith('*')) return c.endsWith(lastSeg)
    return true
  }
  return segMatch(c, normPath(t))
}
function candidateArgs(tool, args) {
  const first = primaryArgOf(tool, args)
  if (tool === 'grep') {
    const p = pathArgOf(args)
    if (p !== '' && p !== first) return [first, p]
  }
  return [first]
}
function matchRule(rule, tool, args) {
  if (rule.tool !== tool) return false
  if (rule.match === undefined) return true
  const isPathTool = FILE_TOOLS.includes(tool)
  const cands = candidateArgs(tool, args)
  for (const cand of cands) {
    if (isPathTool) {
      if (matchPathPattern(normPath(cand), rule.match.value)) return true
    } else {
      const v = rule.match.value.endsWith('*') ? rule.match.value.slice(0, -1) : rule.match.value
      if (v === '' || cand.startsWith(v)) return true
    }
  }
  return false
}
function evaluate(merged, tool, args) {
  for (const rule of merged) if (matchRule(rule, tool, args)) return rule
  return undefined
}
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
  const wsCache = new Map()
  ctx.effect(() => scope.watch((next) => {
    current = next
    wsCache.clear()
  }))

  const workspaceRegistry = ctx.get('workspaceRegistry')
  const approval = ctx.get('approval')
  const systemPrompt = ctx.get('systemPrompt')

  function getMerged(keys) {
    const ws = (current && current.workspaces) || {}
    return mergeRules(keys.map((k) => ({
      source: k,
      set: k === 'global'
        ? { hard: current.hard || [], deny: current.deny || [], ask: current.ask || [], allow: current.allow || [] }
        : (ws[k.slice(3)] || EMPTY),
    })))
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

  // ---------- 决策引擎 ----------
  ctx.on('tools/pre-execute', async (exec, next) => {
    let tool = '?'
    try {
      tool = exec.name
      if (!current || !current.enabled) return next()
      if (exec.agent === undefined || exec.agent === null) return next()
      let wsId
      try { wsId = await resolveWorkspaceId(exec.agent) } catch (e) { wsId = undefined }
      const keys = wsId !== undefined ? ['global', 'ws:' + wsId] : ['global']
      const rule = evaluate(getMerged(keys), tool, exec.arguments)
      if (rule === undefined) return next()
      if (rule.action === 'hard') {
        return { kind: 'deny', reason: '硬规则拒绝（高于 full access，不可豁免）[' + sourceLabel(rule.source) + ' · hard]: ' + rule.raw }
      }
      if (rule.action === 'deny') {
        return { kind: 'deny', reason: '权限规则拒绝 [' + sourceLabel(rule.source) + ' · deny]: ' + rule.raw }
      }
      if (rule.action === 'allow') return next()
      if (effectivePolicy(exec.agent) === 'never') return next()
      return { kind: 'ask', reason: '权限规则要求确认 [' + sourceLabel(rule.source) + ' · ask]: ' + rule.raw }
    } catch (err) {
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
  // 通过自建路由 /api/dperm/rules 服务自己的设置页（同源 fetch，无 CORS）。
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
          send(405, { ok: false, error: 'method not allowed' })
        } catch (e) {
          send(500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      },
    }), 'dsh-permissions: rules route')
  }
}
