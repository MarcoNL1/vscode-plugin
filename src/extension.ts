import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as SaxonJS from 'saxon-js';

import StartService from "./start/start-service";
import SnippetsService from "./snippets/snippets-service";
import { showSnippetsView } from './snippets/usersnippets-view';
import FlowViewProvider from './flow/flow-view-provider';
import { SnippetsTreeProvider } from "./snippets/snippets-tree-provider";
import { SnippetsDndController } from "./snippets/snippets-dnd-controller";
import { StartTreeProvider } from "./start/start-tree-provider";
import { FrankValidator } from './validation/frank-validator';

/**
 * @param {vscode.ExtensionContext} context
*/

let targets = null;
let projectNameTrimmed = "skeleton";
let configNameTrimmed = "";

function activate(context: vscode.ExtensionContext) {
	const snippetsService = new SnippetsService(context);
	const snippetsTreeProvider = new SnippetsTreeProvider(snippetsService);
	const snippetsDndController = new SnippetsDndController(context, snippetsTreeProvider, snippetsService);
	const startService = new StartService(context);
	const startTreeProvider = new StartTreeProvider(context, startService);
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('frank-framework');
    context.subscriptions.push(diagnosticCollection);
    const frankValidator = new FrankValidator(diagnosticCollection);

	if (vscode.window.activeTextEditor) {
        frankValidator.validate(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => frankValidator.validate(doc)),
        vscode.workspace.onDidSaveTextDocument(doc => frankValidator.validate(doc)),
        vscode.workspace.onDidChangeTextDocument(e => frankValidator.validate(e.document)),
        vscode.workspace.onDidCloseTextDocument(doc => frankValidator.clear(doc))
    );

	vscode.commands.registerCommand('frank.createNewFrank', async function () {
		const items = [
			{
				label: 'Simple Frank'
			},
			{
				label: 'Skeleton',
				description: 'https://github.com/wearefrank/skeleton?tab=readme-ov-file#steps'
			},
			{
				label: 'Project per Config',
				description: 'https://github.com/wearefrank/frank-runner?tab=readme-ov-file#project-per-config'
			},
			{
				label: 'Module per Config',
				description: 'https://github.com/wearefrank/frank-runner?tab=readme-ov-file#module-per-config'
			},
			{
				label: 'Monorepo',
				description: 'https://github.com/wearefrank/frank-runner?tab=readme-ov-file#module-per-config-flattened-aka-monorepo'
			},
			{
				label: 'Foks Monorepo',
				description: 'https://github.com/wearefrank/frank-runner?tab=readme-ov-file#foks-monorepo'
			}
		];
		const projectType = await vscode.window.showQuickPick(items as vscode.QuickPickItem[], {placeHolder: "Pick a project"});
		if (projectType && projectType.description) {
			vscode.env.openExternal(vscode.Uri.parse(projectType.description));
		} else if (projectType?.label === "Simple Frank") {
			const projectName = await vscode.window.showInputBox({
				placeHolder: 'Give your project a name',
				validateInput: (value) => {
					if (!value || value.trim() === '') {
						return 'Name cannot be empty';
					}
					return null;
				}
			});
			if (!projectName) {
				return;
			}
			projectNameTrimmed = projectName.trim();

			const configName = await vscode.window.showInputBox({
				placeHolder: 'Give your configuration a name',
				validateInput: (value) => {
					if (!value || value.trim() === '') {
						return 'Name cannot be empty';
					}
					return null;
				}
			});
			if (!configName) {
				return;
			}
			configNameTrimmed = configName.trim();

			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder open');
				return;
			}
			const rootPath = workspaceFolders[0].uri.fsPath;

			if (!fs.existsSync(path.join(rootPath, "frank-runner"))) {
				await execAsync(
					'git clone https://github.com/wearefrank/frank-runner.git',
					rootPath
				);
			}

			const simpleFrankPath = vscode.Uri.file(path.join(context.extensionPath, 'resources/simpleFrank/projectName'));
			const targetDir = vscode.Uri.file(path.join(rootPath, projectNameTrimmed));

			await copyDir(simpleFrankPath, targetDir);

			vscode.window.showTextDocument(vscode.Uri.file(path.join(rootPath, projectNameTrimmed, 'configurations', configNameTrimmed, 'Configuration.xml')));

			vscode.env.openExternal(vscode.Uri.parse("https://github.com/wearefrank/frank-runner?tab=readme-ov-file#project-structure-and-customisation"));
		}
	});
	//Helper function to copy simple frank project to user workspace.
	async function copyDir(source: vscode.Uri, target: vscode.Uri) {
		await vscode.workspace.fs.createDirectory(target);

		const entries = await vscode.workspace.fs.readDirectory(source);

		for (const [name, type] of entries) {
			const src = vscode.Uri.joinPath(source, name);
			let dest = vscode.Uri.joinPath(target, name);
			if (name === "configName") {
				dest = vscode.Uri.joinPath(target, configNameTrimmed);
			}

			if (type === vscode.FileType.Directory) {
				await copyDir(src, dest);
			} else {
				await vscode.workspace.fs.copy(src, dest, { overwrite: true });
			}
		}
	}

	vscode.commands.registerCommand("frank.openWalkthrough", () => {
		vscode.commands.executeCommand(
			"workbench.action.openWalkthrough",
			"wearefrank.wearefrank#introduction",
			false
		);
	});

	//Helper function for starting a project.
	async function startHandler(item: any, isCurrent: boolean) {
		const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'xml') {
            frankValidator.validate(editor.document);
            
            const diagnostics = diagnosticCollection.get(editor.document.uri);
            const hasErrors = diagnostics && diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error);

            if (hasErrors) {
                const selection = await vscode.window.showErrorMessage(
                    "Configuration contains semantic errors (e.g., missing forwards). The application may fail to start.",
                    "Start Anyway",
                    "Cancel"
                );

                if (selection !== "Start Anyway") {
                    return; // Abort startup
                }
            }
        }

		switch (item.method) {
			case "ant":
				await startService.startWithAnt(item.path, isCurrent);
				break;
			case "docker":
				await startService.startWithDocker(item.path, isCurrent);
				break;
			case "dockerCompose":
				await startService.startWithDockerCompose(item.path, isCurrent);
				break;
		}

		startTreeProvider.rebuild();
        startTreeProvider.refresh();
	};

	vscode.commands.registerCommand("frank.startCurrent", async function (item) { 
		startHandler(item, true);
		
		startTreeProvider.rebuild();
        startTreeProvider.refresh();
	});
	vscode.commands.registerCommand("frank.startProject", async function (item) { 
		startHandler(item, false);

		startTreeProvider.rebuild();
        startTreeProvider.refresh();
	});

	//Deletes project from ran projects list in Frank!Start view.
	vscode.commands.registerCommand("frank.deleteProject", async function (item) { 
		await startService.deleteRanProject(item.method, item.path);
		
		startTreeProvider.rebuild();
        startTreeProvider.refresh();
	});

	//Init start view.
	const startTreeView = vscode.window.createTreeView("startTreeView", {
		treeDataProvider: startTreeProvider
	});
	setStartTreeViewDescription();
	vscode.window.onDidChangeActiveTextEditor(() => {
		setStartTreeViewDescription();
	});
	async function setStartTreeViewDescription() {
		const project = await startService.getWorkingDirectory();
		let projectName = "";

		if (project != undefined) {
			startTreeView.description = path.basename(project);
		} else {
			startTreeView.description = "No Project Open in Editor/No Runable File Found";
		}
	}
	vscode.commands.registerCommand("frank.toggleUpdate", async (item) => {
		if (!item || item.method !== "ant") {
			return;
		}

		await startService.toggleUpdate(item.path);

		startTreeProvider.rebuild();
    	startTreeProvider.refresh();
	});

	//Load examples from the Frank!Framework Wiki as VS Code Snippets.
	snippetsService.ensureSnippetsFilesExists();
	snippetsService.loadFrankFrameworkSnippets();

	//Init flowchart view.
	const flowViewProvider = new FlowViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('flowView', flowViewProvider)
	);
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor && editor.document.languageId === "xml") {
			flowViewProvider.updateWebview();
		}
	});
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.languageId === "xml") {
			flowViewProvider.updateWebview();
		}
	});
	async function focusFlowView() {
		await vscode.commands.executeCommand(
			"workbench.view.extension.flowViewContainer"
		);
	}
	focusFlowView();

	//Init snippets tree view.
	vscode.window.createTreeView("snippetsTreeView", {
		treeDataProvider: snippetsTreeProvider,
		dragAndDropController: snippetsDndController
	});
	vscode.commands.registerCommand('frank.addNewCategoryOfUserSnippets', () => {
		snippetsService.addNewCategoryOfUserSnippets(snippetsTreeProvider);
	});
	vscode.commands.registerCommand("frank.deleteAllUserSnippetByCategory", (item) => {
		const userSnippets = snippetsService.deleteAllUserSnippetByCategory(item.label);

		snippetsTreeProvider.rebuild();
		snippetsTreeProvider.refresh();
	});
	vscode.commands.registerCommand('frank.showUserSnippetsViewPerCategory', (category) => {
		showSnippetsView(context, category, snippetsTreeProvider, snippetsService);
	})

	vscode.commands.registerCommand("frank.editUserSnippet", (item) => {
		showSnippetsView(context, item.category, snippetsTreeProvider, snippetsService);
	});
	vscode.commands.registerCommand("frank.deleteUserSnippet", (item) => {
		const userSnippets = snippetsService.deleteUserSnippet(item.category, item.index);

		snippetsTreeProvider.rebuild();
		snippetsTreeProvider.refresh();
	});
	vscode.commands.registerCommand("frank.insertSnippet", async function (body) { 
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor");
		} else {
			await editor.edit(editBuilder => {
        		editBuilder.insert(editor.selection.active, body);
    		});
		}
	});

	vscode.commands.registerCommand('frank.addNewUserSnippet', async function () {
		await snippetsService.addNewUserSnippet(snippetsTreeProvider);

		vscode.window.showInformationMessage("Snippet added!");
	});

	vscode.languages.registerDocumentLinkProvider({ language: 'xml', scheme: 'file' }, {
		provideDocumentLinks(document, token) {
			const links = [];
			const text = document.getText();
			const regex = /\w+/g;
			let match;

			const componentsPath = context.asAbsolutePath('./resources/components.json');
			const components = fs.readFileSync(componentsPath, 'utf8');
			targets = JSON.parse(components);

			while ((match = regex.exec(text)) !== null) {
				targetLoop: for (const i in targets) {
					for (const j in targets[i]) {
						if (targets[i][j].includes(match[0])) {
							const start = document.positionAt(match.index);
							const end = document.positionAt(match.index + match[0].length);
							links.push(new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.parse(`https://frankdoc.frankframework.org/#/${i}/${j}/${match[0]}`)));
							
							break targetLoop;
						}
					}
				}
			}

			return links;
		}
	});

	function execAsync(command: string, cwd: string): Promise<string> {
		return new Promise((resolve, reject) => {
			exec(command, { cwd }, (error, stdout, stderr) => {
				if (error) {
					reject(stderr || error);
				} else {
					resolve(stdout);
				}
			});
		});
	}
}

function deactivate() {}

export { activate, deactivate };
