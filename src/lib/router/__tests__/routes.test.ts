/**
 * Router Tests
 *
 * Tests for route configuration and navigation helpers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ROUTES,
  getNavRoutes,
  getRouteByName,
  getRouteByPath,
  routeRequiresProtocol,
  buildHashUrl,
} from '../routes';

describe('Route Definitions', () => {
  describe('ROUTES constant', () => {
    it('should define editor route at root', () => {
      expect(ROUTES.EDITOR).toBeDefined();
      expect(ROUTES.EDITOR.path).toBe('/');
      expect(ROUTES.EDITOR.name).toBe('editor');
      expect(ROUTES.EDITOR.showInNav).toBe(true);
    });

    it('should define simulation route', () => {
      expect(ROUTES.SIMULATION).toBeDefined();
      expect(ROUTES.SIMULATION.path).toBe('/simulation');
      expect(ROUTES.SIMULATION.name).toBe('simulation');
      expect(ROUTES.SIMULATION.requiresProtocol).toBe(true);
      expect(ROUTES.SIMULATION.showInNav).toBe(true);
    });

    it('should define settings route', () => {
      expect(ROUTES.SETTINGS).toBeDefined();
      expect(ROUTES.SETTINGS.path).toBe('/settings');
      expect(ROUTES.SETTINGS.name).toBe('settings');
      expect(ROUTES.SETTINGS.showInNav).toBe(false);
    });

    it('should define simulation sub-routes', () => {
      expect(ROUTES.SIMULATION_CFG).toBeDefined();
      expect(ROUTES.SIMULATION_CFG.path).toBe('/simulation/cfg');
      expect(ROUTES.SIMULATION_CFG.requiresProtocol).toBe(true);

      expect(ROUTES.SIMULATION_DISTRIBUTED).toBeDefined();
      expect(ROUTES.SIMULATION_DISTRIBUTED.path).toBe('/simulation/distributed');
      expect(ROUTES.SIMULATION_DISTRIBUTED.requiresProtocol).toBe(true);
    });
  });

  describe('getNavRoutes', () => {
    it('should return only routes marked for navigation', () => {
      const navRoutes = getNavRoutes();

      expect(navRoutes.length).toBeGreaterThan(0);
      expect(navRoutes.every(r => r.showInNav === true)).toBe(true);
    });

    it('should include editor and simulation routes', () => {
      const navRoutes = getNavRoutes();
      const names = navRoutes.map(r => r.name);

      expect(names).toContain('editor');
      expect(names).toContain('simulation');
    });

    it('should not include settings in nav routes', () => {
      const navRoutes = getNavRoutes();
      const names = navRoutes.map(r => r.name);

      expect(names).not.toContain('settings');
    });
  });

  describe('getRouteByName', () => {
    it('should find route by name', () => {
      const route = getRouteByName('editor');
      expect(route).toBeDefined();
      expect(route?.path).toBe('/');
    });

    it('should return undefined for unknown name', () => {
      const route = getRouteByName('nonexistent');
      expect(route).toBeUndefined();
    });
  });

  describe('getRouteByPath', () => {
    it('should find route by path', () => {
      const route = getRouteByPath('/simulation');
      expect(route).toBeDefined();
      expect(route?.name).toBe('simulation');
    });

    it('should find root route', () => {
      const route = getRouteByPath('/');
      expect(route).toBeDefined();
      expect(route?.name).toBe('editor');
    });

    it('should return undefined for unknown path', () => {
      const route = getRouteByPath('/nonexistent');
      expect(route).toBeUndefined();
    });
  });

  describe('routeRequiresProtocol', () => {
    it('should return true for simulation routes', () => {
      expect(routeRequiresProtocol('/simulation')).toBe(true);
      expect(routeRequiresProtocol('/simulation/cfg')).toBe(true);
      expect(routeRequiresProtocol('/simulation/distributed')).toBe(true);
    });

    it('should return false for editor route', () => {
      expect(routeRequiresProtocol('/')).toBe(false);
    });

    it('should return false for settings route', () => {
      expect(routeRequiresProtocol('/settings')).toBe(false);
    });

    it('should return false for unknown routes', () => {
      expect(routeRequiresProtocol('/unknown')).toBe(false);
    });
  });

  describe('buildHashUrl', () => {
    it('should build simple hash URL', () => {
      expect(buildHashUrl('/')).toBe('#/');
      expect(buildHashUrl('/simulation')).toBe('#/simulation');
      expect(buildHashUrl('/settings')).toBe('#/settings');
    });

    it('should build hash URL with query params', () => {
      const url = buildHashUrl('/simulation', { mode: 'cfg', speed: '500' });
      expect(url).toBe('#/simulation?mode=cfg&speed=500');
    });

    it('should handle empty params', () => {
      const url = buildHashUrl('/simulation', {});
      expect(url).toBe('#/simulation');
    });
  });
});

describe('Route Guards', () => {
  describe('protocolGuard', () => {
    it('should allow navigation when protocol is loaded', async () => {
      const { protocolGuard } = await import('../guards');

      const guard = protocolGuard(() => true); // Has protocol
      const result = guard('/simulation');

      expect(result).toBe(true);
    });

    it('should redirect to editor when no protocol', async () => {
      const { protocolGuard, ROUTES } = await import('../guards');
      const routes = await import('../routes');

      const guard = protocolGuard(() => false); // No protocol
      const result = guard('/simulation');

      expect(result).toBe(routes.ROUTES.EDITOR.path);
    });

    it('should allow non-protected routes without protocol', async () => {
      const { protocolGuard } = await import('../guards');

      const guard = protocolGuard(() => false); // No protocol
      const result = guard('/'); // Editor doesn't require protocol

      expect(result).toBe(true);
    });

    it('should allow settings without protocol', async () => {
      const { protocolGuard } = await import('../guards');

      const guard = protocolGuard(() => false); // No protocol
      const result = guard('/settings');

      expect(result).toBe(true);
    });
  });

  describe('createRouteGuard', () => {
    it('should allow navigation when condition is true', async () => {
      const { createRouteGuard } = await import('../guards');

      const guard = createRouteGuard(() => true);
      const result = await guard('/any-path');

      expect(result).toBe(true);
    });

    it('should redirect when condition is false', async () => {
      const { createRouteGuard } = await import('../guards');

      const guard = createRouteGuard(() => false, '/fallback');
      const result = await guard('/any-path');

      expect(result).toBe('/fallback');
    });

    it('should handle async conditions', async () => {
      const { createRouteGuard } = await import('../guards');

      const asyncCondition = () => Promise.resolve(true);
      const guard = createRouteGuard(asyncCondition);
      const result = await guard('/any-path');

      expect(result).toBe(true);
    });
  });
});
