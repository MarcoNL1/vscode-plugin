const vscode = require("vscode");

class UserSnippetsDndController {
  constructor(context, userSnippetsTreeProvider, userSnippetsService) {
    this.context = context;
    this.userSnippetsTreeProvider = userSnippetsTreeProvider;
    this.userSnippetsService = userSnippetsService;
    this.dragMimeTypes = ["application/vnd.code.tree.userSnippetsTreeview"];
    this.dropMimeTypes = ["application/vnd.code.tree.userSnippetsTreeview"];
  }

  async handleDrag(sourceItems, dataTransfer, token) {
    const payload = sourceItems.map(item => ({
      prefix: item.prefix,
      parent: item.name
    }));

    dataTransfer.set(
      "application/vnd.code.tree.userSnippetsTreeview",
      new vscode.DataTransferItem(JSON.stringify(payload))
    );
  }

  async handleDrop(target, dataTransfer, token) {
    const dataItem = dataTransfer.get("application/vnd.code.tree.userSnippetsTreeview");
    
    const payload = JSON.parse(dataItem.value); 

    if (target instanceof SnippetNameTreeItem) {
      let targetParentName = target.label;

      payload.forEach(snippet =>  {
        let oldParent = snippet.parent;        
        const snippetArr = this.userSnippetsTreeProvider.userSnippets[oldParent];

        const i = snippetArr.findIndex(s => s.prefix === snippet.prefix);

        const snippeta = snippetArr.splice(i, 1)[0];

        this.userSnippetsTreeProvider.userSnippets[targetParentName].push(snippeta);

        try {
          this.userSnippetsService.deleteUserSnippet(oldParent, i);
        
          let userSnippets = this.userSnippetsService.getUserSnippets();

          userSnippets[targetParentName].push(snippeta);

          this.userSnippetsService.setUserSnippets(userSnippets);
        } catch (err) {
            console.error(err);
        }
      });
    }

    this.userSnippetsTreeProvider.rebuild();
    this.userSnippetsTreeProvider.refresh();
  }

  dispose() {}
}

module.exports = {
  UserSnippetsDndController
};