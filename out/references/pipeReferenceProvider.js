"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipeReferenceProvider = void 0;
const vscode = require("vscode");
class PipeReferenceProvider {
    async provideReferences(document, position, context, token) {
        // 1. Get the text of the current line
        const lineText = document.lineAt(position.line).text;
        // 2. Search for Frank! specific attributes on this line
        const attributeRegex = /(?:name|path|firstPipe|nextPipe)="([^"]*)"/g;
        let match;
        let pipeName = null;
        // 3. Determine if the cursor is actually INSIDE the quotes of such an attribute
        while ((match = attributeRegex.exec(lineText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            // Is the cursor position within the start and end of this attribute?
            if (position.character >= matchStart && position.character <= matchEnd) {
                pipeName = match[1]; // Capture group 1 is the string BETWEEN the quotes, including spaces.
                break;
            }
        }
        // If the cursor was not on a relevant attribute, abort immediately. Saves performance.
        if (!pipeName) {
            return [];
        }
        // 4. Escape the pipe name. Suppose someone (thankfully not in your example) 
        // uses special regex characters like parentheses in a pipe name.
        const escapedPipeName = pipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }
        const locations = [];
        const searchPattern = new vscode.RelativePattern(workspaceFolder, '**/*.xml');
        const excludePattern = new vscode.RelativePattern(workspaceFolder, '{**/target/**,**/build/**,**/.git/**}');
        const files = await vscode.workspace.findFiles(searchPattern, excludePattern, 1000, token);
        // 5. Search with the escaped name. 
        const regex = new RegExp(`\\b(?:name|path|firstPipe|nextPipe)="(${escapedPipeName})"`, 'g');
        for (const file of files) {
            if (token.isCancellationRequested)
                break;
            const doc = await vscode.workspace.openTextDocument(file);
            const text = doc.getText();
            let fileMatch;
            while ((fileMatch = regex.exec(text)) !== null) {
                // Position calculation remains the same, but now it also works with spaces.
                const matchString = fileMatch[0];
                const valueIndex = matchString.indexOf(pipeName);
                const startPos = doc.positionAt(fileMatch.index + valueIndex);
                const endPos = doc.positionAt(fileMatch.index + valueIndex + pipeName.length);
                locations.push(new vscode.Location(file, new vscode.Range(startPos, endPos)));
            }
        }
        return locations;
    }
}
exports.PipeReferenceProvider = PipeReferenceProvider;
//# sourceMappingURL=pipeReferenceProvider.js.map