/**
 * Status bar item that shows live scan counts.
 *
 * Format: "$(shield) Raidu  S:12  B:3"
 *   S = total scans, B = blocked (prompts + commands).
 */

import * as vscode from 'vscode';
import { getStats } from './log-reader';

/**
 * Creates the status bar item and registers it for disposal.
 * Returns the item so callers can refresh or flash it.
 */
export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = 'raidu.showStatus';
  item.tooltip = 'Raidu Firewall: click for details';
  context.subscriptions.push(item);

  refreshStatusBar(item);
  item.show();

  return item;
}

/** Re-reads stats and updates the status bar text. */
export function refreshStatusBar(statusBar: vscode.StatusBarItem): void {
  const stats = getStats();
  const blocked = stats.promptsBlocked + stats.commandsBlocked;
  statusBar.text = `$(shield) Raidu  S:${stats.totalScans}  B:${blocked}`;
}

/**
 * Briefly shows a warning flash on the status bar for 4 seconds,
 * then restores the normal stats display.
 */
export function flashStatusBar(statusBar: vscode.StatusBarItem, msg: string): void {
  const prev = statusBar.text;
  const prevBg = statusBar.backgroundColor;

  statusBar.text = `$(alert) ${msg}`;
  statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

  setTimeout(() => {
    statusBar.text = prev;
    statusBar.backgroundColor = prevBg;
    refreshStatusBar(statusBar);
  }, 4000);
}
