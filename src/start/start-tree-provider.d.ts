import * as vscode from 'vscode';
declare class StartTreeProvider {
    context: any;
    startService: any;
    _onDidChangeTreeData: any;
    onDidChangeTreeData: any;
    startTreeItems: any[];
    constructor(context: any, startService: any);
    refresh(): void;
    rebuild(): void;
    getTreeItem(snippet: any): any;
    getChildren(element: any): any[];
    isInWorkspace(projectPath: any, workspaceFolders: any): any;
}
declare class ProjectTreeItem extends vscode.TreeItem {
    path: any;
    method: any;
    startService: any;
    constructor(project: any, path: any, method: any, startService: any);
}
export { StartTreeProvider, ProjectTreeItem };
//# sourceMappingURL=start-tree-provider.d.ts.map