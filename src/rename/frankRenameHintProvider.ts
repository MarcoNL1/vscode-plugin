import * as vscode from 'vscode';

export class FrankRenameHintProvider {
    // Define the appearance of the ghost text
    private hintDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ' Press F2 to rename',
            color: new vscode.ThemeColor('editorGhostText.foreground'), 
            margin: '0 0 0 5px',
            fontStyle: 'italic'
        }
    });

    public register(context: vscode.ExtensionContext) {
        // Listen for cursor movements and selections
        const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
            const editor = event.textEditor;
            
            // We only do this in XML files
            if (editor.document.languageId !== 'xml') return;

            // If the user selects multiple lines, do not show a hint
            if (!event.selections[0].isSingleLine) {
                editor.setDecorations(this.hintDecorationType, []);
                return;
            }

            const position = event.selections[0].active;
            const lineText = editor.document.lineAt(position.line).text;

            // Quick, lightweight check: are we on a name= or path= attribute?
            const regex = /(?:name|path|[sS]essionKey)=["']([^"']+)["']/g;
            let match;
            let showHint = false;

            while ((match = regex.exec(lineText)) !== null) {
                const attributeValue = match[1];
                const valueStartIndex = match.index + match[0].indexOf(attributeValue);
                const valueEndIndex = valueStartIndex + attributeValue.length;

                // Check if the cursor is inside the quotes
                if (position.character >= valueStartIndex && position.character <= valueEndIndex) {
                    showHint = true;
                    break;
                }
            }

            if (showHint) {
                // Place the virtual text at the END of the current line
                const range = new vscode.Range(
                    position.line, lineText.length, 
                    position.line, lineText.length
                );
                editor.setDecorations(this.hintDecorationType, [range]);
            } else {
                // Clear the decoration if we are not on a valid attribute
                editor.setDecorations(this.hintDecorationType, []);
            }
        });

        // Clean up the listener when the extension closes
        context.subscriptions.push(selectionChangeListener);
    }
}