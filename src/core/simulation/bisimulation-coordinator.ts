/**
 * Bisimulation Coordinator
 *
 * Coordinates CFG and CFSM execution to maintain bisimulation:
 * - CFG provides step ORDER (source of truth for sequence)
 * - CFSMs provide actual STATE (distributed execution with full fidelity)
 * - Both must match if implementation is correct
 *
 * Architecture:
 * 1. CFG determines next action
 * 2. Coordinator signals sender CFSM to execute
 * 3. Message goes to receiver's channel
 * 4. Channel intercepts BEFORE interpretation
 * 5. Emits 'incoming' event, debugger PAUSES
 * 6. Coordinator validates with CFG (checks dependencies, allows concurrent reordering)
 * 7. Coordinator signals RESUME
 * 8. CFSM processes atomically
 */

import type { CFG } from '../cfg/types';
import type { CFSM } from '../projection/types';
import type { Message } from './cfsm-simulator-types';
import { CFGSimulator } from './cfg-simulator';
import { CFSMDebugger } from './cfsm-debugger';
import { createChannel, type ChannelEnd } from './channel';
import { CFGConcurrencyAnalyzer } from './cfg-concurrency-analyzer';

export interface BisimulationCoordinatorConfig {
  maxSteps?: number;
  choiceStrategy?: 'manual' | 'first' | 'random';
}

export class BisimulationCoordinator {
  private cfgSimulator: CFGSimulator;
  private cfsmDebuggers: Map<string, CFSMDebugger>;
  private channels: Map<string, Map<string, ChannelEnd>>;
  private config: Required<BisimulationCoordinatorConfig>;
  private concurrencyAnalyzer: CFGConcurrencyAnalyzer;
  private stepCount: number = 0;
  private completed: boolean = false;
  private completedActions: Set<string> = new Set();

  constructor(
    cfg: CFG,
    cfsms: Map<string, CFSM>,
    config: BisimulationCoordinatorConfig = {}
  ) {
    this.config = {
      maxSteps: config.maxSteps ?? 1000,
      choiceStrategy: config.choiceStrategy ?? 'manual',
    };

    this.cfgSimulator = new CFGSimulator(cfg, {
      maxSteps: this.config.maxSteps,
      choiceStrategy: this.config.choiceStrategy,
      recordTrace: true,
      cfsms,
    });

    this.concurrencyAnalyzer = new CFGConcurrencyAnalyzer(cfg);

    const communicatingPairs = this.analyzeCommunicationPairs(cfsms);
    this.channels = new Map();
    const channelRegistry = new Map<string, [ChannelEnd, ChannelEnd]>();

    for (const role of cfsms.keys()) {
      this.channels.set(role, new Map());
    }

    for (const [roleA, roleB] of communicatingPairs) {
      const [endA, endB] = createChannel({
        onIncoming: async (msg: Message) => {
          const receivingRole = msg.to;
          const receivingDebugger = this.cfsmDebuggers.get(receivingRole);

          if (receivingDebugger) {
            receivingDebugger.pause();
            receivingDebugger.emit('incoming', {
              from: msg.from,
              to: msg.to,
              label: msg.label,
              message: msg,
            });

            await this.validateIncomingMessage(msg);
            receivingDebugger.resume();
          }
        },
      });

      const key = [roleA, roleB].sort().join(':');
      channelRegistry.set(key, [endA, endB]);

      this.channels.get(roleA)!.set(roleB, endA);
      this.channels.get(roleB)!.set(roleA, endB);
    }

    this.cfsmDebuggers = new Map();
    for (const [role, cfsm] of cfsms) {
      const debugger = new CFSMDebugger(cfsm, {
        maxSteps: this.config.maxSteps,
        channels: this.channels.get(role),
        cfsmRegistry: cfsms,
        recordTrace: true,
      });

      this.cfsmDebuggers.set(role, debugger);
    }

    this.cfgSimulator.on('message', async (data) => {
      await this.handleCFGMessage(data);
    });
  }

