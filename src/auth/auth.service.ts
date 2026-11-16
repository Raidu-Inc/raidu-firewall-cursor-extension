/**
 * Authentication service for Raidu Firewall.
 *
 * Flow per integration spec:
 *  1. login()         - opens browser: {apiBase}/console/login?ide_callback=cursor&state=xxx
 *  2. handleCallback  - receives cursor://raidu.raidu-firewall/callback?token=xxx&state=xxx
 *  3. loadConfig      - GET /api/auth/ide/config → user, org, workspaces
 *  4. logout()        - revokes sessions, clears everything
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import * as settings from '../config/settings';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _pendingState: string | undefined;

export interface UserProfile {
  email: string;
  name: string;
  organizationName: string;
  plan: string;
  workspaceName?: string;
  environmentName?: string;
}

let _profile: UserProfile | undefined;

export function getProfile(): UserProfile | undefined {
  return _profile;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(): Promise<void> {
  _pendingState = crypto.randomUUID();
  settings.savePendingState(_pendingState);
  const apiBase = settings.getApiBase();
  const loginUrl = `${apiBase}/login?ide_callback=cursor&state=${_pendingState}`;

  await vscode.env.openExternal(vscode.Uri.parse(loginUrl));

  // The browser redirect (cursor://raidu.raidu-firewall/callback?...) is routed by
  // the OS to the primary editor window. When running in an Extension Development
  // Host (F5) or a different window, that window can't complete the login, so let
  // the user paste the callback URL here instead.
  const PASTE = 'Paste callback URL';
  void vscode.window
    .showInformationMessage(
      'Raidu: Complete login in your browser. If the editor does not reconnect automatically, copy the callback URL and paste it here.',
      PASTE,
    )
    .then((choice) => {
      if (choice === PASTE) return promptForCallbackUrl();
    });
}

export async function promptForCallbackUrl(): Promise<void> {
  const input = await vscode.window.showInputBox({
    title: 'Raidu: Paste login callback URL',
    prompt: 'e.g. cursor://raidu.raidu-firewall/callback?token=...&state=...',
    ignoreFocusOut: true,
    password: true,
  });
  if (!input) return;

  let uri: vscode.Uri;
  try {
    uri = vscode.Uri.parse(input.trim(), true);
  } catch {
    vscode.window.showErrorMessage('Raidu: That does not look like a valid callback URL.');
    return;
  }
  await handleCallback(uri);
}

// ---------------------------------------------------------------------------
// OAuth callback handler
// ---------------------------------------------------------------------------

export async function handleCallback(uri: vscode.Uri): Promise<void> {
  const params = new URLSearchParams(uri.query);
  const state = params.get('state');
  const token = params.get('token');

  // Accept state from this window or from another window that started login.
  const expected = [_pendingState, settings.readPendingState()].filter(Boolean);
  if (!state || !expected.includes(state)) {
    vscode.window.showErrorMessage('Raidu: Authentication failed (state mismatch). Please run "Raidu: Connect" again.');
    return;
  }
  _pendingState = undefined;
  settings.clearPendingState();

  if (!token) {
    vscode.window.showErrorMessage('Raidu: Authentication failed (no token).');
    return;
  }

  await settings.setToken(token);
  vscode.window.showInformationMessage('Raidu Firewall: Connected successfully.');

  await loadConfig(token);

  // Notify extension to refresh UI (sidebar + status bar)
  vscode.commands.executeCommand('raidu.refreshUI');
}

// ---------------------------------------------------------------------------
// Load config (user, org, workspaces) from API
// ---------------------------------------------------------------------------

export async function loadConfig(token: string): Promise<void> {
  const apiBase = settings.getApiBase();

  try {
    const res = await fetch(`${apiBase}/api/auth/ide/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      await settings.clearAll();
      _profile = undefined;
      vscode.window.showWarningMessage('Raidu: Session expired. Please reconnect.');
      return;
    }

    if (!res.ok) {
      vscode.window.showWarningMessage('Raidu: Could not load config.');
      return;
    }

    const data = (await res.json()) as {
      user?: { email?: string; name?: string };
      organization?: { name?: string; plan?: string };
      workspaces?: Array<{
        id: string;
        name: string;
        environments?: Array<{ id: string; name: string }>;
      }>;
    };

    // Build profile
    _profile = {
      email: data.user?.email || '',
      name: data.user?.name || '',
      organizationName: data.organization?.name || '',
      plan: data.organization?.plan || 'free',
    };

    // Auto-select first workspace/environment (no prompt)
    const workspaces = data.workspaces || [];
    if (workspaces.length > 0) {
      const ws = workspaces[0];
      await settings.setWorkspaceId(ws.id);
      _profile.workspaceName = ws.name;

      const envs = ws.environments || [];
      if (envs.length > 0) {
        await settings.setEnvironmentId(envs[0].id);
        _profile.environmentName = envs[0].name;
      }
    }
  } catch {
    vscode.window.showWarningMessage('Raidu: Failed to load config. Check your connection.');
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const token = await settings.getToken();
  const apiBase = settings.getApiBase();

  if (token) {
    try {
      // Get sessions and revoke
      const sessionsRes = await fetch(`${apiBase}/api/auth/ide/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sessionsRes.ok) {
        const sessions = (await sessionsRes.json()) as Array<{ id: string }>;
        for (const session of sessions) {
          await fetch(`${apiBase}/api/auth/ide/revoke?session_id=${session.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch {
      // Best effort
    }
  }

  await settings.clearAll();
  _profile = undefined;
  vscode.window.showInformationMessage('Raidu Firewall: Disconnected.');
}

// ---------------------------------------------------------------------------
// Restore session on activation
// ---------------------------------------------------------------------------

export async function restoreSession(): Promise<void> {
  const token = await settings.getToken();
  if (token) {
    await loadConfig(token);
  }
}

// ---------------------------------------------------------------------------
// Cross-window sync: pick up logins/logouts completed in another editor window
// ---------------------------------------------------------------------------

export function watchTokenFile(context: vscode.ExtensionContext): void {
  let lastToken = settings.readTokenFile();

  const onChange = async () => {
    const token = settings.readTokenFile();
    if (token === lastToken) return;
    lastToken = token;

    if (token) {
      await settings.adoptToken(token);
      await loadConfig(token);
    } else {
      _profile = undefined;
    }
    vscode.commands.executeCommand('raidu.refreshUI');
  };

  fs.watchFile(settings.TOKEN_FILE, { interval: 1000 }, () => {
    void onChange();
  });
  context.subscriptions.push({ dispose: () => fs.unwatchFile(settings.TOKEN_FILE) });
}

// ---------------------------------------------------------------------------
// URI handler registration
// ---------------------------------------------------------------------------

export function registerUriHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        handleCallback(uri);
      },
    }),
  );
}
