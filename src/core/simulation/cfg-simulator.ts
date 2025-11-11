/**
 * CFG Simulator (Orchestration-based)
 *
 * Centralized execution from global CFG.
 * Validates CFG structure correctness through executable semantics.
 *
 * Key principle: The simulator IS the operational semantics of the CFG.
 * If protocols execute correctly here, the CFG structure is correct.
 */

import type { CFG, CFGNode, CFGEdge, ActionNode, ChoiceNode, RecNode, ParallelNode } from '../cfg/types';
import type {
  CFGSimulatorConfig,
  CFGExecutionState,
  CFGStepResult,
  CFGRunResult,
  CFGExecutionEvent,
  CFGExecutionTrace,
  CFGExecutionError,
  ChoiceOption,
  RecursionContext,
  MessageEvent,
  ChoiceEvent,
  RecursionEvent,
  ParallelEvent,
  StateChangeEvent,
} from './types';

/**
 * CFG Simulator - Orchestrated execution
 *
 * Executes global protocol step-by-step from CFG.
 * Maintains single source of truth for protocol state.
 */
export class CFGSimulator {
  private cfg: CFG;
  private config: Required<CFGSimulatorConfig>;

  // Execution state
  private currentNode: string;
  private visitedNodes: string[] = [];
  private stepCount: number = 0;
  private completed: boolean = false;
  private reachedMaxSteps: boolean = false;

  // Choice state
  private pendingChoice: ChoiceOption[] | null = null;
  private selectedChoice: number | null = null;

  // Parallel state
  private inParallel: boolean = false;
  private parallelBranches: string[][] = [];
  private parallelBranchIndex: number = 0;

  // Recursion state
  private recursionStack: RecursionContext[] = [];

  // Trace recording
  private trace: CFGExecutionTrace;

