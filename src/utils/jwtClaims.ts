/** .NET JWT claim type URIs (ASP.NET Core default) */
const CLAIM_NAMEID =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const CLAIM_EMAIL =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const CLAIM_GIVENNAME =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname';
const CLAIM_ROLE =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractUserId(decoded: Record<string, unknown>): string {
  const raw =
    decoded.sub ??
    decoded.nameidentifier ??
    decoded[CLAIM_NAMEID];
  return typeof raw === 'string' ? raw.trim() : '';
}

export function extractEmail(decoded: Record<string, unknown>): string {
  const raw = decoded.email ?? decoded[CLAIM_EMAIL];
  return typeof raw === 'string' ? raw.trim() : '';
}

export function extractDisplayName(decoded: Record<string, unknown>): string {
  const raw =
    decoded.given_name ??
    decoded.givenname ??
    decoded[CLAIM_GIVENNAME] ??
    decoded.name ??
    decoded.unique_name;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'User';
}

export function extractRole(decoded: Record<string, unknown>): string {
  const raw = decoded.role ?? decoded[CLAIM_ROLE];
  if (Array.isArray(raw)) return String(raw[0] ?? 'Citizen');
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Citizen';
}

export function getUserIdFromToken(token: string | null | undefined): string {
  if (!token) return '';
  const decoded = decodeJwtPayload(token);
  return decoded ? extractUserId(decoded) : '';
}
