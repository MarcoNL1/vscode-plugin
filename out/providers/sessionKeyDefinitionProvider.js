"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionKeyDefinitionProvider = void 0;
const vscode = require("vscode");
class SessionKeyDefinitionProvider {
    provideDefinition(document, position, token) {
        // 1. Get the word the user clicked on.
        const wordRange = document.getWordRangeAtPosition(position, /[-\w]+/);
        if (!wordRange) {
            return null;
        }
        const clickedWord = document.getText(wordRange);
        // 2. Get the full text of the document
        const text = document.getText();
        // 3. Build a Regex to find the definition.
        // We search for known attributes that populate a sessionKey with the exact name of the clicked word.
        const definitionRegex = new RegExp(`(?:storeResultInSessionKey|rootElementSessionKey|reasonSessionKey)\\s*=\\s*["'](${clickedWord})["']|<PutInSessionPipe[^>]*sessionKey\\s*=\\s*["'](${clickedWord})["']`, 'g');
        const locations = [];
        let match;
        // 4. Find all matches in the document
        while ((match = definitionRegex.exec(text)) !== null) {
            // Calculate the start and end position of the matched text
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            // Check if the found definition isn't the exact place we already clicked
            if (startPos.line !== position.line) {
                const range = new vscode.Range(startPos, endPos);
                locations.push(new vscode.Location(document.uri, range));
            }
        }
        return locations;
    }
}
exports.SessionKeyDefinitionProvider = SessionKeyDefinitionProvider;
//# sourceMappingURL=sessionKeyDefinitionProvider.js.map