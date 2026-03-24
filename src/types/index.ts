/**
 * TypeScript interfaces for the Raidu Firewall extension host.
 *
 * Stats and AuditEntry are duplicated here (rather than imported from
 * hooks/src/lib/types) because tsconfig.rootDir = src/ prevents
 * cross-boundary imports.  The hook process and the extension host
 * read/write the same JSON files, so the shapes must stay in sync.
 */

// ---------------------------------------------------------------------------
// Data types (mirrors hooks/src/lib/types.ts)
// ---------------------------------------------------------------------------

export interface Stats {
  totalScans: number;
  piiFound: number;
  secretsFound: number;
  promptsBlocked: number;
  commandsBlocked: number;
  sessionsAudited: number;
  [key: string]: number;
}

export interface AuditEntry {
  timestamp?: string;
  event: string;
  action: string;
  conversationId?: string;
  generationId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Webview communication
// ---------------------------------------------------------------------------

/** User profile info displayed in sidebar when connected. */
export interface ProfileInfo {
  email: string;
  name: string;
  org: string;
  plan: string;
  workspace?: string;
  environment?: string;
}

/** Message posted from the extension to the sidebar webview. */
export interface UpdateMessage {
  type: 'update';
  connected: boolean;
  stats: Stats;
  events: AuditEntry[];
  logoUri?: string;
  profile?: ProfileInfo;
}

/** Inbound message sent from the sidebar webview to the extension. */
export type WebviewMessage = { type: 'login' } | { type: 'logout' } | { type: 'refresh' } | { type: 'ready' };

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Shape of the workspace config returned by the Raidu API. */
export interface WorkspaceConfig {
  id: string;
  name: string;
  environments: EnvironmentConfig[];
}

export interface EnvironmentConfig {
  id: string;
  name: string;
}
