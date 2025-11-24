/**
 * App Store - Global Application State
 *
 * Manages application-wide state including:
 * - Theme preferences
 * - UI layout state
 * - Navigation state
 * - Loading states
 */

import { writable, derived, get } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface AppState {
  // Theme
  theme: Theme;
  resolvedTheme: ResolvedTheme;

  // Layout
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Navigation
  currentRoute: string;
  previousRoute: string | null;

  // Loading
  isInitialized: boolean;
  isLoading: boolean;
  loadingMessage: string | null;

  // Notifications
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  dismissible: boolean;
  duration?: number; // ms, undefined = permanent
  timestamp: number;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AppState = {
  theme: 'dark',
  resolvedTheme: 'dark',
  sidebarCollapsed: false,
  sidebarWidth: 280,
  currentRoute: '/',
  previousRoute: null,
  isInitialized: false,
  isLoading: true,
  loadingMessage: 'Initializing...',
  notifications: [],
};

// ============================================================================
// Store Creation
// ============================================================================

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(initialState);

  // Helper to resolve theme based on system preference
  function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  // Apply theme to document
  function applyTheme(resolvedTheme: ResolvedTheme) {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }

  return {
    subscribe,

    // ========================================
    // Theme Actions
    // ========================================

    setTheme: (theme: Theme) => {
      update(state => {
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        return { ...state, theme, resolvedTheme };
      });
    },

    toggleTheme: () => {
      update(state => {
        const newTheme: Theme = state.resolvedTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        return { ...state, theme: newTheme, resolvedTheme: newTheme };
      });
    },

    // ========================================
    // Layout Actions
    // ========================================

    toggleSidebar: () => {
      update(state => ({ ...state, sidebarCollapsed: !state.sidebarCollapsed }));
    },

    setSidebarCollapsed: (collapsed: boolean) => {
      update(state => ({ ...state, sidebarCollapsed: collapsed }));
    },

    setSidebarWidth: (width: number) => {
      update(state => ({ ...state, sidebarWidth: Math.max(200, Math.min(600, width)) }));
    },

    // ========================================
    // Navigation Actions
    // ========================================

    setRoute: (route: string) => {
      update(state => ({
        ...state,
        previousRoute: state.currentRoute,
        currentRoute: route,
      }));
    },

    /**
     * Navigate to a route (updates both store and URL)
     * For SPA view persistence, this just toggles visibility
     */
    navigateTo: (route: string) => {
      update(state => {
        // Only update if route changed
        if (state.currentRoute === route) return state;

        // Update URL hash for browser history
        if (typeof window !== 'undefined') {
          window.history.pushState({}, '', `#${route}`);
        }

        return {
          ...state,
          previousRoute: state.currentRoute,
          currentRoute: route,
        };
      });
    },

    /**
     * Go back to previous route
     */
    goBack: () => {
      update(state => {
        const targetRoute = state.previousRoute || '/';

        if (typeof window !== 'undefined') {
          window.history.back();
        }

        return {
          ...state,
          previousRoute: null,
          currentRoute: targetRoute,
        };
      });
    },

    // ========================================
    // Loading Actions
    // ========================================

    setLoading: (isLoading: boolean, message?: string) => {
      update(state => ({
        ...state,
        isLoading,
        loadingMessage: message ?? null,
      }));
    },

    setInitialized: () => {
      update(state => ({
        ...state,
        isInitialized: true,
        isLoading: false,
        loadingMessage: null,
      }));
    },

    // ========================================
    // Notification Actions
    // ========================================

    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const id = crypto.randomUUID();
      const timestamp = Date.now();

      update(state => ({
        ...state,
        notifications: [...state.notifications, { ...notification, id, timestamp }],
      }));

      // Auto-dismiss if duration is set
      if (notification.duration) {
        setTimeout(() => {
          update(state => ({
            ...state,
            notifications: state.notifications.filter(n => n.id !== id),
          }));
        }, notification.duration);
      }

      return id;
    },

    dismissNotification: (id: string) => {
      update(state => ({
        ...state,
        notifications: state.notifications.filter(n => n.id !== id),
      }));
    },

    clearNotifications: () => {
      update(state => ({ ...state, notifications: [] }));
    },

    // ========================================
    // Utility
    // ========================================

    reset: () => set(initialState),

    getState: () => get({ subscribe }),
  };
}

// ============================================================================
// Export Singleton
// ============================================================================

export const appStore = createAppStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const theme = derived(appStore, $app => $app.theme);
export const resolvedTheme = derived(appStore, $app => $app.resolvedTheme);
export const isDarkMode = derived(appStore, $app => $app.resolvedTheme === 'dark');
export const sidebarCollapsed = derived(appStore, $app => $app.sidebarCollapsed);
export const currentRoute = derived(appStore, $app => $app.currentRoute);
export const isLoading = derived(appStore, $app => $app.isLoading);
export const notifications = derived(appStore, $app => $app.notifications);
export const hasNotifications = derived(appStore, $app => $app.notifications.length > 0);

// ============================================================================
// System Theme Listener
// ============================================================================

if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  mediaQuery.addEventListener('change', (e) => {
    const state = appStore.getState();
    if (state.theme === 'system') {
      const resolvedTheme: ResolvedTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  });
}

// ============================================================================
// Browser Navigation Listener (back/forward buttons)
// ============================================================================

if (typeof window !== 'undefined') {
  // Initialize route from URL hash
  const initialRoute = window.location.hash.slice(1) || '/';
  appStore.setRoute(initialRoute);

  // Listen for browser back/forward buttons
  window.addEventListener('popstate', () => {
    const route = window.location.hash.slice(1) || '/';
    appStore.setRoute(route);
  });
}
