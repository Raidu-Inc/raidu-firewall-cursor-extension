/**
 * Reads stats and audit events from the filesystem.
 *
 * The hook process writes to ~/.raidu/logs/stats.json and
 * ~/.raidu/logs/audit.jsonl.  This module provides typed readers
 * for the extension host.
 */

import * as fs from 'node:fs';
import { AUDIT_LOG, HIDDEN_EVENTS, STATS_FILE } from '../config/constants';
import type { AuditEntry, Stats } from '../types';

const DEFAULT_STATS: Stats = {
  totalScans: 0,
  piiFound: 0,
  secretsFound: 0,
  promptsBlocked: 0,
  commandsBlocked: 0,
  sessionsAudited: 0,
};

/** Returns the current aggregated stats, falling back to zeroes. */
export function getStats(): Stats {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch {
    return { ...DEFAULT_STATS };
  }
}

/**
 * Reads the audit log, filters out hidden events, and returns the
 * newest entries first.
 *
 * @param limit  Maximum number of entries to return (default 50).
 */
export function getEvents(limit: number = 50): AuditEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(AUDIT_LOG, 'utf-8');
  } catch {
    return [];
  }

  const lines = raw.trim().split('\n').filter(Boolean);
  const entries: AuditEntry[] = [];

  // Walk from the end so the newest entries come first.
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const entry: AuditEntry = JSON.parse(lines[i]);
      if (!HIDDEN_EVENTS.has(entry.event)) {
        entries.push(entry);
      }
    } catch {
      // Skip malformed lines.
    }
  }

  return entries;
}
