# Changelog

## 1.0.9

- **Rule validation**: invalid rule syntax is flagged inline in the panels (purple dot + warning text) — matches the engine's silent-skip behavior so inert rules are visible. / 非法规则语法在面板内即时标注（引擎会静默跳过这些规则，现在看得见）。
- **Effective (merged) view**: when a workspace scope is selected, a card shows the actual decision basis for that workspace's sessions — global ∪ workspace merged in priority order. / workspace 作用域下展示合并判定视图。
- **Import / export rules as JSON** (buttons in the save bar; import lands in the draft, applies on save). / 规则导入导出 JSON。
- **Whitespace-squashed command matching**: `rm␣␣␣-rf` (extra spaces/tabs) can no longer slip past prefix rules. / 命令匹配折叠连续空白。

## 1.0.8

- Screenshots (zh + en) in `assets/`, referenced from both READMEs; registered in awesome-dsh-plugin's `data/screenshots.json` (PR #1653).
- Privacy fix: the rule tester's default input no longer embeds a real username path (`~/.ssh/id_rsa` now).

## 1.0.7

- **Case-insensitive command matching** (safety): `remove-item -recurse` can no longer bypass `pwsh(Remove-Item -Recurse)`.
- **Compiled-rules cache** (perf): merged rule tables cached per scope-combination + settings revision instead of recompiling on every tool call.
- **Decision log & rule tester** return in the settings page (`/api/dperm/log`, `/api/dperm/match-test`).

## 1.0.6

- **Per-workspace rule editing** in the settings UI: a prominent scope card (rule counts per scope, current-scope labels on the editor).

## 1.0.5

- Dark-mode contrast fixes (adaptive switch knob and button text); restored the ghost-button style lost in the i18n rewrite.

## 1.0.4

- Locale-aware settings page (zh/en dictionaries via the official `locale` service, lazy binding); settings nav label localizes without re-registering.

## 1.0.3

- Bilingual README (Chinese default, `README.en.md`), awesome badges.

## 1.0.2

- npm packaging aligned with community convention (`files: [lib, cordis.patch.yml]`, explicit patch export, Chinese description); `@deepseek-ai/schemastery` moved to peerDependencies.

## 1.0.1

- Published (initial npm release: 1.0.0 content with `dependencies`; 1.0.1 corrected the declaration).

## 1.0.0

- Initial release: Claude Code-style permission rules engine — hard/deny/ask/allow tiers with a hard tier above full access, global + workspace scopes, wildcard path matching (`*.pem`, `*secret*`, segments, absolute prefixes), staged visual editor with one-click presets, persistence in `settings.yaml`, model-visible rule summary via `systemPrompt`.
