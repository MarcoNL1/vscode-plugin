"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrankRenameProvider = void 0;
const vscode = require("vscode");
const xmldom_1 = require("@xmldom/xmldom");
class FrankRenameProvider {
    provideRenameEdits(document, position, newName, token) {
        // Match the name based on a valid XML attribute value
        const wordRange = document.getWordRangeAtPosition(position, /[^"']+/);
        if (!wordRange)
            return null;
        const oldName = document.getText(wordRange);
        const text = document.getText();
        const edit = new vscode.WorkspaceEdit();
        // Initialize the XML Parser with a locator to get line numbers
        const parser = new xmldom_1.DOMParser({
            locator: {},
            errorHandler: { warning: () => { }, error: () => { }, fatalError: () => { } }
        });
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');
        let targetPipeline = null;
        // STEP 1: Detect in which Pipeline the cursor (position.line) is located
        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const elements = pipeline.getElementsByTagName('*');
            for (let j = 0; j < elements.length; j++) {
                const el = elements[j];
                const nameAttr = el.getAttribute('name');
                const pathAttr = el.getAttribute('path');
                if (nameAttr === oldName || pathAttr === oldName) {
                    const startLine = el.lineNumber - 1;
                    if (position.line >= startLine && position.line <= startLine + 20) {
                        targetPipeline = pipeline;
                        break;
                    }
                }
            }
            if (targetPipeline)
                break;
        }
        if (!targetPipeline) {
            vscode.window.showInformationMessage("Rename action canceled: Cursor is not within a recognizable <Pipeline> scope.");
            return null;
        }
        // STEP 2: Collect all elements in THIS pipeline that need to be adjusted
        const elementsToRename = [];
        const allElements = targetPipeline.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            // Check for 'name' (Pipes/Exits)
            if (el.getAttribute('name') === oldName) {
                elementsToRename.push({ node: el, attr: 'name' });
            }
            // Check for 'path' (Forwards)
            if (el.getAttribute('path') === oldName) {
                elementsToRename.push({ node: el, attr: 'path' });
            }
        }
        // STEP 3: Carefully construct the text edits
        for (const item of elementsToRename) {
            const startLine = item.node.lineNumber - 1;
            if (startLine < 0 || startLine >= document.lineCount)
                continue;
            // Since tags and attributes can span multiple lines in Frank! configs,
            // we scan downwards from the start tag for a limited number of lines.
            // A limit of 10 lines prevents unnecessarily deep scanning of the document.
            for (let currentLine = startLine; currentLine <= startLine + 10 && currentLine < document.lineCount; currentLine++) {
                const lineText = document.lineAt(currentLine).text;
                // Explicitly search for the attribute assignment to prevent false positives
                // (e.g., matching a random string inside a comment or description)
                const searchStringDouble = `${item.attr}="${oldName}"`;
                const searchStringSingle = `${item.attr}='${oldName}'`;
                let startIndex = lineText.indexOf(searchStringDouble);
                let offset = item.attr.length + 2; // Compensate for the attribute name and ="
                if (startIndex === -1) {
                    startIndex = lineText.indexOf(searchStringSingle);
                }
                // Once we locate the exact line and position of the attribute:
                if (startIndex !== -1) {
                    const startPos = new vscode.Position(currentLine, startIndex + offset);
                    const endPos = new vscode.Position(currentLine, startIndex + offset + oldName.length);
                    edit.replace(document.uri, new vscode.Range(startPos, endPos), newName);
                    // Target found and replaced for this node, move on to the next element
                    break;
                }
            }
        }
        return edit;
    }
    prepareRename(document, position, token) {
        const line = document.lineAt(position.line).text;
        // Strict validation: Ensure we are on a line that contains name= or path=
        if (!line.includes('name=') && !line.includes('path=')) {
            throw new Error("Invalid rename: You can only rename the 'name' attribute of Pipes or the 'path' attribute of Forwards.");
        }
        // Use a Regex to find the exact boundaries of the name= or path= attributes on this line
        const regex = /(?:name|path)=["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const attributeValue = match[1]; // The actual name without quotes (e.g., "Only one line?")
            const valueStartIndex = match.index + match[0].indexOf(attributeValue);
            const valueEndIndex = valueStartIndex + attributeValue.length;
            // Check if the user's cursor is actually positioned inside the quotes of this specific attribute
            if (position.character >= valueStartIndex && position.character <= valueEndIndex) {
                const startPos = new vscode.Position(position.line, valueStartIndex);
                const endPos = new vscode.Position(position.line, valueEndIndex);
                // Explicitly tell VS Code exactly what text to select and replace
                return {
                    range: new vscode.Range(startPos, endPos),
                    placeholder: attributeValue
                };
            }
        }
        throw new Error("Place the cursor explicitly inside the quotes of a 'name' or 'path' attribute.");
    }
}
exports.FrankRenameProvider = FrankRenameProvider;
//# sourceMappingURL=frankRenameProvider.js.map