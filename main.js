const { Plugin, PluginSettingTab, Setting, TFolder, AbstractInputSuggest, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
    mappings: [
        { folder: '_Templates', color: '#7F8C8D' },
        { folder: '_Skills', color: '#5DADE2' }
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
                    if (child instanceof TFolder) {
                        traverse(child);
                    }
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
        
        // Inject dynamic CSS
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'folder-accents-dynamic-css';
        document.head.appendChild(this.styleEl);
        this.updateCSS();
        
        // Watch for file changes
        this.registerEvent(this.app.workspace.on('file-open', () => this.updateAccent()));
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateAccent()));
        
        // Initial check
        this.app.workspace.onLayoutReady(() => this.updateAccent());
        
        // Settings tab
        this.addSettingTab(new FolderAccentsSettingTab(this.app, this));
    }
    
    onunload() {
        if (this.styleEl) this.styleEl.remove();
        document.body.removeAttribute('data-folder-accent');
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
        this.updateCSS();
        this.updateAccent();
    }
    
    updateCSS() {
        let css = '/* Folder Accents - Dynamic Styles */\n';
        this.settings.mappings.forEach((mapping, index) => {
            const safeName = `folder-accent-${index}`;
            css += `body[data-folder-accent="${safeName}"] { --color-accent: ${mapping.color} !important; }\n`;
        });
        this.styleEl.textContent = css;
    }
    
    updateAccent() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            document.body.removeAttribute('data-folder-accent');
            return;
        }
        
        const path = file.path;
        let matchedIndex = -1;
        
        for (let i = 0; i < this.settings.mappings.length; i++) {
            const folder = this.settings.mappings[i].folder;
            if (path === folder || path.startsWith(folder + '/')) {
                matchedIndex = i;
                break;
            }
        }
        
        if (matchedIndex >= 0) {
            document.body.setAttribute('data-folder-accent', `folder-accent-${matchedIndex}`);
        } else {
            document.body.removeAttribute('data-folder-accent');
        }
    }
}

class FolderAccentsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    async display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.classList.add('folder-accents-settings');
        
        containerEl.createEl('h2', { text: 'Folder Accents' });
        containerEl.createEl('p', { 
            text: 'Assign accent colours to folders. When you open a note, the accent colour changes automatically.',
            cls: 'setting-item-description'
        });
        
        // Add new folder button — AT THE TOP
        new Setting(containerEl)
            .setName('Add new folder')
            .setDesc('Map another folder to an accent colour')
            .addButton(btn => btn
                .setButtonText('+ Add Folder')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.mappings.push({ folder: '', color: '#2ECC71' });
                    await this.plugin.saveSettings();
                    this.display();
                }));
        
        // Divider
        const divider = containerEl.createEl('div');
        divider.style.borderTop = '1px solid var(--background-modifier-border)';
        divider.style.margin = '12px 0';
        
        // Sort mappings alphabetically for display
        const sortedMappings = [...this.plugin.settings.mappings].sort((a, b) => {
            return a.folder.localeCompare(b.folder);
        });
        
        // Existing mappings
        sortedMappings.forEach((mapping) => {
            const realIndex = this.plugin.settings.mappings.findIndex(m => 
                m.folder === mapping.folder && m.color === mapping.color
            );
            
            const setting = new Setting(containerEl)
                .setName(mapping.folder || 'New folder')
                .setDesc(`Accent: ${mapping.color}`);
            
            // Color picker
            setting.addColorPicker(color => {
                color.setValue(mapping.color);
                
                color.onChange(async (value) => {
                    this.plugin.settings.mappings[realIndex].color = value;
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
            
            // Text input with folder suggester
            setting.addText(text => {
                text.setPlaceholder('Type to search folders...');
                text.setValue(mapping.folder);
                
                const suggester = new FolderSuggest(
                    this.app,
                    text.inputEl,
                    async (value) => {
                        this.plugin.settings.mappings[realIndex].folder = value;
                        await this.plugin.saveSettings();
                    }
                );
                
                text.onChange(async (value) => {
                    this.plugin.settings.mappings[realIndex].folder = value;
                    await this.plugin.saveSettings();
                });
            });
            
            // Remove button
            setting.addButton(btn => {
                btn.setButtonText('×');
                btn.setTooltip('Remove');
                btn.setWarning();
                
                btn.onClick(async () => {
                    this.plugin.settings.mappings.splice(realIndex, 1);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
        });
        
        // Divider before import/export
        const ioDivider = containerEl.createEl('div');
        ioDivider.style.borderTop = '1px solid var(--background-modifier-border)';
        ioDivider.style.margin = '20px 0';
        
        // Import / Export section
        containerEl.createEl('h3', { text: 'Backup & Restore' });
        
        new Setting(containerEl)
            .setName('Export settings')
            .setDesc('Download your folder-colour mappings as a JSON file.')
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
                }));
        
        new Setting(containerEl)
            .setName('Import settings')
            .setDesc('Load folder-colour mappings from a previously exported JSON file.')
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
                            
                            // Basic validation
                            if (!Array.isArray(imported.mappings)) {
                                throw new Error('Invalid file: "mappings" array not found.');
                            }
                            
                            for (const m of imported.mappings) {
                                if (typeof m.folder !== 'string' || typeof m.color !== 'string') {
                                    throw new Error('Invalid file: each mapping needs a folder and a color.');
                                }
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
    }
}

module.exports = FolderAccentsPlugin;
