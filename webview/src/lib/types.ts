export interface Stats {
  totalScans: number;
  piiFound: number;
  secretsFound: number;
  promptsBlocked: number;
  commandsBlocked: number;
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  action: string;
  entities?: { type: string; score: number }[];
  filePath?: string;
  command?: string;
  tool?: string;
  reason?: string;
  scanTimeMs?: number;
  source?: string;
  violations?: { type: string }[];
  subagentType?: string;
  conversationId?: string;
  generationId?: string;
}

export interface ProfileInfo {
  email?: string;
  name?: string;
  org?: string;
  plan?: string;
  workspace?: string;
  environment?: string;
}

export interface UpdateMessage {
  type: 'update';
  stats: Stats;
  events: AuditEntry[];
  connected: boolean;
  logoUri: string;
  profile?: ProfileInfo;
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  | { type: 'login' }
  | { type: 'logout' };
