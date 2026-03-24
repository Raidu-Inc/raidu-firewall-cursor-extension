# How to Test Raidu Firewall

## Setup

1. Open the `raidu-cursor-plugin` project in Cursor
2. Run `npm install && npm run build`
3. Press `F5` to launch the Extension Development Host

## Test 1: Extension Loads

After F5, verify:
- Lion logo appears in the activity bar (left sidebar)
- Click it to open the Raidu Firewall panel
- Welcome screen shows with "Connect to Raidu" button
- Status bar at bottom shows: `Raidu | Active`

Check hooks installed:
```bash
cat ~/.cursor/hooks.json | python3 -m json.tool | grep -c command
# Should show 13
```

## Test 2: Login

1. Click "Connect to Raidu"
2. Browser opens to `sandbox.raidu.com`
3. Sign in with your Raidu account
4. Cursor shows "Raidu Firewall: Connected successfully"
5. Sidebar updates: shows your profile (name, org, plan), stats grid, event log

## Test 3: PII Blocked in Prompt

In the Cursor chat, type:
```
Fix the patient lookup for John Smith, SSN 482-39-1847, email john@hospital.org
```

Expected:
- Prompt is blocked
- Message shows: "Raidu Firewall: Detected 1 person, 1 us ssn, 1 email address..."
- Redacted version copied to clipboard
- Press Cmd+V to see: `Fix the patient lookup for <PERSON>, SSN <US_SSN>, email <EMAIL_ADDRESS>`
- Event appears in sidebar activity log
- Stats update: Scanned +1, PII +3, Blocked +1

Verify in logs:
```bash
tail -5 ~/.raidu/logs/debug.log
# Should show: API: response passed=false, entities=3, source=api
```

## Test 4: Secrets Blocked in Prompt

```
Use this key sk-proj-abc123def456ghi789jkl012mno345pqr678stu to call the API
```

Expected:
- Blocked with API key detected
- Redacted version on clipboard

## Test 5: Sensitive File Read Blocked

Switch to Agent mode. Ask:
```
Read the .env file and show me its contents
```

Expected:
- Agent attempts to use Read or Shell tool
- `preToolUse` hook blocks it
- Message: "Raidu Firewall: Blocked access to .env"
- Event logged in sidebar

Also try:
```
Show me the AWS credentials
```
```
Cat the id_rsa file
```

## Test 6: Clean Prompt Passes Through

```
How do I refactor this function to use async await?
```

Expected:
- No blocking, AI responds normally
- Scanned count increases, PII stays the same

## Test 7: .cursorignore Patterns Merged

If the project has a `.cursorignore` file, those patterns are automatically added to the block list.

Create a `.cursorignore`:
```
.env
custom-secrets.yaml
```

Then ask the agent to read `custom-secrets.yaml`. It should be blocked.

## Test 8: API Validation

Watch the API call in real time:
```bash
tail -f ~/.raidu/logs/debug.log
```

Send a PII prompt. You should see:
```
API: POST https://sandbox.raidu.com/api/guardrails/ide/validate
API: 800ms | passed=false | entities=2 | sanitized=true | serverMs=30
API: response={"passed":false,"sanitizedInput":"...","entities":[...]}
```

## Test 9: Disconnect

1. Click "Disconnect" in the sidebar
2. Sidebar returns to welcome screen
3. Hooks still work (local scanner fallback)
4. Send a PII prompt, it still gets blocked (local scan)

## Test 10: Uninstall Cleanup

Close the Extension Development Host window. The extension runs `deactivate()` which:
- Removes Raidu hooks from `~/.cursor/hooks.json`
- Clears stored credentials
- Deletes `~/.raidu/logs/`

Verify:
```bash
cat ~/.cursor/hooks.json 2>/dev/null || echo "hooks removed"
ls ~/.raidu/logs/ 2>/dev/null || echo "logs removed"
```

## Useful Commands

```bash
# Watch hooks fire in real time
tail -f ~/.raidu/logs/debug.log

# See audit trail
tail -f ~/.raidu/logs/audit.jsonl

# Check stats
cat ~/.raidu/logs/stats.json

# Check installed hooks
cat ~/.cursor/hooks.json | python3 -m json.tool

# Test hook manually
echo '{"hook_event_name":"beforeSubmitPrompt","prompt":"SSN 123-45-6789","conversation_id":"t","generation_id":"g"}' | node hooks/dist/index.js

# Rebuild after code changes
npm run build
```

## Troubleshooting

**Hooks not firing**: Check `~/.cursor/hooks.json` exists with 13 entries. Restart Cursor after first F5.

**API calls failing**: Check `tail ~/.raidu/logs/debug.log` for "API: FAILED" messages. Verify token exists: `cat ~/.raidu/token`.

**Double messages**: Ensure only one hooks.json exists. Check both `~/.cursor/hooks.json` and `~/.cursor/plugins/local/raidu-firewall/hooks/hooks.json`. There should be no overlap.

**Sidebar not updating**: Click Refresh in the sidebar. Check that `~/.raidu/logs/audit.jsonl` has entries.
