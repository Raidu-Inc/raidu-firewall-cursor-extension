/**
 * Handler: stop
 */

import { audit, incStat } from '../lib/audit';
import { allow, ids } from '../lib/helpers';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleStop(event: HookEvent): HookResponse {
  incStat('sessionsAudited');
  audit({ event: 'stop', action: 'logged', status: event.status, ...ids(event) });
  return allow();
}
