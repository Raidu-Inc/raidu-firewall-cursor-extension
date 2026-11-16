/**
 * Watches the Raidu log directory for changes and emits typed events.
 *
 * The hook process writes stats.json and audit.jsonl.  This watcher
 * lets the extension host react immediately when new data arrives
 * instead of polling.
 */

import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import { AUDIT_LOG, LOG_DIR, STATS_FILE } from '../config/constants';
import type { AuditEntry, Stats } from '../types';
import { getEvents, getStats } from './log-reader';

export interface LogWatcherEvents {
  stats: (stats: Stats) => void;
  audit: (events: AuditEntry[]) => void;
}

/** How often the log files are checked, in milliseconds. */
const POLL_INTERVAL_MS = 1000;

export class LogWatcher extends EventEmitter {
  private _started = false;
  private readonly _onStats = (curr: fs.Stats, prev: fs.Stats) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) return;
    try {
      this.emit('stats', getStats());
    } catch {
      /* ignore read errors during rapid writes */
    }
  };
  private readonly _onAudit = (curr: fs.Stats, prev: fs.Stats) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) return;
    try {
      this.emit('audit', getEvents());
    } catch {
      /* ignore */
    }
  };

  // Type-safe overrides
  override on<K extends keyof LogWatcherEvents>(event: K, listener: LogWatcherEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof LogWatcherEvents>(event: K, ...args: Parameters<LogWatcherEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Begin watching the log files. Safe to call multiple times.
   *
   * This used fs.watch on the log DIRECTORY, which throws when the directory
   * does not exist and was then never retried. The directory is often absent
   * at activation (a fresh install, or one whose ~/.raidu was cleared), and
   * the hook creates it on its first event, so the Activity list stayed empty
   * while audit.jsonl filled up. A directory watch also stays bound to the
   * deleted directory if it is removed and recreated.
   *
   * fs.watchFile polls each file by path instead: it accepts a path that does
   * not exist yet, fires when the file appears, and survives the file or its
   * directory being recreated. Two stat calls a second is negligible.
   */
  start(): void {
    if (this._started) {
      return;
    }
    this._started = true;
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
    } catch {
      /* the hook creates it too; polling works either way */
    }
    fs.watchFile(STATS_FILE, { interval: POLL_INTERVAL_MS }, this._onStats);
    fs.watchFile(AUDIT_LOG, { interval: POLL_INTERVAL_MS }, this._onAudit);
  }

  /** Stop watching. Safe to call even if never started. */
  stop(): void {
    if (!this._started) {
      return;
    }
    fs.unwatchFile(STATS_FILE, this._onStats);
    fs.unwatchFile(AUDIT_LOG, this._onAudit);
    this._started = false;
  }
}
