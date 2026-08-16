# Publishing checklist

The release recipe used for this plugin (learned the hard way — see *Pitfalls*).

## Layout (community convention)

```
dsh-permissions/
├── lib/index.js       # host half (settings namespace + pre-execute engine + /api/dperm route)
├── lib/client.js      # browser bundle (window.__ModuleLoader__.load, id MUST equal package name)
├── cordis.patch.yml   # root patch (the manual-install manifest)
├── package.json       # dsh.client manifest + dsh.bundle.patch declaration + files whitelist
├── README.md
├── PUBLISH.md
└── LICENSE
```

## Release steps

1. Bump `version` in `package.json`.
2. `git add -A && git commit` — push to GitHub (topics: `dsh-plugin`, `deepseek-harness`, `permissions`).
3. `npm publish --access public` (unscoped name: `dsh-permissions`).
4. Keep the awesome-dsh-plugin entry in sync (one line under the matching category in both `README.md` and `README.zh.md`).

## Pitfalls hit during development (so the next release doesn't)

0. **`link:`-installed profiles resolve imports from the real source path** — `dsh plugin --profile <p> add link:<checkout>` keeps the package external, so Node resolves `@deepseek-ai/schemastery` from the checkout, not the profile. Fix: install the peer into the profile (`dsh plugin --profile <p> add @deepseek-ai/schemastery`) and bridge it into the checkout with a junction at `<checkout>/node_modules/@deepseek-ai/schemastery` → `<profile>/node_modules/@deepseek-ai/schemastery` (gitignored). `file:` specs copy and install deps instead, at the cost of losing live-edit.
1. **Client package `exports` must include `"./package.json"`** — the client-modules node half reads the package manifest through `require.resolve('<pkg>/package.json')`; without the export the row is silently skipped (no bundle route, no settings page).
2. **Bundle `__ModuleLoader__.load` id must equal the package name** — the graph row is keyed by entry name.
3. **Never pass unbounded method references to React's `useSyncExternalStore`** (`controller.subscribe` loses `this` and crashes the render).
4. **The api-proxy settings allowlist does not expose third-party namespaces** — the engine serves its own HTTP route (`/api/dperm/rules`) over its own `SettingsScope` instead.
5. **`serveBundle` reads the bundle from disk with `cache-control: no-cache`** — client-side edits apply on a plain F5; host-side edits need a restart (Node module cache).
6. **Dynamic plugin state resets on every package update** — persist via the `settings` namespace, not in-process memory.
7. **Model tool-call argument key order is not stable** — extract semantic fields (`file_path`, `pattern`, `command`), never `Object.values(args)[0]`.
