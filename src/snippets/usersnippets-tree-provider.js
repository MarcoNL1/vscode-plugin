const vscode = require("vscode");

class UserSnippetsTreeProvider {
  constructor(context, userSnippetsService) {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.userSnippetsService = userSnippetsService;
    this.userSnippetsTreeItems = [];

    this.rebuild();
  }

  refresh() {
    this._onDidChangeTreeData.fire(null);
  }

  rebuild() {
    const snippetsPerCategoryTreeItems = [];

    let userSnippets = this.userSnippetsService.getUserSnippets();

    for (let category in userSnippets) {
      snippetsPerCategoryTreeItems.push(
        this.convertUserSnippetsToCategoryTreeItems(category, userSnippets[category])                                                                                             
      );
    }

    this.userSnippetsTreeItems = snippetsPerCategoryTreeItems;
  }

  getTreeItem(snippet) {
    return snippet;
  }

  getChildren(snippet) {
    if (snippet) {
      return snippet.getSnippetTreeItems();
    } else {
      return this.userSnippetsTreeItems;
    }
  }

  convertUserSnippetsToCategoryTreeItems(category, userSnippetsPerCategory) {
    const categoryTreeItem = new CategoryTreeItem(category, userSnippetsPerCategory, vscode.TreeItemCollapsibleState.Expanded)
    return categoryTreeItem;
  }
}

class CategoryTreeItem {
  constructor(category, userSnippetsPerCategory, collapsibleState) {
    this.label = category;
    this.userSnippetsPerCategory = userSnippetsPerCategory;
    this.collapsibleState = collapsibleState;
    this.snippetTreeItems = [];
    this.contextValue = "categoryTreeItem";

    this.command = {
      command: "frank.showUserSnippetsViewPerCategory",
      title: "Show Snippets",
      arguments: [category]
    };

    this.convertSnippetToSnippetTreeItems();
  }

  convertSnippetToSnippetTreeItems() {
    const arr = [];

    this.userSnippetsPerCategory.forEach((snippet, index) => {
      arr.push(new SnippetTreeItem(snippet.prefix, this.label, index));
    });

    this.snippetTreeItems = arr;
  }

  getSnippetTreeItems() {
    return this.snippetTreeItems;
  }
}

class SnippetTreeItem extends vscode.TreeItem {
  constructor(prefix, category, index) {
    super(prefix);
    this.id = `${category}:${index}:${prefix}`;
    this.prefix = prefix;
    this.category = category;
    this.index = index;
    this.contextValue = "snippetTreeItem";
  }
}

module.exports = {
  UserSnippetsTreeProvider
};