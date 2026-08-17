// dsh-permissions —— 权限规则引擎设置页（浏览器 bundle，中英双语）
// 语言跟随 DSH 的 locale 服务：register('dsh-permissions', {zh,en}) + bind().t()。
window.__ModuleLoader__.load({
  id: 'dsh-permissions',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useSyncExternalStore } = React

    const CSS = `
.dp-page{display:flex;flex-direction:column;gap:16px;padding:2px 2px 28px;font-size:13px;color:var(--dsw-alias-label-primary)}
.dp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.dp-title{margin:0;font-size:16px;font-weight:600}
.dp-subtitle{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary);max-width:520px;line-height:1.6}
.dp-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dp-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dp-switch{position:relative;width:40px;height:22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .15s;flex:none;padding:0}
.dp-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .15s,background .15s}
.dp-switch.dp-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dp-switch.dp-on::after{transform:translateX(18px);background:var(--dsw-alias-bg-base)}
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
.dp-scope-seg{display:inline-flex;gap:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:4px;flex-wrap:wrap}
.dp-scope-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);padding:7px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s,color .12s}
.dp-scope-btn:hover{color:var(--dsw-alias-label-primary)}
.dp-scope-btn.dp-on{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dp-btn{border:1px solid transparent;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);transition:opacity .15s}
.dp-btn-ghost{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
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

    const DICT = {
      zh: {
        title: '🛡️ 权限控制',
        navTitle: '权限',
        scopeGlobal: '全局',
        scopeTitle: '规则作用域',
        scopeHint: 'workspace 规则与全局合并判定，永不允许永远胜出',
        subtitle: '控制 AI 能做什么。优先级：永不允许 > 不允许 > 每次询问 > 始终允许；永不允许即使在全访问（full access）模式下也生效。修改先暂存为本页草稿，点击「保存并应用」后才生效。',
        engineOn: '引擎已开启',
        engineOff: '引擎已关闭',
        engineAria: '切换权限引擎（保存后生效）',
        quickSensitiveTitle: '保护敏感目录',
        quickSensitiveDesc: '阻止写入 .ssh / .aws / AppData 等敏感位置',
        quickKeyfileTitle: '保护密钥文件',
        quickKeyfileDesc: '阻止写入 *.pem / *.key / *.env 等密钥文件',
        quickDangerousTitle: '拦截危险命令',
        quickDangerousDesc: '阻止 rm -rf、格式化磁盘等危险终端命令',
        editorTitle: '新增规则',
        editorHint: '点选即可生成，无需记语法',
        editorWhen: '当 AI 使用',
        editorAction: '动作',
        editorAdd: '添加规则',
        phPrefix: '如 .ssh 或 npm run',
        phSuffix: '如 .pem 或 .env',
        phContains: '如 secret 或 password',
        phWildcard: '如 *.pem 或 *secret*',
        actionHard: '永不允许',
        actionHardHint: '高于全访问，不可豁免',
        actionDeny: '不允许',
        actionDenyHint: '',
        actionAsk: '每次询问',
        actionAskHint: '全访问下自动放行',
        actionAllow: '始终允许',
        actionAllowHint: '',
        modeAll: '所有调用',
        modePrefix: '以…开头',
        modeSuffix: '以…结尾',
        modeContains: '包含…',
        modeWildcard: '通配符…',
        toolRead: '读取文件',
        toolWrite: '写入文件',
        toolEdit: '编辑文件',
        toolGlob: '查找文件',
        toolGrep: '搜索内容',
        toolReadImage: '读图片',
        toolPwsh: '终端命令',
        toolWebSearch: '网页搜索',
        toolWebFetch: '抓取网页',
        toolSubagent: '子代理',
        toolWorkflow: '工作流',
        ruleAll: '所有调用',
        ruleAny: '任意参数',
        ruleEndsWith: '以「{v}」结尾',
        ruleStartsWith: '以「{v}」开头',
        ruleContains: '包含「{v}」',
        panelCount: '{n} 条',
        panelEmpty: '暂无规则',
        del: '删除',
        dirtyYes: '⚠ 有未保存的修改 —— 保存前不会影响 AI 行为',
        dirtyNo: '✓ 无未保存修改，当前规则已生效',
        discard: '放弃修改',
        save: '保存并应用',
        saving: '保存中…',
        saved: '已保存并生效 ✓',
        presetApplied: '已加入草稿：新增 {n} 条硬规则（保存后生效）',
        errDuplicate: '已存在等价规则: {raw}',
        errSave: '保存失败，请重试',
        loading: '加载权限设置中…',
        unavailable: '权限设置不可用：{msg}',
        footnote: '💡 通配符（文件类工具）：*.pem = 文件名以 .pem 结尾；*secret* = 路径包含 secret；prefix* = 以 prefix 开头；* 单独 = 全部。不带通配符的片段（如 .ssh、appdata）匹配路径任意位置。绝对路径（C:\\、/）按完整前缀匹配。所有修改先进入本页草稿，点击「保存并应用」后立即生效并写入 settings.yaml（跨重启保留）；「放弃修改」恢复为上次保存的状态。workspace 级规则可在上方作用域切换器中分别配置，与全局合并判定、永不允许永远胜出。引擎关闭时所有规则透明（包括永不允许）。',
      },
      en: {
        title: '🛡️ Permissions',
        navTitle: 'Permissions',
        scopeGlobal: 'Global',
        scopeTitle: 'Rule scope',
        scopeHint: 'Workspace rules merge with global; never-allow always wins',
        subtitle: 'Control what the AI can do. Precedence: never allow > deny > ask every time > always allow; never-allow stays enforced even under full access. Edits stay staged as a draft and take effect only after Save & Apply.',
        engineOn: 'Engine on',
        engineOff: 'Engine off',
        engineAria: 'Toggle the rules engine (applies on save)',
        quickSensitiveTitle: 'Protect sensitive dirs',
        quickSensitiveDesc: 'Block writes to .ssh / .aws / AppData and similar locations',
        quickKeyfileTitle: 'Protect key files',
        quickKeyfileDesc: 'Block writes to *.pem / *.key / *.env and similar key files',
        quickDangerousTitle: 'Block dangerous commands',
        quickDangerousDesc: 'Block rm -rf, disk format and similar dangerous commands',
        editorTitle: 'Add rule',
        editorHint: 'Point and click — no syntax needed',
        editorWhen: 'When the AI uses',
        editorAction: 'Action',
        editorAdd: 'Add rule',
        phPrefix: 'e.g. .ssh or npm run',
        phSuffix: 'e.g. .pem or .env',
        phContains: 'e.g. secret or password',
        phWildcard: 'e.g. *.pem or *secret*',
        actionHard: 'Never allow',
        actionHardHint: 'Above full access, not exemptable',
        actionDeny: 'Deny',
        actionDenyHint: '',
        actionAsk: 'Ask every time',
        actionAskHint: 'Auto-allowed under full access',
        actionAllow: 'Always allow',
        actionAllowHint: '',
        modeAll: 'All calls',
        modePrefix: 'starts with…',
        modeSuffix: 'ends with…',
        modeContains: 'contains…',
        modeWildcard: 'wildcard…',
        toolRead: 'Read files',
        toolWrite: 'Write files',
        toolEdit: 'Edit files',
        toolGlob: 'Find files',
        toolGrep: 'Search content',
        toolReadImage: 'Read images',
        toolPwsh: 'Terminal commands',
        toolWebSearch: 'Web search',
        toolWebFetch: 'Fetch web pages',
        toolSubagent: 'Subagents',
        toolWorkflow: 'Workflows',
        ruleAll: 'all calls',
        ruleAny: 'any argument',
        ruleEndsWith: 'ends with "{v}"',
        ruleStartsWith: 'starts with "{v}"',
        ruleContains: 'contains "{v}"',
        panelCount: '{n} rules',
        panelEmpty: 'No rules yet',
        del: 'Delete',
        dirtyYes: '⚠ Unsaved changes — they do not affect the AI until saved',
        dirtyNo: '✓ No unsaved changes; current rules are live',
        discard: 'Discard',
        save: 'Save & Apply',
        saving: 'Saving…',
        saved: 'Saved & applied ✓',
        presetApplied: 'Added to draft: {n} hard rules (applies on save)',
        errDuplicate: 'Equivalent rule exists: {raw}',
        errSave: 'Save failed, please retry',
        loading: 'Loading permission settings…',
        unavailable: 'Permission settings unavailable: {msg}',
        footnote: '💡 Wildcards (file tools): *.pem = path ends with .pem; *secret* = path contains secret; prefix* = starts with prefix; bare * = everything. Non-wildcard segments (.ssh, appdata) match anywhere in the path. Absolute paths (C:\\, /) match as full prefixes. All edits stay staged until Save & Apply, then take effect immediately and persist to settings.yaml across restarts; Discard restores the last saved state. Workspace-scoped rules are configured in the scope switcher above and merge with global (never-allow always wins). Turning the engine off disables all rules, including never-allow.',
      },
    }

    const ACTION_KEYS = ['hard', 'deny', 'ask', 'allow']
    const ACTION_META = {
      hard: { cls: 'dp-a-hard', labelKey: 'actionHard', hintKey: 'actionHardHint' },
      deny: { cls: 'dp-a-deny', labelKey: 'actionDeny', hintKey: 'actionDenyHint' },
      ask: { cls: 'dp-a-ask', labelKey: 'actionAsk', hintKey: 'actionAskHint' },
      allow: { cls: 'dp-a-allow', labelKey: 'actionAllow', hintKey: 'actionAllowHint' },
    }
    const FILE_TOOL_NAMES = ['read', 'write', 'edit', 'glob', 'grep', 'read_image']
    const TOOL_KEY_OF = {
      read: 'toolRead', write: 'toolWrite', edit: 'toolEdit', glob: 'toolGlob',
      grep: 'toolGrep', read_image: 'toolReadImage', pwsh: 'toolPwsh',
      web_search: 'toolWebSearch', web_fetch: 'toolWebFetch', subagent: 'toolSubagent', workflow: 'toolWorkflow',
    }
    const TOOL_OPTIONS = [
      { name: 'read' }, { name: 'write' }, { name: 'edit' }, { name: 'glob' },
      { name: 'grep' }, { name: 'read_image' }, { name: 'pwsh' },
      { name: 'web_search' }, { name: 'web_fetch' }, { name: 'subagent' }, { name: 'workflow' },
    ]
    const SENSITIVE_PRESET = ['write(.ssh)', 'edit(.ssh)', 'write(.aws)', 'edit(.aws)', 'write(.gnupg)', 'edit(.gnupg)', 'write(appdata)', 'edit(appdata)']
    const DANGEROUS_PRESET = ['pwsh(rm -rf *)', 'pwsh(Remove-Item -Recurse)', 'pwsh(del /s)', 'pwsh(rd /s)', 'pwsh(format)']
    const KEYFILE_PRESET = ['write(*.pem)', 'edit(*.pem)', 'write(*.key)', 'edit(*.key)', 'write(*.env)', 'edit(*.env)', 'write(*.htpasswd)', 'edit(*.htpasswd)']

    function interp(template, params) {
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    }

    // 惰性接入 locale 服务：首次渲染时才绑定，避免与 locale 插件的加载顺序耦合。
    function makeTranslator(ctx) {
      let face
      let unregister
      let unsub
      let snap = 0
      const listeners = new Set()
      const ensure = () => {
        if (face !== undefined) return
        const locale = ctx.get('locale')
        if (locale === undefined) return
        unregister = locale.register('dsh-permissions', DICT)
        face = locale.bind('dsh-permissions')
        unsub = locale.subscribe(() => {
          snap += 1
          for (const cb of listeners) cb()
        })
      }
      ctx.effect(() => () => {
        if (unsub !== undefined) unsub()
        if (unregister !== undefined) unregister()
      }, 'dsh-permissions-client: locale dicts')
      return {
        t(key, params) {
          ensure()
          if (face !== undefined) return face(key, params)
          return interp(DICT.zh[key] ?? key, params)
        },
        subscribe(cb) {
          listeners.add(cb)
          return () => listeners.delete(cb)
        },
        getSnapshot() {
          ensure()
          return snap
        },
      }
    }

    function describeRule(raw, t) {
      const m = /^([A-Za-z0-9_-]+)(?:\((.+)\))?$/.exec(raw)
      if (!m) return raw
      const toolKey = TOOL_KEY_OF[m[1]]
      const tool = toolKey ? t(toolKey) : m[1]
      if (!m[2]) return tool + ' · ' + t('ruleAll')
      const v = m[2]
      if (v === '*') return tool + ' · ' + t('ruleAny')
      if (v.startsWith('*') && v.endsWith('*') && v.length > 2) return tool + ' · ' + t('ruleContains', { v: v.slice(1, -1) })
      if (v.startsWith('*')) return tool + ' · ' + t('ruleEndsWith', { v: v.slice(1) })
      if (v.endsWith('*')) return tool + ' · ' + t('ruleStartsWith', { v: v.slice(0, -1) })
      return tool + ' · ' + t('ruleStartsWith', { v })
    }

    function PermissionsSettingsPage(props) {
      const translator = props.translator
      useSyncExternalStore(translator.subscribe, translator.getSnapshot)
      const t = translator.t
      const workspaceItems = props.useWorkspaces ? props.useWorkspaces((s) => s.items) : []
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(null)
      const [scope, setScope] = React.useState('global')
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
            else setLoadError((j && j.error) || t('errSave'))
          })
          .catch((e) => { if (alive) setLoadError(String(e)) })
        return () => { alive = false }
      }, [])

      if (draft === null && loadError === '') {
        return React.createElement('div', { className: 'dp-page' },
          React.createElement('div', { className: 'dp-empty' }, t('loading')))
      }
      if (draft === null) {
        return React.createElement('div', { className: 'dp-page' },
          React.createElement('div', { className: 'dp-error' }, t('unavailable', { msg: loadError })))
      }

      const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

      function update(field, next) {
        setMsg('')
        setErr('')
        setDraft(Object.assign({}, draft, { [field]: next }))
      }
      function currentSet() {
        if (scope === 'global') return draft
        const id = scope.slice(3)
        const ws = draft.workspaces || {}
        return ws[id] || { hard: [], deny: [], ask: [], allow: [] }
      }
      function writeRuleField(field, next) {
        setMsg('')
        setErr('')
        if (scope === 'global') {
          setDraft(Object.assign({}, draft, { [field]: next }))
          return
        }
        const id = scope.slice(3)
        const ws = Object.assign({}, draft.workspaces || {})
        const cur = ws[id] || { hard: [], deny: [], ask: [], allow: [] }
        ws[id] = Object.assign({}, cur, { [field]: next })
        setDraft(Object.assign({}, draft, { workspaces: ws }))
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
            if (j && j.ok) { setDraft(j.value); setSaved(j.value); setMsg(t('saved')) }
            else setErr((j && j.error) || t('errSave'))
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
        const set = currentSet()
        const list = set[bAction] || []
        if (list.indexOf(raw) >= 0) { setErr(t('errDuplicate', { raw })); return }
        writeRuleField(bAction, list.concat([raw]))
      }
      function removeRule(action, index) {
        const list = (currentSet()[action] || []).slice()
        list.splice(index, 1)
        writeRuleField(action, list)
      }
      function applyPreset(kind) {
        const list = kind === 'sensitive' ? SENSITIVE_PRESET : kind === 'dangerous' ? DANGEROUS_PRESET : KEYFILE_PRESET
        const next = (currentSet().hard || []).slice()
        let added = 0
        for (const raw of list) if (next.indexOf(raw) < 0) { next.push(raw); added++ }
        setMsg(t('presetApplied', { n: added }))
        writeRuleField('hard', next)
      }
      function pickTool(next) {
        setBTool(next)
        if (!FILE_TOOL_NAMES.includes(next) && ['suffix', 'contains', 'wildcard'].includes(bMatch)) setBMatch('prefix')
      }

      const head = React.createElement('div', { className: 'dp-header' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'dp-title' }, t('title')),
          React.createElement('p', { className: 'dp-subtitle' }, t('subtitle')),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, draft.enabled ? t('engineOn') : t('engineOff')),
          React.createElement('button', {
            className: draft.enabled ? 'dp-switch dp-on' : 'dp-switch',
            'aria-label': t('engineAria'),
            onClick: () => update('enabled', !draft.enabled),
          }),
        ),
      )

      const scopeName = scope === 'global' ? t('scopeGlobal') : (() => {
        const id = scope.slice(3)
        const w = workspaceItems.find((item) => String(item.workspaceId) === id)
        return w ? w.title : id.slice(0, 8)
      })()
      const scopeBtns = [React.createElement('button', {
        key: 'global',
        className: scope === 'global' ? 'dp-scope-btn dp-on' : 'dp-scope-btn',
        onClick: () => setScope('global'),
      }, t('scopeGlobal') + ' · ' + (((draft.hard || []).length) + ((draft.deny || []).length) + ((draft.ask || []).length) + ((draft.allow || []).length)))]
      for (const w of workspaceItems) {
        const id = String(w.workspaceId)
        const wsRules = (draft.workspaces || {})[id]
        const count = wsRules ? ((wsRules.hard || []).length + (wsRules.deny || []).length + (wsRules.ask || []).length + (wsRules.allow || []).length) : 0
        scopeBtns.push(React.createElement('button', {
          key: id,
          className: scope === 'ws:' + id ? 'dp-scope-btn dp-on' : 'dp-scope-btn',
          onClick: () => setScope('ws:' + id),
        }, w.title + (count > 0 ? ' · ' + count : '')))
      }
      const scopeCard = React.createElement('div', { className: 'dp-card' },
        React.createElement('div', { className: 'dp-card-head' },
          React.createElement('span', { className: 'dp-card-title' }, '📁 ' + t('scopeTitle') + '：' + scopeName),
          React.createElement('span', { className: 'dp-hint' }, t('scopeHint')),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('div', { className: 'dp-scope-seg' }, scopeBtns),
        ),
      )

      const quickGrid = React.createElement('div', { className: 'dp-quickgrid' },
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('sensitive') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '🔐'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, t('quickSensitiveTitle')),
            React.createElement('div', { className: 'dp-quick-desc' }, t('quickSensitiveDesc')),
          ),
        ),
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('keyfile') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '🔑'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, t('quickKeyfileTitle')),
            React.createElement('div', { className: 'dp-quick-desc' }, t('quickKeyfileDesc')),
          ),
        ),
        React.createElement('button', { className: 'dp-quick', onClick: () => applyPreset('dangerous') },
          React.createElement('span', { className: 'dp-quick-emoji' }, '⚠️'),
          React.createElement('span', null,
            React.createElement('div', { className: 'dp-quick-title' }, t('quickDangerousTitle')),
            React.createElement('div', { className: 'dp-quick-desc' }, t('quickDangerousDesc')),
          ),
        ),
      )

      const actionBtns = ACTION_KEYS.map((a) => React.createElement('button', {
        key: a,
        className: bAction === a ? 'dp-action-btn ' + ACTION_META[a].cls + ' dp-on' : 'dp-action-btn ' + ACTION_META[a].cls,
        title: t(ACTION_META[a].hintKey),
        onClick: () => setBAction(a),
      }, t(ACTION_META[a].labelKey)))

      const isFileTool = FILE_TOOL_NAMES.includes(bTool)
      const matchModes = [
        { key: 'all', labelKey: 'modeAll' },
        { key: 'prefix', labelKey: 'modePrefix' },
        { key: 'suffix', labelKey: 'modeSuffix', fileOnly: true },
        { key: 'contains', labelKey: 'modeContains', fileOnly: true },
        { key: 'wildcard', labelKey: 'modeWildcard', fileOnly: true },
      ]
      const matchBtns = matchModes.filter((m) => !m.fileOnly || isFileTool).map((m) => React.createElement('button', {
        key: m.key,
        className: bMatch === m.key ? 'dp-mode-btn dp-on' : 'dp-mode-btn',
        onClick: () => setBMatch(m.key),
      }, t(m.labelKey)))
      const placeholderKeys = { prefix: 'phPrefix', suffix: 'phSuffix', contains: 'phContains', wildcard: 'phWildcard' }

      const editor = React.createElement('div', { className: 'dp-card' },
        React.createElement('div', { className: 'dp-card-head' },
          React.createElement('span', { className: 'dp-card-title' }, t('editorTitle') + ' · ' + scopeName),
          React.createElement('span', { className: 'dp-hint' }, t('editorHint')),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, t('editorWhen')),
          React.createElement('select', { className: 'dp-select', value: bTool, onChange: (e) => pickTool(e.target.value) },
            TOOL_OPTIONS.map((opt) => React.createElement('option', { key: opt.name, value: opt.name }, t(TOOL_KEY_OF[opt.name]) + ' (' + opt.name + ')'))),
          React.createElement('div', { className: 'dp-mode-seg' }, matchBtns),
          bMatch === 'all'
            ? null
            : React.createElement('input', {
              className: 'dp-input',
              value: bValue,
              style: { flex: 1, minWidth: 130 },
              placeholder: t(placeholderKeys[bMatch] || 'phPrefix'),
              onChange: (e) => setBValue(e.target.value),
            }),
        ),
        React.createElement('div', { className: 'dp-bar' },
          React.createElement('span', { className: 'dp-hint' }, t('editorAction')),
          React.createElement('div', { className: 'dp-action-seg' }, actionBtns),
          React.createElement('span', { className: 'dp-chip' }, buildValue()),
          React.createElement('span', { className: 'dp-hint' }, describeRule(buildValue(), t)),
          React.createElement('span', { style: { flex: 1 } }),
          React.createElement('button', { className: 'dp-btn', onClick: addRule }, t('editorAdd')),
        ),
      )

      const panels = ACTION_KEYS.map((a) => {
        const rows = currentSet()[a] || []
        const meta = ACTION_META[a]
        const children = []
        if (rows.length === 0) {
          children.push(React.createElement('div', { key: 'empty', className: 'dp-empty', style: { padding: '8px 14px' } }, t('panelEmpty')))
        }
        rows.forEach((raw, i) => {
          children.push(React.createElement('div', { key: 'r' + i, className: 'dp-rule-row' },
            React.createElement('span', { className: 'dp-dot dp-dot-' + a }),
            React.createElement('span', { className: 'dp-rule-desc' }, describeRule(raw, t)),
            React.createElement('code', { className: 'dp-rule-raw' }, raw),
            React.createElement('button', { className: 'dp-del', onClick: () => removeRule(a, i) }, t('del')),
          ))
        })
        return React.createElement('div', { key: a, className: a === 'hard' ? 'dp-panel dp-panel-hard' : 'dp-panel' },
          React.createElement('div', { className: 'dp-panel-head' },
            React.createElement('span', { className: 'dp-dot dp-dot-' + a }),
            React.createElement('span', { className: 'dp-panel-title' }, t(meta.labelKey) + ' · ' + t('panelCount', { n: rows.length })),
            React.createElement('span', { className: 'dp-hint' }, t(meta.hintKey)),
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
            dirty ? t('dirtyYes') : t('dirtyNo')),
          React.createElement('span', { style: { flex: 1 } }),
          React.createElement('button', { className: 'dp-btn-ghost dp-btn', disabled: !dirty, onClick: discardDraft }, t('discard')),
          React.createElement('button', { className: 'dp-btn', disabled: !dirty || saving, onClick: saveDraft }, saving ? t('saving') : t('save')),
        ),
      )

      return React.createElement('div', { className: 'dp-page' },
        head,
        scopeCard,
        quickGrid,
        editor,
        dirtyBar,
        msg ? React.createElement('div', { className: 'dp-ok' }, msg) : null,
        err ? React.createElement('div', { className: 'dp-error' }, err) : null,
        panels,
        React.createElement('div', { className: 'dp-footnote' }, t('footnote')),
      )
    }

    const inject = []
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      const translator = makeTranslator(ctx)
      const styleTag = document.createElement('style')
      styleTag.textContent = CSS
      styleTag.dataset.plugin = 'dsh-permissions'
      ctx.effect(() => {
        document.head.appendChild(styleTag)
        return () => styleTag.remove()
      }, 'dsh-permissions-client: styles')
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'dsh-permissions', order: 30, label: () => translator.t('navTitle') },
        (props) => React.createElement(PermissionsSettingsPage, Object.assign({}, props, { translator })),
      ))
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
