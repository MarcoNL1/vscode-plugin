import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as SaxonJS from 'saxon-js';
import * as frankLayout from "@frankframework/frank-config-layout";
import { JSDOM } from "jsdom";

export default class FlowViewProvider {
    context: any;
    webView: any;
    constructor(context: any) {
      this.context = context;
    }

    resolveWebviewView(webviewView: any) {
      this.webView = webviewView;
      this.webView.webview.options = { enableScripts: true };

      (global as any).DOMParser = new JSDOM().window.DOMParser;
      (global as any).document = new JSDOM().window.document;

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

      // Process local SYSTEM entities to resolve aggregator configurations automatically.
      // Note: Parsing XML with Regex is generally an anti-pattern, but necessary here 
      // because JSDOM's DOMParser blocks external file-system entity resolution by default.
      const entityRegex = /<!ENTITY\s+([\w.-]+)\s+SYSTEM\s+["']([^"']+)["']\s*>/gi;
      let match;
      const dir = path.dirname(editor.document.fileName);

      while ((match = entityRegex.exec(config)) !== null) {
          const entityName = match[1];
          const relativePath = match[2];
          try {
              const entityUri = vscode.Uri.file(path.join(dir, relativePath));
              
              // Use VS Code's async workspace API to prevent blocking the Extension Host
              const fileData = await vscode.workspace.fs.readFile(entityUri);
              let entityContent = Buffer.from(fileData).toString('utf8');
              
              // Strip XML declarations from injected files to maintain a valid overall XML document
              entityContent = entityContent.replace(/<\?xml[^>]*\?>/gi, '');
              
              // Always use a callback function for the replacement string. 
              // Frank! configurations contain variables like ${property}, which standard replace 
              // might incorrectly parse as Regex capture group references if they contain $ signs.
              config = config.replace(new RegExp(`&${entityName};`, 'g'), () => entityContent);
          } catch (error) {
              console.error(`[WeAreFrank!] Entity resolution failed for ${entityName} at ${relativePath}`, error);
              // We intentionally continue the loop; a single missing file shouldn't break the entire parsing tree immediately.
          }
      }

      const parser = new (global as any).DOMParser();
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

      // Robust check using the actual DOM tree instead of brittle string splitting
      // If the document contains adapters, we map it as an adapter flowchart.
      const isAdapter = xml.documentElement.nodeName.toLowerCase() === 'adapter' || 
                        xml.getElementsByTagName("adapter").length > 0;

      const mermaidSef = convertXSLtoSEF(
        this.context,
        isAdapter ? "adapter2mermaid" : "configuration2mermaid"
      );
      
      const paramsUri = vscode.Uri.joinPath(
        this.context.extensionUri, 
        "resources", "flow", "xml", "params.xml"
      );
      
      let params = "";
      try {
        // Asynchronously read the file using VS Code's workspace file system API
        // This prevents blocking the single-threaded Extension Host
        const paramsData = await vscode.workspace.fs.readFile(paramsUri);
        
        // Convert the returned Uint8Array to a UTF-8 string
        params = Buffer.from(paramsData).toString('utf8');
      } catch (err) {
        console.error("[WeAreFrank!] Failed to load internal params.xml resource:", err);
        this.webView.webview.html = getErrorWebviewContent("Internal error: Could not load flow parameters.");
        return;
      }

      const mermaid = SaxonJS.transform({
        stylesheetText: mermaidSef,
        sourceText: canoncalizedXml.principalResult,
        destination: "serialized",
        stylesheetParams: {
          frankElements: paramsXdm
        }
      });

      const css = this.webView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'resources',
          'css',
          'flow-view-webcontent.css'
        )
      );

      const codiconCss = this.webView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'resources',
          'css',
          'codicon.css'
        )
      );

      const script = this.webView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'src',
          'flow',
          'flow-view-script.js'
        )
      );

      const zoomScript = this.webView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'node_modules',
          'svg-pan-zoom',
          'dist',
          'svg-pan-zoom.min.js'
        )
      );

      try {
        frankLayout.initMermaid2Svg(frankLayout.getFactoryDimensions());
        const svg = await frankLayout.mermaid2svg(mermaid.principalResult);

        this.webView.webview.html = getWebviewContent(svg, css, codiconCss, script, zoomScript);
      } catch (err) {
        this.webView.webview.html = getErrorWebviewContent("This file is not recognized as a Frank!Configuration");
      }
    }
}

function convertXSLtoSEF(context: any, xsl: any) {
  const xslPath = path.join(
    context.extensionPath,
    "resources/flow/xsl",
    xsl + ".xsl"
  );

  const env = SaxonJS.getPlatform();
  const doc = env.parseXmlFromString(env.readFile(xslPath));

  const lookupDir = path.join(
    context.extensionPath,
    "resources/flow/xml"
  ).replace(/\\/g, "/");
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

function getWebviewContent(svg: any, css: any, codiconCss: any, script: any, zoomScript: any) {
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

function getErrorWebviewContent(error: any) {
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

function getAggregatorWebviewContent() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Flowchart</title>
        <style>
            body {
                font-family: sans-serif;
                color: var(--vscode-list-warningForeground);
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
        <h2>Info</h2>
        <p>This file combines multiple sub-configurations. Open a specific configuration to get started.</p>
    </body>
    </html>
    `;
}

// Exported as default above