# Raidu Firewall

AI Accountability Layer for Cursor, VS Code, and Windsurf. Scans every prompt for PII and secrets, blocks sensitive file access, provides a full audit trail.

## Features

- **Prompt scanning**: Detects SSN, credit cards, API keys, emails, phone numbers, JWTs, connection strings, and 20+ entity types before they leave your machine
- **File protection**: Blocks AI from reading .env, credentials, private keys, SSH keys, AWS config, and other sensitive files
- **Exfiltration prevention**: Blocks shell commands that attempt to send data to external endpoints
- **Tab completion protection**: Prevents tab autocomplete from reading sensitive files as context
- **Subagent control**: Blocks parallel agents from accessing sensitive file patterns
- **Leak detection**: Scans shell output, file edits, and AI responses for accidentally exposed PII
- **Audit trail**: Every AI interaction logged to `~/.raidu/logs/`
- **Sidebar dashboard**: Live stats, scrollable event log with expandable details
- **Status bar**: Real-time scan counters

## How It Works

Raidu uses two layers:

1. **`.cursorignore`** prevents sensitive files from being indexed into AI context (auto-created on install)
2. **Cursor hooks** intercept every AI action (prompts, file reads, shell commands, MCP tools) and block or log based on policy

When connected to Raidu cloud, prompts are also validated against your organization's 27-guardrail suite via API.

## Install

### From source

```bash
git clone https://github.com/raidu-ai/raidu-cursor-plugin.git
cd raidu-cursor-plugin
npm install
npm run build
```

### Test locally

```bash
cursor --extensionDevelopmentPath=$PWD
```

### Install the plugin hooks

The extension auto-installs plugin hooks on activation. If you need to install manually:

```bash
cp -r . ~/.cursor/plugins/local/raidu-firewall
```

Restart Cursor after installation.

## Connect to Raidu

1. Click the Raidu lion icon in the activity bar
2. Click "Connect to Raidu"
3. Sign in via browser
4. Select your workspace and environment

Without connecting, Raidu still runs locally with all 13 hooks active and the built-in PII scanner.

## What Gets Protected

| Hook | What it does |
|---|---|
| `beforeSubmitPrompt` | Scans typed prompts for PII/secrets, blocks if found |
| `preToolUse` | Blocks Read/Shell/Grep access to .env, credentials, keys |
| `beforeReadFile` | Blocks direct file reads + scans file content |
| `beforeShellExecution` | Blocks secrets in commands + exfiltration patterns |
| `beforeMCPExecution` | Scans MCP tool inputs for PII |
| `beforeTabFileRead` | Blocks tab completion from reading sensitive files |
| `subagentStart` | Blocks subagents targeting sensitive files |
| `afterShellExecution` | Detects PII in shell output |
| `afterFileEdit` | Detects secrets written into code |
| `afterAgentResponse` | Detects PII in AI responses |

## Blocked File Patterns

Auto-blocked by default policy (configurable via Raidu cloud):

```
.env, .env.*, credentials*, secrets*
*.pem, *.key, *.p12, *.pfx, *.jks
id_rsa, id_ed25519, id_ecdsa
.netrc, .pgpass, .npmrc, .pypirc
.aws/credentials, .kube/config
```

## Project Structure

```
raidu-cursor-plugin/
  src/                    # Extension host (TypeScript)
    extension.ts          # Activate/deactivate orchestrator
    auth/                 # OAuth login, logout, workspace selection
    config/               # Constants, typed settings wrapper
    services/             # Cursorignore, log reader, watcher, statusbar, cleanup
    sidebar/              # WebviewViewProvider (loads Svelte output)
  hooks/                  # Cursor hooks (TypeScript, standalone Node.js)
    src/
      index.ts            # Entry: stdin > dispatch > stdout
      handlers/           # One handler per hook event
      lib/                # Scanner, policy, audit, redaction, API client
    dist/index.js         # Compiled bundle (what Cursor runs)
    hooks.json            # Hook registration
  webview/                # Sidebar UI (Svelte 4 + Vite)
    src/
      App.svelte          # Root component
      components/         # Welcome, Dashboard, EventLog, EventItem, StatCard
    dist/index.html       # Built single-file HTML
  rules/                  # Cursor plugin rules (PII awareness, secret detection)
  skills/                 # Cursor plugin skills (governance scan)
  commands/               # Cursor plugin commands (status check)
  media/                  # Logo SVGs and activity bar icon
  dist/extension.js       # Compiled extension host
```

## Build

```bash
npm run build        # Build all (extension + hooks + webview)
npm run build:ext    # Build extension + hooks only
npm run build:webview # Build Svelte webview only
npm run dev          # Watch mode (extension + hooks)
npm run lint         # Biome check
npm run lint:fix     # Biome auto-fix
npm run format       # Biome format
npm run package      # Build + create .vsix
```

## Security

- Token stored in OS keychain (SecretStorage) and `~/.raidu/token` (0600 perms), never in plaintext settings
- No shell string interpolation (uses `execFileSync` with array args)
- Token never visible in process list
- Debug logs never contain prompt text or PII values
- Log directory and files are owner-only (0700/0600)
- Policy cache validated on load (tamper-resistant)
- Stdin capped at 1MB to prevent OOM
- API input capped at 100KB

## Uninstall

The extension cleans up on deactivation:

1. Clears all stored credentials (keychain + token file)
2. Deletes `~/.raidu/logs/` directory
3. Removes plugin from `~/.cursor/plugins/local/raidu-firewall/`
4. Removes `.cursorignore` entries added by Raidu (between marker comments)
5. Clears workspace/environment settings

## Tech Stack

- **TypeScript** for extension host and hooks
- **Svelte 4 + Vite** for webview sidebar
- **esbuild** for extension + hooks bundling
- **Biome** for linting and formatting
- **VS Code Extension API** for UI (status bar, sidebar, commands)
- **Cursor Plugin API** for hooks (lifecycle event interception)

## License

MIT
