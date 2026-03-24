/**
 * Handler: afterFileEdit
 */

import { audit, incStat } from '../lib/audit';
import { allow, ids } from '../lib/helpers';
import { entitySummary, MAX_SCAN_SIZE, scanTextLocal } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleAfterFileEdit(event: HookEvent): HookResponse {
  const leaked: Array<{ type: string; score: number }> = [];
  for (const edit of event.edits || []) {
    if (edit.new_string && edit.new_string.length < MAX_SCAN_SIZE) {
      leaked.push(...entitySummary(scanTextLocal(edit.new_string).entities));
    }
  }
  const action = leaked.length > 0 ? 'secret_written' : 'logged';
  if (leaked.length > 0) incStat('secretsFound', leaked.length);
  audit({
    event: 'afterFileEdit',
    action,
    filePath: event.file_path,
    entities: leaked.length > 0 ? leaked : undefined,
    ...ids(event),
  });
  return allow();
}
