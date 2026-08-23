// dsh-permissions/match —— 规则匹配纯函数（无依赖，宿主与测试共用）

export const ACTIONS = ['hard', 'deny', 'ask', 'allow']
export const FILE_TOOLS = ['read', 'write', 'edit', 'glob', 'grep', 'read_image']
export const EMPTY = { hard: [], deny: [], ask: [], allow: [] }

// ---------- 规则编译/合并（前缀语义 + 通配符） ----------
export function compileRule(raw) {
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

export function mergeRules(scopes) {
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
export function primaryArgOf(tool, args) {
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

export function pathArgOf(args) {
  if (args === undefined || args === null || typeof args !== 'object' || Array.isArray(args)) return ''
  const v = args.path
  return typeof v === 'string' && v !== '' ? v : ''
}

// ---------- 路径匹配 ----------
export function normPath(p) {
  let s = String(p).trim()
  if (s === '') return s
  s = s.replace(/\\/g, '/')
  while (s.includes('//')) s = s.replace(/\/\//g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s.toLowerCase()
}

export function looksAbsolute(p) {
  return /^[a-z]:/i.test(p) || p.startsWith('/') || p.startsWith('~/')
}

export function segMatch(c, p) {
  return c === p || c.startsWith(p + '/') || c.includes('/' + p + '/') || c.endsWith('/' + p)
}

// *x = 结尾；x* = 片段开头；*x* = 包含；多星按序分段；绝对路径按完整前缀（支持尾星与中间星）
export function matchPathPattern(c, raw) {
  const t = raw.trim()
  if (t === '') return false
  if (t === '*') return true
  if (looksAbsolute(t) && !t.includes('*')) return c.startsWith(normPath(t))
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

export function candidateArgs(tool, args) {
  const first = primaryArgOf(tool, args)
  if (tool === 'grep') {
    const p = pathArgOf(args)
    if (p !== '' && p !== first) return [first, p]
  }
  return [first]
}

export function matchRule(rule, tool, args) {
  if (rule.tool !== tool) return false
  if (rule.match === undefined) return true
  const isPathTool = FILE_TOOLS.includes(tool)
  const cands = candidateArgs(tool, args)
  for (const cand of cands) {
    if (isPathTool) {
      if (matchPathPattern(normPath(cand), rule.match.value)) return true
    } else {
      // 命令/查询类匹配：不区分大小写（Windows 命令行大小写不敏感），
      // 并折叠连续空白（"rm   -rf"/Tab 变体不能绕过前缀匹配）
      const squash = (s) => s.replace(/\s+/g, ' ').toLowerCase()
      const v = rule.match.value.endsWith('*') ? rule.match.value.slice(0, -1) : rule.match.value
      if (v === '' || squash(cand).startsWith(squash(v))) return true
    }
  }
  return false
}

export function evaluate(merged, tool, args) {
  for (const rule of merged) if (matchRule(rule, tool, args)) return rule
  return undefined
}

// 引擎需要的便捷封装：合并作用域并求值
export function evaluateScopes(scopes, tool, args) {
  return evaluate(mergeRules(scopes), tool, args)
}
