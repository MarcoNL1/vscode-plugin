import * as vscode from 'vscode';

export class PipeReferenceProvider implements vscode.ReferenceProvider {
    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        
        // 1. Haal de tekst van de huidige regel op
        const lineText = document.lineAt(position.line).text;
        
        // 2. Zoek naar Frank! specifieke attributen op deze regel
        const attributeRegex = /(?:name|path|firstPipe|nextPipe)="([^"]*)"/g;
        let match;
        let pipeName: string | null = null;
        
        // 3. Bepaal of de cursor daadwerkelijk BINNEN de quotes van zo'n attribuut staat
        while ((match = attributeRegex.exec(lineText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            
            // Ligt de cursorpositie binnen de start en end van dit attribuut?
            if (position.character >= matchStart && position.character <= matchEnd) {
                pipeName = match[1]; // Capture group 1 is de string TUSSEN de quotes, inclusief spaties.
                break;
            }
        }
        
        // Als de cursor niet op een relevant attribuut stond, breek direct af. Scheelt performance.
        if (!pipeName) {
            return [];
        }

        // 4. Ontsnap de pipenaam. Stel dat iemand (godzijdank niet in jouw voorbeeld) 
        // speciale regex karakters zoals haakjes in een pipe naam gebruikt.
        const escapedPipeName = pipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        const locations: vscode.Location[] = [];
        const searchPattern = new vscode.RelativePattern(workspaceFolder, '**/*.xml');
        const excludePattern = new vscode.RelativePattern(workspaceFolder, '{**/target/**,**/build/**,**/.git/**}');

        const files = await vscode.workspace.findFiles(searchPattern, excludePattern, 1000, token);

        // 5. Zoek met de ontsnapte naam. 
        const regex = new RegExp(`\\b(?:name|path|firstPipe|nextPipe)="(${escapedPipeName})"`, 'g');

        for (const file of files) {
            if (token.isCancellationRequested) break;

            const doc = await vscode.workspace.openTextDocument(file);
            const text = doc.getText();
            let fileMatch;

            while ((fileMatch = regex.exec(text)) !== null) {
                // Positieberekening blijft hetzelfde, maar nu klopt het ook met spaties.
                const matchString = fileMatch[0];
                const valueIndex = matchString.indexOf(pipeName);
                
                const startPos = doc.positionAt(fileMatch.index + valueIndex);
                const endPos = doc.positionAt(fileMatch.index + valueIndex + pipeName.length);
                
                locations.push(new vscode.Location(file, new vscode.Range(startPos, endPos)));
            }
        }

        return locations;
    }
}