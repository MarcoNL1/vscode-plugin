import * as vscode from 'vscode';

class SnippetsTreeProvider {
  _onDidChangeTreeData: any;
  onDidChangeTreeData: any;
  userSnippetsService: any;
  userSnippetsTreeItems: any[];
  rootTreeItem: any;
  rootTreeItems: any[];

  constructor(userSnippetsService: any) {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    this.userSnippetsService = userSnippetsService;
    this.userSnippetsTreeItems = [];
    this.rootTreeItem = null;

    this.rebuild();
  }

  refresh() {
    this._onDidChangeTreeData.fire(null);
  }

  rebuild() {
    const userCategories = [];
    const frameworkCategories = [];

    const userSnippets = this.userSnippetsService.getUserSnippets();
    const frameworkSnippets = this.userSnippetsService.getFrameworkSnippets();

    for (const category in userSnippets) {
      userCategories.push(
        this.convertUserSnippetToCategoryTreeItem(category, "user", userSnippets[category])
      );
    }

    for (const category in frameworkSnippets) {
      if (frameworkSnippets[category].length <= 0) continue;

      frameworkCategories.push(
        this.convertFrameworkSnippetToCategoryTreeItem(category, "framework", frameworkSnippets[category])
      );
    }

    this.rootTreeItems = [
      new RootTreeItem("User Snippets", userCategories, "userSnippetsRoot"),
      new RootTreeItem("Framework Snippets", frameworkCategories, "frameworkSnippetsRoot")
    ];
  }

  getTreeItem(treeItem) {
    return treeItem;
  }

  getChildren(treeItem) {
    if (!treeItem) {
      return this.rootTreeItems;
    }

    if (treeItem instanceof RootTreeItem) {
      return treeItem.getCategoryTreeItems();
    }

    if (treeItem instanceof CategoryTreeItem) {
      return treeItem.getSnippetTreeItems();
    }

    return [];
  }

  convertUserSnippetToCategoryTreeItem(category, root, userSnippetsPerCategory) {
    return new CategoryTreeItem(category, root, userSnippetsPerCategory, vscode.TreeItemCollapsibleState.Expanded);
  }

  convertFrameworkSnippetToCategoryTreeItem(category, root, snippets) {
    return new CategoryTreeItem(category, root, snippets, vscode.TreeItemCollapsibleState.Collapsed);
  }

}

class RootTreeItem {
  label: any;
  collapsibleState: any;
  categoryTreeItems: any[];
  contextValue: any;

  constructor(label: any, categoryTreeItems: any[], contextValue?: any) {
    this.label = label;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.categoryTreeItems = categoryTreeItems;
    this.contextValue = contextValue ?? "snippetsRoot";
  }

  getCategoryTreeItems() {
    return this.categoryTreeItems;
  }
}

class CategoryTreeItem extends vscode.TreeItem {
  userSnippetsPerCategory: any[];
  snippetTreeItems: any[];
  root: any;

  constructor(category: any, root: any, userSnippetsPerCategory: any[], collapsibleState: any) {
    super(category, collapsibleState);
    this.userSnippetsPerCategory = userSnippetsPerCategory;
    this.snippetTreeItems = [];
    this.root = root;
    this.contextValue = `categoryTreeItem-${root}`;

    if (this.root == "user") {
      this.command = {
        command: "frank.showUserSnippetsViewPerCategory",
        title: "Show Snippets",
        arguments: [category]
      };
    }
    
    this.convertSnippetsToSnippetTreeItems();
  }

  convertSnippetsToSnippetTreeItems() {
    const arr: any[] = [];

    this.userSnippetsPerCategory.forEach((snippet: any, index: any) => {
      arr.push(new SnippetTreeItem(snippet.prefix, snippet.body, this.root, this.label, index));
    });

    this.snippetTreeItems = arr;
  }

  getSnippetTreeItems() {
    return this.snippetTreeItems;
  }
}

class SnippetTreeItem extends vscode.TreeItem {
  id: any;
  prefix: any;
  category: any;
  index: any;
  root: any;
  body: any;

  constructor(prefix: any, body: any, root: any, category: any, index: any) {
    super(`${prefix}`);
    this.id = `${category}:${index}:${prefix}`;
    this.prefix = prefix;
    this.category = category;
    this.index = index;
    this.root = root;
    this.body = body;
    this.contextValue = `snippetTreeItem-${root}`;
    this.tooltip = body;
    this.description = String(index);

    this.command = {
        command: "frank.insertSnippet",
        title: "Insert Snippet",
        arguments: [this.body]
      };
  }
}

export { SnippetsTreeProvider };