/**
 * Router Module
 *
 * Provides hash-based routing for the SPA.
 * Compatible with GitHub Pages (no server rewrites needed).
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { Router, Route, Link } from '$lib/router';
 * </script>
 *
 * <Router>
 *   <Route path="/" component={EditorPage} />
 *   <Route path="/simulation" component={SimulationPage} />
 * </Router>
 * ```
 */

// Re-export from svelte-spa-router
export {
  default as Router,
  link,
  push,
  pop,
  replace,
  location,
  querystring,
  params
} from 'svelte-spa-router';

// Re-export route definitions
export {
  ROUTES,
  getNavRoutes,
  getRouteByName,
  getRouteByPath,
  routeRequiresProtocol,
  buildHashUrl,
  parseHashUrl,
  type RouteDefinition,
} from './routes';

// Re-export guards
export { createRouteGuard, protocolGuard } from './guards';
