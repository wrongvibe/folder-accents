# Folder Accents

Automatically change Obsidian's accent colour based on which folder your note is in.

## How It Works

When you open a note, this plugin checks which folder that note lives in. If the folder has a colour assigned, the entire UI shifts to that accent colour instantly. Open a note in a different folder? The colour changes automatically.

Works with any theme that uses `--color-accent` (like COLOURS).

## Features

- **Per-folder accent colours** — assign any colour to any folder
- **Subfolder inheritance** — `Projects/Work` inherits from `Projects` if no exact match
- **Native folder search** — type to find folders, just like Obsidian's core plugins
- **Live preview** — colour changes the moment you switch files
- **No manual toggling** — completely automatic

## Installation

### Manual

1. Download `main.js` and `manifest.json`
2. Create `.obsidian/plugins/folder-accents/` in your vault
3. Place both files there
4. **Settings → Community Plugins** → enable **Folder Accents**

### From Community Plugins (when published)

1. **Settings → Community Plugins → Browse**
2. Search for **Folder Accents**
3. Install and enable

## Usage

1. Open **Settings → Community Plugins → Folder Accents → Options**
2. Click **+ Add Folder**
3. Type a folder name — matching folders appear as you type
4. Pick a colour with the colour picker
5. Open any note in that folder — the accent changes automatically

## Example

| Folder | Colour | Effect |
|--------|--------|--------|
| `_Templates` | `#7F8C8D` (grey) | Grey UI when editing templates |
| `_Skills` | `#5DADE2` (light blue) | Blue UI when viewing skills |
| `02 Daily` | `#E74C3C` (red) | Red UI for journal entries |

## How It Works (Technical)

The plugin injects a small CSS override onto `<body>` when you open a file:

```css
body[data-folder-accent="folder-accent-0"] {
  --color-accent: #7F8C8D !important;
}
```

Because Obsidian themes derive UI colours from `--color-accent`, the entire interface updates instantly — no reload needed.

## Compatibility

- **Obsidian**: v0.15.0+
- **Mobile**: Yes (iOS and Android)
- **Themes**: Any theme using CSS `--color-accent`

## License

MIT
