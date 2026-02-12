declare class SnippetsService {
    context: any;
    constructor(context: any);
    getUserSnippetsPath(): string;
    getFrameworkSnippetsPath(): string;
    ensureSnippetsFilesExists(): void;
    getUserSnippets(): any;
    setUserSnippets(userSnippets: any): void;
    getFrameworkSnippets(): any;
    addNewUserSnippet(userSnippetsTreeProvider: any): Promise<void>;
    deleteUserSnippet(category: any, snippetIndex: any): void;
    deleteAllUserSnippetByCategory(category: any): void;
    changeCategoryOfUserSnippets(oldCategory: any, category: any): void;
    addNewCategoryOfUserSnippets(userSnippetsTreeProvider: any): Promise<void>;
    uploadUserSnippet(category: any): Promise<void>;
    prettifyXml(xml: any): any;
    extractSnippets(targetDir: any): void;
    loadFrankFrameworkSnippets(): void;
}
export default SnippetsService;
//# sourceMappingURL=snippets-service.d.ts.map