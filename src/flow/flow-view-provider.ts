import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as SaxonJS from 'saxon-js';
import * as frankLayout from "@frankframework/frank-config-layout";
import { JSDOM } from "jsdom";

export default class FlowViewProvider {
    context: any;
    webView: any;

    // Cached heavy resources — computed once per extension lifetime
    private canonicalizeSef: string | null = null;
    private mermaidSef: string | null = null;
    private paramsXdm: any = null;
    private domParser: any = null;
    private xmlSerializer: any = null;
    private layoutInitialized = false;

    constructor(context: any) {
      this.context = context;
    }

    resolveWebviewView(webviewView: any) {
      this.webView = webviewView;
      this.webView.webview.options = { enableScripts: true };

      const jsdomWindow = new JSDOM().window;
      (global as any).DOMParser = jsdomWindow.DOMParser;
      (global as any).document = jsdomWindow.document;
      this.domParser = new jsdomWindow.DOMParser();
      this.xmlSerializer = new (jsdomWindow as any).XMLSerializer();

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

      // Resolve SYSTEM entities and <Include> tags iteratively so that included files'
      // own includes/entities are also expanded (transitive resolution).
      // Strip XML comments first so patterns inside example comments are ignored.
      const MAX_PASSES = 10;
      for (let pass = 0; pass < MAX_PASSES; pass++) {
          const configWithoutComments: string = config.replace(/<!--[\s\S]*?-->/g, '');
          let changed = false;

          const entityMatches: RegExpMatchArray[] = [...configWithoutComments.matchAll(/<!ENTITY\s+([\w.-]+)\s+SYSTEM\s+["']([^"']+)["']\s*>/gi)];
          for (const match of entityMatches) {
              const entityName: string = match[1];
              const relativePath: string = match[2];
              try {
                  const entityUri = vscode.Uri.file(path.join(dir, relativePath));
                  const fileData = await vscode.workspace.fs.readFile(entityUri);
                  let entityContent = Buffer.from(fileData).toString('utf8');
                  entityContent = entityContent.replace(/<\?xml[^>]*\?>/gi, '');
                  const before: string = config;
                  config = config.replace(new RegExp(`&${entityName};`, 'g'), () => entityContent);
                  if (config !== before) { changed = true; }
              } catch (error: any) {
                  const errorMsg = `Unable to load entity '&${entityName};'. File '${relativePath}' is missing or unreadable.`;
                  console.error(`[WeAreFrank!] ${errorMsg}`, error);
                  vscode.window.showWarningMessage(`WeAreFrank! Flow: ${errorMsg}`);
              }
          }

          // Match both self-closing and paired-tag <Include> forms.
          const includeMatches: RegExpMatchArray[] = [...configWithoutComments.matchAll(/<Include\s+ref=["']([^"']+)["']\s*(?:\/>|><\/Include>)/gi)];
          for (const match of includeMatches) {
              const fullMatch: string = match[0];
              const relativePath: string = match[1];
              try {
                  const includeUri = vscode.Uri.file(path.join(dir, relativePath));
                  const fileData = await vscode.workspace.fs.readFile(includeUri);
                  let includeContent = Buffer.from(fileData).toString('utf8');
                  includeContent = includeContent.replace(/<\?xml[^>]*\?>/gi, '');
                  config = config.replace(fullMatch, () => includeContent);
                  changed = true;
              } catch (error: any) {
                  const errorMsg = `Unable to resolve Include reference. File '${relativePath}' is missing or unreadable.`;
                  console.error(`[WeAreFrank!] ${errorMsg}`, error);
                  vscode.window.showWarningMessage(`Frank!Flow: ${errorMsg}`);
              }
          }

          if (!changed) { break; }
      }

      const parser = new (global as any).DOMParser();
      const xml = parser.parseFromString(config, "text/xml");

      const parserErrors = xml.getElementsByTagName("parsererror");

      if (parserErrors.length > 0) {
          const error = parserErrors[0].textContent;
          this.webView.webview.html = getErrorWebviewContent(error);
          return;
      }

      const FRANK_ROOT_ELEMENTS = new Set(['configuration', 'module', 'adapter']);
      const rootName = xml.documentElement.nodeName.toLowerCase();
      if (!FRANK_ROOT_ELEMENTS.has(rootName)) {
          this.webView.webview.html = getOpenedWithEmptyEditorWebviewContent();
          return;
      }

      if (!this.canonicalizeSef) {
          this.canonicalizeSef = convertXSLtoSEF(this.context, "canonicalize");
      }
      if (!this.mermaidSef) {
          this.mermaidSef = convertXSLtoSEF(this.context, "adapter2mermaid");
      }

      const canoncalizedXml = SaxonJS.transform({
        stylesheetText: this.canonicalizeSef,
        sourceText: config,
        destination: "serialized"
      });

      const paramsPath = path.join(this.context.extensionPath, "resources/flow/xml/params.xml");

      try {
          if (!this.paramsXdm) {
              const paramsBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(paramsPath));
              const paramsContent = Buffer.from(paramsBuffer).toString('utf8');
              this.paramsXdm = await SaxonJS.getResource({
                  type: "xml",
                  text: paramsContent
              });
          }

          // frank-config-layout only supports flat mermaid (no subgraphs, only
          // `Id("..."):::style` nodes), so for a <Configuration> with multiple adapters we
          // run adapter2mermaid once per adapter and stack each SVG in the webview.
          const canonDoc = this.domParser.parseFromString(canoncalizedXml.principalResult, "text/xml");
          const adapterNodes: any[] = Array.from(canonDoc.getElementsByTagName("adapter"));

          if (adapterNodes.length === 0) {
              this.webView.webview.html = getOpenedWithEmptyEditorWebviewContent();
              return;
          }

          // Always split by adapter so any root element (Configuration, Module, Adapter, etc.)
          // works correctly — the XSL expects an <adapter> as the document root.
          const adapterSources: { name: string; xml: string }[] = adapterNodes.map((a: any) => ({
              name: a.getAttribute("name") || "Adapter",
              xml: this.xmlSerializer.serializeToString(a)
          }));

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
              if (!this.layoutInitialized) {
                  frankLayout.initMermaid2Svg(frankLayout.getFactoryDimensions());
                  this.layoutInitialized = true;
              }

              const isMultiAdapter = adapterSources.length > 1;
              const renderedAdapters: { name: string; svg: string }[] = [];

              for (const src of adapterSources) {
                const mermaid = SaxonJS.transform({
                    stylesheetText: this.mermaidSef,
                    sourceText: src.xml,
                    destination: "serialized",
                    stylesheetParams: { frankElements: this.paramsXdm }
                });
                try {
                    const adapterSvg = await frankLayout.mermaid2svg(mermaid.principalResult);
                    renderedAdapters.push({ name: src.name, svg: adapterSvg });
                } catch (innerErr: any) {
                    const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    console.error(`[WeAreFrank!] mermaid2svg failed for adapter "${src.name}":`, innerErr);
                    const errorSvg = `<pre style="color:var(--vscode-errorForeground)">Failed to render: ${msg}</pre>`;
                    renderedAdapters.push({ name: src.name, svg: errorSvg });
                }
              }

              if (isMultiAdapter) {
                  this.webView.webview.html = getMultiAdapterWebviewContent(renderedAdapters, css, codiconCss);
              } else {
                  this.webView.webview.html = getWebviewContent(renderedAdapters[0].svg, css, codiconCss, script, zoomScript);
              }
            } catch (err: any) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error("[WeAreFrank!] Rendering failed:", err);
              
