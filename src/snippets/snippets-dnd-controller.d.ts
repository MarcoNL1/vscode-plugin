declare class SnippetsDndController {
    context: any;
    snippetsTreeProvider: any;
    snippetsService: any;
    dragMimeTypes: string[];
    dropMimeTypes: string[];
    constructor(context: any, snippetsTreeProvider: any, snippetsService: any);
    handleDrag(sourceItems: any, dataTransfer: any, token: any): Promise<void>;
    handleDrop(target: any, dataTransfer: any, token: any): Promise<void>;
    dispose(): void;
}
export { SnippetsDndController };
//# sourceMappingURL=snippets-dnd-controller.d.ts.map