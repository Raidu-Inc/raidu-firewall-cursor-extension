---
name: governance-scan
description: Scan code or text for PII, secrets, and security risks before including in AI prompts. Use when the developer is working with database output, log files, configuration data, or any content that may contain real personal data.
---

# Governance Scan

Help the developer check content for sensitive data before it enters the AI context.

## When to use

- Developer pastes database query results or application logs
- Working with configuration files that may contain credentials
- Reviewing code that processes personal data
- Before including file contents that may have real customer data

## How to check

Look for these patterns in the content:
- SSN format (XXX-XX-XXXX)
- Credit card numbers (16 digits, Luhn-valid)
- Email addresses of real people
- API keys (sk-, ghp_, AKIA, xoxb- prefixes)
- Connection strings with passwords
- Private key blocks
- Patient names, medical record numbers
- JWT tokens (eyJ... format)

If found, warn the developer and suggest removing or replacing with placeholder values before proceeding.
