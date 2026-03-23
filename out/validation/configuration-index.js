"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationIndex = void 0;
const vscode = require("vscode");
const xmldom_1 = require("@xmldom/xmldom");
class ConfigurationIndex {
    constructor() {
        // Map of JavaListener names to their source file URI string
        this.javaListeners = new Map();
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
                errorHandler: { warning: () => { }, error: () => { }, fatalError: () => { } }
            });
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            // Purge old entries for this specific file before adding new ones
            this.removeFile(uri);
            const listeners = xmlDoc.getElementsByTagName('JavaListener');
            for (let i = 0; i < listeners.length; i++) {
                const name = listeners[i].getAttribute('name');
                if (name) {
                    this.javaListeners.set(name, uri.toString());
                }
            }
        }
        catch (error) {
            console.error(`Failed to index file: ${uri.fsPath}`, error);
        }
    }
    removeFile(uri) {
        const uriString = uri.toString();
        for (const [name, storedUri] of this.javaListeners.entries()) {
            if (storedUri === uriString) {
                this.javaListeners.delete(name);
            }
        }
    }
    hasJavaListener(name) {
        return this.javaListeners.has(name);
    }
}
exports.ConfigurationIndex = ConfigurationIndex;
//# sourceMappingURL=configuration-index.js.map