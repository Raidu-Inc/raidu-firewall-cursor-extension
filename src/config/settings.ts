/**
 * Typed wrapper around vscode.workspace.getConfiguration('raidu').
 *
 * Security:
 * - IDE token stored in SecretStorage (OS keychain) for the extension
 * - Token also written to ~/.raidu/token (0600 perms) for hooks to read
 * - Token NEVER stored in settings.json (plaintext, world-readable)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const SECTION = 'raidu';
const TOKEN_FILE = path.join(os.homedir(), '.raidu', 'token');

let _secrets: vscode.SecretStorage | undefined;

/** Call once during activation to hand in the SecretStorage instance. */
export function initSecretStorage(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

// ---- Readers ---------------------------------------------------------------

export function getApiBase(): string {
  return cfg().get<string>('apiBase', 'https://sandbox.raidu.com');
}

export async function getToken(): Promise<string | undefined> {
  if (_secrets) {
    const secret = await _secrets.get('ideToken');
    if (secret) return secret;
  }
  // Fallback: read from token file (for migration)
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf-8').trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getWorkspaceId(): string | undefined {
  return cfg().get<string>('workspaceId') || undefined;
}

export function getEnvironmentId(): string | undefined {
  return cfg().get<string>('environmentId') || undefined;
}

export async function isConnected(): Promise<boolean> {
  return !!(await getToken());
}

// ---- Writers ---------------------------------------------------------------

export async function setToken(token: string): Promise<void> {
  // Primary: OS keychain via SecretStorage
  if (_secrets) {
    await _secrets.store('ideToken', token);
  }

  // Secondary: token file with restricted perms for hooks to read
  // Hooks run as standalone Node.js and can't access SecretStorage
  try {
    const dir = path.dirname(TOKEN_FILE);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  } catch {}

  // Remove any legacy token from settings.json
  await cfg().update('ideToken', undefined, vscode.ConfigurationTarget.Global);
}

export async function setWorkspaceId(id: string): Promise<void> {
  await cfg().update('workspaceId', id, vscode.ConfigurationTarget.Global);
}

export async function setEnvironmentId(id: string): Promise<void> {
  await cfg().update('environmentId', id, vscode.ConfigurationTarget.Global);
}

/** Clears all stored credentials and identifiers. */
export async function clearAll(): Promise<void> {
  if (_secrets) {
    await _secrets.delete('ideToken');
  }
  // Delete token file
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {}

  const config = cfg();
  await config.update('ideToken', undefined, vscode.ConfigurationTarget.Global);
  await config.update('workspaceId', undefined, vscode.ConfigurationTarget.Global);
  await config.update('environmentId', undefined, vscode.ConfigurationTarget.Global);
}
