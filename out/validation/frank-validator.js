"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrankValidator = void 0;
const vscode = require("vscode");
const xmldom_1 = require("@xmldom/xmldom");
const expressionValidator_1 = require("./expressionValidator");
class FrankValidator {
    constructor(collection, index) {
        this.diagnosticCollection = collection;
        this.index = index;
        this.expressionValidator = new expressionValidator_1.ExpressionValidator();
    }
    async validate(document, token) {
        if (document.languageId !== 'xml')
            return;
        const diagnostics = [];
        const text = document.getText();
        // 1. Yield to the event loop before running the heavy DOM parser
        await new Promise(resolve => setTimeout(resolve, 0));
        if (token?.isCancellationRequested)
            return;
        const parser = new xmldom_1.DOMParser({
            locator: {},
            errorHandler: {
                warning: () => { },
                error: () => { },
                fatalError: () => { }
            }
        });
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        this.validatePipelines(xmlDoc, document, diagnostics);
        this.validateLocalSenders(xmlDoc, document, diagnostics);
        // 2. Await the asynchronous expression validation
        await this.validateExpressions(xmlDoc, document, diagnostics, token);
        // 3. Final check before committing diagnostics to the UI
        if (token?.isCancellationRequested)
            return;
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    async validateExpressions(xmlDoc, document, diagnostics, token) {
        const elements = xmlDoc.getElementsByTagName('*');
        const attributesToCheck = ['jsonPath', 'xpathExpression'];
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            for (const attrName of attributesToCheck) {
                const attrValue = el.getAttribute(attrName);
                if (attrValue) {
                    if (token?.isCancellationRequested)
                        return;
                    const lineNumber = el.lineNumber - 1;
                    if (lineNumber < 0 || lineNumber >= document.lineCount)
                        continue;
                    const lineText = document.lineAt(lineNumber).text;
                    const startIndex = lineText.indexOf(attrValue);
                    const startCharacter = startIndex !== -1 ? startIndex : 0;
                    const endCharacter = startIndex !== -1 ? startIndex + attrValue.length : lineText.length;
                    const range = new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter);
                    const actualToken = token ?? new vscode.CancellationTokenSource().token;
                    const diagnostic = await this.expressionValidator.checkExpression(attrName, attrValue, range, actualToken);
                    if (diagnostic) {
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }
    validatePipelines(xmlDoc, document, diagnostics) {
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');
        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const validTargets = new Set();
            const allElements = pipeline.getElementsByTagName('*');
            for (let j = 0; j < allElements.length; j++) {
                const tagName = allElements[j].tagName;
                if (tagName && tagName.toLowerCase().includes('pipe')) {
                    const name = allElements[j].getAttribute('name');
                    if (name)
                        validTargets.add(name);
                }
            }
            const exits = pipeline.getElementsByTagName('Exit');
            for (let j = 0; j < exits.length; j++) {
                const name = exits[j].getAttribute('name');
                if (name)
                    validTargets.add(name);
            }
            const forwards = pipeline.getElementsByTagName('Forward');
            for (let k = 0; k < forwards.length; k++) {
                const forward = forwards[k];
                const path = forward.getAttribute('path');
                if (path && !validTargets.has(path)) {
                    const lineNumber = forward.lineNumber - 1;
                    this.addDiagnostic(document, diagnostics, lineNumber, `path="${path}"`, `Invalid Forward: The path '${path}' does not exist in this Pipeline.`);
                }
            }
        }
    }
    validateLocalSenders(xmlDoc, document, diagnostics) {
        const senderTags = ['LocalSender', 'IbisLocalSender'];
        senderTags.forEach(tagName => {
            const senders = xmlDoc.getElementsByTagName(tagName);
            for (let i = 0; i < senders.length; i++) {
                const sender = senders[i];
                const targetListener = sender.getAttribute('javaListener');
                if (targetListener && !this.index.hasJavaListener(targetListener)) {
                    const lineNumber = sender.lineNumber - 1;
                    this.addDiagnostic(document, diagnostics, lineNumber, `javaListener="${targetListener}"`, `Invalid target: The JavaListener '${targetListener}' is not defined in the workspace.`);
                }
            }
        });
    }
    addDiagnostic(document, diagnostics, lineNumber, searchString, message) {
        if (lineNumber < 0 || lineNumber >= document.lineCount)
            return;
        const lineText = document.lineAt(lineNumber).text;
        const startIndex = lineText.indexOf(searchString);
        const startCharacter = startIndex !== -1 ? startIndex : 0;
        const endCharacter = startIndex !== -1 ? startIndex + searchString.length : lineText.length;
        diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter), message, vscode.DiagnosticSeverity.Error));
    }
    clear(document) {
        this.diagnosticCollection.delete(document.uri);
    }
}
exports.FrankValidator = FrankValidator;
//# sourceMappingURL=frank-validator.js.map