"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const SaxonJS = require("saxon-js");
const frankLayout = require("@frankframework/frank-config-layout");
const jsdom_1 = require("jsdom");
class FlowViewProvider {
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView) {
        this.webView = webviewView;
        this.webView.webview.options = { enableScripts: true };
        global.DOMParser = new jsdom_1.JSDOM().window.DOMParser;
        global.document = new jsdom_1.JSDOM().window.document;
        this.updateWebview();
    }
    async updateWebview() {
        if (!this.webView) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "xml" || editor.document.fileName.endsWith(".xsd")) {
            this.webView.webview.html = getOpenedWithEmptyEditorWebviewContent();
            return;
        }
        let config = getCurrentConfiguration();
        if (!config) {
            return;
        }
        const dir = path.dirname(editor.document.fileName);
        // Process local SYSTEM entities to resolve aggregator configurations automatically.
        // We extract all matches first using matchAll to prevent RegExp state corruption 
        // caused by modifying the string length during iteration.
        const entityMatches = [...config.matchAll(/<!ENTITY\s+([\w.-]+)\s+SYSTEM\s+["']([^"']+)["']\s*>/gi)];
        for (const match of entityMatches) {
            const entityName = match[1];
            const relativePath = match[2];
            try {
                const entityUri = vscode.Uri.file(path.join(dir, relativePath));
                const fileData = await vscode.workspace.fs.readFile(entityUri);
                let entityContent = Buffer.from(fileData).toString('utf8');
                // Strip XML declarations to prevent invalidating the master document
                entityContent = entityContent.replace(/<\?xml[^>]*\?>/gi, '');
                config = config.replace(new RegExp(`&${entityName};`, 'g'), () => entityContent);
            }
            catch (error) {
                const errorMsg = `Unable to load entity '&${entityName};'. File '${relativePath}' is missing or unreadable.`;
                console.error(`[WeAreFrank!] ${errorMsg}`, error);
                // Warn the user via the UI, but do not break the flow rendering completely
                vscode.window.showWarningMessage(`WeAreFrank! Flow: ${errorMsg}`);
            }
        }
        const includeMatches = [...config.matchAll(/<Include\s+ref=["']([^"']+)["']\s*\/>/gi)];
        for (const match of includeMatches) {
            const fullMatch = match[0];
            const relativePath = match[1];
            try {
                const includeUri = vscode.Uri.file(path.join(dir, relativePath));
                const fileData = await vscode.workspace.fs.readFile(includeUri);
                let includeContent = Buffer.from(fileData).toString('utf8');
                // Strip XML declarations from injected files
                includeContent = includeContent.replace(/<\?xml[^>]*\?>/gi, '');
                // Replace the specific <Include ... /> tag with the fetched file content
                config = config.replace(fullMatch, () => includeContent);
            }
            catch (error) {
                const errorMsg = `Unable to resolve Include reference. File '${relativePath}' is missing or unreadable.`;
                console.error(`[WeAreFrank!] ${errorMsg}`, error);
                vscode.window.showWarningMessage(`Frank!Flow: ${errorMsg}`);
            }
        }
        const parser = new global.DOMParser();
        const xml = parser.parseFromString(config, "text/xml");
        const parserErrors = xml.getElementsByTagName("parsererror");
        if (parserErrors.length > 0) {
            const error = parserErrors[0].textContent;
            this.webView.webview.html = getErrorWebviewContent(error);
            return;
        }
        const canonicalizeSef = convertXSLtoSEF(this.context, "canonicalize");
        const canoncalizedXml = SaxonJS.transform({
            stylesheetText: canonicalizeSef,
            sourceText: config,
            destination: "serialized"
        });
        const isAdapter = xml.documentElement.nodeName.toLowerCase() === 'adapter' ||
            xml.getElementsByTagName("adapter").length > 0;
        const mermaidSef = convertXSLtoSEF(this.context, isAdapter ? "adapter2mermaid" : "configuration2mermaid");
        const paramsPath = path.join(this.context.extensionPath, "resources/flow/xml/params.xml");
        try {
            const paramsBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(paramsPath));
            const paramsContent = Buffer.from(paramsBuffer).toString('utf8');
            const paramsXdm = await SaxonJS.getResource({
                type: "xml",
                text: paramsContent
            });
            const mermaid = SaxonJS.transform({
                stylesheetText: mermaidSef,
                sourceText: canoncalizedXml.principalResult,
                destination: "serialized",
                stylesheetParams: {
                    frankElements: paramsXdm
                }
            });
            const css = this.webView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'css', 'flow-view-webcontent.css'));
            const codiconCss = this.webView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'css', 'codicon.css'));
            const script = this.webView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'flow', 'flow-view-script.js'));
            const zoomScript = this.webView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'svg-pan-zoom', 'dist', 'svg-pan-zoom.min.js'));
            try {
                frankLayout.initMermaid2Svg(frankLayout.getFactoryDimensions());
                const svg = await frankLayout.mermaid2svg(mermaid.principalResult);
                this.webView.webview.html = getWebviewContent(svg, css, codiconCss, script, zoomScript);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error("[WeAreFrank!] Rendering failed:", err);
                this.webView.webview.html = getErrorWebviewContent(`Failed to generate the flow.\nPlease check your configuration syntax.\n\nDetails:\n${errorMessage}`);
            }
        }
        catch (error) {
            console.error("Failed to process SaxonJS resources:", error);
            this.webView.webview.html = getErrorWebviewContent("Internal transformation error: missing resources.");
            return;
        }
    }
}
exports.default = FlowViewProvider;
function convertXSLtoSEF(context, xsl) {
    const xslPath = path.join(context.extensionPath, "resources/flow/xsl", xsl + ".xsl");
    const env = SaxonJS.getPlatform();
    const doc = env.parseXmlFromString(env.readFile(xslPath));
    const lookupDir = path.join(context.extensionPath, "resources/flow/xml").replace(/\\/g, "/");
    doc._saxonBaseUri = `file://${lookupDir}/`;
    return JSON.stringify(SaxonJS.compile(doc));
}
function getCurrentConfiguration() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    return editor.document.getText();
}
function getWebviewContent(svg, css, codiconCss, script, zoomScript) {
    return `
  <!DOCTYPE html>
  <html>
      <head>
        <meta charset="UTF-8">
        <title>Flowchart</title>
        <link rel="stylesheet" href="${css}">
        <link rel="stylesheet" href="${codiconCss}" >
      </head>
      <body>
        <div id="container">
          ${svg}
          <div id="toolbar">
            <i class="codicon codicon-zoom-in" id="zoom-in"></i>
            <i class="codicon codicon-discard" id="reset"></i>
            <i class="codicon codicon-zoom-out" id="zoom-out"></i>
          </div>
        </div>

        <script src="${zoomScript}"></script>
        <script src="${script}"></script>
      </body>
  </html>
  `;
}
function getErrorWebviewContent(error) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Flowchart – Error</title>
        <style>
            body {
                font-family: sans-serif;
                color: var(--vscode-errorForeground);
                padding: 10px;
            }
            pre {
                background: var(--vscode-editorWidget-background);
                border-left: 4px solid var(--vscode-errorForeground);
                padding: 5px;
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <h2>Error</h2>
        <p>Something is wrong with your XML :(</p>
        <pre>${error}</pre>
    </body>
    </html>
    `;
}
function getOpenedWithEmptyEditorWebviewContent() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Flowchart</title>
        <style>
            body {
                font-family: sans-serif;
                color: var(--vscode-textLink-foreground);
                padding: 10px;
            }
            pre {
                background: var(--vscode-editorWidget-background);
                border-left: 4px solid var(--vscode-errorForeground);
                padding: 5px;
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <h2>Hello!</h2>
        <p>Open a Frank!Configuration to get started :)</p>
    </body>
    </html>
    `;
}
// Exported as default above
//# sourceMappingURL=flow-view-provider.js.map