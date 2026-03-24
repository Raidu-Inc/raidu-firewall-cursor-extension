/**
 * Text scanning, entity formatting, redaction, and clipboard helpers.
 *
 * scanText() is the single entry point for all PII/secret detection.
 * It calls the Raidu API first (when connected), falls back to local regex.
 */

import { execFileSync } from 'node:child_process';
import { validateViaAPI } from './api';
import { debug } from './audit';
import { PIIScanner } from './scanner';
import type { EntityMatch, ScanResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_SCAN_SIZE = 100_000;

// ---------------------------------------------------------------------------
// Scanner instance (local fallback)
// ---------------------------------------------------------------------------

const localScanner = new PIIScanner();

// ---------------------------------------------------------------------------
// Unified scan: API first, local fallback
// ---------------------------------------------------------------------------

/**
 * Scans text for PII and secrets.
 *
 * 1. If connected to Raidu API: calls POST /api/guardrails/ide/validate
 *    (runs Presidio + 27 guardrails, 99.2% accuracy)
 * 2. If API unavailable or not connected: falls back to local regex scanner
 *    (18 entity types, ~92% accuracy)
 *
 * Returns a unified ScanResult regardless of which path was used.
 */
export function scanText(text: string): ScanResult & { source: 'api' | 'local'; sanitizedInput?: string } {
  if (!text || text.length > MAX_SCAN_SIZE) {
    return { entities: [], scanTimeMs: 0, source: 'local' };
  }

  // Try API first
  const start = performance.now();
  const apiResult = validateViaAPI(text);

  if (apiResult && !apiResult.passed && apiResult.entities && apiResult.entities.length > 0) {
    const entities: EntityMatch[] = apiResult.entities.map((e) => ({
      type: e.type || 'UNKNOWN',
      value: '',
      start: e.start ?? 0,
      end: e.end ?? 0,
      score: e.confidence ?? 1.0,
    }));

    debug(`scan: API found ${entities.length} entities (${entities.map((e) => e.type).join(', ')})`);

    return {
      entities,
      scanTimeMs: apiResult.processingTimeMs ?? performance.now() - start,
      source: 'api',
      sanitizedInput: apiResult.sanitizedInput,
    };
  }

  if (apiResult && apiResult.passed) {
    // API says clean, but still run local scan as safety net
    // (API might not have all guardrails enabled in sandbox)
    const localCheck = localScanner.scan(text);
    if (localCheck.entities.length > 0) {
      debug(`scan: API passed but local found ${localCheck.entities.length} entities`);
      return { ...localCheck, source: 'local' };
    }
    return { entities: [], scanTimeMs: performance.now() - start, source: 'api' };
  }

  // API unavailable or not connected: local fallback
  const localResult = localScanner.scan(text);
  debug(`scan: local fallback (${localResult.entities.length} entities, ${localResult.scanTimeMs.toFixed(1)}ms)`);

  return { ...localResult, source: 'local' };
}

/**
 * Local-only scan (for file content, shell output where API call would be too slow).
 * Used by afterShellExecution, afterFileEdit, afterAgentResponse (post-hoc detection).
 */
export function scanTextLocal(text: string): ScanResult {
  if (!text || text.length > MAX_SCAN_SIZE) return { entities: [], scanTimeMs: 0 };
  return localScanner.scan(text);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatEntities(entities: EntityMatch[]): string {
  const types = [...new Set(entities.map((e) => e.type))];
  return types
    .map((t) => {
      const n = entities.filter((e) => e.type === t).length;
      return `${n} ${t.replace(/_/g, ' ').toLowerCase()}`;
    })
    .join(', ');
}

export function redactText(text: string, entities: EntityMatch[]): string {
  // Only works with local scan results that have real positions
  const withPositions = entities.filter((e) => e.start !== e.end);
  if (withPositions.length === 0) return text;

  const sorted = [...withPositions].sort((a, b) => b.start - a.start);
  let out = text;
  const counters: Record<string, number> = {};
  for (const e of sorted) {
    counters[e.type] = (counters[e.type] || 0) + 1;
    out = `${out.slice(0, e.start)}[${e.type}_${counters[e.type]}]${out.slice(e.end)}`;
  }
  return out;
}

export function copyToClipboard(text: string): void {
  try {
    if (process.platform === 'darwin') {
      execFileSync('pbcopy', [], { input: text, timeout: 2000 });
    } else if (process.platform === 'linux') {
      execFileSync('xclip', ['-selection', 'clipboard'], { input: text, timeout: 2000 });
    }
  } catch {}
}

export function entitySummary(entities: EntityMatch[]): Array<{ type: string; score: number }> {
  return entities.map((e) => ({ type: e.type, score: e.score }));
}
