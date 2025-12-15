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
        return path.join(
            this.context.globalStorageUri.fsPath,
            '../../snippets/usersnippets.code-snippets'
        );
    }

    ensureUserSnippetsFileExists() {
        const userSnippetsStoragePath =  this.getUserSnippetsPath()

        const dir = path.dirname(userSnippetsStoragePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(userSnippetsStoragePath)) {
            fs.writeFileSync(userSnippetsStoragePath, "{}", "utf8");
        }
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

    async uploadUserSnippet(name, snippetIndex) {      
        try {
            const userSnippets = this.getUserSnippets();

            const storagePath = this.context.globalStorageUri.fsPath;
            const targetDir = path.join(storagePath, "test");
            const targetPath = path.join(targetDir, `${name}.md`)
    
            const data = `Example:
\`\`\`xml
${userSnippets[name][snippetIndex]["body"]}
\`\`\`
`;

            if (fs.existsSync(targetPath)) {
                try {
                    fs.appendFileSync(targetPath, data, "utf8");
                } catch (err) {
                    console.log(err);
                }
            } else {
                try {
                    fs.writeFileSync(targetPath, data, "utf8");
                } catch (err) {
                    console.log(err);
                }
            }
            
            try {
                exec(`git pull`, { cwd: targetDir }, (err) => {
                    if (err) {
                        console.log(err);
                        vscode.window.showErrorMessage("error");
                        return;
                    }
                    exec(`git add . `, { cwd: targetDir }, (err) => {
                        if (err) {
                            vscode.window.showErrorMessage("error");
                            return;
                        }
                        exec(`git commit -m "test"`, { cwd: targetDir }, (err) => {
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
                            });
                        });
                    });
                });
            } catch (err) {
                console.log(err);
            }
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

    getSnippets() {
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