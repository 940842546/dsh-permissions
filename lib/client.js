// dsh-permissions-client —— 权限规则引擎设置页（浏览器 bundle）
// 经 settingsScope 读写 dsh-permissions 设置命名空间：改动即时生效、落盘跨重启。
window.__ModuleLoader__.load({
  id: 'dsh-permissions',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const CSS = `
.dp-page{display:flex;flex-direction:column;gap:16px;padding:2px 2px 28px;font-size:13px;color:var(--dsw-alias-label-primary)}
.dp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.dp-title{margin:0;font-size:16px;font-weight:600}
.dp-subtitle{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary);max-width:520px;line-height:1.6}
.dp-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dp-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dp-switch{position:relative;width:40px;height:22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .15s;flex:none;padding:0}
.dp-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s,background .15s}
.dp-switch.dp-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dp-switch.dp-on::after{transform:translateX(18px);background:#fff}
.dp-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:14px;display:flex;flex-direction:column;gap:10px}
.dp-card-head{display:flex;align-items:center;gap:8px}
.dp-card-title{margin:0;font-size:13px;font-weight:600;flex:1}
.dp-quickgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.dp-quick{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;border:1px dashed var(--dsw-alias-border-l2);cursor:pointer;background:var(--dsw-alias-bg-layer-1);text-align:left;transition:border-color .15s;font-size:inherit;color:inherit}
.dp-quick:hover{border-color:var(--dsw-alias-brand-primary)}
.dp-quick-emoji{font-size:20px;line-height:1.3}
.dp-quick-title{font-weight:600;font-size:13px}
.dp-quick-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px;line-height:1.5}
.dp-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:12px}
.dp-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font-size:12px}
.dp-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dp-action-seg{display:inline-flex;gap:2px;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:2px}
.dp-action-btn{border:none;background:transparent;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary);transition:background .12s}
.dp-action-btn.dp-on{color:#fff}
.dp-action-btn.dp-a-hard.dp-on{background:#7c2d3f}
.dp-action-btn.dp-a-deny.dp-on{background:var(--dsw-alias-state-error-primary)}
.dp-action-btn.dp-a-ask.dp-on{background:var(--dsw-alias-state-warn-primary)}
.dp-action-btn.dp-a-allow.dp-on{background:var(--dsw-alias-state-success-primary)}
.dp-mode-seg{display:inline-flex;gap:2px;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:2px}
.dp-mode-btn{border:none;background:transparent;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary);transition:background .12s,color .12s}
.dp-mode-btn.dp-on{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.dp-btn{border:1px solid transparent;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:#fff;transition:opacity .15s}
.dp-btn:disabled{opacity:.45;cursor:default}
.dp-btn:disabled:hover{opacity:.45}
.dp-btn:hover{opacity:.9}
.dp-panel{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.dp-panel.dp-panel-hard{border-color:var(--dsw-alias-state-error-primary)}
.dp-panel-head{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.dp-panel-title{font-size:12px;font-weight:600;flex:1}
.dp-rule-row{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dp-rule-row:last-child{border-bottom:none}
.dp-rule-desc{flex:1;font-size:13px}
.dp-rule-raw{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);padding:2px 8px;border-radius:6px}
.dp-dot{width:8px;height:8px;border-radius:50%;flex:none}
.dp-dot-hard{background:var(--dsw-alias-state-error-primary)}
.dp-dot-deny{background:var(--dsw-alias-state-error-primary);opacity:.6}
.dp-dot-ask{background:var(--dsw-alias-state-warn-primary)}
.dp-dot-allow{background:var(--dsw-alias-state-success-primary)}
.dp-del{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;transition:color .12s,border-color .12s}
.dp-del:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dp-empty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:6px 0}
.dp-ok{color:var(--dsw-alias-state-success-primary);font-size:12px}
.dp-error{color:var(--dsw-alias-state-error-primary);font-size:12px}
.dp-footnote{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.7}
`
    const ACTION_META = {
      hard: { label: '永不允许', hint: '高于全访问，不可豁免', cls: 'dp-a-hard' },
      deny: { label: '不允许', hint: '', cls: 'dp-a-deny' },
      ask: { label: '每次询问', hint: '全访问下自动放行', cls: 'dp-a-ask' },
      allow: { label: '始终允许', hint: '', cls: 'dp-a-allow' },
    }
    const ACTIONS = ['hard', 'deny', 'ask', 'allow']
    const FILE_TOOL_NAMES = ['read', 'write', 'edit', 'glob', 'grep', 'read_image']
    const TOOL_LABELS = {
      read: '读取文件', write: '写入文件', edit: '编辑文件', glob: '查找文件',
      grep: '搜索内容', read_image: '读图片', pwsh: '终端命令',
      web_search: '网页搜索', web_fetch: '抓取网页', subagent: '子代理', workflow: '工作流',
    }
    const TOOL_OPTIONS = [
      { name: 'read', label: '读取文件（read）' },
      { name: 'write', label: '写入文件（write）' },
      { name: 'edit', label: '编辑文件（edit）' },
      { name: 'glob', label: '查找文件（glob）' },
      { name: 'grep', label: '搜索内容（grep）' },
      { name: 'read_image', label: '读图片（read_image）' },
      { name: 'pwsh', label: '终端命令（pwsh）' },
      { name: 'web_search', label: '网页搜索（web_search）' },
      { name: 'web_fetch', label: '抓取网页（web_fetch）' },
      { name: 'subagent', label: '子代理（subagent）' },
      { name: 'workflow', label: '工作流（workflow）' },
    ]
    const SENSITIVE_PRESET = ['write(.ssh)', 'edit(.ssh)', 'write(.aws)', 'edit(.aws)', 'write(.gnupg)', 'edit(.gnupg)', 'write(appdata)', 'edit(appdata)']
    const DANGEROUS_PRESET = ['pwsh(rm -rf *)', 'pwsh(Remove-Item -Recurse)', 'pwsh(del /s)', 'pwsh(rd /s)', 'pwsh(format)']
    const KEYFILE_PRESET = ['write(*.pem)', 'edit(*.pem)', 'write(*.key)', 'edit(*.key)', 'write(*.env)', 'edit(*.env)', 'write(*.htpasswd)', 'edit(*.htpasswd)']

    function describeRule(raw) {
      const m = /^([A-Za-z0-9_-]+)(?:\((.+)\))?$/.exec(raw)
      if (!m) return raw
      const t = TOOL_LABELS[m[1]] || m[1]
      if (!m[2]) return t + ' · 所有调用'
      const v = m[2]
      if (v === '*') return t + ' · 任意参数'
      if (v.startsWith('*') && v.endsWith('*') && v.length > 2) return t + ' · 包含「' + v.slice(1, -1) + '」'
      if (v.startsWith('*')) return t + ' · 以「' + v.slice(1) + '」结尾'
      if (v.endsWith('*')) return t + ' · 以「' + v.slice(0, -1) + '」开头'
      return t + ' · 以「' + v + '」开头'
    }

    function PermissionsSettingsPage(props) {
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(null)
      const [loadError, setLoadError] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [bAction, setBAction] = React.useState('hard')
      const [bTool, setBTool] = React.useState('write')
      const [bMatch, setBMatch] = React.useState('prefix')
      const [bValue, setBValue] = React.useState('.ssh')
      const [msg, setMsg] = React.useState('')
      const [err, setErr] = React.useState('')

      React.useEffect(() => {
        let alive = true
        fetch('/api/dperm/rules')
          .then((r) => r.json())
          .then((j) => {
            if (!alive) return
            if (j && j.ok) { setDraft(j.value); setSaved(j.value) }
            else setLoadError((j && j.error) || '读取规则失败')
          })
          .catch((e) => { if (alive) setLoadError(String(e)) })
        return () => { alive = false }
      }, [])

      if (draft === null && loadError === '') {
        return React.createElement('div', { className: 'dp-page' },
          React.createElement('div', { className: 'dp-empty' }, '加载权限设置中…'))
      }
      if (draft === null) {
        return React.createElement('div', { className: 'dp-page' },
          React.createElement('div', { className: 'dp-error' }, '权限设置不可用：' + loadError))
      }

      const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

      function update(field, next) {
        setMsg('')
        setErr('')
        setDraft(Object.assign({}, draft, { [field]: next }))
      }
      function saveDraft() {
        setSaving(true)
        setMsg('')
        setErr('')
        fetch('/api/dperm/rules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        })
          .then((r) => r.json())
          .then((j) => {
            setSaving(false)
            if (j && j.ok) { setDraft(j.value); setSaved(j.value); setMsg('已保存并生效 ✓') }
            else setErr((j && j.error) || '保存失败，请重试')
          })
          .catch((e) => { setSaving(false); setErr(String(e)) })
      }
      function discardDraft() {
        setMsg('')
        setErr('')
        setDraft(saved)
      }
      function buildValue() {
        const raw = bValue.trim()
        if (raw === '') return bTool
        if (bMatch === 'suffix') return bTool + '(*' + raw + ')'
        if (bMatch === 'contains') return bTool + '(*' + raw + '*)'
        return bTool + '(' + raw + ')'
      }
      function addRule() {
        const raw = buildValue()
        const list = draft[bAction] || []
        if (list.indexOf(raw) >= 0) { setErr('已存在等价规则: ' + raw); return }
        update(bAction, list.concat([raw]))
      }
      function removeRule(action, index) {
        const list = (draft[action] || []).slice()
        list.splice(index, 1)
        update(action, list)
      }
      function applyPreset(kind) {
        const list = kind === 'sensitive' ? SENSITIVE_PRESET : kind === 'dangerous' ? DANGEROUS_PRESET : KEYFILE_PRESET
        const next = (draft.hard || []).slice()
        let added = 0
        for (const raw of list) if (next.indexOf(raw) < 0) { next.push(raw); added++ }
        setMsg('已加入草稿：新增 ' + added + ' 条硬规则（保存后生效）')
        update('hard', next)
      }
      function pickTool(next) {
        setBTool(next)
        if (!FILE_TOOL_NAMES.includes(next) && ['suffix', 'contains', 'wildcard'].includes(bMatch)) setBMatch('prefix')
      }

      const head = React.createElement('div', { className: 'dp-header' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'dp-title' }, '🛡️ 权限控制'),
          React.createElement('p', { className: 'dp-subtitle' },
            '控制 AI 能做什么。优先级：永不允许 > 不允许 > 每次询问 > 始终允许；永不允许即使在全访问（full access）模式下也生效。修改先暂存为本页草稿，点击「保存并应用」后才生效。'),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, draft.enabled ? '引擎已开启' : '引擎已关闭'),
          React.createElement('button', {
            className: draft.enabled ? 'dp-switch dp-on' : 'dp-switch',
            'aria-label': '切换权限引擎（保存后生效）',
            onClick: () => update('enabled', !draft.enabled),
          }),
        ),
      )

      const quickGrid = React.createElement('div', { className: 'dp-quickgrid' },
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('sensitive') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '🔐'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, '保护敏感目录'),
            React.createElement('div', { className: 'dp-quick-desc' }, '阻止写入 .ssh / .aws / AppData 等敏感位置'),
          ),
        ),
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('keyfile') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '🔑'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, '保护密钥文件'),
            React.createElement('div', { className: 'dp-quick-desc' }, '阻止写入 *.pem / *.key / *.env 等密钥文件'),
          ),
        ),
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('dangerous') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '⚠️'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, '拦截危险命令'),
            React.createElement('div', { className: 'dp-quick-desc' }, '阻止 rm -rf、格式化磁盘等危险终端命令'),
          ),
        ),
      )

      const actionBtns = ACTIONS.map((a) => React.createElement('button', {
        key: a,
        className: bAction === a ? 'dp-action-btn ' + ACTION_META[a].cls + ' dp-on' : 'dp-action-btn ' + ACTION_META[a].cls,
        title: ACTION_META[a].hint,
        onClick: () => setBAction(a),
      }, ACTION_META[a].label))

      const isFileTool = FILE_TOOL_NAMES.includes(bTool)
      const matchModes = [
        { key: 'all', label: '所有调用' },
        { key: 'prefix', label: '以…开头' },
        { key: 'suffix', label: '以…结尾', fileOnly: true },
        { key: 'contains', label: '包含…', fileOnly: true },
        { key: 'wildcard', label: '通配符…', fileOnly: true },
      ]
      const matchBtns = matchModes.filter((m) => !m.fileOnly || isFileTool).map((m) => React.createElement('button', {
        key: m.key,
        className: bMatch === m.key ? 'dp-mode-btn dp-on' : 'dp-mode-btn',
        onClick: () => setBMatch(m.key),
      }, m.label))
      const placeholderMap = {
        prefix: '如 .ssh 或 npm run',
        suffix: '如 .pem 或 .env',
        contains: '如 secret 或 password',
        wildcard: '如 *.pem 或 *secret*',
      }

      const editor = React.createElement('div', { className: 'dp-card' },
        React.createElement('div', { className: 'dp-card-head' },
          React.createElement('span', { className: 'dp-card-title' }, '新增规则'),
          React.createElement('span', { className: 'dp-hint' }, '点选即可生成，无需记语法'),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, '当 AI 使用'),
          React.createElement('select', { className: 'dp-select', value: bTool, onChange: (e) => pickTool(e.target.value) },
            TOOL_OPTIONS.map((t) => React.createElement('option', { key: t.name, value: t.name }, t.label))),
          React.createElement('div', { className: 'dp-mode-seg' }, matchBtns),
          bMatch === 'all'
            ? null
            : React.createElement('input', {
              className: 'dp-input',
              value: bValue,
              style: { flex: 1, minWidth: 130 },
              placeholder: placeholderMap[bMatch] || '',
              onChange: (e) => setBValue(e.target.value),
            }),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, '动作'),
          React.createElement('div', { className: 'dp-action-seg' }, actionBtns),
          React.createElement('span', { className: 'dp-chip' }, buildValue()),
          React.createElement('span', { className: 'dp-hint' }, describeRule(buildValue())),
          React.createElement('span', { style: { flex: 1 } }),
          React.createElement('button', { className: 'dp-btn', onClick: addRule }, '添加规则'),
        ),
      )

      const panels = ACTIONS.map((a) => {
        const rows = draft[a] || []
        const meta = ACTION_META[a]
        const children = []
        if (rows.length === 0) {
          children.push(React.createElement('div', { key: 'empty', className: 'dp-empty', style: { padding: '8px 14px' } }, '暂无规则'))
        }
        rows.forEach((raw, i) => {
          children.push(React.createElement('div', { key: 'r' + i, className: 'dp-rule-row' },
            React.createElement('span', { className: 'dp-dot dp-dot-' + a }),
            React.createElement('span', { className: 'dp-rule-desc' }, describeRule(raw)),
            React.createElement('code', { className: 'dp-rule-raw' }, raw),
            React.createElement('button', { className: 'dp-del', onClick: () => removeRule(a, i) }, '删除'),
          ))
        })
        return React.createElement('div', { key: a, className: a === 'hard' ? 'dp-panel dp-panel-hard' : 'dp-panel' },
          React.createElement('div', { className: 'dp-panel-head' },
            React.createElement('span', { className: 'dp-dot dp-dot-' + a }),
            React.createElement('span', { className: 'dp-panel-title' }, meta.label + ' · ' + rows.length + ' 条'),
            React.createElement('span', { className: 'dp-hint' }, meta.hint),
          ),
          children,
        )
      })

      const dirtyBar = React.createElement('div', {
        className: 'dp-card',
        style: dirty ? { borderColor: 'var(--dsw-alias-state-warn-primary)' } : undefined,
      },
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: dirty ? 'dp-hint' : 'dp-ok', style: dirty ? { color: 'var(--dsw-alias-state-warn-primary)' } : undefined },
            dirty ? '⚠ 有未保存的修改 —— 保存前不会影响 AI 行为' : '✓ 无未保存修改，当前规则已生效'),
          React.createElement('span', { style: { flex: 1 } }),
          React.createElement('button', { className: 'dp-btn-ghost dp-btn', disabled: !dirty, onClick: discardDraft }, '放弃修改'),
          React.createElement('button', { className: 'dp-btn', disabled: !dirty || saving, onClick: saveDraft }, saving ? '保存中…' : '保存并应用'),
        ),
      )

      return React.createElement('div', { className: 'dp-page' },
        head,
        quickGrid,
        editor,
        dirtyBar,
        msg ? React.createElement('div', { className: 'dp-ok' }, msg) : null,
        err ? React.createElement('div', { className: 'dp-error' }, err) : null,
        panels,
        React.createElement('div', { className: 'dp-footnote' },
          '💡 通配符（文件类工具）：*.pem = 文件名以 .pem 结尾；*secret* = 路径包含 secret；prefix* = 以 prefix 开头；* 单独 = 全部。不带通配符的片段（如 .ssh、appdata）匹配路径任意位置。绝对路径（C:\\、/）按完整前缀匹配。所有修改先进入本页草稿，点击「保存并应用」后立即生效并写入 settings.yaml（跨重启保留）；「放弃修改」恢复为上次保存的状态。workspace 级规则引擎已支持，界面编辑后续补充。引擎关闭时所有规则透明（包括永不允许）。'),
      )
    }

    const inject = []
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      const styleTag = document.createElement('style')
      styleTag.textContent = CSS
      styleTag.dataset.plugin = 'dsh-permissions-client'
      ctx.effect(() => {
        document.head.appendChild(styleTag)
        return () => styleTag.remove()
      }, 'dsh-permissions-client: styles')
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'dsh-permissions', order: 30, label: '权限' },
        () => React.createElement(PermissionsSettingsPage),
      ))
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
