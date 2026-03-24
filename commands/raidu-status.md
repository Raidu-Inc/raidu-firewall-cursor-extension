---
name: raidu-status
description: Show current Raidu governance status including scan counts, PII detected, and exposure prevented
---

Show the current Raidu governance status by reading the stats file. Run:

```bash
cat ~/.raidu/logs/stats.json 2>/dev/null || echo '{"totalScans":0,"piiFound":0,"secretsFound":0,"promptsBlocked":0,"commandsBlocked":0,"sessionsAudited":0,"exposurePreventedCents":0}'
```

Present the results clearly:

- Total prompts scanned
- PII entities detected
- Secrets caught
- Prompts blocked
- Commands blocked
- Sessions audited
- Total exposure prevented (convert cents to dollars)

Also show recent audit events:

```bash
tail -20 ~/.raidu/logs/audit.jsonl 2>/dev/null || echo "No audit events yet"
```
