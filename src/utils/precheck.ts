export interface PrecheckStatus {
  kind: 'ok' | 'warning' | 'neutral';
  message: string;
}

/**
 * Deterministic instant structural pre-check for equations, JSON payloads, and code.
 */
export function runStructuralPrecheck(input: string): PrecheckStatus | null {
  const trimmed = input.trim();
  if (trimmed.length < 2) return null;

  // 1. Check JSON validity if input clearly looks like JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { kind: 'ok', message: 'Valid JSON syntax' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON syntax';
      return { kind: 'warning', message: `JSON error: ${msg.slice(0, 60)}` };
    }
  }

  // 2. Check balanced parentheses, brackets, and braces
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closingSet = new Set([')', ']', '}']);
  const stack: string[] = [];
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const prev = i > 0 ? trimmed[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;

    if (pairs[ch]) {
      stack.push(pairs[ch]);
    } else if (closingSet.has(ch)) {
      const expected = stack.pop();
      if (expected !== ch) {
        return { kind: 'warning', message: `Unmatched '${ch}' delimiter` };
      }
    }
  }

  if (stack.length > 0) {
    return { kind: 'warning', message: `Unclosed delimiter (expected '${stack[stack.length - 1]}')` };
  }

  if (/[=<>∑∫√Δσμ]/.test(trimmed)) {
    return { kind: 'ok', message: 'Expression delimiters balanced' };
  }

  return { kind: 'neutral', message: 'Syntax delimiters balanced' };
}
