import * as vscode from 'vscode';

export class PipeReferenceProvider implements vscode.ReferenceProvider {
    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        
        // 1. Validate if the cursor is on a valid Frank! attribute
        const lineText = document.lineAt(position.line).text;
        const attributeRegex = /(?:name|path|firstPipe|nextPipe)="([^"]*)"/g;
        let match;
        let pipeName: string | null = null;
        
        while ((match = attributeRegex.exec(lineText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            
            if (position.character >= matchStart && position.character <= matchEnd) {
                pipeName = match[1];
                break;
            }
        }
        
        if (!pipeName) {
            return [];
        }

        const escapedPipeName = pipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const locations: vscode.Location[] = [];

        // 2. Isolate the current <Pipeline> scope using document offsets
        const fullText = document.getText();
        const cursorOffset = document.offsetAt(position);
        
        // Find the start of the pipeline before the cursor
        const pipelineStart = fullText.lastIndexOf('<Pipeline', cursorOffset);
        
        // Find the end of the pipeline after the cursor
        let pipelineEnd = fullText.indexOf('</Pipeline>', cursorOffset);
        
        // Defensive check: if no end tag is found, default to end of document
        if (pipelineEnd !== -1) {
            pipelineEnd += '</Pipeline>'.length; 
        } else {
            pipelineEnd = fullText.length;
        }

        // If we can't find a start tag, or it's malformed, exit early
        if (pipelineStart === -1 || pipelineStart > cursorOffset) {
            return [];
        }

        // 3. Extract only the text of the current pipeline block
        const pipelineText = fullText.substring(pipelineStart, pipelineEnd);
        
        // 4. Search within the isolated block
        const searchRegex = new RegExp(`\\b(?:name|path|firstPipe|nextPipe)="(${escapedPipeName})"`, 'g');
        let blockMatch;

        while ((blockMatch = searchRegex.exec(pipelineText)) !== null) {
            if (token.isCancellationRequested) {
                break;
            }

            const matchString = blockMatch[0];
            const valueIndex = matchString.indexOf(pipeName);

            const absoluteIndex = pipelineStart + blockMatch.index + valueIndex;
            
            const startPos = document.positionAt(absoluteIndex);
            const endPos = document.positionAt(absoluteIndex + pipeName.length);
            
            locations.push(new vscode.Location(document.uri, new vscode.Range(startPos, endPos)));
        }

        return locations;
    }
}