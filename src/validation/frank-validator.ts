import * as vscode from 'vscode';
import { DOMParser } from '@xmldom/xmldom';

export class FrankValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(collection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = collection;
    }

    public validate(document: vscode.TextDocument) {
        if (document.languageId !== 'xml') return;

        const diagnostics: vscode.Diagnostic[] =[];
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

        // Iterate over Pipelines to ensure scope (pipes in one adapter don't affect another)
        const pipelines = xmlDoc.getElementsByTagName('Pipeline');

        for (let i = 0; i < pipelines.length; i++){
            const pipeline = pipelines[i];
            const validTargets = new Set<string>();

            // 1. Collect all valid targets (Pipe names and Exit names)
            const allElements = pipeline.getElementsByTagName('*');
            for (let j = 0; j < allElements.length; j++){
                const tagName = allElements[j].tagName;
                // Check if the tag name contains "pipe" (e.g., Pipe, SenderPipe, ReceiverPipe)
                if (tagName && tagName.toLowerCase().includes('pipe')) {
                    const name = allElements[j].getAttribute('name');
                    if (name) validTargets.add(name);
                }
            }

            const exits = pipeline.getElementsByTagName('Exit');
            for (let j = 0; j < exits.length; j++){
                const name = exits[j].getAttribute('name');
                if (name) validTargets.add(name);
            }

            // 2. Validate Forwards
            const forwards = pipeline.getElementsByTagName('Forward');
            for (let k = 0; k < forwards.length; k++) {
                const forward = forwards[k];
                const path = forward.getAttribute('path');
                
                if (path && !validTargets.has(path)) {
                    const lineNumber = (forward as any).lineNumber - 1; 
                    
                    const lineText = document.lineAt(lineNumber).text;
                    
                    const searchString = `path="${path}"`;
                    
                    const startIndex = lineText.indexOf(searchString);
                    
                    const startCharacter = startIndex !== -1 ? startIndex : 0;
                    const endCharacter = startIndex !== -1 ? startIndex + searchString.length : lineText.length;

                    const range = new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter);
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Invalid Forward: The path '${path}' does not exist in this Pipeline.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);

        }

        public clear(document: vscode.TextDocument) {
            this.diagnosticCollection.delete(document.uri);
        }

    }