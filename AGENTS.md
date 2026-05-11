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
  - `onload()` — Injects dynamic CSS style element, registers file-open/active-leaf-change event listeners, adds settings tab
  - `updateCSS()` — Regenerates `data-folder-accent-*` CSS rules from settings
  - `updateAccent()` — Checks active file path against mapped folders, sets `data-folder-accent` attribute on `<body>`
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
