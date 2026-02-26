"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionKeyDefinitionProvider = void 0;
const vscode = require("vscode");
class SessionKeyDefinitionProvider {
    // Notice the 'async' here, as we will be searching through files asynchronously
    async provideDefinition(document, position, token) {
        // 1. Get the word the user clicked on.
        const wordRange = document.getWordRangeAtPosition(position, /[-\w]+/);
        if (!wordRange) {
            return null;
        }
        const clickedWord = document.getText(wordRange);
        // 2. Build the Regex to find the definition.
        const definitionRegex = new RegExp(`(?:storeResultInSessionKey|rootElementSessionKey|reasonSessionKey)\\s*=\\s*["'](${clickedWord})["']|<PutInSessionPipe[^>]*sessionKey\\s*=\\s*["'](${clickedWord})["']`, 'g');
        const locations = [];
        // 3. Find all XML files in the current workspace.
        // We ignore 'node_modules' or 'target' folders to keep it fast.
        const xmlFiles = await vscode.workspace.findFiles('**/*.xml', '{**/node_modules/**,**/target/**}');
        // 4. Loop through all found XML files
        for (const fileUri of xmlFiles) {
            // Check if the user cancelled the action (e.g., pressed Escape)
            if (token.isCancellationRequested) {
                break;
            }
            try {
                // Read the file as raw bytes from the disk (very fast)
                const fileData = await vscode.workspace.fs.readFile(fileUri);
                const fileText = Buffer.from(fileData).toString('utf8');
                // Performance optimization: Quick check if the clicked word is even in this file
                if (!fileText.includes(clickedWord)) {
                    continue; // Skip to the next file
                }
                // Reset regex index before searching
                definitionRegex.lastIndex = 0;
                let match;
                let doc = null;
                // 5. Search for the regex matches in the file
                while ((match = definitionRegex.exec(fileText)) !== null) {
                    // We only "open" the document in VS Code if we actually found a match.
                    // This gives us access to the convenient 'positionAt' method without slowing down the IDE.
                    if (!doc) {
                        doc = await vscode.workspace.openTextDocument(fileUri);
                    }
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(match.index + match[0].length);
                    // Check if the found definition isn't the exact place we already clicked
                    // (in case we are searching the file that is currently open)
                    if (fileUri.fsPath !== document.uri.fsPath || startPos.line !== position.line) {
                        locations.push(new vscode.Location(fileUri, new vscode.Range(startPos, endPos)));
                    }
                }
            }
            catch (error) {
                console.error(`Failed to read file ${fileUri.fsPath}:`, error);
            }
        }
        return locations;
    }
}
exports.SessionKeyDefinitionProvider = SessionKeyDefinitionProvider;
//# sourceMappingURL=sessionKeyDefinitionProvider.js.map