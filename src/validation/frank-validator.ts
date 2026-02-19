import * as vscode from 'vscode';
import { DOMParser } from '@xmldom/xmldom';
import { TextDecoder } from 'util';

export class FrankValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(collection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = collection;
    }

    public async validate(document: vscode.TextDocument) {
        if (document.languageId !== 'xml') return;

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        const parser = new DOMParser({
            locator: {},
            errorHandler: {
                warning: () => {},
                error: () => {},
                fatalError: () => {}
            }
        });
        
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        // Phase 1: Pipeline-scoped Validation (Pipes and Forwards)
        this.validatePipelines(xmlDoc, document, diagnostics);

        // Attach all found diagnostics to the document
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private validatePipelines(xmlDoc: Document, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');

        for (let i = 0; i < pipelines.length; i++) {
            const pipeline = pipelines[i];
            const validTargets = new Set<string>();

            // 1. Collect valid targets (Pipes and Exits)
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

            // 2. Validate Forwards against the targets
            const forwards = pipeline.getElementsByTagName('Forward');
            for (let k = 0; k < forwards.length; k++) {
                const forward = forwards[k];
                const path = forward.getAttribute('path');
                
                if (path && !validTargets.has(path)) {
                    const lineNumber = (forward as any).lineNumber - 1;
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

    /**
     * Helper method to find the exact string on a line and create a diagnostic error.
     */
    private addDiagnostic(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[], lineNumber: number, searchString: string, message: string) {
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