const vscode = require("vscode");
const fs = require('fs');
const path = require('path');

class StartService {
    constructor(context) {
        this.context = context;
    }

    async createFile(workspaceRoot, file) {
        const newFilePath = path.join(workspaceRoot, file)

        const defaultFilePath = path.join(this.context.extensionPath, 'resources', file)
        let newFile = fs.readFileSync(defaultFilePath, 'utf8');

        if (file === "compose.frank.loc.yaml") {
            if (workspaceRoot.toLowerCase().endsWith('\\frank-runner')) {
                vscode.window.showErrorMessage("Please add the compose.frank.loc.yaml manually.");
                return false;
            }

            const skeletonrcJSONPath = path.join(workspaceRoot, "skeletonrc.json");

            if (fs.existsSync(skeletonrcJSONPath)) {
                const skeletonrcJSON = JSON.parse(fs.readFileSync(skeletonrcJSONPath, 'utf8'));

                newFile = newFile.replace("placeholder", skeletonrcJSON.mappings["{{ cookiecutter.instance_name_lc }}"]);
            }
        }
        
        fs.writeFileSync(newFilePath, newFile, "utf8");

        return true;
    }

    async getWorkingDirectory(file) {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage("No active editor, open a file of the project you want to run in the editor.");
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            editor.document.uri
        );

        const workspaceRoot = workspaceFolder.uri.fsPath;

        let currentDir = path.dirname(editor.document.uri.fsPath);
        let lastDir = currentDir;

        while (true) {
            let matches = await vscode.workspace.findFiles(
                new vscode.RelativePattern(currentDir, file),
                null,
                1
            );

            if (matches.length > 0) {
                return currentDir;
            }

            let parentDir = path.dirname(currentDir);

            if (currentDir === workspaceRoot) {
                 const choice = await vscode.window.showInformationMessage(
                    'File doesn\'t exist in the current project, create new file?',
                    'Yes',
                    'Cancel'
                );
                
                if (choice === 'Yes') {
                    try {
                        const createdFile = await this.createFile(lastDir, file);

                        if (createdFile) {
                            return lastDir;
                        } else {
                            return null;
                        }
                    } catch (err) {
                        return null;
                    }
                } else {
                    return null;
                }
            }

            lastDir = currentDir;
            currentDir = parentDir;
        }
    }

    async startWithAnt() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage("No active editor");
            return;
        }

        const workingDir = await this.getWorkingDirectory("build.xml");

        if (!workingDir) {
            return;
        }

        const term = vscode.window.createTerminal("Frank Ant");

        term.show();

        term.sendText(`cd "${workingDir}"`);

        if (workingDir.includes('frank-runner\\examples')){
            term.sendText(`../../ant.bat`);
        } else {
            term.sendText(`../frank-runner/ant.bat`);
        }
    }

    async startWithDocker() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage("No active editor");
            return;
        }

        const workingDir = await this.getWorkingDirectory("Dockerfile");

        if (!workingDir) {
            return;
        }

        const projectName = path.basename(path.dirname(workingDir));

        var term = vscode.window.createTerminal('cmd');
        term.show();
    
        term.sendText(`cd "${workingDir}"`);
        term.sendText(`docker build -t ${projectName} .`);
        term.sendText(`docker rm ${projectName}-container`);
        term.sendText(`docker run --name ${projectName}-container ${projectName}`);
    }

    async startWithDockerCompose() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage("No active editor");
            return;
        }

        const workingDir = await this.getWorkingDirectory("compose.frank.loc.yaml");
        
        if (!workingDir) {
            return;
        }

        var term = vscode.window.createTerminal('cmd');
        term.show();
    
        term.sendText(`cd "${workingDir}"`);
        term.sendText('docker compose -f compose.frank.loc.yaml up --build');
    }
}

module.exports = StartService;