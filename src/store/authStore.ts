import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type User } from '../types';
import {
  decodeJwtPayload,
  extractDisplayName,
  extractEmail,
  extractRole,
  extractUserId,
} from '../utils/jwtClaims';

interface AuthStore {
  token: string | null;
  signupToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (apiUser: any, token: string) => void;
  setSignupToken: (token: string) => void;
  login: (token: string) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  isRole: (...roles: string[]) => boolean;
}

function userFromToken(apiUser: any, token: string): User | null {
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;

  const id = extractUserId(decoded);
  if (!id) return null;

  return {
    id,
    displayName: apiUser?.displayName || extractDisplayName(decoded),
    email: apiUser?.email || extractEmail(decoded),
    role: extractRole(decoded),
    token,
    authorityId: decoded.authorityId as string | undefined,
  };
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      signupToken: null,
      user: null,
      isAuthenticated: false,

      setSignupToken: (signupToken) => set({ signupToken }),

      setAuth: (apiUser, token) => {
        const user = userFromToken(apiUser, token);
        if (!user) return;
        set({ token, user, isAuthenticated: true, signupToken: null });
      },

      login: (token: string) => {
        get().setAuth(null, token);
      },

      logout: () => set({ token: null, user: null, isAuthenticated: false, signupToken: null }),

      hasRole: (role: string) => {
        const user = get().user;
        if (!user) return false;
        const userRoles = Array.isArray(user.role) ? user.role : [user.role];
        return userRoles.includes(role);
      },

      isRole: (...roles: string[]) => {
        const user = get().user;
        if (!user) return false;
        const userRoles = Array.isArray(user.role) ? user.role : [user.role];
        return roles.some((r) => userRoles.includes(r));
      },
    }),
    {
      name: 'ain-auth-storage',
      onRehydrateStorage: () => (state) => {
        if (!state?.token || !state.user) return;
        if (state.user.id?.trim()) return;
        const user = userFromToken(state.user, state.token);
        if (user) state.user = user;
      },
    },
  ),
);

/** Resolved user id — prefers store, falls back to decoding the JWT. */
export function useAuthUserId(): string {
  const userId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);
  return userId?.trim() || extractUserId(decodeJwtPayload(token ?? '') ?? {}) || '';
}
