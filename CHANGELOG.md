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

## 1.2.2
- Session-grants panel in Settings (list + revoke, all sessions); sanitized rules export (username paths replaced with ~); decision-log CSV export.

## 1.2.3
- Security: /api/dperm/* routes now go through the browser authentication wall (connection.authorizeIndex) on dsh >= 0.1.2-alpha.2; older versions without the connection service pass through (no auth existed there).

## 2.0.0
- **BREAKING**: dsh >= 0.1.7-alpha.1 removed ctx.settings.register (SettingsForms refactor). The plugin now self-manages its rules in `~/.dsh/dsh-permissions-state.json` (loadState/saveState) instead of the settings namespace. First run auto-migrates rules from the old settings.yaml dsh-permissions section. Dropped the @deepseek-ai/schemastery peerDependency (no longer needed). All existing rules, decision-log persistence, HTTP routes, session grants, and auth gating are preserved.

## 2.0.1
- Fix: use connection.isAuthenticated for API route auth instead of authorizeIndex (authorizeIndex writes 303/401 responses and only handles the / path, so it silently blocked all /api/dperm/* calls).
- Fix: move rulesRev/wsCache/mergedCache declarations above saveState to avoid TDZ risk.
- Fix outdated CHANGELOG note (2.0.0 replaced the settings namespace).

## 2.0.2
- Fix: declare inject = ['webServer'] so the plugin waits for the webServer service before registering /api/dperm routes. dsh 0.1.7 loaded the plugin before webServer was ready → ctx.get('webServer') returned undefined → routes never mounted → settings page showed a "not found" JSON error and the badge never rendered. (dsh-usage-billing, which declares webServer in inject, was unaffected — confirming the root cause.)

## 2.1.0
- **Fix (data safety)**: rule state is written atomically — write `.tmp`, keep the previous file as `.bak`, then `rename`. A crash mid-write no longer leaves truncated JSON that the next boot would mistake for "first run" and silently replace with defaults.
- **Fix**: `POST /api/dperm/rules` validates every field type (returns 400 naming the offending field) and merges partial bodies over defaults, so submitting only `{ enabled }` no longer empties the rule arrays.
- **Fix**: a pending approval that gets cancelled mid-turn is now removed from the queue instead of lingering forever — previously `/api/dperm/ask` kept returning it, so the badge pulsed "pending confirmation" with a prompt that could not be answered.
- **Fix**: the decision-log size counter starts from the on-disk file size, so an already-oversized log is trimmed on the next write instead of waiting for another 2 MB.
- **Tests**: new engine integration suite (fake Cordis context driving every route and listener) and contract suite (source canaries for the inject/settings/authorizeIndex regressions + a dsh API-surface comparison that runs whenever a dsh installation is discoverable). `npm test` runs all 53 tests; CI now runs the whole suite.

## 2.2.0
- **Per-rule disable/enable**: toggle a rule without deleting it. Disabled rules are stored with a `!` prefix (`"!pwsh"`), which the engine's syntax parser already rejects, so they are inert everywhere — including the prompt summary — while staying visible and one click away from being re-enabled. Older plugin versions read them as inert too, so the format is backward compatible.
- **Per-rule reordering**: move rules up/down inside their group. Order decides which rule matches first, so precedence inside one action is now editable.
- **Stale workspace cleanup**: the settings page lists rule sets whose workspace no longer exists and offers a one-click cleanup (only when the workspace list actually loaded, to avoid false positives).
- **Localized approval prompts**: ask prompts now send `displayReason` (`en` + `zh`) alongside the internal `reason`, so the approval UI renders in the active language. `reason` keeps its `[dsh-permissions-ask]` marker for the session-grant responder.
- **Quieter polling**: the badge polls pending approvals every 3 s (was 1.5 s) and both the badge and the settings page skip polls while the tab is hidden, refreshing immediately when it becomes visible again.
- README refreshed to describe the self-managed JSON state and the new controls.

## 2.3.0
- **"Open settings" from the badge**: the popover now has a primary action that jumps straight to the permissions page. The shell-owned settings dialog exposes no public open hook (`openSettings` exists only on the single-occupant `settings.launcher` slot, which the shipped UI already owns), so the plugin registers its own **keyed `main` panel** (`dsh-permissions`) and navigates with the documented `ctx.layout.selectPanel()` API. The panel renders the same editing UI full-width, with a "back to chat" control.
- **Workspace list from the plugin's own route**: `GET /api/dperm/workspaces` returns `{ id, title }` pairs from the host registry. Both surfaces (settings section and main panel) now use it instead of relying on each slot's owner props, whose workspace state shape differs per slot.
- Badge hides the action and falls back to a hint when `layout` is unavailable (older dsh).
- Tests: +3 (workspaces route with and without a registry, main-panel canary), 60 → 63.

## 2.3.1
- **Main panel layout**: the wide surface is now a real page instead of a stretched dialog — sticky header bar (back · title · engine switch) and a two-column body: editing on the left (scope, presets, builder, save bar, rule panels), diagnostics on the right (merged view, tester, decision log, grants). Collapses to one column under 1020 px.
- **Popover polish**: roomier padding, 12 px radius, layered shadow, wider minimum, and a hover tint on the badge.

## 2.3.2
- **Visual language matched to the shipped settings UI.** Values were taken from the installed `ui-settings*` packages rather than invented: heading 18 px/600, body 13 px, secondary text `--dsw-alias-label-tertiary` (official intro color), separators `.5 px`, panel title 16 px/500, hover surfaces `--dsw-alias-interactive-bg-hover`, radii `--dsw-radius-md`/`--dsw-radius-panel`, popover elevation `--dsw-elevation-prominent` (each with a fallback so an older theme degrades cleanly).
- Removed the custom-looking choices: dashed preset borders, heavy card shadows, pill-heavy buttons, and colored chips — replaced by bordered sections, hairline row separators, and text-weight hierarchy.
- Surfaces follow the official order: page `bg-layer-2`, groups `bg-layer-1`, inputs `bg-base`.

## 2.3.3
- **Fix: the "Open settings" action could be missing entirely.** The client read `layout` during `apply()`, when the service may not be mounted yet — so the main panel was never registered and the badge hid the button (the same timing trap as `webServer` on 0.1.7). The service is now resolved lazily on click, and the main panel is registered unconditionally (`slots.inject('main', …)` waits for the slot itself).
- Failure is no longer silent: if navigation is impossible, the popover shows the reason instead of doing nothing.
- **Quick on/off switch in the badge popover**: a compact `引擎 [switch]` row next to "Open settings", posting the same state the settings page writes and notifying other surfaces via `dsh-permissions-changed`.

## 2.3.4
- **Fix: host services are resolved lazily.** `workspaceRegistry`, `approval` and `systemPrompt` were read once during `apply()`; when any of them mounted slightly later they stayed `undefined` for the whole process. Symptom found live: `GET /api/dperm/workspaces` returned `[]` even though the registry was registered. Services are now looked up on use and cached only once found.
- The approval responder is registered unconditionally (it delegates with `next()` for any request that is not ours), so it can no longer be lost to the same race.
- Tests: +1 lazy-resolution regression, 63 → 64.







