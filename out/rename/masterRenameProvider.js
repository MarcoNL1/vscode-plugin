"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterRenameProvider = void 0;
const frankRenameProvider_1 = require("./frankRenameProvider");
const sessionKeyRenameProvider_1 = require("./sessionKeyRenameProvider");
class MasterRenameProvider {
    constructor() {
        // Instantiate your underlying logic classes
        this.frankProvider = new frankRenameProvider_1.FrankRenameProvider();
        this.sessionProvider = new sessionKeyRenameProvider_1.SessionKeyRenameProvider();
    }
    prepareRename(document, position, token) {
        const line = document.lineAt(position.line).text;
        // 1. Check if the cursor is within a name or path attribute
        const frankRegex = /(?:name|path)\s*=\s*(["'])([^"']+)\1/gi;
        if (this.isCursorInsideAttributeValue(line, position.character, frankRegex)) {
            return this.frankProvider.prepareRename(document, position, token);
        }
        // 2. Check if the cursor is within a sessionKey attribute
        const sessionKeyRegex = /\b(?:\w*sessionKey)\s*=\s*(["'])([^"']+)\1/gi;
        if (this.isCursorInsideAttributeValue(line, position.character, sessionKeyRegex)) {
            return this.sessionProvider.prepareRename(document, position, token);
        }
        throw new Error("Invalid rename location: You can only rename 'name', 'path', or '*sessionKey' attributes.");
    }
    async provideRenameEdits(document, position, newName, token) {
        const line = document.lineAt(position.line).text;
        const frankRegex = /(?:name|path)\s*=\s*(["'])([^"']+)\1/gi;
        if (this.isCursorInsideAttributeValue(line, position.character, frankRegex)) {
            return this.frankProvider.provideRenameEdits(document, position, newName, token);
        }
        const sessionKeyRegex = /\b(?:\w*sessionKey)\s*=\s*(["'])([^"']+)\1/gi;
        if (this.isCursorInsideAttributeValue(line, position.character, sessionKeyRegex)) {
            return this.sessionProvider.provideRenameEdits(document, position, newName, token);
        }
        return null;
    }
    isCursorInsideAttributeValue(line, charIndex, regex) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
            const quoteType = match[1];
            const attributeValue = match[2];
            const valueStartIndex = match.index + match[0].indexOf(quoteType) + 1;
            const valueEndIndex = valueStartIndex + attributeValue.length;
            if (charIndex >= valueStartIndex && charIndex <= valueEndIndex) {
                return true;
            }
        }
        return false;
    }
}
exports.MasterRenameProvider = MasterRenameProvider;
//# sourceMappingURL=masterRenameProvider.js.map