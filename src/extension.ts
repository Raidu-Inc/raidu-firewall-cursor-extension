/**
 * Raidu Firewall - Extension Host
 *
 * Clean orchestrator that wires up all services:
 *  1. Ensures log directory exists
 *  2. Registers URI handler (OAuth callback)
 *  3. Creates status bar
 *  4. Registers sidebar provider
 *  5. Registers commands (login, logout, showStatus, clearHistory)
 *  6. Installs hooks into ~/.cursor/hooks.json
 *  7. Starts log watcher
 *  8. Starts periodic status bar refresh (every 3 seconds)
 */

import * as fs from 'node:fs';
import * as vscode from 'vscode';
import * as authService from './auth/auth.service';
import { LOG_DIR } from './config/constants';
import { initSecretStorage } from './config/settings';
import { cleanup } from './services/cleanup';
import { installHooks, removeHooks } from './services/hooks-installer';
import { getStats } from './services/log-reader';
import { LogWatcher } from './services/log-watcher';
import { createStatusBar, flashStatusBar, refreshStatusBar } from './services/statusbar';
import { SidebarProvider } from './sidebar/sidebar.provider';

let logWatcher: LogWatcher | undefined;
let refreshInterval: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // --- 0. Init secret storage ---
  initSecretStorage(context.secrets);

  // --- 1. Ensure log directory exists ---
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* may already exist */
  }

  // --- 2. Register URI handler for OAuth callback ---
  authService.registerUriHandler(context);

  // --- 3. Create status bar ---
  const statusBar = createStatusBar(context);

  // --- 4. Register sidebar provider ---
  const sidebarProvider = new SidebarProvider(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider));

  // --- 5. Register commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('raidu.login', async () => {
      await authService.login();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('raidu.logout', async () => {
      await authService.logout();
      sidebarProvider.refresh();
      refreshStatusBar(statusBar);
    }),
  );

  // Internal command: refresh UI after auth callback
  context.subscriptions.push(
    vscode.commands.registerCommand('raidu.refreshUI', () => {
      sidebarProvider.refresh();
      refreshStatusBar(statusBar);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('raidu.showStatus', () => {
      const stats = getStats();
      const blocked = stats.promptsBlocked + stats.commandsBlocked;
      vscode.window.showInformationMessage(
        `Raidu Firewall: ${stats.totalScans} scans, ${blocked} blocked, ` +
          `${stats.piiFound} PII, ${stats.secretsFound} secrets detected`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('raidu.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all Raidu audit logs and stats?',
        { modal: true },
        'Clear',
      );
      if (confirm !== 'Clear') {
        return;
      }

      try {
        const { AUDIT_LOG, STATS_FILE } = await import('./config/constants');
        if (fs.existsSync(AUDIT_LOG)) {
          fs.unlinkSync(AUDIT_LOG);
        }
        if (fs.existsSync(STATS_FILE)) {
          fs.unlinkSync(STATS_FILE);
        }
        refreshStatusBar(statusBar);
        await sidebarProvider.refresh();
        vscode.window.showInformationMessage('Raidu: History cleared.');
      } catch (err) {
        vscode.window.showErrorMessage(`Raidu: Failed to clear history. ${err}`);
      }
    }),
  );

  // --- 6. Install hooks into ~/.cursor/hooks.json ---
  installHooks(context.extensionPath);

  // --- 8. Start log watcher ---
  logWatcher = new LogWatcher();

  logWatcher.on('stats', (stats) => {
    refreshStatusBar(statusBar);
    sidebarProvider.refresh();

    // Flash the status bar when something is blocked.
    const blocked = stats.promptsBlocked + stats.commandsBlocked;
    if (blocked > 0) {
      const prevStats = getStats();
      const prevBlocked = prevStats.promptsBlocked + prevStats.commandsBlocked;
      if (blocked > prevBlocked) {
        flashStatusBar(statusBar, 'Blocked!');
      }
    }
  });

  logWatcher.on('audit', () => {
    sidebarProvider.refresh();
  });

  logWatcher.start();

  // --- 8. Restore session if previously connected ---
  authService.restoreSession().then(() => {
    sidebarProvider.refresh();
    refreshStatusBar(statusBar);
  });

  // --- 9. Periodic status bar refresh (every 3 seconds) ---
  refreshInterval = setInterval(() => {
    refreshStatusBar(statusBar);
  }, 3000);

  // Register cleanup for log watcher and refresh interval
  context.subscriptions.push({
    dispose() {
      if (logWatcher) {
        logWatcher.stop();
        logWatcher = undefined;
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = undefined;
      }
    },
  });
}

export async function deactivate(): Promise<void> {
  // 1. Stop log watcher.
  if (logWatcher) {
    logWatcher.stop();
    logWatcher = undefined;
  }

  // 2. Clear periodic refresh.
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  // 3. Remove hooks from ~/.cursor/hooks.json.
  removeHooks();

  // 4. Clean uninstall (revert all changes).
  await cleanup();
}
