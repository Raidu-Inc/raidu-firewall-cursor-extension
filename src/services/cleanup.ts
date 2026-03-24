/**
 * Complete uninstall. Removes every trace of Raidu from the system.
 *
 *  1. Clears credentials (SecretStorage + token file + settings)
 *  2. Removes hooks from ~/.cursor/hooks.json
 *  3. Deletes ~/.raidu/ directory entirely (logs, token, policy cache)
 *  4. Removes plugin directory ~/.cursor/plugins/local/raidu-firewall/
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { clearAll } from '../config/settings';
import { removeHooks } from './hooks-installer';

const RAIDU_HOME = path.join(os.homedir(), '.raidu');
const PLUGIN_DIR = path.join(os.homedir(), '.cursor', 'plugins', 'local', 'raidu-firewall');

export async function cleanup(): Promise<void> {
  const cleaned: string[] = [];

  // 1. Clear credentials and settings
  try {
    await clearAll();
    cleaned.push('credentials cleared');
  } catch (err) {
    console.warn('[Raidu cleanup] credentials:', err);
  }

  // 2. Remove hooks from ~/.cursor/hooks.json
  try {
    removeHooks();
    cleaned.push('hooks removed');
  } catch (err) {
    console.warn('[Raidu cleanup] hooks:', err);
  }

  // 3. Delete entire ~/.raidu/ directory (logs, token, policy, everything)
  try {
    if (fs.existsSync(RAIDU_HOME)) {
      fs.rmSync(RAIDU_HOME, { recursive: true, force: true });
      cleaned.push('~/.raidu deleted');
    }
  } catch (err) {
    console.warn('[Raidu cleanup] ~/.raidu:', err);
  }

  // 4. Remove plugin directory
  try {
    if (fs.existsSync(PLUGIN_DIR)) {
      fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
      cleaned.push('plugin dir deleted');
    }
  } catch (err) {
    console.warn('[Raidu cleanup] plugin dir:', err);
  }

  console.log(`[Raidu cleanup] ${cleaned.length > 0 ? cleaned.join(', ') : 'nothing to clean'}`);
}
