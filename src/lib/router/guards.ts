/**
 * Route Guards
 *
 * Functions that run before navigation to validate access.
 * Used for conditional navigation (e.g., require parsed protocol).
 */

import { get } from 'svelte/store';
import { appStore } from '$lib/stores/app.store';
import { routeRequiresProtocol, ROUTES } from './routes';

// Import stores (will be connected after store refactor)
// For now, we'll use a simple check function

type GuardResult = boolean | string; // true = allow, false = block, string = redirect path

export interface RouteGuard {
  (path: string): GuardResult | Promise<GuardResult>;
}

/**
 * Create a route guard that checks conditions before navigation
 */
export function createRouteGuard(
  condition: () => boolean | Promise<boolean>,
  redirectPath: string = '/'
): RouteGuard {
  return async (path: string): Promise<GuardResult> => {
    const allowed = await condition();
    if (!allowed) {
      return redirectPath;
    }
    return true;
  };
}

/**
 * Guard that requires a parsed protocol
 *
 * Uses a callback to check protocol status since stores
 * may not be initialized when this module loads.
 */
export function protocolGuard(
  hasProtocolCheck: () => boolean
): RouteGuard {
  return (path: string): GuardResult => {
    if (!routeRequiresProtocol(path)) {
      return true;
    }

    if (!hasProtocolCheck()) {
      // Redirect to editor if no protocol is loaded
      return ROUTES.EDITOR.path;
    }

    return true;
  };
}

/**
 * Apply guards to a route condition function
 *
 * Usage with app.store routing:
 * ```typescript
 * // Guards are applied within components using onMount or reactive statements
 * // Example in SimulationPage.svelte:
 * // onMount(() => {
 * //   if (!hasProtocol) {
 * //     appStore.navigateTo('/');
 * //   }
 * // });
 * ```
 */
export function applyGuards(guards: RouteGuard[]): (detail: { location: string }) => boolean | Promise<boolean> {
  return async (detail: { location: string }): Promise<boolean> => {
    for (const guard of guards) {
      const result = await guard(detail.location);

      if (result === false) {
        return false;
      }

      if (typeof result === 'string') {
        // Redirect
        appStore.navigateTo(result);
        return false;
      }
    }

    return true;
  };
}
