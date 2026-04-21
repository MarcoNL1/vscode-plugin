"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class StartService {
    constructor(context) {
        this.context = context;
    }
    async discoverAntProjects() {
        const buildFiles = await vscode.workspace.findFiles('**/build.xml', '**/node_modules/**');
        return buildFiles.map(uri => path.dirname(uri.fsPath));
    }
    async discoverDockerProjects() {
        const [mavenFiles, simpleFiles] = await Promise.all([
            vscode.workspace.findFiles('**/src/main/configurations/**', '**/node_modules/**'),
            vscode.workspace.findFiles('**/configurations/*/Configuration.xml', '**/node_modules/**'),
        ]);
        const projectRoots = new Set();
        const mavenMarker = `${path.sep}src${path.sep}main${path.sep}configurations`;
        for (const file of mavenFiles) {
            const idx = file.fsPath.indexOf(mavenMarker);
            if (idx !== -1)
                projectRoots.add(file.fsPath.substring(0, idx));
        }
        const simpleMarker = `${path.sep}configurations${path.sep}`;
        for (const file of simpleFiles) {
            const idx = file.fsPath.indexOf(simpleMarker);
            if (idx !== -1)
                projectRoots.add(file.fsPath.substring(0, idx));
        }
        return Array.from(projectRoots);
    }
    detectConfigurationsDir(projectRoot) {
        const candidates = ['src/main/configurations', 'configurations'];
        for (const candidate of candidates) {
            if (fs.existsSync(path.join(projectRoot, candidate))) {
                return candidate;
            }
        }
        return candidates[0];
    }
    async getFrankRunnerPath(workingDir) {
        let currentDir = workingDir;
        while (true) {
            const potentialRunnerPath = path.join(currentDir, 'frank-runner');
            if (fs.existsSync(potentialRunnerPath)) {
                return potentialRunnerPath;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break;
            }
            currentDir = parentDir;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        for (const folder of workspaceFolders) {
            if (folder.name.toLowerCase() === 'frank-runner' || folder.uri.fsPath.endsWith('frank-runner')) {
                return folder.uri.fsPath;
            }
        }
        return null;
    }
    async createFile(targetDir, file) {
        const newFilePath = path.join(targetDir, file);
        const defaultFilePath = path.join(this.context.extensionPath, 'resources', file);
        let content = fs.readFileSync(defaultFilePath, 'utf8');
        if (file === 'docker-compose.yml') {
            const configsDir = this.detectConfigurationsDir(targetDir);
            content = content.replace('{{CONFIGURATIONS_DIR}}', `./${configsDir}`);
        }
        fs.writeFileSync(newFilePath, content, 'utf8');
        return true;
    }
    // Walks up from the active editor looking for a project root containing build.xml (Ant).
    async getAntWorkingDirectory() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return null;
        let currentDir = path.dirname(editor.document.uri.fsPath);
        while (true) {
            if (fs.existsSync(path.join(currentDir, 'build.xml'))) {
                return currentDir;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir)
                break;
            currentDir = parentDir;
        }
        return null;
    }
    // Walks up from the active editor looking for a project root containing a known configurations folder.
    async getDockerWorkingDirectory() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return null;
        let currentDir = path.dirname(editor.document.uri.fsPath);
        while (true) {
            if (fs.existsSync(path.join(currentDir, 'src', 'main', 'configurations')) ||
                fs.existsSync(path.join(currentDir, 'configurations'))) {
                return currentDir;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir)
                break;
            currentDir = parentDir;
        }
        return null;
    }
    // Used by extension.ts for the tree view description label (Ant project from active editor).
    async getWorkingDirectory() {
        return this.getAntWorkingDirectory();
    }
    getComposeFile(dir) {
        const isComposeFile = (filename) => filename.toLowerCase().includes("compose") &&
            (filename.endsWith(".yml") || filename.endsWith(".yaml"));
        const files = fs.readdirSync(dir);
        const composeFile = files.find(isComposeFile);
        return composeFile ?? null;
    }
    isFrameworkFile(file) {
        if (file.startsWith('frankframework-webapp')) {
            return true;
        }
        if (file.startsWith('ibis-adapterframework-webapp')) {
            return true;
        }
        return false;
    }
    async toggleUpdate(workingDir) {
        const FFOptions = [];
        FFOptions.push("Highest Online Version");
        FFOptions.push("Highest Stable Online Version");
        for (let file of this.getLocalFFVersions(workingDir)) {
            FFOptions.push(file.version);
        }
        const ffOption = await vscode.window.showQuickPick(FFOptions, { placeHolder: "Pick a FF! version" });
        if (!ffOption)
            return;
        const frankRunnerPropertiesFile = path.join(workingDir, "frank-runner.properties");
        let newLine = ` `;
        switch (ffOption) {
            case "Highest Online Version":
                if (fs.existsSync(frankRunnerPropertiesFile)) {
                    let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
                    if (this.ffVersionSet(workingDir) || this.updateStrategySet(workingDir)) {
                        frankRunnerProperties = frankRunnerProperties
                            .replace(/^\s*ff\.version=.*$/gm, "")
                            .trim();
                        frankRunnerProperties = frankRunnerProperties
                            .replace(/^\s*update\.strategy=.*$/gm, "")
                            .trim();
                        fs.writeFileSync(frankRunnerPropertiesFile, frankRunnerProperties, "utf8");
                    }
                }
                break;
            case "Highest Stable Online Version":
                newLine = `\nupdate.strategy=stable`;
                if (fs.existsSync(frankRunnerPropertiesFile)) {
                    let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
                    if (!this.updateStrategySet(workingDir)) {
                        if (this.ffVersionSet(workingDir)) {
                            frankRunnerProperties = frankRunnerProperties
                                .replace(/^\s*ff\.version=.*$/gm, "")
                                .trim();
                            fs.writeFileSync(frankRunnerPropertiesFile, frankRunnerProperties, "utf8");
                            fs.appendFileSync(frankRunnerPropertiesFile, newLine, "utf8");
                        }
                        else {
                            fs.appendFileSync(frankRunnerPropertiesFile, newLine, "utf8");
                        }
                    }
                }
                else {
                    fs.writeFileSync(frankRunnerPropertiesFile, newLine, "utf8");
                }
                break;
            default:
                newLine = `ff.version=${ffOption}`;
                if (fs.existsSync(frankRunnerPropertiesFile)) {
                    let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
                    if (this.ffVersionSet(workingDir) || this.updateStrategySet(workingDir)) {
                        frankRunnerProperties = frankRunnerProperties
                            .replace(/^\s*ff\.version=.*$/gm, "")
                            .trim();
                        frankRunnerProperties = frankRunnerProperties
                            .replace(/^\s*update\.strategy=.*$/gm, "")
                            .trim();
                        fs.writeFileSync(frankRunnerPropertiesFile, frankRunnerProperties, "utf8");
                        fs.appendFileSync(frankRunnerPropertiesFile, "\n" + newLine, "utf8");
                    }
                    else {
                        fs.appendFileSync(frankRunnerPropertiesFile, "\n" + newLine, "utf8");
                    }
                }
                else {
                    fs.writeFileSync(frankRunnerPropertiesFile, newLine, "utf8");
                }
        }
    }
    getLocalFFVersions(workingDir) {
        let downloadDir;
        if (workingDir.includes("frank-runner\\examples")) {
            downloadDir = path.join(workingDir, "../../download");
        }
        else {
            downloadDir = path.join(workingDir, "../frank-runner/download");
        }
        if (!fs.existsSync(downloadDir))
            return [];
        const versionRegex = /(\d+(?:\.\d+)*(?:-\d+\.\d+)?)/;
        return fs.readdirSync(downloadDir)
            .filter(f => /^(frankframework|ibis).*\.war$/.test(f))
            .map(f => {
            const match = f.match(versionRegex);
            return {
                file: f,
                version: match ? match[1] : ""
            };
        })
            .filter(e => e.version);
    }
    updateStrategySet(workingDir) {
        const frankRunnerPropertiesFile = path.join(workingDir, "frank-runner.properties");
        if (fs.existsSync(frankRunnerPropertiesFile)) {
            let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
            const hasActiveStableStrategy = /^\s*update\.strategy=stable.*$/m.test(frankRunnerProperties);
            return hasActiveStableStrategy;
        }
        return false;
    }
    ffVersionSet(workingDir) {
        const frankRunnerPropertiesFile = path.join(workingDir, "frank-runner.properties");
        if (fs.existsSync(frankRunnerPropertiesFile)) {
            let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
            const hasActiveFFVersion = /^\s*ff\.version=.*$/m.test(frankRunnerProperties);
            return hasActiveFFVersion;
        }
        return false;
    }
    getSetFFVersion(workingDir) {
        const frankRunnerPropertiesFile = path.join(workingDir, "frank-runner.properties");
        if (fs.existsSync(frankRunnerPropertiesFile)) {
            let frankRunnerProperties = fs.readFileSync(frankRunnerPropertiesFile, "utf8");
            const match = frankRunnerProperties.match(/^\s*ff\.version=.*$/m);
            const setFFversion = match ? match[0].split("=")[1] : "";
            return setFFversion;
        }
        return false;
    }
    async startWithAnt(workingDir, isCurrent) {
        if (isCurrent) {
            workingDir = await this.getAntWorkingDirectory();
        }
        if (!workingDir) {
            vscode.window.showErrorMessage("No Frank project found. Open a file inside a Frank project (containing build.xml).");
            return;
        }
        const runnerPath = await this.getFrankRunnerPath(workingDir);
        if (!runnerPath) {
            vscode.window.showErrorMessage("Could not locate the frank-runner directory. Ensure it is cloned or added to your workspace.");
            return;
        }
        const term = vscode.window.createTerminal("Frank Ant");
        term.show();
        term.sendText(`cd "${workingDir}"`);
        const antBatPath = path.join(runnerPath, "ant.bat");
        term.sendText(`& "${antBatPath}"`);
    }
    async startWithDockerCompose(workingDir, isCurrent) {
        if (isCurrent) {
            workingDir = await this.getDockerWorkingDirectory();
        }
        if (!workingDir) {
            vscode.window.showErrorMessage("No Frank project found. Open a file inside a project containing src/main/configurations.");
            return;
        }
        // STEP 1: Find or generate docker-compose.yml at the project root
        let composeFileName = this.getComposeFile(workingDir);
        if (!composeFileName) {
            const choice = await vscode.window.showInformationMessage("No docker-compose file found in the project root. Would you like to generate one?", 'Yes', 'Cancel');
            if (choice !== 'Yes')
                return;
            await this.createFile(workingDir, "docker-compose.yml");
            composeFileName = "docker-compose.yml";
        }
        // STEP 2: Launch docker-compose from the project root
        const term = vscode.window.createTerminal('Frank! Docker Compose');
        term.show();
        term.sendText(`cd "${workingDir}"`);
        term.sendText(`docker-compose -f "${composeFileName}" up`);
    }
}
exports.default = StartService;
//# sourceMappingURL=start-service.js.map