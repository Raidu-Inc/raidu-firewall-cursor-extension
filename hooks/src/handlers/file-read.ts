/**
 * Handlers: beforeReadFile, beforeTabFileRead
 *
 * Block by FILE NAME PATTERN only. No content scanning.
 * Content scanning causes false positives on source code (RAI-1893).
 */

import * as path from 'node:path';
import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { isSensitiveFile } from '../lib/policy';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleBeforeReadFile(event: HookEvent): HookResponse {
  const filePath = event.file_path || '';
  const hit = isSensitiveFile(filePath);
  if (hit) {
    incStat('commandsBlocked');
    audit({ event: 'beforeReadFile', action: 'blocked', filePath, reason: hit, ...ids(event) });
    return deny(`Blocked reading ${path.basename(filePath)} (policy: ${hit}).`);
  }

  audit({ event: 'beforeReadFile', action: 'allowed', filePath, ...ids(event) });
  return allow();
}

export function handleBeforeTabFileRead(event: HookEvent): HookResponse {
  const filePath = event.file_path || '';
  const hit = isSensitiveFile(filePath);
  if (hit) {
    audit({ event: 'beforeTabFileRead', action: 'blocked', filePath, reason: hit, ...ids(event) });
    return { permission: 'deny' };
  }
  return allow();
}
