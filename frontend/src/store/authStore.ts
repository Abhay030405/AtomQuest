import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/user.types";
import { Permission } from "@/types/user.types";
import { mockUsers } from "@/mocks/mockUsers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateFakeJWT(user: User): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  );
  return `${header}.${payload}.mock_signature`;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
  currentUser: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  /** Switch between demo users instantly without re-login */
  switchRole: (userId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      loginError: null,

      login: async (email, _password) => {
        set({ isLoading: true, loginError: null });
        // Simulate network latency
        await new Promise((r) => setTimeout(r, 450));
        const user = mockUsers.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (!user) {
          set({ isLoading: false, loginError: "No account found with that email." });
          throw new Error("No account found with that email.");
        }
        const token = generateFakeJWT(user);
        set({ currentUser: user, token, isAuthenticated: true, isLoading: false });
      },

      logout: () =>
        set({
          currentUser: null,
          token: null,
          isAuthenticated: false,
          loginError: null,
        }),

      hasPermission: (permission) => {
        const { currentUser } = get();
        return currentUser?.permissions.includes(permission) ?? false;
      },

      switchRole: (userId) => {
        const user = mockUsers.find((u) => u.id === userId);
        if (!user) return;
        set({ currentUser: user, token: generateFakeJWT(user) });
      },
    }),
    {
      name: "atomquest-auth",
      // Only persist auth state, not loading / error
      partialize: (state) => ({
        currentUser: state.currentUser,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
