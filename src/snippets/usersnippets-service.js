const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const he = require('he');
const format = require('xml-formatter');

class UserSnippetsService {
    constructor(context) {
        this.context = context;
    }

    getUserSnippetsPath() {
        return path.join(this.context.globalStorageUri.fsPath,'../../snippets/usersnippets.code-snippets');
    }

    ensureSnippetsFilesExists() {
        const storagePaths = [];
        storagePaths.push(this.getUserSnippetsPath());
        storagePaths.push(path.join(this.context.globalStorageUri.fsPath,'../../snippets/frankframework.code-snippets'));

        storagePaths.forEach(storagePath => {
            const dir = path.dirname(storagePath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            if (!fs.existsSync(storagePath)) {
                fs.writeFileSync(storagePath, "{}", "utf8");
            }
        });
    }

    getUserSnippets() {
        const userSnippetsStoragePath =  this.getUserSnippetsPath()

        try {
            const userSnippetsExtension = JSON.parse(fs.readFileSync(userSnippetsStoragePath, 'utf8'));

            return userSnippetsExtension;
        } catch (err) {
            console.error(err);
            return {};
        }
    }

    setUserSnippets(userSnippets) {
        const userSnippetsStoragePath =  this.getUserSnippetsPath()

        try {
            fs.writeFileSync(userSnippetsStoragePath, JSON.stringify(userSnippets, null, 4), 'utf8');
        } catch (err) {
            console.log(err);
        }
    }

    async addUserSnippet(userSnippetsTreeProvider) {
        const editor = vscode.window.activeTextEditor;
    
        if (!editor) {
            return;
        }
    
        const selection = editor.selection;
        const body = editor.document.getText(selection);
    
        const name = await vscode.window.showInputBox({
            placeHolder: 'Give your new snippet a name',
            prompt: "Name is required",
            validateInput: (value) => {
                if (!value || value.trim() === "") {
                    return "Name cannot be empty";
                }
                return null;
            }
        });
    
        if (!name) {
            return;
        }
    
        try {
            const userSnippets = this.getUserSnippets();

            let snippetsByName = userSnippets[name];

            if (snippetsByName === undefined) {
                snippetsByName = [];
            }
    
            const newSnippetBody = {
                "prefix": name,
                "body": body,
                "description": name
            };

            snippetsByName.push(newSnippetBody);
            userSnippets[name] = snippetsByName;
    
            this.setUserSnippets(userSnippets);

            userSnippetsTreeProvider.rebuild();
            userSnippetsTreeProvider.refresh();
        } catch (err) {
            console.log(err);
        }
    }

    deleteUserSnippet(name, snippetIndex) {
        try {
            const userSnippets = this.getUserSnippets();

            userSnippets[name].splice(snippetIndex, 1);

            this.setUserSnippets(userSnippets);
        } catch (err) {
            console.log(err);
        }
    }

    deleteAllUserSnippetByName(name) {
        try {
            const userSnippets = this.getUserSnippets();

            delete userSnippets[name];

            this.setUserSnippets(userSnippets);
        } catch (err) {
            console.log(err);
        }
    }

    changeNameOfUserSnippets(oldName, name) {
        const userSnippets = this.getUserSnippets();

        if (Object.keys(userSnippets).includes(name)) {
            vscode.window.showErrorMessage("error");
            return;
        }

        if (oldName != name) {
            try {
                userSnippets[name] = userSnippets[oldName];

                delete userSnippets[oldName];

                this.setUserSnippets(userSnippets);
            } catch (err) {
                console.log(err);
            }
        }
    }

    async addNameOfUserSnippets(userSnippetsTreeProvider) {
        const userSnippets = this.getUserSnippets();

        const name = await vscode.window.showInputBox({
            placeHolder: 'Give a name',
            prompt: "Name is required",
            validateInput: (value) => {
                if (!value || value.trim() === "") {
                    return "Name cannot be empty";
                }
                return null;
            }
        });
    
        if (!name) {
            return;
        }

        userSnippets[name] = [];

        this.setUserSnippets(userSnippets);

        userSnippetsTreeProvider.rebuild();
        userSnippetsTreeProvider.refresh();
    }

    async uploadUserSnippet(name) {    
        const storagePath = this.context.globalStorageUri.fsPath;
        const targetDir = path.join(storagePath, "test");
        const targetPath = path.join(targetDir, `${name}.md`)

        try {
            exec(`git reset --hard`, { cwd: targetDir}, (err) => {
                exec(`git clean -fd`, { cwd: targetDir}, (err) => {
                    exec(`git pull`, { cwd: targetDir }, async (err) => {
                        if (err) {
                            console.log(err);
                            vscode.window.showErrorMessage("error");
                            return;
                        }
                
                        const newFileText = "Replace all text in this file with your content.\n\nPlease make sure you use the right format:\n````xml\n<example>\n\t<example>\n<example>\n```\n\nSave to add this file as a page to the Frank!Framework Wiki.";

                        if (!fs.existsSync(targetPath)) {
                            const choice = await vscode.window.showInformationMessage(
                                'Page doesn\'t exist in the current wiki, create a new page?',
                                'Yes',
                                'Cancel'
                            );
                            
                            if (choice === 'Yes') {
                                try {
                                    fs.writeFileSync(targetPath, newFileText, "utf8");
                                } catch (err) {
                                    console.log(err);
                                }
                            } else {
                                return;
                            }
                        }

                        const doc = await vscode.workspace.openTextDocument(targetPath);
                        await vscode.window.showTextDocument(doc);

                        const saveListener = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
                            if (savedDoc.uri.fsPath === targetPath) {
                                exec(`git add . `, { cwd: targetDir }, (err) => {
                                    if (err) {
                                        vscode.window.showErrorMessage("error");
                                        return;
                                    }
                                    exec(`git commit -m "Updated ${name}.md"`, { cwd: targetDir }, (err) => {
                                        if (err) {
                                            console.log(err);
                                            vscode.window.showErrorMessage("error");
                                            return;
                                        }
                                        exec(`git push`, { cwd: targetDir }, (err) => {
                                            if (err) {
                                                console.log(err);
                                                vscode.window.showErrorMessage("error");
                                                return;
                                            }

                                            vscode.window.showInformationMessage("Snippet exported! You can close the file it won\'t make changes again.");
                                        });
                                    });
                                });

                                saveListener.dispose();
                            }
                        });
                    });
                });
            });
            
        } catch (err) {
            console.log(err);
        }
    }

    prettifyXml(xml) {
        try {
            return format(xml, {
                indentation: '    ',
                collapseContent: true,
                lineSeparator: '\n'
            });
        } catch {
            return xml;
        }
    };

    extractSnippets(targetDir) {
        const snippetsStoragePath =  path.join(this.context.globalStorageUri.fsPath, '../../snippets/frankframework.code-snippets');

        const regex = new RegExp(
        '```xml([\\s\\S]*?)```|' +
        '<pre>([\\s\\S]*?)</pre>|' +
        '(^\\s*<(\\w+)[^>]*>[\\s\\S]*?</\\4>)',
        'gm'
        );

        const snippets = {}
        
        try {
            const files = fs.readdirSync(targetDir);

            for (const file of files) {
                const filePath = path.join(targetDir, file);
                const name = file.replace(/.md|.asciidoc/g, "");
                const snippetsPerFile= [];
                
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const matches = content.matchAll(regex);

                    for (const match of matches) {
                        const xmlBlock = match[1] || match[2] || match[3] || match[4];

                        if (xmlBlock) {
                            const decodedBody = he.decode(xmlBlock.trim()).replace("<pre>", "").replace("</pre>", "");
                
                            const prettyBody = this.prettifyXml(decodedBody);

                            const snippet = {
                                "prefix": name,
                                "body": prettyBody,
                                "description": name
                            }

                            snippetsPerFile.push(snippet)
                        }
                    }
                    snippets[name] = snippetsPerFile;
                } catch (err) {
                    console.log(err);
                }
            } 
            fs.writeFileSync(snippetsStoragePath, JSON.stringify(snippets, null, 4), 'utf8');
        } catch (err) {
            console.log(err);
        }
    }

    loadFrankFrameworkSnippets() {
        const storagePath = this.context.globalStorageUri.fsPath;
        fs.mkdirSync(storagePath, { recursive: true });

        const repoUrl = "https://github.com/frankframework/frankframework.wiki.git";
        const targetDir = path.join(storagePath, "frankframework.wiki");

        const repoUrla = "https://github.com/FrancesTwisk/test.wiki.git";
        const targetDira = path.join(storagePath, "test");


        fs.rmSync(targetDir, { recursive: true, force: true });
        fs.rmSync(targetDira, { recursive: true, force: true });

        exec(`git clone "${repoUrl}" "${targetDir}"`, { cwd: storagePath }, (err) => {
            if (err) {
                console.log(err);
            }

            this.extractSnippets(targetDir);
        });

        exec(`git clone "${repoUrla}" "${targetDira}"`, { cwd: storagePath }, (err) => {
            if (err) {
                return;
            }
        });
    };
}

module.exports = UserSnippetsService;