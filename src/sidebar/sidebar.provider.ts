/**
 * Webview provider for the Raidu sidebar panel.
 *
 * Loads the compiled Svelte app from webview/dist/index.html.
 * Falls back to a minimal placeholder if the webview build does not
 * exist yet (e.g. first checkout before `npm run build:webview`).
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as authService from '../auth/auth.service';
import * as settings from '../config/settings';
import { getEvents, getStats } from '../services/log-reader';
import type { UpdateMessage, WebviewMessage } from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'raidu.sidebar';

  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._extensionUri = _context.extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Handle messages from the webview.
    // Webview sends { type: 'login' | 'logout' | 'refresh' | 'ready' }
    webviewView.webview.onDidReceiveMessage(
      async (msg: { type: string }) => {
        switch (msg.type) {
          case 'login':
            await authService.login();
            break;
          case 'logout':
            await authService.logout();
            this.refresh();
            break;
          case 'refresh':
          case 'ready':
            this.refresh();
            break;
        }
      },
      undefined,
      this._context.subscriptions,
    );

    // Send initial data.
    this.refresh();
  }

  /** Posts an UpdateMessage with current stats and events to the webview. */
  async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const logoUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'logo.png'));

    const profile = authService.getProfile();

    const message: UpdateMessage = {
      type: 'update',
      connected: await settings.isConnected(),
      stats: getStats(),
      events: getEvents(),
      logoUri: logoUri.toString(),
      profile: profile
        ? {
            email: profile.email,
            name: profile.name,
            org: profile.organizationName,
            plan: profile.plan,
            workspace: profile.workspaceName,
            environment: profile.environmentName,
          }
        : undefined,
    };

    this._view.webview.postMessage(message);
  }

  // ---------------------------------------------------------------------------
  // HTML generation
  // ---------------------------------------------------------------------------

  private _getHtml(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('hex');

    // Try loading the compiled webview app.
    const distIndex = path.join(this._extensionUri.fsPath, 'webview', 'dist', 'index.html');

    if (fs.existsSync(distIndex)) {
      return this._injectCsp(fs.readFileSync(distIndex, 'utf-8'), webview, nonce);
    }

    // Fallback: minimal placeholder.
    return this._fallbackHtml(webview, nonce);
  }

  /**
   * Injects a strict Content-Security-Policy meta tag and replaces
   * local asset paths with webview URIs.
   */
  private _injectCsp(html: string, webview: vscode.Webview, nonce: string): string {
    const distUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'));

    const cspMeta =
      `<meta http-equiv="Content-Security-Policy" content="` +
      `default-src 'none'; ` +
      `style-src ${webview.cspSource} 'unsafe-inline'; ` +
      `script-src 'nonce-${nonce}' ${webview.cspSource}; ` +
      `img-src ${webview.cspSource} https:; ` +
      `font-src ${webview.cspSource};` +
      `">`;

    // Insert CSP right after <head> (or <head ...>).
    let result = html.replace(/<head([^>]*)>/, `<head$1>\n    ${cspMeta}`);

    // Rewrite relative src/href to use the webview URI.
    result = result.replace(/(src|href)="(?!https?:\/\/|data:)([^"]+)"/g, (_match, attr, val) => {
      const assetUri = `${distUri}/${val.replace(/^\.?\//, '')}`;
      return `${attr}="${assetUri}"`;
    });

    // Add nonce to all script tags that don't already have one.
    result = result.replace(/<script(?![^>]*nonce)([^>]*)>/g, `<script nonce="${nonce}"$1>`);

    return result;
  }

  /** Minimal fallback shown when webview/dist has not been built yet. */
  private _fallbackHtml(webview: vscode.Webview, nonce: string): string {
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'logo.png'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      style-src 'nonce-${nonce}';
      img-src ${webview.cspSource} https:;
      script-src 'nonce-${nonce}';
    ">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
    <style nonce="${nonce}">
      body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; text-align: center; }
      img { width: 80px; margin: 24px auto; display: block; }
      h3 { margin-top: 16px; }
      p { color: var(--vscode-descriptionForeground); font-size: 13px; }
    </style>
    <img src="${logoUri}" alt="Raidu" />
    <h3>Raidu Firewall</h3>
    <p>Webview not built yet. Run <code>npm run build:webview</code> and reload.</p>
</body>
</html>`;
  }
}
