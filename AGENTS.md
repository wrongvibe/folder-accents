# AGENTS.md

## Project
Obsidian community plugin `folder-accents` — automatically changes accent colour based on active note's folder.

## Key Constraints
- Pure JavaScript (no TypeScript build step)
- Obsidian API only (`Plugin`, `PluginSettingTab`, `Setting`, `AbstractInputSuggest`, `TFolder`)
- Must work on desktop and mobile
- No external dependencies

## File Overview
- `main.js` — Plugin entry point. Exports `FolderAccentsPlugin` class.
  - `onload()` — Injects dynamic CSS style element, registers file-open/active-leaf-change listeners, starts iframe MutationObserver, adds settings tab
  - `updateCSS()` — Regenerates `data-folder-accent-*` CSS rules from settings
  - `updateAccent()` — Resolves active file (prefers `activeLeaf.view.file`), matches against mapped folders, sets `data-folder-accent` on `<body>`, calls `syncIframes()`
  - `setupIframe()` / `applyAccentToIframe()` / `syncIframes()` — Push `--color-accent` into canvas markdown-embed iframes (see Canvas Iframe Quirk below)
  - `getActiveColor()` — Resolves the current `data-folder-accent` attribute back to its hex colour
- `manifest.json` — Plugin metadata (name, version, minAppVersion, description, author)
- `README.md` — User-facing documentation
- `AGENTS.md` — This file. Developer context and constraints.

## Plugin Architecture
```
main.js
├── FolderAccentsPlugin (extends Plugin)
│   ├── onload() — setup CSS injection + event listeners
│   ├── updateCSS() — regenerate dynamic styles
│   ├── updateAccent() — match active file to folder mapping
│   └── saveSettings() — persist + re-apply CSS
│
├── FolderAccentsSettingTab (extends PluginSettingTab)
│   ├── display() — render settings UI
│   └── FolderSuggest (extends AbstractInputSuggest)
│       ├── getSuggestions() — fuzzy search all vault folders
│       └── selectSuggestion() — update setting on selection
│
└── manifest.json
```

## CSS Strategy
The plugin creates a single `<style id="folder-accents-dynamic-css">` element in `<head>`.
Rules follow this pattern:
```css
body[data-folder-accent="folder-accent-{index}"] {
  --color-accent: {colour} !important;
}
```
`!important` is required because Obsidian themes may also set `--color-accent`.

## Matching Logic
```javascript
// Longest (most specific) folder path wins
this.settings.mappings.forEach((mapping, i) => {
    const folder = mapping.folder;
    if (folder && (path === folder || path.startsWith(folder + '/')) && folder.length > bestLen) {
        bestIndex = i;
        bestLen = folder.length;
    }
});
```
- Most specific (longest) folder path wins — `Projects/Work` beats `Projects` regardless of array order
- No match → remove `data-folder-accent` attribute (revert to theme default)
- Canvas files are matched like any other file — they follow their own folder's accent
- File resolution uses `activeLeaf.view.file` first, falling back to `getActiveFile()` — this keeps the canvas's accent when editing an embedded markdown card (where `getActiveFile()` would otherwise return the embedded note's file)
- Early-return guard: skip if `.canvas-node.is-editing` exists (preserves accent while editing a text card)

## Canvas Iframe Quirk
Canvas markdown-embed cards render inside `<iframe class="embed-iframe" sandbox="allow-same-origin ...">`. The iframe has its own `document` whose `<body>` does **not** inherit `--color-accent` from the parent document — CSS custom properties don't cross iframe boundaries.

Solution: push the colour into each iframe directly as inline style.
```javascript
iframe.contentDocument.body.style.setProperty('--color-accent', color, 'important');
```
- A `MutationObserver` on `document.body` (childList + subtree) catches new `iframe.embed-iframe` nodes as cards enter edit mode
- `setupIframe()` attaches a `load` listener (re-applies on iframe content reload) and runs `applyAccentToIframe()` immediately
- `syncIframes()` is called from `updateAccent()` so accent changes propagate to all live iframes
- `onunload()` disconnects the observer and clears inline styles from all iframe bodies

## Settings Schema
```json
{
  "mappings": [
    { "id": 1, "folder": "_Templates", "color": "#7F8C8D" },
    { "id": 2, "folder": "_Skills", "color": "#5DADE2" }
  ]
}
```
Each mapping carries a stable `id` (set to `Date.now()` on creation) used for UI row identity — avoids the duplicate-empty-entry lookup bug.
`loadSettings()` migrates existing entries without an `id` automatically.
Stored in `.obsidian/plugins/folder-accents/data.json` (auto-managed by Obsidian's `saveData`/`loadData`).

## Recently Added
- Canvas markdown-embed iframes — `--color-accent` pushed inline via MutationObserver + `contentDocument` access
- Canvas files now follow their own folder's accent (previously preserved the prior note's)
- `updateAccent()` reads `activeLeaf.view.file` first — editing an embedded markdown card no longer leaks the embedded note's folder accent
- Stable `id` field on each mapping — UI row identity no longer depends on duplicate-sensitive `findIndex`
- Longest-path-first matching — most specific folder wins regardless of array order
- Text input saves on blur / suggester select only (not on every keystroke)
- Import validates CSS color values via `new Option().style`
- Default new-mapping color changed to `#0d0d73`
- `display()` no longer unnecessarily `async`

## Workflow
- No build tools. Edit `main.js` directly.
- To test: reload plugin in **Settings → Community Plugins**
- To release: bump `version` in `manifest.json`, commit, push

## Common Gotchas
- `AbstractInputSuggest` requires `app` instance passed to constructor
- `color.colorPickerEl` styling can squeeze the native colour picker — avoid adding padding
- Event listeners registered with `this.registerEvent()` are auto-cleaned on unload
- The `<style>` element must be removed in `onunload()` to prevent orphaned styles
- The iframe `MutationObserver` must be `disconnect()`-ed in `onunload()`, and inline `--color-accent` cleared from each iframe body
- CSS custom properties do not cross iframe boundaries — anything inside `iframe.embed-iframe` needs the property set on its own `document.body`
- `getActiveFile()` returns the embedded note's file when editing a canvas markdown embed; use `activeLeaf.view.file` to get the leaf's primary file instead
