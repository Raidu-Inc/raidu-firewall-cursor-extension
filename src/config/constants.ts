/**
 * Shared constants for the Raidu Firewall extension host.
 */

import * as os from 'node:os';
import * as path from 'node:path';

/** Directory where the hook process writes audit logs and stats. */
export const LOG_DIR = path.join(os.homedir(), '.raidu', 'logs');

/** JSONL audit log written by hooks. */
export const AUDIT_LOG = path.join(LOG_DIR, 'audit.jsonl');

/** Aggregated stats JSON written by hooks. */
export const STATS_FILE = path.join(LOG_DIR, 'stats.json');

/**
 * Hook events that are too noisy to show in the sidebar event list.
 * They are still recorded in the audit log.
 */
export const HIDDEN_EVENTS: ReadonlySet<string> = new Set(['stop', 'afterAgentThought', 'sessionStart', 'sessionEnd']);
