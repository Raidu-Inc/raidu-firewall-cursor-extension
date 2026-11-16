/**
 * Block reporting to Raidu Tower.
 *
 * /api/guardrails/ide/validate records a violation only when the SERVER scan
 * finds something. Many blocks never reach it or are decided locally:
 *   - the local scanner caught what the server scan passed
 *   - protected-file, exfiltration and blocked-command rules are local-only
 *   - no token / server unreachable, so the local fallback decided
 *   - the server flagged it but its evidence write failed
 * Each of those is reported to POST /api/guardrails/ide/report so Tower has a
 * violation for every block the user saw.
 *
 * Design:
 * - Hooks never wait on the network for this. A block is appended to a local
 *   queue (0600) and a detached background process flushes it.
 * - Reports carry METADATA ONLY: event, kind, entity types, tool name, file
 *   basename, policy rule. Never the prompt, command or file content.
 * - The queue survives offline periods and missing tokens; it is flushed on the
 *   next hook run once a token exists. Capped so it cannot grow without bound.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasToken, postBlockReports } from './api';
import { debug, LOG_DIR } from './audit';
import type { BlockDetector, BlockReport, HookEvent } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REPORT_QUEUE = path.join(LOG_DIR, 'report-queue.jsonl');
const SENDING_SUFFIX = '.sending';
const MAX_QUEUE_ENTRIES = 500;
const BATCH_SIZE = 25; // server-side ArrayMaxSize
const MAX_ATTEMPTS = 10; // drop a report the server keeps refusing
const STALE_SENDING_MS = 2 * 60_000; // a flusher that died mid-send
export const FLUSH_FLAG = '--flush-reports';

interface QueuedReport {
  report: BlockReport;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function readQueueFile(file: string): QueuedReport[] {
  try {
    return fs
      .readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .flatMap((l) => {
        try {
          const q = JSON.parse(l) as QueuedReport;
          return q?.report?.event ? [q] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function appendToQueue(entries: QueuedReport[]): void {
  if (entries.length === 0) return;
  try {
    fs.appendFileSync(REPORT_QUEUE, entries.map((e) => `${JSON.stringify(e)}\n`).join(''), { mode: 0o600 });
    trimQueue();
  } catch (err) {
    debug(`report: queue write failed: ${(err as Error).message?.slice(0, 100)}`);
  }
}

/** Keep only the newest MAX_QUEUE_ENTRIES. Cheap: only rewrites when over the cap. */
function trimQueue(): void {
  try {
    const lines = fs
      .readFileSync(REPORT_QUEUE, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    if (lines.length <= MAX_QUEUE_ENTRIES) return;
    debug(`report: queue over cap, dropping ${lines.length - MAX_QUEUE_ENTRIES} oldest`);
    fs.writeFileSync(REPORT_QUEUE, `${lines.slice(-MAX_QUEUE_ENTRIES).join('\n')}\n`, { mode: 0o600 });
  } catch {}
}

function queueHasEntries(): boolean {
  try {
    return fs.statSync(REPORT_QUEUE).size > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API for handlers
// ---------------------------------------------------------------------------

/** Queue a block for Tower. Never throws, never touches the network. */
export function reportBlock(
  event: HookEvent,
  report: Omit<BlockReport, 'occurredAt' | 'ideConversationId' | 'ideGenerationId'>,
): void {
  const full: BlockReport = {
    ...report,
    entityTypes: report.entityTypes?.length ? [...new Set(report.entityTypes)].slice(0, 50) : undefined,
    rule: report.rule?.slice(0, 200),
    fileName: report.fileName ? path.basename(report.fileName).slice(0, 255) : undefined,
    tool: report.tool?.slice(0, 100),
    ideConversationId: event.conversation_id?.slice(0, 100),
    ideGenerationId: event.generation_id?.slice(0, 100),
    occurredAt: new Date().toISOString(),
  };
  appendToQueue([{ report: full, attempts: 0 }]);
  debug(`report: queued ${full.event}/${full.kind} (${full.detector})`);
}

/**
 * Queue a scan-based block only when Tower did not already record it.
 * `scan.detector` is set by scanText() exactly when /validate wrote no row.
 */
export function reportScanBlockIfUnrecorded(
  event: HookEvent,
  scan: { detector?: BlockDetector; entities: Array<{ type: string }> },
  base: { event: BlockReport['event']; tool?: string },
): void {
  if (!scan.detector) return; // Tower already has the violation from /validate
  reportBlock(event, {
    ...base,
    kind: 'sensitive_data',
    detector: scan.detector,
    entityTypes: scan.entities.map((e) => e.type),
  });
}

/**
 * Start a detached flusher if there is something to send and a token to send
 * it with. Returns immediately; the hook's own exit is never delayed.
 */
export function flushReportsInBackground(): void {
  if (!queueHasEntries() || !hasToken()) return;
  try {
    const script = process.argv[1];
    if (!script) return;
    const child = spawn(process.execPath, [script, FLUSH_FLAG], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (err) {
    debug(`report: could not start flusher: ${(err as Error).message?.slice(0, 100)}`);
  }
}

// ---------------------------------------------------------------------------
// Flusher (runs in the detached process)
// ---------------------------------------------------------------------------

/**
 * Claim the queue by renaming it, so a concurrent flusher (or a hook appending
 * a new report) can never cause a double send. Also adopts batches left behind
 * by a flusher that died mid-send.
 */
function claimBatches(): string[] {
  const claimed: string[] = [];
  const mine = `${REPORT_QUEUE}.${process.pid}.${Date.now()}${SENDING_SUFFIX}`;
  try {
    fs.renameSync(REPORT_QUEUE, mine);
    claimed.push(mine);
  } catch {}

  try {
    const base = path.basename(REPORT_QUEUE);
    for (const name of fs.readdirSync(LOG_DIR)) {
      if (!name.startsWith(`${base}.`) || !name.endsWith(SENDING_SUFFIX)) continue;
      const full = path.join(LOG_DIR, name);
      if (full === mine) continue;
      try {
        if (Date.now() - fs.statSync(full).mtimeMs < STALE_SENDING_MS) continue;
        const adopted = `${full}.${process.pid}${SENDING_SUFFIX}`;
        fs.renameSync(full, adopted);
        claimed.push(adopted);
      } catch {}
    }
  } catch {}
  return claimed;
}

export function flushReports(): void {
  if (!hasToken()) return;
  const files = claimBatches();
  if (files.length === 0) return;

  const pending = files.flatMap(readQueueFile);
  const requeue: QueuedReport[] = [];
  let sent = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = postBlockReports(batch.map((q) => q.report));

    if (!results) {
      // Network failure or rejected request: keep everything not yet sent.
      for (const q of pending.slice(i)) {
        if (q.attempts + 1 < MAX_ATTEMPTS) requeue.push({ ...q, attempts: q.attempts + 1 });
      }
      break;
    }

    batch.forEach((q, idx) => {
      if (results[idx]?.outcome === 'stored') sent++;
      else if (q.attempts + 1 < MAX_ATTEMPTS) requeue.push({ ...q, attempts: q.attempts + 1 });
    });
  }

  appendToQueue(requeue);
  for (const f of files) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
  debug(`report: flushed ${sent}/${pending.length}, requeued ${requeue.length}`);
}
