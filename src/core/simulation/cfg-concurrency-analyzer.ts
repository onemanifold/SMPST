/**
 * CFG Concurrency Analyzer
 *
 * Analyzes CFG structure to determine which events are concurrent vs causally ordered.
 * Essential for bisimulation validation - concurrent events can happen in any order.
 *
 * Concurrency Rules:
 * 1. Actions in different parallel branches (fork-join) are concurrent
 * 2. Actions in the same sequential path are causally ordered
 * 3. Actions across choice branches are NOT concurrent (only one executes)
 */

import type { CFG, Node, ActionNode, ForkNode, JoinNode } from '../cfg/types';

export interface ActionId {
  nodeId: string;
  from: string;
  to: string | string[];
  label: string;
}

export interface ConcurrencyInfo {
  actionId: ActionId;
  dependencies: Set<string>; // Must happen before this
  concurrentWith: Set<string>; // Can happen in any order
  parallelRegion: string | null;
}

export class CFGConcurrencyAnalyzer {
  private cfg: CFG;
  private concurrencyMap: Map<string, ConcurrencyInfo> = new Map();

  constructor(cfg: CFG) {
    this.cfg = cfg;
    this.analyze();
  }

  private analyze(): void {
    const actionNodes = this.cfg.nodes.filter(n => n.type === 'action') as ActionNode[];

    for (const node of actionNodes) {
      if (node.action.kind === 'message') {
        this.concurrencyMap.set(node.id, {
          actionId: {
            nodeId: node.id,
            from: node.action.from,
            to: node.action.to,
            label: node.action.message?.label || node.action.label || '',
          },
          dependencies: new Set(),
          concurrentWith: new Set(),
          parallelRegion: null,
        });
      }
    }

    this.analyzeParallelRegions();
    this.buildCausalDependencies();
  }

  private analyzeParallelRegions(): void {
    const forkNodes = this.cfg.nodes.filter(n => n.type === 'fork') as ForkNode[];

    for (const forkNode of forkNodes) {
      const parallelId = forkNode.parallel_id;
      const joinNode = this.cfg.nodes.find(
        n => n.type === 'join' && (n as JoinNode).parallel_id === parallelId
      ) as JoinNode | undefined;

      if (!joinNode) continue;

      const forkEdges = this.cfg.edges.filter(
        e => e.from === forkNode.id && e.edgeType === 'fork'
      );

      const branches: string[][] = [];
      for (const edge of forkEdges) {
        const branchActions = this.collectActionsInBranch(edge.to, joinNode.id);
        branches.push(branchActions);
      }

      for (const branchActions of branches) {
        for (const nodeId of branchActions) {
          const info = this.concurrencyMap.get(nodeId);
          if (info) {
            info.parallelRegion = parallelId;
          }
        }
      }

      for (let i = 0; i < branches.length; i++) {
        for (let j = i + 1; j < branches.length; j++) {
          for (const action1 of branches[i]) {
            for (const action2 of branches[j]) {
              const info1 = this.concurrencyMap.get(action1);
              const info2 = this.concurrencyMap.get(action2);
              if (info1 && info2) {
                info1.concurrentWith.add(action2);
                info2.concurrentWith.add(action1);
              }
            }
          }
        }
      }
    }
  }

  private collectActionsInBranch(startNodeId: string, joinNodeId: string): string[] {
    const actions: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId) || nodeId === joinNodeId) continue;
      visited.add(nodeId);

      const node = this.cfg.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (node.type === 'action' && (node as ActionNode).action.kind === 'message') {
        actions.push(nodeId);
      }

      const outEdges = this.cfg.edges.filter(e => e.from === nodeId);
      for (const edge of outEdges) {
        if (edge.edgeType !== 'continue') {
          queue.push(edge.to);
        }
      }
    }

    return actions;
  }

  private buildCausalDependencies(): void {
    for (const [nodeId, info] of this.concurrencyMap) {
      const predecessors = this.findCausalPredecessors(nodeId);
      for (const predId of predecessors) {
        if (!info.concurrentWith.has(predId)) {
          info.dependencies.add(predId);
        }
      }
    }
  }

  private findCausalPredecessors(nodeId: string): Set<string> {
    const predecessors = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const inEdges = this.cfg.edges.filter(e => e.to === currentId);
      for (const edge of inEdges) {
        if (edge.edgeType === 'continue') continue;

        const predNode = this.cfg.nodes.find(n => n.id === edge.from);
        if (!predNode) continue;

        if (predNode.type === 'action' && (predNode as ActionNode).action.kind === 'message') {
          predecessors.add(edge.from);
        }

        queue.push(edge.from);
      }
    }

    return predecessors;
  }

  getConcurrencyInfo(nodeId: string): ConcurrencyInfo | undefined {
    return this.concurrencyMap.get(nodeId);
  }

  areConcurrent(nodeId1: string, nodeId2: string): boolean {
    const info1 = this.concurrencyMap.get(nodeId1);
    return info1 ? info1.concurrentWith.has(nodeId2) : false;
  }

  mustHappenBefore(nodeId1: string, nodeId2: string): boolean {
    const info2 = this.concurrencyMap.get(nodeId2);
    return info2 ? info2.dependencies.has(nodeId1) : false;
  }

  getConcurrentActions(nodeId: string): Set<string> {
    const info = this.concurrencyMap.get(nodeId);
    return info ? info.concurrentWith : new Set();
  }

  getDependencies(nodeId: string): Set<string> {
    const info = this.concurrencyMap.get(nodeId);
    return info ? info.dependencies : new Set();
  }

  getAllConcurrencyInfo(): Map<string, ConcurrencyInfo> {
    return new Map(this.concurrencyMap);
  }
}
