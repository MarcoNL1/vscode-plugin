import * as vscode from 'vscode';
declare class SnippetsTreeProvider {
    _onDidChangeTreeData: any;
    onDidChangeTreeData: any;
    userSnippetsService: any;
    userSnippetsTreeItems: any[];
    rootTreeItem: any;
    rootTreeItems: any[];
    constructor(userSnippetsService: any);
    refresh(): void;
    rebuild(): void;
    getTreeItem(treeItem: any): any;
    getChildren(treeItem: any): any[];
    convertUserSnippetToCategoryTreeItem(category: any, root: any, userSnippetsPerCategory: any): CategoryTreeItem;
    convertFrameworkSnippetToCategoryTreeItem(category: any, root: any, snippets: any): CategoryTreeItem;
}
declare class CategoryTreeItem extends vscode.TreeItem {
    userSnippetsPerCategory: any[];
    snippetTreeItems: any[];
    root: any;
    constructor(category: any, root: any, userSnippetsPerCategory: any[], collapsibleState: any);
    convertSnippetsToSnippetTreeItems(): void;
    getSnippetTreeItems(): any[];
}
export { SnippetsTreeProvider };
//# sourceMappingURL=snippets-tree-provider.d.ts.map