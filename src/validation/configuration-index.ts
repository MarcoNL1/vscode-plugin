import * as vscode from 'vscode';
import { DOMParser } from '@xmldom/xmldom';

export class ConfigurationIndex {
    // Map of JavaListener names to their source file URI string
    private javaListeners: Map<string, string> = new Map();

    public async buildIndex(): Promise<void> {
        // Find all XML files, explicitly ignoring common large/irrelevant directories
        const files = await vscode.workspace.findFiles('**/*.xml', '**/node_modules/**');
        
        for (const file of files) {
            await this.updateFile(file);
        }
    }

    public async updateFile(uri: vscode.Uri): Promise<void> {
        try {
            // Read the file contents directly from the filesystem to avoid opening editors
            const fileData = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(fileData);

            const parser = new DOMParser({
                locator: {},
                errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} }
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
        } catch (error) {
            console.error(`Failed to index file: ${uri.fsPath}`, error);
        }
    }

    public removeFile(uri: vscode.Uri): void {
        const uriString = uri.toString();
        for (const [name, storedUri] of this.javaListeners.entries()) {
            if (storedUri === uriString) {
                this.javaListeners.delete(name);
            }
        }
    }

    public hasJavaListener(name: string): boolean {
        return this.javaListeners.has(name);
    }
}