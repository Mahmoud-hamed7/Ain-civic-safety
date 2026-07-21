import type { AxiosError } from 'axios';

function pickDetail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const detail = obj.detail ?? obj.Detail;
  return typeof detail === 'string' && detail.trim() ? detail : undefined;
}

function pickMessage(data: unknown): string | undefined {
  if (typeof data === 'string' && data.trim()) return data;
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const msg = obj.message ?? obj.Message ?? obj.title ?? obj.Title;
  return typeof msg === 'string' && msg.trim() ? msg : undefined;
}

/** Structured community API error messages per integration spec. */
export function extractCommunityApiError(error: unknown): string {
  const err = error as AxiosError;
  const status = err.response?.status;
  const data = err.response?.data;
  const detail = pickDetail(data);
  const message = pickMessage(data);

  if (status === 409 && detail) return detail;
  if (status === 409 && message) return message;
  if (status === 400 && detail) return detail;

  if (status === 403) return "You don't have permission to perform this action";
  if (status === 404) return 'Community not found';

  if (status === 400) {
    const text = (detail ?? message ?? '').toLowerCase();
    if (text.includes('neighborhood') && text.includes('join')) {
      return 'Only Neighborhood communities accept join requests';
    }
    if (text.includes('owner') || text.includes('ownership')) {
      return 'Transfer ownership before removing this member';
    }
    if (message) return message;
  }

  return detail ?? message ?? 'Something went wrong. Please try again.';
}
