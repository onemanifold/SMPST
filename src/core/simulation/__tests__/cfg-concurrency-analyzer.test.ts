/**
 * CFG Concurrency Analyzer Tests
 *
 * Tests the analysis of CFG structure to identify concurrent vs causal actions.
 */

import { describe, it, expect } from 'vitest';
import { CFGConcurrencyAnalyzer } from '../cfg-concurrency-analyzer';
import type { CFG } from '../../cfg/types';

describe('CFG Concurrency Analyzer', () => {
  describe('Sequential Protocol', () => {
    it('should identify causal dependencies in sequential protocol', () => {
      const cfg: CFG = {
        protocolName: 'Sequential',
        parameters: [],
        roles: ['A', 'B', 'C'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          {
            type: 'action',
            id: 'n1',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'B',
              to: 'C',
              message: { label: 'msg2', from: 'B', to: 'C' },
            },
          },
          { type: 'terminal', id: 'n3' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'sequence' },
          { id: 'e2', from: 'n2', to: 'n3', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      // msg2 depends on msg1 (sequential)
      const msg2Info = analyzer.getConcurrencyInfo('n2');
      expect(msg2Info).toBeDefined();
      expect(msg2Info!.dependencies.has('n1')).toBe(true);

      // msg1 and msg2 are NOT concurrent
      expect(analyzer.areConcurrent('n1', 'n2')).toBe(false);

      // msg1 must happen before msg2
      expect(analyzer.mustHappenBefore('n1', 'n2')).toBe(true);
    });

    it('should have no concurrent actions in sequential protocol', () => {
      const cfg: CFG = {
        protocolName: 'Sequential',
        parameters: [],
        roles: ['A', 'B'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          {
            type: 'action',
            id: 'n1',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg2', from: 'A', to: 'B' },
            },
          },
          { type: 'terminal', id: 'n3' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'sequence' },
          { id: 'e2', from: 'n2', to: 'n3', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      const msg1Info = analyzer.getConcurrencyInfo('n1');
      expect(msg1Info!.concurrentWith.size).toBe(0);

      const msg2Info = analyzer.getConcurrencyInfo('n2');
      expect(msg2Info!.concurrentWith.size).toBe(0);
    });
  });

  describe('Parallel Protocol', () => {
    it('should identify concurrent actions in parallel branches', () => {
      const cfg: CFG = {
        protocolName: 'Parallel',
        parameters: [],
        roles: ['A', 'B', 'C', 'D'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          { type: 'fork', id: 'n1', parallel_id: 'p1' },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n3',
            action: {
              kind: 'message',
              from: 'C',
              to: 'D',
              message: { label: 'msg2', from: 'C', to: 'D' },
            },
          },
          { type: 'join', id: 'n4', parallel_id: 'p1' },
          { type: 'terminal', id: 'n5' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'fork' },
          { id: 'e2', from: 'n1', to: 'n3', edgeType: 'fork' },
          { id: 'e3', from: 'n2', to: 'n4', edgeType: 'sequence' },
          { id: 'e4', from: 'n3', to: 'n4', edgeType: 'sequence' },
          { id: 'e5', from: 'n4', to: 'n5', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      // msg1 and msg2 are concurrent (in different parallel branches)
      expect(analyzer.areConcurrent('n2', 'n3')).toBe(true);
      expect(analyzer.areConcurrent('n3', 'n2')).toBe(true);

      // Neither must happen before the other
      expect(analyzer.mustHappenBefore('n2', 'n3')).toBe(false);
      expect(analyzer.mustHappenBefore('n3', 'n2')).toBe(false);

      // Both should be in the same parallel region
      const msg1Info = analyzer.getConcurrencyInfo('n2');
      const msg2Info = analyzer.getConcurrencyInfo('n3');
      expect(msg1Info!.parallelRegion).toBe('p1');
      expect(msg2Info!.parallelRegion).toBe('p1');

      // They should be in each other's concurrent sets
      expect(msg1Info!.concurrentWith.has('n3')).toBe(true);
      expect(msg2Info!.concurrentWith.has('n2')).toBe(true);
    });

    it('should handle sequential actions within parallel branches', () => {
      const cfg: CFG = {
        protocolName: 'ParallelWithSequential',
        parameters: [],
        roles: ['A', 'B', 'C', 'D'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          { type: 'fork', id: 'n1', parallel_id: 'p1' },
          // Branch 1: A→B, then B→A
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n3',
            action: {
              kind: 'message',
              from: 'B',
              to: 'A',
              message: { label: 'msg2', from: 'B', to: 'A' },
            },
          },
          // Branch 2: C→D
          {
            type: 'action',
            id: 'n4',
            action: {
              kind: 'message',
              from: 'C',
              to: 'D',
              message: { label: 'msg3', from: 'C', to: 'D' },
            },
          },
          { type: 'join', id: 'n5', parallel_id: 'p1' },
          { type: 'terminal', id: 'n6' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'fork' },
          { id: 'e2', from: 'n2', to: 'n3', edgeType: 'sequence' },
          { id: 'e3', from: 'n1', to: 'n4', edgeType: 'fork' },
          { id: 'e4', from: 'n3', to: 'n5', edgeType: 'sequence' },
          { id: 'e5', from: 'n4', to: 'n5', edgeType: 'sequence' },
          { id: 'e6', from: 'n5', to: 'n6', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      // msg2 depends on msg1 (sequential in same branch)
      const msg2Info = analyzer.getConcurrencyInfo('n3');
      expect(msg2Info!.dependencies.has('n2')).toBe(true);

      // msg3 is concurrent with msg1 and msg2 (different branch)
      expect(analyzer.areConcurrent('n2', 'n4')).toBe(true);
      expect(analyzer.areConcurrent('n3', 'n4')).toBe(true);

      // msg1 and msg2 are NOT concurrent (same branch)
      expect(analyzer.areConcurrent('n2', 'n3')).toBe(false);
    });

    it('should track multiple parallel regions correctly', () => {
      const cfg: CFG = {
        protocolName: 'NestedParallel',
        parameters: [],
        roles: ['A', 'B', 'C', 'D'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          // First parallel region
          { type: 'fork', id: 'n1', parallel_id: 'p1' },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n3',
            action: {
              kind: 'message',
              from: 'C',
              to: 'D',
              message: { label: 'msg2', from: 'C', to: 'D' },
            },
          },
          { type: 'join', id: 'n4', parallel_id: 'p1' },
          // Second parallel region
          { type: 'fork', id: 'n5', parallel_id: 'p2' },
          {
            type: 'action',
            id: 'n6',
            action: {
              kind: 'message',
              from: 'A',
              to: 'C',
              message: { label: 'msg3', from: 'A', to: 'C' },
            },
          },
          {
            type: 'action',
            id: 'n7',
            action: {
              kind: 'message',
              from: 'B',
              to: 'D',
              message: { label: 'msg4', from: 'B', to: 'D' },
            },
          },
          { type: 'join', id: 'n8', parallel_id: 'p2' },
          { type: 'terminal', id: 'n9' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'fork' },
          { id: 'e2', from: 'n1', to: 'n3', edgeType: 'fork' },
          { id: 'e3', from: 'n2', to: 'n4', edgeType: 'sequence' },
          { id: 'e4', from: 'n3', to: 'n4', edgeType: 'sequence' },
          { id: 'e5', from: 'n4', to: 'n5', edgeType: 'sequence' },
          { id: 'e6', from: 'n5', to: 'n6', edgeType: 'fork' },
          { id: 'e7', from: 'n5', to: 'n7', edgeType: 'fork' },
          { id: 'e8', from: 'n6', to: 'n8', edgeType: 'sequence' },
          { id: 'e9', from: 'n7', to: 'n8', edgeType: 'sequence' },
          { id: 'e10', from: 'n8', to: 'n9', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      // msg1 and msg2 are concurrent (same parallel region p1)
      expect(analyzer.areConcurrent('n2', 'n3')).toBe(true);

      // msg3 and msg4 are concurrent (same parallel region p2)
      expect(analyzer.areConcurrent('n6', 'n7')).toBe(true);

      // msg1/msg2 happen before msg3/msg4 (different sequential regions)
      const msg3Info = analyzer.getConcurrencyInfo('n6');
      const msg4Info = analyzer.getConcurrencyInfo('n7');

      // msg3 and msg4 depend on both msg1 and msg2
      expect(msg3Info!.dependencies.has('n2')).toBe(true);
      expect(msg3Info!.dependencies.has('n3')).toBe(true);
      expect(msg4Info!.dependencies.has('n2')).toBe(true);
      expect(msg4Info!.dependencies.has('n3')).toBe(true);
    });
  });

  describe('Choice Protocol', () => {
    it('should not mark actions in different choice branches as concurrent', () => {
      const cfg: CFG = {
        protocolName: 'Choice',
        parameters: [],
        roles: ['A', 'B'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          { type: 'branch', id: 'n1', at: 'A', branch_id: 'b1' },
          // Branch 1
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'option1', from: 'A', to: 'B' },
            },
          },
          // Branch 2
          {
            type: 'action',
            id: 'n3',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'option2', from: 'A', to: 'B' },
            },
          },
          { type: 'merge', id: 'n4', branch_id: 'b1' },
          { type: 'terminal', id: 'n5' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'branch', label: 'option1' },
          { id: 'e2', from: 'n1', to: 'n3', edgeType: 'branch', label: 'option2' },
          { id: 'e3', from: 'n2', to: 'n4', edgeType: 'sequence' },
          { id: 'e4', from: 'n3', to: 'n4', edgeType: 'sequence' },
          { id: 'e5', from: 'n4', to: 'n5', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      // Actions in different choice branches are NOT concurrent
      // (only one branch executes)
      expect(analyzer.areConcurrent('n2', 'n3')).toBe(false);

      // Neither has the other as a dependency
      const option1Info = analyzer.getConcurrencyInfo('n2');
      const option2Info = analyzer.getConcurrencyInfo('n3');
      expect(option1Info!.dependencies.has('n3')).toBe(false);
      expect(option2Info!.dependencies.has('n2')).toBe(false);
    });
  });

  describe('API Methods', () => {
    it('should return all concurrency info', () => {
      const cfg: CFG = {
        protocolName: 'Simple',
        parameters: [],
        roles: ['A', 'B'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          {
            type: 'action',
            id: 'n1',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'B',
              to: 'A',
              message: { label: 'msg2', from: 'B', to: 'A' },
            },
          },
          { type: 'terminal', id: 'n3' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'sequence' },
          { id: 'e2', from: 'n2', to: 'n3', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      const allInfo = analyzer.getAllConcurrencyInfo();
      expect(allInfo.size).toBe(2); // Two message actions
      expect(allInfo.has('n1')).toBe(true);
      expect(allInfo.has('n2')).toBe(true);
    });

    it('should return concurrent actions for a node', () => {
      const cfg: CFG = {
        protocolName: 'Parallel',
        parameters: [],
        roles: ['A', 'B', 'C', 'D'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          { type: 'fork', id: 'n1', parallel_id: 'p1' },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n3',
            action: {
              kind: 'message',
              from: 'C',
              to: 'D',
              message: { label: 'msg2', from: 'C', to: 'D' },
            },
          },
          { type: 'join', id: 'n4', parallel_id: 'p1' },
          { type: 'terminal', id: 'n5' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'fork' },
          { id: 'e2', from: 'n1', to: 'n3', edgeType: 'fork' },
          { id: 'e3', from: 'n2', to: 'n4', edgeType: 'sequence' },
          { id: 'e4', from: 'n3', to: 'n4', edgeType: 'sequence' },
          { id: 'e5', from: 'n4', to: 'n5', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      const concurrentActions = analyzer.getConcurrentActions('n2');
      expect(concurrentActions.size).toBe(1);
      expect(concurrentActions.has('n3')).toBe(true);
    });

    it('should return dependencies for a node', () => {
      const cfg: CFG = {
        protocolName: 'Sequential',
        parameters: [],
        roles: ['A', 'B', 'C'],
        initialNode: 'n0',
        nodes: [
          { type: 'initial', id: 'n0' },
          {
            type: 'action',
            id: 'n1',
            action: {
              kind: 'message',
              from: 'A',
              to: 'B',
              message: { label: 'msg1', from: 'A', to: 'B' },
            },
          },
          {
            type: 'action',
            id: 'n2',
            action: {
              kind: 'message',
              from: 'B',
              to: 'C',
              message: { label: 'msg2', from: 'B', to: 'C' },
            },
          },
          { type: 'terminal', id: 'n3' },
        ],
        edges: [
          { id: 'e0', from: 'n0', to: 'n1', edgeType: 'sequence' },
          { id: 'e1', from: 'n1', to: 'n2', edgeType: 'sequence' },
          { id: 'e2', from: 'n2', to: 'n3', edgeType: 'sequence' },
        ],
      };

      const analyzer = new CFGConcurrencyAnalyzer(cfg);

      const dependencies = analyzer.getDependencies('n2');
      expect(dependencies.size).toBe(1);
      expect(dependencies.has('n1')).toBe(true);
    });
  });
});