              this.webView.webview.html = getErrorWebviewContent(
                  `Failed to generate the flow.\nPlease check your configuration syntax.\n\nDetails:\n${errorMessage}`
              );
            }
          }
          catch (error) {
          console.error("Failed to process SaxonJS resources:", error);
          this.webView.webview.html = getErrorWebviewContent("Internal transformation error: missing resources.");
          return;
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

function getMultiAdapterWebviewContent(adapters: { name: string; svg: string }[], css: any, codiconCss: any) {
  const sections = adapters.map(({ name, svg }) => `
    <div class="adapter-section">
      ${name ? `<div class="adapter-label">${name}</div>` : ''}
      ${svg}
    </div>`).join('\n');

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Flowchart</title>
    <link rel="stylesheet" href="${css}">
    <link rel="stylesheet" href="${codiconCss}">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; width: 100%; overflow: hidden; }
      #viewport {
        width: 100%; height: 100%;
        overflow: hidden;
        cursor: grab;
        background-color: var(--vscode-editor-background);
        user-select: none;
      }
      #viewport.panning { cursor: grabbing; }
      #canvas {
        display: inline-flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 32px;
        padding: 24px;
        transform-origin: 0 0;
      }
      .adapter-section {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-shrink: 0;
        border: 1px solid var(--vscode-editorWidget-border, #555);
        border-radius: 6px;
        padding: 12px;
        background-color: var(--vscode-editorWidget-background, rgba(255,255,255,0.03));
      }
      .adapter-label {
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 8px;
        padding-bottom: 6px;
        width: 100%;
        border-bottom: 1px solid var(--vscode-editorWidget-border, #555);
        color: var(--vscode-editor-foreground);
        white-space: nowrap;
      }
      svg text { fill: var(--vscode-editor-foreground); }
      svg marker { fill: var(--vscode-editor-foreground); }
      #toolbar {
        display: flex;
        gap: 5px;
        position: absolute;
        top: 10px;
        right: 10px;
      }
      #toolbar i {
        color: var(--vscode-editor-foreground);
        cursor: pointer;
      }
      #toolbar i:hover { color: #fcd300; }
    </style>
  </head>
  <body>
    <div id="viewport">
      <div id="canvas">
        ${sections}
      </div>
    </div>
    <div id="toolbar">
      <i class="codicon codicon-zoom-in" id="zoom-in"></i>
      <i class="codicon codicon-discard" id="reset"></i>
      <i class="codicon codicon-zoom-out" id="zoom-out"></i>
    </div>
    <script>
      let scale = 1, panX = 0, panY = 0;
      let isPanning = false, startX = 0, startY = 0;
      const viewport = document.getElementById('viewport');
      const canvas = document.getElementById('canvas');

      function applyTransform() {
        canvas.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
      }

      function fitAll() {
        const vw = viewport.clientWidth, vh = viewport.clientHeight;
        const cw = canvas.scrollWidth, ch = canvas.scrollHeight;
        scale = Math.min(vw / cw, vh / ch) * 0.9;
        panX = (vw - cw * scale) / 2;
        panY = (vh - ch * scale) / 2;
        applyTransform();
      }

      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        panX = mx - (mx - panX) * factor;
        panY = my - (my - panY) * factor;
        scale *= factor;
        applyTransform();
      }, { passive: false });

      viewport.addEventListener('pointerdown', (e) => {
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('panning');
      });

      viewport.addEventListener('pointermove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
      });

      viewport.addEventListener('pointerup', () => {
        isPanning = false;
        viewport.classList.remove('panning');
      });

      window.addEventListener('load', fitAll);
      window.addEventListener('resize', fitAll);

      document.getElementById('zoom-in').onclick = () => { scale *= 1.2; applyTransform(); };
      document.getElementById('zoom-out').onclick = () => { scale /= 1.2; applyTransform(); };
      document.getElementById('reset').onclick = fitAll;
    </script>
  </body>
  </html>`;
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

// Exported as default above