/**
 * Route Definitions
 *
 * Defines all application routes and their metadata.
 * Uses hash-based routing for GitHub Pages compatibility.
 */

import type { SvelteComponent } from 'svelte';

// ============================================================================
// Route Types
// ============================================================================

export interface RouteDefinition {
  path: string;
  name: string;
  title: string;
  icon?: string;
  /** Whether this route requires a parsed protocol */
  requiresProtocol?: boolean;
  /** Whether this route is shown in navigation */
  showInNav?: boolean;
}

// ============================================================================
// Route Definitions
// ============================================================================

export const ROUTES: Record<string, RouteDefinition> = {
  EDITOR: {
    path: '/',
    name: 'editor',
    title: 'Editor',
    icon: 'code',
    showInNav: true,
  },
  SIMULATION: {
    path: '/simulation',
    name: 'simulation',
    title: 'Simulation',
    icon: 'play',
    requiresProtocol: true,
    showInNav: true,
  },
  SIMULATION_CFG: {
    path: '/simulation/cfg',
    name: 'simulation-cfg',
    title: 'CFG Simulation',
    requiresProtocol: true,
    showInNav: false,
  },
  SIMULATION_DISTRIBUTED: {
    path: '/simulation/distributed',
    name: 'simulation-distributed',
    title: 'Distributed Simulation',
    requiresProtocol: true,
    showInNav: false,
  },
  SETTINGS: {
    path: '/settings',
    name: 'settings',
    title: 'Settings',
    icon: 'settings',
    showInNav: false,
  },
  WEBCOLA_SIM: {
    path: '/webcola-sim',
    name: 'webcola-sim',
    title: 'WebCola Simulation',
    icon: 'graph',
    requiresProtocol: false,
    showInNav: true,
  },
};

// ============================================================================
// Navigation Helpers
// ============================================================================

/** Get routes for main navigation */
export function getNavRoutes(): RouteDefinition[] {
  return Object.values(ROUTES).filter(r => r.showInNav);
}

/** Get route by name */
export function getRouteByName(name: string): RouteDefinition | undefined {
  return Object.values(ROUTES).find(r => r.name === name);
}

/** Get route by path */
export function getRouteByPath(path: string): RouteDefinition | undefined {
  return Object.values(ROUTES).find(r => r.path === path);
}

/** Check if a route requires a protocol */
export function routeRequiresProtocol(path: string): boolean {
  const route = getRouteByPath(path);
  return route?.requiresProtocol ?? false;
}

// ============================================================================
// URL Helpers
// ============================================================================

/** Build a hash URL for navigation */
export function buildHashUrl(path: string, params?: Record<string, string>): string {
  let url = `#${path}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}

/** Parse the current hash URL */
export function parseHashUrl(): { path: string; params: Record<string, string> } {
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const params: Record<string, string> = {};

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { path, params };
}
