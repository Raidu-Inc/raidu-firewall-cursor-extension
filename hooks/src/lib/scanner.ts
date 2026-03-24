/**
 * Local PII / secrets scanner using regex patterns.
 * Identical patterns to the working scanner.js.
 */

import type { EntityMatch, PatternDef, ScanResult } from './types';

// ---------------------------------------------------------------------------
// Luhn checksum (credit card validation)
// ---------------------------------------------------------------------------

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = +digits[i];
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

const PATTERNS: PatternDef[] = [
  {
    type: 'SSN',
    regex: /\b(\d{3}[-.\s]?\d{2}[-.\s]?\d{4})\b/g,
    confidence: 0.95,
    validate: (v: string) => {
      const d = v.replace(/\D/g, '');
      const a = +d.slice(0, 3);
      return a > 0 && a < 900 && a !== 666 && +d.slice(3, 5) > 0 && +d.slice(5) > 0;
    },
  },
  {
    type: 'CREDIT_CARD',
    regex: /\b(\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4})\b/g,
    confidence: 0.97,
    validate: (v: string) => {
      const d = v.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhn(d);
    },
  },
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confidence: 0.9,
    validate: (v: string) =>
      !['example.com', 'test.com', 'localhost', 'domain.com', 'company.com'].some((s) => v.includes(s)),
  },
  {
    type: 'PHONE',
    regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    confidence: 0.8,
    validate: (v: string) => {
      const d = v.replace(/\D/g, '');
      return d.length >= 10 && d.length <= 11;
    },
  },
  { type: 'API_KEY_ANTHROPIC', regex: /\b(sk-ant-[a-zA-Z0-9-]{20,})\b/g, confidence: 0.99 },
  { type: 'API_KEY_OPENAI', regex: /\b(sk-(?!ant-)(?:proj-|live-|)[a-zA-Z0-9_-]{20,})\b/g, confidence: 0.99 },
  { type: 'API_KEY_GITHUB', regex: /\b(ghp_[a-zA-Z0-9]{30,})\b/g, confidence: 0.99 },
  { type: 'API_KEY_GITHUB', regex: /\b(github_pat_[a-zA-Z0-9_]{80,})\b/g, confidence: 0.99 },
  { type: 'API_KEY_SLACK', regex: /\b(xox[bpoas]-[a-zA-Z0-9-]{10,})\b/g, confidence: 0.99 },
  { type: 'API_KEY_GOOGLE', regex: /\b(AIza[0-9A-Za-z_-]{35})\b/g, confidence: 0.99 },
  { type: 'AWS_ACCESS_KEY', regex: /\b(AKIA[0-9A-Z]{16})\b/g, confidence: 0.99 },
  { type: 'PRIVATE_KEY', regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, confidence: 0.99 },
  {
    type: 'CONNECTION_STRING',
    regex: /\b((?:mongodb|postgres|postgresql|mysql|redis|amqp|mssql):\/\/[^\s"'`,]+)/g,
    confidence: 0.95,
  },
  {
    type: 'JWT_TOKEN',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    confidence: 0.98,
  },
  { type: 'BEARER_TOKEN', regex: /Bearer\s+([A-Za-z0-9_\-.]{40,})/g, confidence: 0.9 },
  {
    type: 'PERSON',
    regex:
      /\b(?:patient|user|name|doctor|nurse|client|employee|Mr\.|Mrs\.|Ms\.|Dr\.|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g,
    confidence: 0.75,
    validate: (v: string) =>
      ![
        'New York',
        'San Francisco',
        'Los Angeles',
        'Visual Studio',
        'Open Source',
        'Stack Overflow',
        'Pull Request',
      ].some((fp) => v.includes(fp)),
  },
  {
    type: 'IP_ADDRESS',
    regex: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
    confidence: 0.7,
    validate: (v: string) => {
      const p = v.split('.').map(Number);
      return (
        p.every((n) => n >= 0 && n <= 255) &&
        v !== '127.0.0.1' &&
        v !== '0.0.0.0' &&
        !v.startsWith('192.168.') &&
        !v.startsWith('10.')
      );
    },
  },
  {
    type: 'DATE_OF_BIRTH',
    regex: /\b(?:DOB|date\s+of\s+birth|born\s+on|birthday)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi,
    confidence: 0.9,
  },
  { type: 'MRN', regex: /\b(?:MRN|medical\s+record|patient\s+id)[:\s#]+([A-Z0-9-]{5,15})\b/gi, confidence: 0.85 },
  {
    type: 'IBAN',
    regex: /\b([A-Z]{2}\d{2}[A-Z0-9]{4,30})\b/g,
    confidence: 0.8,
    validate: (v: string) => v.length >= 15 && v.length <= 34,
  },
];

// ---------------------------------------------------------------------------
// PIIScanner class
// ---------------------------------------------------------------------------

export class PIIScanner {
  scan(text: string): ScanResult {
    const start = performance.now();
    const raw: EntityMatch[] = [];

    for (const p of PATTERNS) {
      p.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
      while ((m = p.regex.exec(text)) !== null) {
        const value = m[1] || m[0];
        if (!p.validate || p.validate(value)) {
          raw.push({ type: p.type, value, start: m.index, end: m.index + m[0].length, score: p.confidence });
        }
      }
    }

    // Deduplicate overlapping (keep highest confidence)
    raw.sort((a, b) => a.start - b.start);
    const entities: EntityMatch[] = [];
    for (const e of raw) {
      const prev = entities[entities.length - 1];
      if (prev && e.start < prev.end) {
        if (e.score > prev.score) entities[entities.length - 1] = e;
      } else {
        entities.push(e);
      }
    }

    return { entities, scanTimeMs: performance.now() - start };
  }
}