  constructor(cfg: CFG, config: CFGSimulatorConfig = {}) {
    this.cfg = cfg;
    this.config = {
      maxSteps: config.maxSteps ?? 1000,
      recordTrace: config.recordTrace ?? false,
      choiceStrategy: config.choiceStrategy ?? 'manual',
    };

    // Initialize at entry node
    this.currentNode = cfg.entry;
    this.visitedNodes.push(cfg.entry);

    // Initialize trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
      totalSteps: 0,
    };
  }

  /**
   * Get current execution state
   */
  getState(): CFGExecutionState {
    return {
      currentNode: this.inParallel ? this.parallelBranches.flat() : this.currentNode,
      visitedNodes: [...this.visitedNodes],
      stepCount: this.stepCount,
      completed: this.completed,
      atChoice: this.pendingChoice !== null,
      availableChoices: this.pendingChoice ?? undefined,
      inParallel: this.inParallel,
      activeBranches: this.inParallel ? this.parallelBranches : undefined,
      reachedMaxSteps: this.reachedMaxSteps,
      recursionStack: [...this.recursionStack],
    };
  }

  /**
   * Execute one step
   */
  step(): CFGStepResult {
    // Check if already completed
    if (this.completed) {
      return {
        success: false,
        error: {
          type: 'already-completed',
          message: 'Protocol execution already completed',
          nodeId: this.currentNode,
        },
        state: this.getState(),
      };
    }

    // Check max steps
    if (this.stepCount >= this.config.maxSteps) {
      this.reachedMaxSteps = true;
      return {
        success: false,
        error: {
          type: 'max-steps-reached',
          message: `Maximum steps (${this.config.maxSteps}) reached`,
          nodeId: this.currentNode,
        },
        state: this.getState(),
      };
    }

    // If at choice point, must make choice first
    if (this.pendingChoice !== null && this.selectedChoice === null) {
      // Auto-select based on strategy
      if (this.config.choiceStrategy === 'first') {
        this.selectedChoice = 0;
      } else if (this.config.choiceStrategy === 'random') {
        this.selectedChoice = Math.floor(Math.random() * this.pendingChoice.length);
      } else {
        // Manual - require explicit choose() call
        return {
          success: false,
          error: {
            type: 'choice-required',
            message: 'At choice point - must call choose() before step()',
            nodeId: this.currentNode,
          },
          state: this.getState(),
        };
      }
    }

    this.stepCount++;

    try {
      // Execute and auto-advance until we hit an action or complete
      const result = this.executeUntilAction();

      if (result.success && this.config.recordTrace && result.event) {
        this.trace.events.push(result.event);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'invalid-node',
          message: error instanceof Error ? error.message : String(error),
          nodeId: this.currentNode,
        },
        state: this.getState(),
      };
    }
  }

  /**
   * Execute nodes until we produce an action event or complete
   * Auto-advances through structural nodes (entry, merge, etc.)
   */
  private executeUntilAction(): CFGStepResult {
    let advanceLimit = 100; // Prevent infinite loops

    while (advanceLimit-- > 0) {
      const result = this.executeNode();

      // If we hit an error or completed, return immediately
      if (!result.success || this.completed) {
        return result;
      }

      // If we got an event (action happened), return it
      if (result.event) {
        return result;
      }

      // No event - we auto-advanced through a structural node
      // Continue looping to find the next action
    }

    throw new Error('Too many structural nodes traversed (possible cycle)');
  }

  /**
   * Check if node is an action node (requires user visibility)
   */
  private isActionNode(node: CFGNode): boolean {
    return node.type === 'message' ||
           node.type === 'choice' ||
           node.type === 'rec';
  }

  /**
   * Execute current node and transition to next
   */
  private executeNode(): CFGStepResult {
    const node = this.getNode(this.currentNode);
    if (!node) {
      throw new Error(`Node ${this.currentNode} not found in CFG`);
    }

    // Handle different node types
    switch (node.type) {
      case 'entry':
        return this.executeEntry();

      case 'exit':
        return this.executeExit();

      case 'message':
        return this.executeMessage(node as ActionNode);

      case 'choice':
        return this.executeChoice(node as ChoiceNode);

      case 'merge':
        return this.executeMerge();

      case 'rec':
        return this.executeRec(node as RecNode);

      case 'continue':
        return this.executeContinue();

      case 'parallel':
        return this.executeParallel(node as ParallelNode);

      case 'fork':
        return this.executeFork();

      case 'join':
        return this.executeJoin();

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  /**
   * Execute entry node (just transition to next)
   */
  private executeEntry(): CFGStepResult {
    return this.transitionToNext();
  }

  /**
   * Execute exit node (mark as complete)
   */
  private executeExit(): CFGStepResult {
    this.completed = true;
    this.trace.completed = true;
    this.trace.endTime = Date.now();
    this.trace.totalSteps = this.stepCount;

    return {
      success: true,
      state: this.getState(),
    };
  }

  /**
   * Execute message node (emit message event)
   */
  private executeMessage(node: ActionNode): CFGStepResult {
    const action = node.action;
    if (action.type !== 'message') {
      throw new Error(`Expected message action, got ${action.type}`);
    }

    const event: MessageEvent = {
      type: 'message',
      timestamp: Date.now(),
      from: action.from,
      to: action.to,
      label: action.label,
      payloadType: action.payloadType,
      nodeId: node.id,
    };

    // Transition to next node
    const result = this.transitionToNext();

    return {
      ...result,
      event,
    };
  }

  /**
   * Execute choice node (setup choice options)
   */
  private executeChoice(node: ChoiceNode): CFGStepResult {
    // If already chose, take that branch
    if (this.selectedChoice !== null) {
      const choiceIndex = this.selectedChoice;
      this.selectedChoice = null;
      this.pendingChoice = null;

      const event: ChoiceEvent = {
        type: 'choice',
        timestamp: Date.now(),
        decidingRole: node.role,
        choiceIndex,
        nodeId: node.id,
      };

      // Take the chosen branch
      const edges = this.getOutgoingEdges(node.id);
      if (choiceIndex >= edges.length) {
        throw new Error(`Choice index ${choiceIndex} out of bounds (${edges.length} branches)`);
      }

      const chosenEdge = edges[choiceIndex];
      this.transitionTo(chosenEdge.to);

      return {
        success: true,
        event,
        state: this.getState(),
      };
    }

    // Setup choice options
    const edges = this.getOutgoingEdges(node.id);
    this.pendingChoice = edges.map((edge, index) => ({
      index,
      label: edge.label,
      firstNode: edge.to,
      description: this.getNodeDescription(edge.to),
    }));

    return {
      success: true,
      state: this.getState(),
    };
  }

  /**
   * Execute merge node (just transition)
   */
  private executeMerge(): CFGStepResult {
    return this.transitionToNext();
  }

  /**
   * Execute rec node (push recursion context)
   */
  private executeRec(node: RecNode): CFGStepResult {
    // Push recursion context
    this.recursionStack.push({
      label: node.label,
      nodeId: node.id,
      iterations: 0,
    });

    const event: RecursionEvent = {
      type: 'recursion',
      timestamp: Date.now(),
      action: 'enter',
      label: node.label,
      nodeId: node.id,
    };

    const result = this.transitionToNext();

    return {
      ...result,
      event,
    };
  }

  /**
   * Execute continue node (jump back to rec)
   */
  private executeContinue(): CFGStepResult {
    const node = this.getNode(this.currentNode);
    if (!node || node.type !== 'continue') {
      throw new Error(`Node ${this.currentNode} is not a continue node`);
    }

    const continueNode = node as any;
    const label = continueNode.label;

    // Find matching recursion context
    const context = this.recursionStack.find(c => c.label === label);
    if (!context) {
      throw new Error(`No recursion context found for label: ${label}`);
    }

    context.iterations++;

    const event: RecursionEvent = {
      type: 'recursion',
      timestamp: Date.now(),
      action: 'continue',
      label,
      iteration: context.iterations,
      nodeId: this.currentNode,
    };

    // Jump back to rec node
    this.transitionTo(context.nodeId);

    return {
      success: true,
      event,
      state: this.getState(),
    };
  }

  /**
   * Execute parallel node (setup parallel branches)
   */
  private executeParallel(node: ParallelNode): CFGStepResult {
    // Get branch entry points
    const edges = this.getOutgoingEdges(node.id);
    this.parallelBranches = edges.map(edge => [edge.to]);
    this.parallelBranchIndex = 0;
    this.inParallel = true;

    const event: ParallelEvent = {
      type: 'parallel',
      timestamp: Date.now(),
      action: 'fork',
      branches: edges.length,
      nodeId: node.id,
    };

    // Enter first branch
    this.currentNode = this.parallelBranches[0][0];
    this.visitedNodes.push(this.currentNode);

    return {
      success: true,
      event,
      state: this.getState(),
    };
  }

  /**
   * Execute fork node (branch point in parallel)
   */
  private executeFork(): CFGStepResult {
    return this.transitionToNext();
  }

  /**
   * Execute join node (merge parallel branches)
   */
  private executeJoin(): CFGStepResult {
    // Check if all branches completed
    this.parallelBranchIndex++;

    if (this.parallelBranchIndex < this.parallelBranches.length) {
      // Move to next branch
      const nextBranch = this.parallelBranches[this.parallelBranchIndex];
      this.currentNode = nextBranch[0];
      this.visitedNodes.push(this.currentNode);

      return {
        success: true,
        state: this.getState(),
      };
    }

    // All branches complete - exit parallel
    this.inParallel = false;
    this.parallelBranches = [];
    this.parallelBranchIndex = 0;

    const event: ParallelEvent = {
      type: 'parallel',
      timestamp: Date.now(),
      action: 'join',
      nodeId: this.currentNode,
    };

    const result = this.transitionToNext();

    return {
      ...result,
      event,
    };
  }

  /**
   * Transition to next node (follow single outgoing edge)
   */
  private transitionToNext(): CFGStepResult {
    const edges = this.getOutgoingEdges(this.currentNode);

    if (edges.length === 0) {
      throw new Error(`No outgoing edges from node ${this.currentNode}`);
    }

    if (edges.length > 1) {
      throw new Error(`Multiple outgoing edges from non-choice node ${this.currentNode}`);
    }

    this.transitionTo(edges[0].to);

    return {
      success: true,
      state: this.getState(),
    };
  }

  /**
   * Transition to specific node
   */
  private transitionTo(nodeId: string): void {
    const fromNode = this.currentNode;
    this.currentNode = nodeId;
    this.visitedNodes.push(nodeId);

    if (this.config.recordTrace) {
      const event: StateChangeEvent = {
        type: 'state-change',
        timestamp: Date.now(),
        fromNode,
        toNode: nodeId,
      };
      this.trace.events.push(event);
    }
  }

  /**
   * Make a choice at choice point
   */
  choose(index: number): void {
    if (this.pendingChoice === null) {
      throw new Error('Not at a choice point');
    }

    if (index < 0 || index >= this.pendingChoice.length) {
      throw new Error(`Invalid choice index ${index} (must be 0-${this.pendingChoice.length - 1})`);
    }

    this.selectedChoice = index;
  }

  /**
   * Run to completion (or until error/maxSteps)
   */
  run(): CFGRunResult {
    while (!this.completed && !this.reachedMaxSteps) {
      const result = this.step();

      if (!result.success) {
        return {
          success: false,
          steps: this.stepCount,
          state: this.getState(),
          error: result.error,
        };
      }
    }

    return {
      success: this.completed,
      steps: this.stepCount,
      state: this.getState(),
    };
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return this.completed;
  }

  /**
   * Get execution trace
   */
  getTrace(): CFGExecutionTrace {
    return {
      ...this.trace,
      events: [...this.trace.events],
      totalSteps: this.stepCount,
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentNode = this.cfg.entry;
    this.visitedNodes = [this.cfg.entry];
    this.stepCount = 0;
    this.completed = false;
    this.reachedMaxSteps = false;
    this.pendingChoice = null;
    this.selectedChoice = null;
    this.inParallel = false;
    this.parallelBranches = [];
    this.parallelBranchIndex = 0;
    this.recursionStack = [];

    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
      totalSteps: 0,
    };
  }

  /**
   * Helper: Get node by ID
   */
  private getNode(id: string): CFGNode | undefined {
    return this.cfg.nodes.find(n => n.id === id);
  }

  /**
   * Helper: Get outgoing edges from node
   */
  private getOutgoingEdges(nodeId: string): CFGEdge[] {
    return this.cfg.edges.filter(e => e.from === nodeId);
  }

  /**
   * Helper: Get description of node (for choice preview)
   */
  private getNodeDescription(nodeId: string): string | undefined {
    const node = this.getNode(nodeId);
    if (!node) return undefined;

    if (node.type === 'message') {
      const action = (node as ActionNode).action;
      if (action.type === 'message') {
        return `${action.from} → ${action.to}: ${action.label}`;
      }
    }

    return node.type;
  }
}
