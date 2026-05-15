/* Copyright (C) 2026 Emma
   Github:  https://github.com/wrongvibe/folder-accents
   Support: https://buymeacoffee.com/wrongvibe
   SPDX-License-Identifier: GPL-3.0-only */

const { Plugin, PluginSettingTab, Setting, TFolder, AbstractInputSuggest, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
    mappings: [
        { id: 1, folder: '_Templates', color: '#7F8C8D' },
        { id: 2, folder: '_Skills', color: '#5DADE2' }
    ]
};

/* Custom suggester for folders */
class FolderSuggest extends AbstractInputSuggest {
    constructor(app, inputEl, onSelect) {
        super(app, inputEl);
        this.onSelect = onSelect;
    }

    getSuggestions(query) {
        const folders = [];
        const root = this.app.vault.getRoot();

        const traverse = (folder) => {
            if (folder.path && folder.path !== '/') {
                folders.push(folder.path);
            }
            if (folder.children) {
                folder.children.forEach(child => {
                    if (child instanceof TFolder) traverse(child);
                });
            }
        };

        traverse(root);

        const lowerQuery = query.toLowerCase();
        return folders
            .filter(f => f.toLowerCase().includes(lowerQuery))
            .sort((a, b) => a.localeCompare(b));
    }

    renderSuggestion(value, el) {
        el.setText(value);
        el.style.padding = '6px 10px';
        el.style.cursor = 'pointer';
    }

    selectSuggestion(value) {
        this.setValue(value);
        this.onSelect(value);
        this.close();
    }
}

class FolderAccentsPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        this.styleEl = document.createElement('style');
        this.styleEl.id = 'folder-accents-dynamic-css';
        document.head.appendChild(this.styleEl);
        this.updateCSS();

        this.registerEvent(this.app.workspace.on('file-open', () => this.updateAccent()));
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateAccent()));

        // Canvas markdown embeds render inside sandboxed iframes whose document
        // does not inherit the parent's CSS custom properties. Push --color-accent
        // into each one directly. allow-same-origin lets us reach contentDocument.
        this.iframeObserver = new MutationObserver((mutations) => {
            for (const mut of mutations) {
                for (const node of mut.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches && node.matches('iframe.embed-iframe')) {
                        this.setupIframe(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('iframe.embed-iframe').forEach(f => this.setupIframe(f));
                    }
                }
            }
        });
        this.iframeObserver.observe(document.body, { childList: true, subtree: true });

        this.app.workspace.onLayoutReady(() => {
            this.updateAccent();
            document.querySelectorAll('iframe.embed-iframe').forEach(f => this.setupIframe(f));
        });

        this.addSettingTab(new FolderAccentsSettingTab(this.app, this));
    }

    onunload() {
        if (this.styleEl) this.styleEl.remove();
        if (this.iframeObserver) this.iframeObserver.disconnect();
        document.body.removeAttribute('data-folder-accent');
        document.querySelectorAll('iframe.embed-iframe').forEach(iframe => {
            try { iframe.contentDocument?.body?.style.removeProperty('--color-accent'); } catch (e) {}
        });
    }

    setupIframe(iframe) {
        const apply = () => this.applyAccentToIframe(iframe);
        iframe.addEventListener('load', apply);
        apply();
    }

    applyAccentToIframe(iframe) {
        try {
            const body = iframe.contentDocument?.body;
            if (!body) return;
            const color = this.getActiveColor();
            if (color) {
                body.style.setProperty('--color-accent', color, 'important');
            } else {
                body.style.removeProperty('--color-accent');
            }
        } catch (e) { /* cross-origin or detached */ }
    }

    getActiveColor() {
        const attr = document.body.getAttribute('data-folder-accent');
        if (!attr) return null;
        const match = attr.match(/folder-accent-(\d+)/);
        if (!match) return null;
        return this.settings.mappings[parseInt(match[1])]?.color || null;
    }

    syncIframes() {
        document.querySelectorAll('iframe.embed-iframe').forEach(f => this.applyAccentToIframe(f));
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        // Migrate: ensure every mapping has a unique id
        this.settings.mappings.forEach((m, i) => {
            if (!m.id) m.id = Date.now() + i;
        });
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateCSS();
        this.updateAccent();
    }

    updateCSS() {
        let css = '/* Folder Accents - Dynamic Styles */\n';
        this.settings.mappings.forEach((mapping, index) => {
            css += `body[data-folder-accent="folder-accent-${index}"] { --color-accent: ${mapping.color} !important; }\n`;
        });
        this.styleEl.textContent = css;
    }

    updateAccent() {
        // Prefer the active leaf's primary file. When editing an embedded markdown
        // inside a canvas, getActiveFile() returns the embedded note's file — but
        // the leaf itself is still the canvas, so activeLeaf.view.file stays correct.
        const leafFile = this.app.workspace.activeLeaf?.view?.file;
        const file = leafFile || this.app.workspace.getActiveFile();

        // Canvas card is being text-edited — keep current accent
        if (document.querySelector('.canvas-node.is-editing')) return;
        if (!file) return;

        const path = file.path;
        let bestIndex = -1;
        let bestLen = -1;

        // Longest (most specific) folder path wins — avoids order-dependent surprises
        this.settings.mappings.forEach((mapping, i) => {
            const folder = mapping.folder;
            if (folder && (path === folder || path.startsWith(folder + '/')) && folder.length > bestLen) {
                bestIndex = i;
                bestLen = folder.length;
            }
        });

        if (bestIndex >= 0) {
            document.body.setAttribute('data-folder-accent', `folder-accent-${bestIndex}`);
        } else {
            document.body.removeAttribute('data-folder-accent');
        }
        this.syncIframes();
    }
}

class FolderAccentsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.classList.add('folder-accents-settings');

        containerEl.createEl('h3', { text: 'Folder Accents' });
        const descEl = containerEl.createEl('p');
        descEl.appendText('Companion plugin for the ');
        descEl.createEl('a', { text: 'COLOURS', href: 'https://github.com/wrongvibe/colours' });
        descEl.appendText(' theme. Assigns a unique accent colour to each folder — the entire palette shifts automatically when you open a note.');

        const supportEl = containerEl.createEl('p');
        supportEl.appendText('If you enjoy this plugin and ');
        supportEl.createEl('a', { text: 'COLOURS', href: 'https://github.com/wrongvibe/colours' });
        supportEl.appendText(', ');
        const coffeeLink = supportEl.createEl('a', { href: 'https://buymeacoffee.com/wrongvibe', attr: { style: 'text-decoration: underline;' } });
        coffeeLink.appendText('buy me a ');
        coffeeLink.createEl('span', { text: '☕', attr: { style: 'font-size: 1.4em; vertical-align: middle; font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;' } });
        supportEl.appendText('!');

        const descDivider = containerEl.createEl('div');
        descDivider.style.borderTop = '1px solid var(--background-modifier-border)';
        descDivider.style.margin = '16px 0';

        new Setting(containerEl)
            .setName('Add new folder')
            .setDesc('Map another folder to an accent colour')
            .addButton(btn => btn
                .setButtonText('+ Add Folder')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.mappings.push({ id: Date.now(), folder: '', color: '#0d0d73' });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName('Backup & Restore')
            .setDesc('Export your mappings to a JSON file, or restore from one.')
            .addButton(btn => btn
                .setButtonText('Export')
                .onClick(() => {
                    const data = JSON.stringify(this.plugin.settings, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'folder-accents-settings.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    new Notice('Folder Accents settings exported!');
                }))
            .addButton(btn => btn
                .setButtonText('Import')
                .onClick(() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.style.display = 'none';

                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        try {
                            const text = await file.text();
                            const imported = JSON.parse(text);

                            if (!Array.isArray(imported.mappings)) {
                                throw new Error('Invalid file: "mappings" array not found.');
                            }

                            const colorTest = new Option().style;
                            for (const m of imported.mappings) {
                                if (typeof m.folder !== 'string' || typeof m.color !== 'string') {
                                    throw new Error('Invalid file: each mapping needs a folder and a color.');
                                }
                                colorTest.color = m.color;
                                if (colorTest.color === '') {
                                    throw new Error(`Invalid color value: "${m.color}"`);
                                }
                                if (!m.id) m.id = Date.now() + Math.random();
                            }

                            this.plugin.settings = imported;
                            await this.plugin.saveSettings();
                            new Notice('Folder Accents settings imported successfully!');
                            this.display();
                        } catch (err) {
                            new Notice('Import failed: ' + err.message);
                        }

                        document.body.removeChild(input);
                    };

                    document.body.appendChild(input);
                    input.click();
                }));

        // Divider before folder list
        const divider = containerEl.createEl('div');
        divider.style.borderTop = '1px solid var(--background-modifier-border)';
        divider.style.margin = '12px 0';

        containerEl.createEl('p', {
            text: 'Priority: the most specific (deepest) folder path always wins. Projects/Work overrides Projects for any note inside it.',
            cls: 'setting-item-description'
        });

        // Sort mappings alphabetically for display
        const sortedMappings = [...this.plugin.settings.mappings].sort((a, b) => {
            return a.folder.localeCompare(b.folder);
        });

        // Existing mappings — sorted objects are references to the originals, so direct mutation works
        sortedMappings.forEach((mapping) => {
            const setting = new Setting(containerEl)
                .setName(mapping.folder || 'New folder')
                .setDesc(`Accent: ${mapping.color}`);

            // Color picker
            setting.addColorPicker(color => {
                color.setValue(mapping.color);
                color.onChange(async (value) => {
                    mapping.color = value;
                    await this.plugin.saveSettings();
                    this.display();
                });
            });

            // Text input with folder suggester
            setting.addText(text => {
                text.setPlaceholder('Type to search folders...');
                text.setValue(mapping.folder);

                new FolderSuggest(
                    this.app,
                    text.inputEl,
                    async (value) => {
                        mapping.folder = value;
                        await this.plugin.saveSettings();
                    }
                );

                // Update in-memory value while typing; save only on blur
                text.onChange((value) => {
                    mapping.folder = value;
                });

                text.inputEl.addEventListener('blur', async () => {
                    await this.plugin.saveSettings();
                });
            });

            // Remove button — look up by id so splice targets the right entry
            setting.addButton(btn => {
                btn.setButtonText('×');
                btn.setTooltip('Remove');
                btn.setWarning();
                btn.onClick(async () => {
                    const index = this.plugin.settings.mappings.findIndex(m => m.id === mapping.id);
                    if (index >= 0) this.plugin.settings.mappings.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
        });

    }
}

module.exports = FolderAccentsPlugin;
