/**
 * Raidu Firewall Hook
 *
 * Cursor hook handler for all lifecycle events.
 * Output format per cursor.com/docs/hooks. Exit code 2 = deny.
 *
 * Security:
 * - Stdin capped at 1MB to prevent OOM
 * - Debug log only records hook name + byte count, never content
 * - All errors caught and logged, never crash
 */

import { handleAfterAgentResponse, handleAfterAgentThought, handleSubagentStart } from './handlers/agent';
import { handleAfterFileEdit } from './handlers/file-edit';
import { handleBeforeReadFile, handleBeforeTabFileRead } from './handlers/file-read';
import { handleBeforeMCPExecution } from './handlers/mcp';
import { handleBeforeSubmitPrompt } from './handlers/prompt';
import { handleStop } from './handlers/session';
import { handleAfterShellExecution, handleBeforeShellExecution } from './handlers/shell';
import { handlePreToolUse } from './handlers/tool-use';
import { debug } from './lib/audit';
import type { HookEvent, HookResponse } from './lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_STDIN_BYTES = 1_048_576; // 1MB cap to prevent OOM

// ---------------------------------------------------------------------------
// Handler dispatch map
// ---------------------------------------------------------------------------

const handlers: Record<string, (event: HookEvent) => HookResponse> = {
  beforeSubmitPrompt: handleBeforeSubmitPrompt,
  preToolUse: handlePreToolUse,
  beforeReadFile: handleBeforeReadFile,
  beforeTabFileRead: handleBeforeTabFileRead,
  beforeShellExecution: handleBeforeShellExecution,
  afterShellExecution: handleAfterShellExecution,
  beforeMCPExecution: handleBeforeMCPExecution,
  subagentStart: handleSubagentStart,
  afterAgentResponse: handleAfterAgentResponse,
  afterAgentThought: handleAfterAgentThought,
  afterFileEdit: handleAfterFileEdit,
  stop: handleStop,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let input = '';
  let totalBytes = 0;

  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_STDIN_BYTES) {
      debug(`REJECTED: stdin exceeded ${MAX_STDIN_BYTES} bytes`);
      process.stdout.write('{}');
      return;
    }
    input += chunk;
  }

  if (!input.trim()) {
    process.stdout.write('{}');
    return;
  }

  let event: HookEvent;
  try {
    event = JSON.parse(input.trim());
  } catch {
    process.stdout.write('{}');
    return;
  }

  const hook = event.hook_event_name;
  // Only log hook name and size, never content
  debug(`${hook} | ${totalBytes}B`);

  let response: HookResponse = {};
  try {
    const handler = handlers[hook];
    if (handler) response = handler(event);
    else debug(`unhandled: ${hook}`);
  } catch (err: unknown) {
    debug(`ERR ${hook}: ${(err as Error).message?.slice(0, 100)}`);
  }

  // For blocked actions, Cursor displays stdout as the message.
  // Output just the user_message text for clean display, not the full JSON.
  if (response.permission === 'deny' || response.continue === false) {
    process.stdout.write(response.user_message || 'Blocked by Raidu Firewall');
    process.exit(2);
  }

  process.stdout.write(JSON.stringify(response));
}

main();
