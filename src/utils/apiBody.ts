/** Unwrap API bodies — backend often returns JSON as text/plain string. */
export function unwrapApiBody(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  const trimmed = data.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

export function asRecord(raw: unknown): Record<string, unknown> {
  const body = unwrapApiBody(raw);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== '') return val as T;
  }
  return undefined;
}
