"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrankValidator = void 0;
const vscode = require("vscode");
const xmldom_1 = require("@xmldom/xmldom");
class FrankValidator {
    constructor(collection) {
        this.diagnosticCollection = collection;
    }
    validate(document) {
        if (document.languageId !== 'xml')
            return;
        const diagnostics = [];
        const text = document.getText();
        const parser = new xmldom_1.DOMParser({
            locator: {},
            errorHandler: {
                warning: () => { },
                error: () => { },
                fatalError: () => { }
            }
        });
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        // Iterate over Pipelines to ensure scope (pipes in one adapter don't affect another)
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');
        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const validTargets = new Set();
            // 1. Collect all valid targets (Pipe names and Exit names)
            const pipes = pipeline.getElementsByTagName('Pipe');
            for (let j = 0; j < pipes.length; j++) {
                const name = pipes[j].getAttribute('name');
                if (name)
                    validTargets.add(name);
            }
            const exits = pipeline.getElementsByTagName('Exit');
            for (let j = 0; j < exits.length; j++) {
                const name = exits[j].getAttribute('name');
                if (name)
                    validTargets.add(name);
            }
            // 2. Validate Forwards
            const forwards = pipeline.getElementsByTagName('Forward');
            for (let k = 0; k < forwards.length; k++) {
                const forward = forwards[k];
                const path = forward.getAttribute('path');
                if (path && !validTargets.has(path)) {
                    const lineNumber = forward.lineNumber - 1;
                    const lineText = document.lineAt(lineNumber).text;
                    const searchString = `path="${path}"`;
                    const startIndex = lineText.indexOf(searchString);
                    const startCharacter = startIndex !== -1 ? startIndex : 0;
                    const endCharacter = startIndex !== -1 ? startIndex + searchString.length : lineText.length;
                    const range = new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter);
                    const diagnostic = new vscode.Diagnostic(range, `Invalid Forward: The path '${path}' does not exist in this Pipeline.`, vscode.DiagnosticSeverity.Error);
                    diagnostics.push(diagnostic);
                }
            }
        }
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    clear(document) {
        this.diagnosticCollection.delete(document.uri);
    }
}
exports.FrankValidator = FrankValidator;
//# sourceMappingURL=frank-validator.js.map