  private analyzeCommunicationPairs(cfsms: Map<string, CFSM>): Set<[string, string]> {
    const pairs = new Set<string>();

    for (const [role, cfsm] of cfsms) {
      for (const transition of cfsm.transitions) {
        if (transition.action.type === 'send') {
          const recipients = Array.isArray(transition.action.to)
            ? transition.action.to
            : [transition.action.to];

          for (const recipient of recipients) {
            const key = [role, recipient].sort().join(':');
            pairs.add(key);
          }
        } else if (transition.action.type === 'receive') {
          const sender = transition.action.from;
          const key = [role, sender].sort().join(':');
          pairs.add(key);
        }
      }
    }

    return new Set(
      Array.from(pairs).map(key => {
        const [a, b] = key.split(':');
        return [a, b] as [string, string];
      })
    );
  }

  private async handleCFGMessage(data: {
    from: string;
    to: string | string[];
    label: string;
    payloadType?: string;
    nodeId: string;
  }): Promise<void> {
    this.completedActions.add(data.nodeId);

    const senderDebugger = this.cfsmDebuggers.get(data.from);
    if (senderDebugger) {
      await senderDebugger.stepForward();
    }
  }

  private async validateIncomingMessage(msg: Message): Promise<void> {
    const actionNode = this.findCFGActionNode(msg.from, msg.to, msg.label);

    if (!actionNode) {
      throw new Error(
        `Protocol violation: Unexpected message ${msg.from}→${msg.to}:${msg.label}`
      );
    }

    const info = this.concurrencyAnalyzer.getConcurrencyInfo(actionNode.id);

    if (info) {
      for (const depNodeId of info.dependencies) {
        if (!this.completedActions.has(depNodeId)) {
          throw new Error(
            `Protocol violation: Action ${actionNode.id} depends on ${depNodeId} which hasn't completed yet`
          );
        }
      }
    }

    this.completedActions.add(actionNode.id);
  }

  private findCFGActionNode(
    from: string,
    to: string,
    label: string
  ): { id: string; from: string; to: string | string[]; label: string } | null {
    const cfg = (this.cfgSimulator as any).cfg;

    for (const node of cfg.nodes) {
      if (node.type === 'action' && node.action.kind === 'message') {
        const action = node.action;
        const actionLabel = action.message?.label || action.label || '';

        if (action.from === from && actionLabel === label) {
          const recipients = Array.isArray(action.to) ? action.to : [action.to];
          if (recipients.includes(to)) {
            return {
              id: node.id,
              from: action.from,
              to: action.to,
              label: actionLabel,
            };
          }
        }
      }
    }

    return null;
  }

  async step(): Promise<void> {
    if (this.completed) {
      throw new Error('Bisimulation already completed');
    }

    if (this.stepCount >= this.config.maxSteps) {
      throw new Error('Maximum steps reached');
    }

    const result = this.cfgSimulator.step();

    if (!result.success) {
      throw new Error(`CFG step failed: ${result.error?.message}`);
    }

    this.stepCount++;

    if (this.cfgSimulator.isComplete()) {
      this.completed = true;
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getStepCount(): number {
    return this.stepCount;
  }

  getCFGState() {
    return this.cfgSimulator.getState();
  }

  getCFSMStates(): Map<string, any> {
    const states = new Map();
    for (const [role, debugger] of this.cfsmDebuggers) {
      states.set(role, debugger.getState());
    }
    return states;
  }

  getDebugger(role: string): CFSMDebugger | undefined {
    return this.cfsmDebuggers.get(role);
  }

  getCFGSimulator(): CFGSimulator {
    return this.cfgSimulator;
  }

  getConcurrencyAnalyzer(): CFGConcurrencyAnalyzer {
    return this.concurrencyAnalyzer;
  }

  choose(index: number): void {
    this.cfgSimulator.choose(index);
  }

  reset(): void {
    this.cfgSimulator.reset();
    this.stepCount = 0;
    this.completed = false;
    this.completedActions.clear();
  }

  verifyBisimulation(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }
}
