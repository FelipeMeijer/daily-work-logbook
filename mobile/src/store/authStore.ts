import { create } from 'zustand';
import { getToken, removeToken, setToken } from '@/src/lib/api';

interface AuthUser {
  userId: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64 URL decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (token: string, user: AuthUser) => {
    await setToken(token);
    set({ token, user });
  },

  logout: async () => {
    await removeToken();
    set({ token: null, user: null });
  },

  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const token = await getToken();
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload) {
          const userId = String(payload.sub ?? payload.userId ?? payload.id ?? '');
          const email = String(payload.email ?? '');
          set({ token, user: { userId, email } });
        } else {
          // Token is malformed, remove it
          await removeToken();
          set({ token: null, user: null });
        }
      } else {
        set({ token: null, user: null });
      }
    } catch {
      set({ token: null, user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
