"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationIndex = void 0;
const vscode = require("vscode");
const xmldom_1 = require("@xmldom/xmldom");
class ConfigurationIndex {
    constructor() {
        // Map of JavaListener names to their source file URI string
        this.listeners = new Map();
    }
    async buildIndex() {
        // Find all XML files, explicitly ignoring common large/irrelevant directories
        const files = await vscode.workspace.findFiles('**/*.xml', '**/node_modules/**');
        for (const file of files) {
            await this.updateFile(file);
        }
    }
    async updateFile(uri) {
        try {
            // Read the file contents directly from the filesystem to avoid opening editors
            const fileData = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(fileData);
            const parser = new xmldom_1.DOMParser({
                locator: {},
                errorHandler: {
                    warning: () => { },
                    error: () => { },
                    fatalError: (err) => console.error(`[DOMParser] Fatal error parsing ${uri.fsPath}:`, err)
                }
            });
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            // Purge old entries for this specific file before adding new ones
            this.removeFile(uri);
            // Convert HTMLCollections immediately to standard Arrays to enable proper iteration
            const javaListeners = Array.from(xmlDoc.getElementsByTagName('JavaListener'));
            const frankListeners = Array.from(xmlDoc.getElementsByTagName('FrankListener'));
            // Combine into a single iterable array
            const allListeners = [...javaListeners, ...frankListeners];
            for (const listener of allListeners) {
                const name = listener.getAttribute('name');
                if (name) {
                    this.listeners.set(name, uri.toString());
                }
            }
        }
        catch (error) {
            console.error(`Failed to index file: ${uri.fsPath}`, error);
        }
    }
    removeFile(uri) {
        const uriString = uri.toString();
        for (const [name, storedUri] of this.listeners.entries()) {
            if (storedUri === uriString) {
                this.listeners.delete(name);
            }
        }
    }
    hasJavaListener(name) {
        return this.listeners.has(name);
    }
}
exports.ConfigurationIndex = ConfigurationIndex;
//# sourceMappingURL=configuration-index.js.map