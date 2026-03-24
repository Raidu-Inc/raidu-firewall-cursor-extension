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
  const apiBase = settings.getApiBase();
  const loginUrl = `${apiBase}/console/login?ide_callback=cursor&state=${_pendingState}`;

  await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
  vscode.window.showInformationMessage('Raidu: Opening browser for login...');
}

// ---------------------------------------------------------------------------
// OAuth callback handler
// ---------------------------------------------------------------------------

export async function handleCallback(uri: vscode.Uri): Promise<void> {
  const params = new URLSearchParams(uri.query);
  const state = params.get('state');
  const token = params.get('token');

  if (!state || state !== _pendingState) {
    vscode.window.showErrorMessage('Raidu: Authentication failed (state mismatch).');
    return;
  }
  _pendingState = undefined;

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
