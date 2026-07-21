import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

function apiBase(): string {
  return (apiClient.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
}

function appendNgrokParam(url: string): string {
  if (!url.includes('ngrok')) return url;
  const sep = url.includes('?') ? '&' : '?';
  if (url.includes('ngrok-skip-browser-warning')) return url;
  return `${url}${sep}ngrok-skip-browser-warning=true`;
}

function isRewritableDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );
}

/** Normalize slashes and strip a known API host prefix when present. */
export function normalizeMediaPath(url: string): string {
  const trimmed = url.trim().replace(/\\/g, '/');
  if (!trimmed) return '';

  if (trimmed.startsWith('http')) {
    try {
      const parsed = new URL(trimmed);
      if (isRewritableDevHost(parsed.hostname)) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Path suitable for axios (relative to apiClient baseURL). */
export function toApiRequestPath(url?: string | null): string | null {
  if (!url) return null;
  const normalized = normalizeMediaPath(url);
  if (!normalized) return null;
  if (normalized.startsWith('http')) return normalized;
  return normalized;
}

/** Resolve a relative upload path or partial URL to a full browser-loadable URL. */
export function getMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const normalized = normalizeMediaPath(url);
  if (!normalized) return '';

  // In dev, same-origin /uploads hits the Vite proxy → local API static files.
  if (
    import.meta.env.DEV &&
    (normalized.startsWith('/uploads') || normalized.startsWith('/Uploads'))
  ) {
    return normalized;
  }

  if (normalized.startsWith('http')) {
    return appendNgrokParam(normalized);
  }

  const base = apiBase();
  const full = base ? `${base}${normalized}` : normalized;
  return appendNgrokParam(full);
}

function isImageBlob(blob: Blob, contentType?: string): boolean {
  const ct = (contentType || blob.type || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  // ngrok warning pages and HTML error bodies come back as text/html
  if (ct.includes('text/html') || ct.includes('text/plain')) return false;
  // Unknown type — still try (some servers omit content-type)
  return !ct || ct === 'application/octet-stream';
}

function isUploadPath(path: string): boolean {
  return /^\/uploads?\/?/i.test(path);
}

async function downloadBlob(requestPath: string): Promise<{ blob: Blob; contentType: string } | null> {
  if (
    import.meta.env.DEV &&
    !requestPath.startsWith('http') &&
    isUploadPath(requestPath)
  ) {
    const token = useAuthStore.getState().token;
    const res = await fetch(requestPath, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, contentType: res.headers.get('content-type') ?? blob.type };
  }

  const res = await apiClient.get(requestPath, { responseType: 'blob' });
  const blob = res.data as Blob;
  return { blob, contentType: String(res.headers['content-type'] ?? blob.type ?? '') };
}

/** Fetch image bytes with API auth headers (for protected uploads / ngrok). */
export async function fetchMediaBlob(url?: string | null): Promise<string | null> {
  const requestPath = toApiRequestPath(url);
  if (!requestPath) return null;

  try {
    const downloaded = await downloadBlob(requestPath);
    if (!downloaded) return null;
    const { blob, contentType } = downloaded;
    if (!isImageBlob(blob, contentType)) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
