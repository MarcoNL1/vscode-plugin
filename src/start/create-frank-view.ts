import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

const CONFIG_SUBFOLDERS = ['xml', 'xsl', 'xsd', 'json', 'jsonschema', 'ds'];

export function showCreateFrankView(context: vscode.ExtensionContext, template: 'simple' | 'skeleton'): void {
    const panel = vscode.window.createWebviewPanel(
        'createFrank',
        'Create a Frank!',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'resources'))
            ]
        }
    );

    const css = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'resources', 'css', 'create-frank-view-webcontent.css')
    );

    panel.webview.html = getWebviewContent(css.toString(), template);

    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'pickFolder': {
                    const uris = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Root Directory',
                        title: 'Choose where to create the Frank project'
                    });
                    if (uris && uris.length > 0) {
                        panel.webview.postMessage({ command: 'folderSelected', path: uris[0].fsPath });
                    }
                    break;
                }
                case 'submit': {
                    await handleSubmit(context, panel, message.frankName, message.rootDir, message.configurations, template);
                    break;
                }
            }
        },
        null,
        context.subscriptions
    );
}

async function handleSubmit(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    frankName: string,
    rootDir: string,
    configurations: string[],
    template: 'simple' | 'skeleton'
): Promise<void> {
    const frankNameLower = frankName.toLowerCase();
    const targetProjectDir = path.join(rootDir, frankNameLower);

    if (fs.existsSync(targetProjectDir)) {
        panel.webview.postMessage({ command: 'error', message: `Directory '${frankNameLower}' already exists in the selected location.` });
        return;
    }

    if (template === 'skeleton') {
        await handleSkeletonSubmit(panel, frankNameLower, rootDir, targetProjectDir);
    } else {
        await handleSimpleSubmit(context, panel, frankNameLower, rootDir, targetProjectDir, configurations);
    }
}

async function handleSimpleSubmit(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    frankNameLower: string,
    rootDir: string,
    targetProjectDir: string,
    configurations: string[]
): Promise<void> {
    // STEP 1: Clone frank-runner if not present
    try {
        if (!fs.existsSync(path.join(rootDir, 'frank-runner'))) {
            await execAsync('git clone https://github.com/wearefrank/frank-runner.git', rootDir);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to clone frank-runner: ${error}`);
    }

    // STEP 2: Create project root and copy non-configuration template files
    const templateDir = path.join(context.extensionPath, 'resources', 'simpleFrank', 'projectName');
    fs.mkdirSync(targetProjectDir, { recursive: true });

    for (const file of ['.gitignore', 'build.xml', 'restart.bat', 'restart.sh']) {
        const src = path.join(templateDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(targetProjectDir, file));
        }
    }

    // STEP 3: Create configurations directory with one folder per config
    const configurationsDir = path.join(targetProjectDir, 'configurations');
    fs.mkdirSync(configurationsDir);

    const configXmlTemplate = fs.readFileSync(
        path.join(templateDir, 'configurations', 'configName', 'Configuration.xml'),
        'utf8'
    );

    for (const configName of configurations) {
        const configNameLower = configName.toLowerCase();
        const configDir = path.join(configurationsDir, configNameLower);
        fs.mkdirSync(configDir);
        fs.writeFileSync(path.join(configDir, 'Configuration.xml'), configXmlTemplate);

        for (const subfolder of CONFIG_SUBFOLDERS) {
            fs.mkdirSync(path.join(configDir, subfolder));
        }
    }

    // STEP 4: Add project and frank-runner to workspace
    const targetProjectDirUri = vscode.Uri.file(targetProjectDir);
    const frankRunnerDirUri = vscode.Uri.file(path.join(rootDir, 'frank-runner'));
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const nextIndex = workspaceFolders.length;

    const isPathCoveredByWorkspace = (targetPath: string): boolean =>
        workspaceFolders.some(folder => {
            const relativePath = path.relative(folder.uri.fsPath, targetPath);
            return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
        });

    const foldersToAdd: { uri: vscode.Uri; name?: string }[] = [];
    if (!isPathCoveredByWorkspace(targetProjectDirUri.fsPath)) {
        foldersToAdd.push({ uri: targetProjectDirUri, name: frankNameLower });
    }
    if (!isPathCoveredByWorkspace(frankRunnerDirUri.fsPath)) {
        foldersToAdd.push({ uri: frankRunnerDirUri, name: 'frank-runner' });
    }
    if (foldersToAdd.length > 0) {
        vscode.workspace.updateWorkspaceFolders(nextIndex, 0, ...foldersToAdd);
    }

    // STEP 5: Open first configuration file and close the panel
    const firstConfigPath = vscode.Uri.file(
        path.join(configurationsDir, configurations[0].toLowerCase(), 'Configuration.xml')
    );
    vscode.window.showTextDocument(firstConfigPath);
    panel.dispose();
    vscode.window.showInformationMessage(
        'Frank project created! Check the frank-runner docs for project structure and customisation.',
        'Open Docs'
    ).then(choice => {
        if (choice === 'Open Docs') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/wearefrank/frank-runner?tab=readme-ov-file#project-structure-and-customisation'));
        }
    });
}

async function handleSkeletonSubmit(
    panel: vscode.WebviewPanel,
    frankNameLower: string,
    rootDir: string,
    targetProjectDir: string
): Promise<void> {
    // STEP 1: Clone the frank-skeleton repo into the target directory
    try {
        await execAsync(`git clone https://github.com/wearefrank/skeleton.git "${frankNameLower}"`, rootDir);
    } catch (error) {
        panel.webview.postMessage({ command: 'error', message: `Failed to clone frank-skeleton: ${error}` });
        return;
    }

    // STEP 2: Remove .git so the user starts with a clean repo
    const gitDir = path.join(targetProjectDir, '.git');
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // STEP 3: Add project to workspace
    const targetProjectDirUri = vscode.Uri.file(targetProjectDir);
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const nextIndex = workspaceFolders.length;

    const alreadyInWorkspace = workspaceFolders.some(folder => {
        const relativePath = path.relative(folder.uri.fsPath, targetProjectDir);
        return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    });

    if (!alreadyInWorkspace) {
        vscode.workspace.updateWorkspaceFolders(nextIndex, 0, { uri: targetProjectDirUri, name: frankNameLower });
    }

    panel.dispose();
    vscode.window.showInformationMessage(
        'Frank Skeleton project created! Check the skeleton repo for next steps.',
        'Open Repo'
    ).then(choice => {
        if (choice === 'Open Repo') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/wearefrank/skeleton'));
        }
    });
}

