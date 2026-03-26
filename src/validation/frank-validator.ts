import * as vscode from 'vscode';
import { DOMParser } from '@xmldom/xmldom';
import { ConfigurationIndex } from './configuration-index';
import { ExpressionValidator } from './expressionValidator';

interface LocatableNode extends Element {
    lineNumber: number;
}

export class FrankValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private index: ConfigurationIndex;
    private expressionValidator: ExpressionValidator;

    constructor(collection: vscode.DiagnosticCollection, index: ConfigurationIndex) {
        this.diagnosticCollection = collection;
        this.index = index;
        this.expressionValidator = new ExpressionValidator();
    }

    public async validate(document: vscode.TextDocument, token?: vscode.CancellationToken) {
        if (document.languageId !== 'xml') return;

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 1. Yield to the event loop before running the heavy DOM parser
        await new Promise(resolve => setTimeout(resolve, 0));
        if (token?.isCancellationRequested) return;

        const parser = new DOMParser({
            locator: {},
            errorHandler: {
                warning: () => {},
                error: () => {},
                fatalError: () => {}
            }
        });
        
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        this.validatePipelines(xmlDoc, document, diagnostics);
        this.validateLocalSenders(xmlDoc, document, diagnostics);
        
        // 2. Await the asynchronous expression validation
        await this.validateExpressions(xmlDoc, document, diagnostics, token);

        // 3. Final check before committing diagnostics to the UI
        if (token?.isCancellationRequested) return;

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private async validateExpressions(xmlDoc: Document, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[], token?: vscode.CancellationToken) {
        const elements = xmlDoc.getElementsByTagName('*');
        const attributesToCheck = ['jsonPath', 'xpathExpression'];

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            
            for (const attrName of attributesToCheck) {
                const attrValue = el.getAttribute(attrName);
                if (attrValue) {
                    if (token?.isCancellationRequested) return;

                    const lineNumber = (el as unknown as LocatableNode).lineNumber - 1;
                    if (lineNumber < 0 || lineNumber >= document.lineCount) continue;

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

    private validatePipelines(xmlDoc: Document, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');

        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const validTargets = new Set<string>();

            const allElements = pipeline.getElementsByTagName('*');
            for (let j = 0; j < allElements.length; j++) {
                const tagName = allElements[j].tagName;
                if (tagName && tagName.toLowerCase().includes('pipe')) {
                    const name = allElements[j].getAttribute('name');
                    if (name) validTargets.add(name);
                }
            }

            const exits = pipeline.getElementsByTagName('Exit');
            for (let j = 0; j < exits.length; j++) {
                const name = exits[j].getAttribute('name');
                if (name) validTargets.add(name);
            }

            const forwards = pipeline.getElementsByTagName('Forward');
            for (let k = 0; k < forwards.length; k++) {
                const forward = forwards[k];
                const path = forward.getAttribute('path');
                
                if (path && !validTargets.has(path)) {
                    const lineNumber = (forward as unknown as LocatableNode).lineNumber - 1;
                    this.addDiagnostic(
                        document, 
                        diagnostics, 
                        lineNumber, 
                        `path="${path}"`, 
                        `Invalid Forward: The path '${path}' does not exist in this Pipeline.`
                    );
                }
            }
        }
    }

    private validateLocalSenders(xmlDoc: Document, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const senderTags = ['LocalSender', 'IbisLocalSender'];

        senderTags.forEach(tagName => {
            const senders = xmlDoc.getElementsByTagName(tagName);
            
            for (let i = 0; i < senders.length; i++) {
                const sender = senders[i];
                const targetListener = sender.getAttribute('javaListener');
                
                if (targetListener && !this.index.hasJavaListener(targetListener)) {
                    const lineNumber = (sender as unknown as LocatableNode).lineNumber - 1;
                    this.addDiagnostic(
                        document, 
                        diagnostics, 
                        lineNumber, 
                        `javaListener="${targetListener}"`, 
                        `Invalid target: The JavaListener '${targetListener}' is not defined in the workspace.`
                    );
                }
            }
        });
    }

    private addDiagnostic(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[], lineNumber: number,
         searchString: string, message: string) {
        if (lineNumber < 0 || lineNumber >= document.lineCount) return;

        const lineText = document.lineAt(lineNumber).text;
        const startIndex = lineText.indexOf(searchString);
        
        const startCharacter = startIndex !== -1 ? startIndex : 0;
        const endCharacter = startIndex !== -1 ? startIndex + searchString.length : lineText.length;

        diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter),
            message,
            vscode.DiagnosticSeverity.Error
        ));
    }

    public clear(document: vscode.TextDocument) {
        this.diagnosticCollection.delete(document.uri);
    }
}