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

## 1.1.0
- Extract matcher into lib/match.js (pure, dependency-free) with 26 unit tests (
ode --test) + GitHub Actions CI.
- Fixed absolute-path patterns with mid-path wildcards (c:/users/*/.ssh/*) previously treated literally.
- Bilingual (English) deny/ask reasons for model-side comprehension.
- Composer badge (conversation.input.right): live rule count / engine-off state.
- Import rules from URL (fetch any rules-JSON link, e.g. GitHub raw).

## 1.1.1
- Rule hit counts: each rule shows a xN badge (times its scope matched since engine start); /api/dperm/stats.

## 1.1.2
- Badge click now opens a self-contained popover (engine state, per-action counts, top-5 hit rules) instead of the no-op settings-jump event; click-outside closes.

## 1.1.3
- Badge popover opens upward (the badge sits at the screen bottom; the old downward popover was clipped off-screen).

## 1.1.4
- Badge popover: actionable — pause/enable engine toggle button (writes through the rules API), fixed row overflow layout.

## 1.1.5
- Badge rework: live recent-decisions feed (last 4 calls with action dots) in the popover; badge shows rule count + blocked count (x N); 5s refresh; removed the pause toggle.

## 1.1.6
- Popover rows rework: decision label pinned first, arg clipped to 18 chars with ellipsis, full tool+arg on hover.

## 1.1.7
- Popover width now fits content (width:max-content) — no more trailing blank space; arg clip relaxed to 26 chars.

## 1.2.0
- Session grants ("always allow this session"): ask rules surface a three-choice prompt (allow once / always this session / deny) in the badge popover with an amber pulsing badge state; grants are per session+rule key, in-memory.

## 1.2.1
- Decision log and rule hit counts now survive restarts: every decision is appended to `~/.dsh/dsh-permissions-history.jsonl` (async append, rule keys included for hit-count replay); the tail 200 entries and hit counts are restored on boot; the file self-trims at 2MB.
