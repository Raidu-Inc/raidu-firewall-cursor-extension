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

export class LogWatcher extends EventEmitter {
  private _watcher: fs.FSWatcher | undefined;

  // Type-safe overrides
  override on<K extends keyof LogWatcherEvents>(event: K, listener: LogWatcherEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof LogWatcherEvents>(event: K, ...args: Parameters<LogWatcherEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  /** Begin watching the log directory. Safe to call multiple times. */
  start(): void {
    if (this._watcher) {
      return;
    }

    try {
      this._watcher = fs.watch(LOG_DIR, (_eventType, filename) => {
        if (!filename) {
          return;
        }

        if (filename === 'stats.json' || filename === STATS_FILE) {
          try {
            this.emit('stats', getStats());
          } catch {
            /* ignore read errors during rapid writes */
          }
        }

        if (filename === 'audit.jsonl' || filename === AUDIT_LOG) {
          try {
            this.emit('audit', getEvents());
          } catch {
            /* ignore */
          }
        }
      });
    } catch {
      // Directory may not exist yet; will be created by the hook.
    }
  }

  /** Stop watching. Safe to call even if never started. */
  stop(): void {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = undefined;
    }
  }
}
