/**
 * Installs Raidu hooks on extension activation.
 *
 * Two hook locations (Cursor fires different events from each):
 *   1. ~/.cursor/hooks.json (user-level): beforeSubmitPrompt, afterAgentResponse, etc.
 *   2. ~/.cursor/plugins/local/raidu-firewall/hooks/ (plugin-level): preToolUse, beforeReadFile, etc.
 *
 * On activate: installs both.
 * On deactivate/uninstall: removes both.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CURSOR_HOOKS_FILE = path.join(os.homedir(), '.cursor', 'hooks.json');
const RAIDU_MARKER = '__raidu_managed';

// ALL hooks go in user-level. Plugin-level hooks don't reliably fire in Cursor 2.6.
const ALL_HOOK_EVENTS = [
  'beforeSubmitPrompt',
  'preToolUse',
  'beforeReadFile',
  'beforeShellExecution',
  'beforeMCPExecution',
  'beforeTabFileRead',
  'subagentStart',
  'afterShellExecution',
  'afterMCPExecution',
  'afterFileEdit',
  'afterAgentResponse',
  'afterAgentThought',
  'stop',
];

interface HooksConfig {
  version: number;
  hooks: Record<string, Array<{ command: string; timeout: number; [key: string]: unknown }>>;
}

/**
 * Installs all Raidu hooks on extension activation.
 * All hooks go in user-level ~/.cursor/hooks.json.
 */
export function installHooks(extensionPath: string): void {
  const hookBinary = path.join(extensionPath, 'hooks', 'dist', 'index.js');

  if (!fs.existsSync(hookBinary)) {
    console.warn(`Raidu: Hook binary not found at ${hookBinary}`);
    return;
  }

  installUserHooks(hookBinary);
}

/**
 * Removes all Raidu hooks.
 */
export function removeHooks(): void {
  removeUserHooks();
}

// ---------------------------------------------------------------------------
// User-level hooks (~/.cursor/hooks.json)
// ---------------------------------------------------------------------------

function installUserHooks(hookBinary: string): void {
  const command = `node ${hookBinary}`;

  let config: HooksConfig = { version: 1, hooks: {} };
  try {
    if (fs.existsSync(CURSOR_HOOKS_FILE)) {
      config = JSON.parse(fs.readFileSync(CURSOR_HOOKS_FILE, 'utf-8'));
    }
  } catch {
    config = { version: 1, hooks: {} };
  }

  for (const event of ALL_HOOK_EVENTS) {
    if (!config.hooks[event]) config.hooks[event] = [];

    // Remove existing Raidu hooks
    config.hooks[event] = config.hooks[event].filter((h) => !h[RAIDU_MARKER] && !h.command.includes('raidu'));

    const timeout = event === 'stop' ? 60 : event.startsWith('after') ? 5 : 10;
    config.hooks[event].push({ command, timeout, [RAIDU_MARKER]: true });
  }

  try {
    fs.mkdirSync(path.dirname(CURSOR_HOOKS_FILE), { recursive: true });
    fs.writeFileSync(CURSOR_HOOKS_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn(`Raidu: Failed to write user hooks: ${err}`);
  }
}

function removeUserHooks(): void {
  if (!fs.existsSync(CURSOR_HOOKS_FILE)) return;

  try {
    const config: HooksConfig = JSON.parse(fs.readFileSync(CURSOR_HOOKS_FILE, 'utf-8'));
    let hasOther = false;

    for (const event of Object.keys(config.hooks)) {
      config.hooks[event] = config.hooks[event].filter((h) => !h[RAIDU_MARKER] && !h.command.includes('raidu'));
      if (config.hooks[event].length > 0) hasOther = true;
      else delete config.hooks[event];
    }

    if (hasOther) {
      fs.writeFileSync(CURSOR_HOOKS_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    } else {
      fs.unlinkSync(CURSOR_HOOKS_FILE);
    }
  } catch {}
}
