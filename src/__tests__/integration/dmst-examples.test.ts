/**
 * DMst Examples Integration Tests
 *
 * Validates that all DMst example protocols parse correctly and produce
 * expected AST/CFG structures.
 *
 * Tests parser, CFG builder, and basic validation for:
 * - Dynamic participant creation
 * - Protocol calls
 * - Updatable recursion
 * - Invitation protocol
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import type {
  GlobalProtocolDeclaration,
  DynamicRoleDeclaration,
  Module,
} from '../../core/ast/types';

const EXAMPLES_DIR = join(__dirname, '../../../examples/dmst');

function loadExample(filename: string): string {
  return readFileSync(join(EXAMPLES_DIR, filename), 'utf-8');
}

function getProtocol(module: Module, name: string): GlobalProtocolDeclaration {
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration' && d.name === name
  ) as GlobalProtocolDeclaration;
  if (!protocol) {
    throw new Error(`Protocol ${name} not found in module`);
  }
  return protocol;
}

function getAllProtocols(module: Module): GlobalProtocolDeclaration[] {
  return module.declarations.filter(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration[];
}

describe('DMst Examples - Parser Integration', () => {
  describe('simple-dynamic-worker.smpst', () => {
    it('parses dynamic role declaration', () => {
      const source = loadExample('simple-dynamic-worker.smpst');
      const module = parse(source);

      expect(module).toBeDefined();
      expect(module.type).toBe('Module');

      const protocol = getProtocol(module, 'DynamicWorker');
      expect(protocol.name).toBe('DynamicWorker');

      // Check for dynamic role declaration in protocol body
      const body = protocol.body as any[];
      const dynamicRoleDecl = body.find((i: any) => i.type === 'DynamicRoleDeclaration');
      expect(dynamicRoleDecl).toBeDefined();
      expect((dynamicRoleDecl as DynamicRoleDeclaration).roleName).toBe('Worker');
    });

    it('parses participant creation', () => {
      const source = loadExample('simple-dynamic-worker.smpst');
      const module = parse(source);

      const protocol = getProtocol(module, 'DynamicWorker');
      const body = protocol.body as any[];

      const creation = body.find((i: any) => i.type === 'CreateParticipants');
      expect(creation).toBeDefined();
      expect((creation as any).creator).toBe('Manager');
      expect((creation as any).roleName).toBe('Worker');
    });

    it('parses invitation', () => {
      const source = loadExample('simple-dynamic-worker.smpst');
      const module = parse(source);

      const protocol = getProtocol(module, 'DynamicWorker');
      const body = protocol.body as any[];

      const invitation = body.find((i: any) => i.type === 'Invitation');
      expect(invitation).toBeDefined();
      expect((invitation as any).inviter).toBe('Manager');
      expect((invitation as any).invitee).toBe('Worker');
    });

    it('builds CFG with DMst actions', () => {
      const source = loadExample('simple-dynamic-worker.smpst');
      const module = parse(source);

      const protocol = getProtocol(module, 'DynamicWorker');
      const cfg = buildCFG(protocol);

      expect(cfg).toBeDefined();
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // Check for DMst action nodes
      const actionNodes = cfg.nodes.filter(n => n.type === 'action');
      expect(actionNodes.length).toBeGreaterThan(0);

      // Find dynamic role declaration action
      const dynamicRoleAction = actionNodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'dynamic-role-declaration'
      );
      expect(dynamicRoleAction).toBeDefined();

      // Find creation action
      const createAction = actionNodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'create-participants'
      );
      expect(createAction).toBeDefined();

      // Find invitation action
      const inviteAction = actionNodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'invitation'
      );
      expect(inviteAction).toBeDefined();
    });
  });

  describe('updatable-pipeline.smpst', () => {
    it('parses updatable recursion', () => {
      const source = loadExample('updatable-pipeline.smpst');
      const module = parse(source);

      expect(module).toBeDefined();

      const protocol = getProtocol(module, 'Pipeline');
      const body = protocol.body as any[];

      // Find recursion
      const recursion = body.find((i: any) => i.type === 'Recursion');
      expect(recursion).toBeDefined();
    });

    it('parses continue with update body', () => {
      const source = loadExample('updatable-pipeline.smpst');
      const module = parse(source);

      const protocol = getProtocol(module, 'Pipeline');

      // Search for UpdatableRecursion node in AST
      function findUpdatableRecursion(node: any): any {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'UpdatableRecursion') return node;

        if (Array.isArray(node)) {
          for (const item of node) {
            const found = findUpdatableRecursion(item);
            if (found) return found;
          }
        } else {
          for (const key of Object.keys(node)) {
            const found = findUpdatableRecursion(node[key]);
            if (found) return found;
          }
        }
        return null;
      }

      const updatable = findUpdatableRecursion(protocol);
      expect(updatable).toBeDefined();
      expect(updatable.label).toBe('Loop');
      expect(updatable.updateBody).toBeDefined();
    });

    it('builds CFG with updatable recursion action', () => {
      const source = loadExample('updatable-pipeline.smpst');
      const module = parse(source);

      const protocol = getProtocol(module, 'Pipeline');
      const cfg = buildCFG(protocol);

      // Find updatable recursion action
      const actionNodes = cfg.nodes.filter(n => n.type === 'action');
      const updatableAction = actionNodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'updatable-recursion'
      );
      expect(updatableAction).toBeDefined();
      expect((updatableAction as any).action.label).toBe('Loop');
    });
  });

  describe('protocol-call.smpst', () => {
    it('parses multiple protocols', () => {
      const source = loadExample('protocol-call.smpst');
      const module = parse(source);

      expect(module).toBeDefined();

      const protocols = getAllProtocols(module);
      expect(protocols).toHaveLength(2);

      const subTask = protocols.find(p => p.name === 'SubTask');
      const main = protocols.find(p => p.name === 'Main');

      expect(subTask).toBeDefined();
      expect(main).toBeDefined();
    });

    it('parses protocol call', () => {
      const source = loadExample('protocol-call.smpst');
      const module = parse(source);

      const main = getProtocol(module, 'Main');

      // Find protocol call in AST
      function findProtocolCall(node: any): any {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'ProtocolCall') return node;

        if (Array.isArray(node)) {
          for (const item of node) {
            const found = findProtocolCall(item);
            if (found) return found;
          }
        } else {
          for (const key of Object.keys(node)) {
            const found = findProtocolCall(node[key]);
            if (found) return found;
          }
        }
        return null;
      }

      const call = findProtocolCall(main);
      expect(call).toBeDefined();
      expect(call.caller).toBe('Coordinator');
      expect(call.protocol).toBe('SubTask');
      expect(call.roleArguments).toContain('Worker');
    });

    it('builds CFG with protocol call action', () => {
      const source = loadExample('protocol-call.smpst');
      const module = parse(source);

      const main = getProtocol(module, 'Main');
      const cfg = buildCFG(main);

      const actionNodes = cfg.nodes.filter(n => n.type === 'action');
      const callAction = actionNodes.find(
        n => n.type === 'action' && (n as any).action.kind === 'protocol-call'
      );
      expect(callAction).toBeDefined();
      expect((callAction as any).action.protocol).toBe('SubTask');
    });
  });

  describe('map-reduce.smpst', () => {
    it('parses complex DMst protocol', () => {
      const source = loadExample('map-reduce.smpst');
      const module = parse(source);

      expect(module).toBeDefined();

      const protocols = getAllProtocols(module);
      expect(protocols).toHaveLength(2);

      const mapReduce = protocols.find(p => p.name === 'MapReduce');
      expect(mapReduce).toBeDefined();
    });

    it('combines all DMst features', () => {
      const source = loadExample('map-reduce.smpst');
      const module = parse(source);

      const mapReduce = getProtocol(module, 'MapReduce');
      const cfg = buildCFG(mapReduce);

      const actionNodes = cfg.nodes.filter(n => n.type === 'action');

      // Should have dynamic role declaration
      const hasDynamicRole = actionNodes.some(
        n => (n as any).action?.kind === 'dynamic-role-declaration'
      );
      expect(hasDynamicRole).toBe(true);

      // Should have creation
      const hasCreation = actionNodes.some(
        n => (n as any).action?.kind === 'create-participants'
      );
      expect(hasCreation).toBe(true);

      // Should have protocol call
      const hasCall = actionNodes.some(n => (n as any).action?.kind === 'protocol-call');
      expect(hasCall).toBe(true);

      // Should have updatable recursion
      const hasUpdatable = actionNodes.some(
        n => (n as any).action?.kind === 'updatable-recursion'
      );
      expect(hasUpdatable).toBe(true);
    });
  });
});

describe('DMst Examples - Validation', () => {
  it('all examples parse without errors', () => {
    const examples = [
      'simple-dynamic-worker.smpst',
      'updatable-pipeline.smpst',
      'protocol-call.smpst',
      'map-reduce.smpst',
    ];

    for (const example of examples) {
      const source = loadExample(example);
      expect(() => parse(source)).not.toThrow();
    }
  });

  it('all examples build valid CFGs', () => {
    const examples = [
      'simple-dynamic-worker.smpst',
      'updatable-pipeline.smpst',
      'protocol-call.smpst',
      'map-reduce.smpst',
    ];

    for (const example of examples) {
      const source = loadExample(example);
      const module = parse(source);

      const protocols = getAllProtocols(module);
      for (const protocol of protocols) {
        const cfg = buildCFG(protocol);
        expect(cfg).toBeDefined();
        expect(cfg.nodes.length).toBeGreaterThan(0);
        expect(cfg.edges.length).toBeGreaterThan(0);
      }
    }
  });
});
