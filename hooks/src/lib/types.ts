/**
 * TypeScript interfaces for Raidu Firewall Hook system.
 * Covers all Cursor hook lifecycle events and responses.
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface HookEvent {
  hook_event_name: string;
  conversation_id?: string;
  generation_id?: string;

  // beforeSubmitPrompt
  prompt?: string;

  // preToolUse
  tool_name?: string;
  tool_input?: ToolInput;

  // beforeReadFile / beforeTabFileRead
  file_path?: string;
  content?: string;

  // beforeShellExecution / afterShellExecution
  command?: string;
  output?: string;

  // subagentStart
  subagent_type?: string;
  task?: string;

  // afterFileEdit
  edits?: FileEdit[];

  // afterAgentResponse / afterAgentThought
  text?: string;

  // stop
  status?: string;

  // beforeMCPExecution (tool_name + tool_input reused)

  // Environment ID for API calls
  environmentId?: string;
}

export interface ToolInput {
  file_path?: string;
  glob?: string;
  command?: string;
  [key: string]: unknown;
}

export interface FileEdit {
  new_string?: string;
  old_string?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface HookResponse {
  permission?: 'deny';
  continue?: false;
  user_message?: string;
}

// ---------------------------------------------------------------------------
// Scanner types
// ---------------------------------------------------------------------------

export interface ScanResult {
  entities: EntityMatch[];
  scanTimeMs: number;
}

export interface EntityMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  score: number;
}

export interface PatternDef {
  type: string;
  regex: RegExp;
  confidence: number;
  validate?: (value: string) => boolean;
}

// ---------------------------------------------------------------------------
// Policy types
// ---------------------------------------------------------------------------

export interface Policy {
  files: {
    blocked: string[];
    allowed: string[];
  };
  commands: {
    blocked: string[];
  };
}

// ---------------------------------------------------------------------------
// Stats / Audit types
// ---------------------------------------------------------------------------

export interface Stats {
  totalScans: number;
  piiFound: number;
  secretsFound: number;
  promptsBlocked: number;
  commandsBlocked: number;
  sessionsAudited: number;
  [key: string]: number;
}

export interface AuditEntry {
  timestamp?: string;
  event: string;
  action: string;
  conversationId?: string;
  generationId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Block reports to Tower (POST /api/guardrails/ide/report)
// ---------------------------------------------------------------------------

/** Why Tower has no violation for this block yet. */
export type BlockDetector = 'local' | 'api_unavailable' | 'api_unrecorded';

/** Metadata-only description of a block. Never carries prompt/command/file content. */
export interface BlockReport {
  event:
    | 'beforeSubmitPrompt'
    | 'preToolUse'
    | 'beforeShellExecution'
    | 'beforeMCPExecution'
    | 'beforeReadFile'
    | 'beforeTabFileRead';
  kind: 'sensitive_data' | 'sensitive_file' | 'exfiltration' | 'command_policy';
  detector: BlockDetector;
  tool?: string;
  entityTypes?: string[];
  rule?: string;
  fileName?: string;
  ideConversationId?: string;
  ideGenerationId?: string;
  occurredAt?: string;
}

export type EvidenceVerdict =
  | { outcome: 'stored' }
  | { outcome: 'not_applicable' }
  | { outcome: 'failed'; reason: string };
