/**
 * Logging, audit trail, and stats persistence.
 *
 * Security:
 * - Log directory created with 0700 (owner-only access)
 * - Debug log never contains prompt text or PII values
 * - Audit log stores entity types and metadata, never raw sensitive values
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuditEntry, Stats } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOG_DIR = path.join(os.homedir(), '.raidu', 'logs');
export const AUDIT_LOG = path.join(LOG_DIR, 'audit.jsonl');
export const STATS_FILE = path.join(LOG_DIR, 'stats.json');
export const DEBUG_LOG = path.join(LOG_DIR, 'debug.log');

// Create log directory with restrictive permissions (owner-only)
try {
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  // Ensure existing dir also has correct permissions
  fs.chmodSync(LOG_DIR, 0o700);
} catch {}

// ---------------------------------------------------------------------------
// Debug logging (metadata only, never PII or prompt content)
// ---------------------------------------------------------------------------

export function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export function debug(msg: string): void {
  try {
    // Truncate message to prevent accidental PII in debug logs
    const safe = msg.slice(0, 200);
    fs.appendFileSync(DEBUG_LOG, `${ts()} | ${safe}\n`, { mode: 0o600 });
  } catch {}
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export function audit(entry: AuditEntry): void {
  try {
    fs.appendFileSync(AUDIT_LOG, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, {
      mode: 0o600,
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const DEFAULT_STATS: Stats = {
  totalScans: 0,
  piiFound: 0,
  secretsFound: 0,
  promptsBlocked: 0,
  commandsBlocked: 0,
  sessionsAudited: 0,
};

export function loadStats(): Stats {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(s: Stats): void {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
  } catch {}
}

export function incStat(key: string, n: number = 1): Stats {
  const s = loadStats();
  (s as Record<string, number>)[key] = ((s as Record<string, number>)[key] || 0) + n;
  saveStats(s);
  return s;
}
