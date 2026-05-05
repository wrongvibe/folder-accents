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
// Exact match or subfolder
if (path === folder || path.startsWith(folder + '/')) {
  matchedIndex = i;
  break; // first match wins
}
```
- Mappings are checked in array order (settings order)
- Subfolders inherit parent folder colour unless overridden by a more specific mapping listed earlier
- No match → remove `data-folder-accent` attribute (revert to theme default)

## Settings Schema
```json
{
  "mappings": [
    { "folder": "_Templates", "color": "#7F8C8D" },
    { "folder": "_Skills", "color": "#5DADE2" }
  ]
}
```
Stored in `.obsidian/plugins/folder-accents/data.json` (auto-managed by Obsidian's `saveData`/`loadData`).

## Recently Added
- Native folder suggester using `AbstractInputSuggest`
- Alphabetical sorting of folder mappings in settings UI
- Add Folder button moved to top of settings panel
- Padding adjustments on search input and remove button

## Workflow
- No build tools. Edit `main.js` directly.
- To test: reload plugin in **Settings → Community Plugins**
- To release: bump `version` in `manifest.json`, commit, push

## Common Gotchas
- `AbstractInputSuggest` requires `app` instance passed to constructor
- `color.colorPickerEl` styling can squeeze the native colour picker — avoid adding padding
- Event listeners registered with `this.registerEvent()` are auto-cleaned on unload
- The `<style>` element must be removed in `onunload()` to prevent orphaned styles