function execAsync(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) { reject(stderr || error); }
            else { resolve(stdout); }
        });
    });
}

function getWebviewContent(css: string, template: 'simple' | 'skeleton'): string {
    const isSkeleton = template === 'skeleton';
    const configurationsHidden = isSkeleton ? ' style="display:none"' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${css}">
    <title>Create a Frank!</title>
</head>
<body>
    <div class="container">
        <h1>Create a Frank!</h1>

        <div id="error-banner" class="error-banner hidden"></div>

        <div class="form-group">
            <label for="frankName">Frank Name <span class="required">*</span></label>
            <input type="text" id="frankName" placeholder="my-frank-project" autocomplete="off" />
            <span class="hint">Folder name will be lowercased</span>
        </div>

        <div class="form-group">
            <label for="rootDir">Root Directory <span class="required">*</span></label>
            <div class="dir-picker">
                <input type="text" id="rootDir" placeholder="Select a folder..." readonly />
                <button class="secondary-button" id="browseBtn" type="button">Browse...</button>
            </div>
        </div>

        <div class="form-group" id="configurations-group"${configurationsHidden}>
            <label>Configurations <span class="required">*</span></label>
            <span class="hint">Folder names will be lowercased</span>
            <div id="configurations-list"></div>
            <button class="add-button" id="addConfigBtn" type="button">+ Add Configuration</button>
        </div>

        <div class="actions">
            <button class="primary-button" id="createBtn" type="button">Create Frank!</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const isSkeleton = ${isSkeleton};

        let configCount = 0;

        function addConfig(defaultValue = '') {
            configCount++;
            const list = document.getElementById('configurations-list');
            const item = document.createElement('div');
            item.className = 'config-item';
            item.dataset.id = configCount;
            item.innerHTML = \`
                <input type="text" class="config-name" placeholder="my-configuration" autocomplete="off" value="\${defaultValue}" />
                <button class="remove-button" type="button" title="Remove configuration">✕</button>
            \`;
            item.querySelector('.remove-button').addEventListener('click', () => {
                item.remove();
                updateRemoveButtons();
            });
            list.appendChild(item);
            updateRemoveButtons();
            item.querySelector('.config-name').focus();
        }

        function updateRemoveButtons() {
            const items = document.querySelectorAll('.config-item');
            items.forEach(item => {
                item.querySelector('.remove-button').disabled = items.length === 1;
            });
        }

        function showError(message) {
            const banner = document.getElementById('error-banner');
            banner.textContent = message;
            banner.classList.remove('hidden');
            banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function clearError() {
            document.getElementById('error-banner').classList.add('hidden');
        }

        document.getElementById('browseBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'pickFolder' });
        });

        document.getElementById('addConfigBtn').addEventListener('click', () => addConfig());

        document.getElementById('createBtn').addEventListener('click', () => {
            clearError();

            const frankName = document.getElementById('frankName').value.trim();
            const rootDir = document.getElementById('rootDir').value.trim();
            const configInputs = document.querySelectorAll('.config-name');
            const configurations = Array.from(configInputs)
                .map(input => input.value.trim())
                .filter(v => v.length > 0);

            if (!frankName) { showError('Frank Name is required.'); return; }
            if (!rootDir) { showError('Root Directory is required.'); return; }
            if (!isSkeleton && configurations.length === 0) { showError('At least one configuration name is required.'); return; }

            document.getElementById('createBtn').disabled = true;
            document.getElementById('createBtn').textContent = 'Creating...';

            vscode.postMessage({ command: 'submit', frankName, rootDir, configurations });
        });

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'folderSelected') {
                document.getElementById('rootDir').value = msg.path;
            } else if (msg.command === 'error') {
                showError(msg.message);
                document.getElementById('createBtn').disabled = false;
                document.getElementById('createBtn').textContent = 'Create Frank!';
            }
        });

        // Initialize with one configuration input
        if (!isSkeleton) { addConfig(); }
    </script>
</body>
</html>`;
}
