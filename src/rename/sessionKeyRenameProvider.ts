import * as vscode from 'vscode';

export class SessionKeyRenameProvider implements vscode.RenameProvider {
    
    async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Range | { range: vscode.Range; placeholder: string; }> {
        
        // Extract the exact word under the cursor, ignoring quotes
        const wordRange = document.getWordRangeAtPosition(position, /[^"']+/);
        if (!wordRange) {
            throw new Error("Invalid position for renaming a session key.");
        }

        const line = document.lineAt(position.line).text;
        const clickedWord = document.getText(wordRange);

        // Strictly validate if the cursor is positioned within a session key attribute value.
        // Matches attributes like 'sessionKey', 'storeResultInSessionKey', 'getInputFromSessionKey', etc.
        const sessionKeyRegex = new RegExp(`\\b(\\w*sessionKey)\\s*=\\s*["']${clickedWord}["']`, 'i');
        
        if (!sessionKeyRegex.test(line)) {
            throw new Error("Rename action canceled: Cursor is not positioned on a valid session key attribute.");
        }

        return {
            range: wordRange,
            placeholder: clickedWord
        };
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | null> {
        
        const wordRange = document.getWordRangeAtPosition(position, /[^"']+/);
        if (!wordRange) return null;

        const oldName = document.getText(wordRange);
        const edit = new vscode.WorkspaceEdit();

        // Retrieve all XML files in the workspace, explicitly ignoring build output and dependencies to maintain performance.
        const xmlFiles = await vscode.workspace.findFiles('**/*.xml', '{**/node_modules/**,**/target/**}');

        // Regex captures:
        // Group 1: The attribute name (e.g., storeResultInSessionKey)
        // Group 2: The opening quote (" or ')
        // Group 3: The actual session key value to replace
        const renameRegex = new RegExp(`\\b(\\w*sessionKey)\\s*=\\s*(["'])(${oldName})\\2`, 'gi');

        for (const fileUri of xmlFiles) {
            if (token.isCancellationRequested) {
                break;
            }

            try {
                // Buffer reading is significantly faster than fully opening the document in the IDE
                const fileData = await vscode.workspace.fs.readFile(fileUri);
                const fileText = Buffer.from(fileData).toString('utf8');

                // Quick bail-out if the old session key name doesn't even exist in this file
                if (!fileText.includes(oldName)) {
                    continue;
                }

                let match;
                renameRegex.lastIndex = 0;
                let doc: vscode.TextDocument | null = null;

                while ((match = renameRegex.exec(fileText)) !== null) {
                    
                    // Lazy load the TextDocument only if a match is confirmed, saving memory overhead
                    if (!doc) {
                        doc = await vscode.workspace.openTextDocument(fileUri);
                    }

                    const attrNameLength = match[1].length;
                    
                    // Calculate exact offsets to only replace the value, keeping the attribute name and quotes intact
                    const equalsAndQuoteLength = match[0].indexOf(match[2], attrNameLength) + 1 - attrNameLength; 
                    
                    const valueStartOffset = match.index + attrNameLength + equalsAndQuoteLength;
                    const valueEndOffset = valueStartOffset + oldName.length;

                    const startPos = doc.positionAt(valueStartOffset);
                    const endPos = doc.positionAt(valueEndOffset);

                    // Add the text replacement instruction to the WorkspaceEdit batch
                    edit.replace(fileUri, new vscode.Range(startPos, endPos), newName);
                }
            } catch (error) {
                console.error(`Failed to process workspace edit for file ${fileUri.fsPath}:`, error);
            }
        }

        return edit;
    }
}