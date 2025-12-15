const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const SaxonJS = require('saxon-js');
const frankLayout = require("@frankframework/frank-config-layout");
const { JSDOM } = require("jsdom")

class FlowWebViewProvider {
    constructor(context) {
      this.context = context;
    }

    resolveWebviewView(webviewView) {
      this.webView = webviewView;
      this.webView.webview.options = { enableScripts: true };

      global.DOMParser = new JSDOM().window.DOMParser;
      global.document = new JSDOM().window.document;
      
      this.updateWebview();
    }

    async updateWebview() {
      console.log("AAA");

      if (!this.webView) {
        return;
      }

      const config = getCurrentConfiguration();

      const parser = new DOMParser();
      const xml = parser.parseFromString(config, "text/xml");

      const parserErrors = xml.getElementsByTagName("parsererror");

      if (parserErrors.length > 0) {
          const errorMessage = parserErrors[0].textContent;
          this.webView.webview.html = getErrorWebviewContent(errorMessage);
          return;
      }

      const isAdapter = config.split("\n")[0].includes("adapter");
      const sef = convertXSLtoSEF(this.context, isAdapter);

      const paramsPath = path.join(this.context.extensionPath, "resources/flow/xml/params.xml");
      const params = fs.readFileSync(paramsPath, 'utf8');
      const paramsXdm = await SaxonJS.getResource({
        type: "xml",
        text: params
      });

      const result = SaxonJS.transform({
        stylesheetText: sef,
        sourceText: config,
        destination: "serialized",
        stylesheetParams: {
          frankElements: paramsXdm
        }
      });

      const cssPath = vscode.Uri.file(
          path.join(this.context.extensionPath, 'resources/css', 'flow-view-webcontent.css')
      );
      const cssUri = this.webView.webview.asWebviewUri(cssPath);

      const scriptPath = vscode.Uri.file(
          path.join(this.context.extensionPath, 'src/flow', 'flow-view-script.js')
      );
      const scriptUri = this.webView.webview.asWebviewUri(scriptPath);

      frankLayout.initMermaid2Svg(frankLayout.getFactoryDimensions());
      const svg = await frankLayout.mermaid2svg(result.principalResult);
      
      this.webView.webview.html = getWebviewContent(svg, cssUri, scriptUri);
    }

}

function convertXSLtoSEF(context, isAdapter) {
  const xslPath = isAdapter
    ? path.join(context.extensionPath, "resources/flow/xsl/adapter2mermaid.xsl")
    : path.join(context.extensionPath, "resources/flow/xsl/configuration2mermaid.xsl");

  const env = SaxonJS.getPlatform();
  const doc = env.parseXmlFromString(env.readFile(xslPath));

  doc._saxonBaseUri = "file:///";

  return JSON.stringify(SaxonJS.compile(doc));
}

function getCurrentConfiguration() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }
  return editor.document.getText();
}

function getWebviewContent(svg, cssUri, scriptUri) {
  return `
  <!DOCTYPE html>
  <html>
      <head>
        <meta charset="UTF-8">
        <title>Frank!Flow</title>
        <link rel="stylesheet" href="${cssUri}">
      </head>
      <body>
        <div class="container">
          <div id="svg">${svg}</div>
        </div>

      </body>
  </html>
  `;
}

function getErrorWebviewContent(message) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Frank!Flow – Error</title>
        <style>
            body {
                font-family: sans-serif;
                color: #b00020;
                padding: 1rem;
            }
            pre {
                background: #ffecec;
                border-left: 4px solid #b00020;
                padding: 1rem;
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <h2>XML Error</h2>
        <p>Your XML is invalid:</p>
        <pre>${message}</pre>
    </body>
    </html>
    `;
}

module.exports = FlowWebViewProvider;