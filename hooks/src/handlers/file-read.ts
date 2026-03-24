/**
 * Handlers: beforeReadFile, beforeTabFileRead
 */

import * as path from 'node:path';
import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { isSensitiveFile } from '../lib/policy';
import { entitySummary, formatEntities, scanText } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleBeforeReadFile(event: HookEvent): HookResponse {
  const filePath = event.file_path || '';
  const hit = isSensitiveFile(filePath);
  if (hit) {
    incStat('commandsBlocked');
    audit({ event: 'beforeReadFile', action: 'blocked', filePath, reason: hit, ...ids(event) });
    return deny(`Blocked reading ${path.basename(filePath)} (policy: ${hit}).`);
  }

  if (event.content) {
    const { entities } = scanText(event.content);
    if (entities.length > 0) {
      incStat('piiFound', entities.length);
      incStat('commandsBlocked');
      audit({ event: 'beforeReadFile', action: 'blocked', filePath, entities: entitySummary(entities), ...ids(event) });
      return deny(`Blocked reading ${path.basename(filePath)}. Contains ${formatEntities(entities)}.`);
    }
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
  if (event.content) {
    const { entities } = scanText(event.content);
    if (entities.length > 0) {
      audit({
        event: 'beforeTabFileRead',
        action: 'blocked',
        filePath,
        entities: entitySummary(entities),
        ...ids(event),
      });
      return { permission: 'deny' };
    }
  }
  return allow();
}
