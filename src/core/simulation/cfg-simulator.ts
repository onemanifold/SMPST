/**
 * CFG Simulator (Orchestration-based)
 *
 * Centralized execution from global CFG.
 * Validates CFG structure correctness through executable semantics.
 *
 * Key principle: The simulator IS the operational semantics of the CFG.
 * If protocols execute correctly here, the CFG structure is correct.
 */

import type { CFG, Node as CFGNode, Edge as CFGEdge, ActionNode, BranchNode, RecursiveNode, ForkNode, JoinNode, MergeNode } from '../cfg/types';
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
  private parallelBranchesCompleted: Set<number> = new Set(); // Track which branches reached join
  private parallelJoinNode: string | null = null; // The join node all branches must reach

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

    // Find initial node
    const initialNode = cfg.nodes.find(n => n.type === 'initial');
    if (!initialNode) {
      throw new Error('CFG has no initial node');
    }

    // Initialize at initial node
    this.currentNode = initialNode.id;
    this.visitedNodes.push(initialNode.id);

    // Initialize trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
      totalSteps: 0,
    };

    // Auto-advance to first meaningful state (action/choice/terminal)
    this.advanceToNextMeaningfulState();
  }

  /**
   * Auto-advance from initial to first meaningful state
   * (action, choice, fork, or terminal)
   */
  private advanceToNextMeaningfulState(): void {
    let limit = 100;

    while (limit-- > 0) {
      const node = this.getNode(this.currentNode);
      if (!node) return;

      // Stop at action, branch, fork, or terminal
      if (node.type === 'action' || node.type === 'branch' || node.type === 'fork' || node.type === 'terminal') {
        // If it's a branch, set up the choice
        if (node.type === 'branch') {
          const edges = this.getOutgoingEdges(node.id);
          this.pendingChoice = edges.map((edge, index) => ({
            index,
            label: edge.label,
            firstNode: edge.to,
            description: this.getNodeDescription(edge.to),
          }));
        }

        // If it's a fork, set up parallel state so getState() shows inParallel = true
        if (node.type === 'fork') {
          const forkEdges = this.getOutgoingEdges(node.id).filter(e => e.edgeType === 'fork');
          const joinNode = this.cfg.nodes.find(n =>
            n.type === 'join' && (n as any).parallel_id === (node as any).parallel_id
          );
          this.inParallel = true;
          this.parallelBranches = forkEdges.map(edge => [edge.to]);
          this.parallelBranchIndex = 0;
          this.parallelBranchesCompleted = new Set();
          this.parallelJoinNode = joinNode?.id || null;
          // Don't transition yet - let first step() handle it
        }

        // If it's terminal, mark as complete
        if (node.type === 'terminal') {
          this.completed = true;
          this.trace.completed = true;
          this.trace.endTime = Date.now();
        }

        return;
      }

      // Auto-advance from structural nodes (initial, merge, join, recursive)
      // For recursive nodes, take the forward edge and set up recursion state
      if (node.type === 'recursive') {
        const edges = this.getOutgoingEdges(node.id);
        const forwardEdge = edges.find(e => e.edgeType === 'sequence' && !this.isTerminalNode(e.to));

        if (forwardEdge) {
          // First entry into recursion - set up stack
          this.recursionStack.push({
            label: (node as any).label,
            nodeId: node.id,
            iterations: 0,
          });

          this.currentNode = forwardEdge.to;
          this.visitedNodes.push(this.currentNode);
          continue; // Continue auto-advancing through the forward edge
        } else {
          return; // No forward edge - stop here
        }
      }

      const edges = this.getOutgoingEdges(this.currentNode);
      if (edges.length !== 1) return; // Stop if multiple exits or none

      this.currentNode = edges[0].to;
      this.visitedNodes.push(this.currentNode);
    }
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
    let lastEvent: CFGExecutionEvent | undefined = undefined;

    while (advanceLimit-- > 0) {
      const result = this.executeNode();

      // If we hit an error, return immediately
      if (!result.success) {
        return result;
      }

      // If completed, return with any previously captured event
      if (this.completed) {
        return {
          ...result,
          event: lastEvent || result.event,
        };
      }

      // If we're at a choice point, stop and wait for user to choose
      if (this.pendingChoice !== null) {
        return result;
      }

      // If we got an event, check if we should continue through structural nodes
      if (result.event) {
        lastEvent = result.event;

        // Only continue if next node is structural (merge, terminal, fork, join)
        // Stop if next node is an action or choice
        const currentNode = this.getNode(this.currentNode);
        if (!currentNode) {
          return result;
        }

        if (currentNode.type === 'action' || currentNode.type === 'branch') {
          // Next node requires user visibility - return the event
          return {
            ...result,
            event: lastEvent,
          };
        }

        // Recursive nodes are transparent - continue through them
        // They will be handled by executeRecursive() in the next iteration

        // If in parallel mode and at join, check if this completes all branches
        if (this.inParallel && currentNode.type === 'join') {
          // Mark current branch as complete
          this.parallelBranchesCompleted.add(this.parallelBranchIndex);

          // If all branches are now complete, continue to execute join and auto-complete
          if (this.parallelBranchesCompleted.size === this.parallelBranches.length) {
            // Continue loop to execute the join and exit parallel
            // This allows auto-completion like we do for sequential protocols
          } else {
            // Not all branches done - stop and wait for next step
            return {
              ...result,
              event: lastEvent,
            };
          }
        }

        // Current node is structural - continue loop to auto-advance
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
    return node.type === 'action' ||
           node.type === 'branch' ||
           node.type === 'recursive';
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
      case 'initial':
        return this.executeInitial();

      case 'terminal':
        return this.executeTerminal();

      case 'action':
        return this.executeAction(node as ActionNode);

      case 'branch':
        return this.executeBranch(node as BranchNode);

      case 'merge':
        return this.executeMerge();

      case 'recursive':
        return this.executeRecursive(node as RecursiveNode);

      case 'fork':
        return this.executeFork();

      case 'join':
        return this.executeJoin();

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  /**
   * Execute initial node (just transition to next)
   */
  private executeInitial(): CFGStepResult {
    return this.transitionToNext();
  }

  /**
   * Execute terminal node (mark as complete)
   */
  private executeTerminal(): CFGStepResult {
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
   * Execute action node (emit message event)
   */
  private executeAction(node: ActionNode): CFGStepResult {
    const action = node.action;
    if (action.kind !== 'message') {
      throw new Error(`Expected message action, got ${action.kind}`);
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
   * Execute branch node (setup choice options)
   */
  private executeBranch(node: BranchNode): CFGStepResult {
    // If already chose, take that branch
    if (this.selectedChoice !== null) {
      const choiceIndex = this.selectedChoice;
      this.selectedChoice = null;
      this.pendingChoice = null;

      // Take the chosen branch
      const edges = this.getOutgoingEdges(node.id);
      if (choiceIndex >= edges.length) {
        throw new Error(`Choice index ${choiceIndex} out of bounds (${edges.length} branches)`);
      }

      const chosenEdge = edges[choiceIndex];
      this.transitionTo(chosenEdge.to);

      // Record choice event if tracing
      if (this.config.recordTrace) {
        const event: ChoiceEvent = {
          type: 'choice',
          timestamp: Date.now(),
          decidingRole: node.role,
          choiceIndex,
          nodeId: node.id,
        };
        this.trace.events.push(event);
      }

      // Return without event - let executeUntilAction continue to next action
      return {
        success: true,
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
   * Execute recursive node (recursion entry point)
   * Follows Scribble semantics: rec Label creates a loop point, continue returns to it
   */
  private executeRecursive(node: RecursiveNode): CFGStepResult {
    const edges = this.getOutgoingEdges(node.id);

    // Recursive node has two outgoing edges:
    // - Forward edge (sequence) into loop body
    // - Exit edge (sequence) to terminal or next block
    const forwardEdge = edges.find(e => e.edgeType === 'sequence' && !this.isTerminalNode(e.to));
    const exitEdge = edges.find(e => e.edgeType === 'sequence' && this.isTerminalNode(e.to));

    if (!forwardEdge) {
      throw new Error(`Recursive node ${node.id} has no forward edge into loop body`);
    }

    // Check if we're entering for the first time or continuing
    const inStack = this.recursionStack.find(c => c.label === node.label);

    if (!inStack) {
      // First time entering - push context and take forward edge
      this.recursionStack.push({
        label: node.label,
        nodeId: node.id,
        iterations: 0,
      });

      // Record enter event if tracing
      if (this.config.recordTrace) {
        const event: RecursionEvent = {
          type: 'recursion',
          timestamp: Date.now(),
          action: 'enter',
          label: node.label,
          nodeId: node.id,
        };
        this.trace.events.push(event);
      }

      // Take forward edge into loop body
      this.transitionTo(forwardEdge.to);

      return {
        success: true,
        state: this.getState(),
      };
    } else {
      // Returning via continue edge - check if we should exit
      inStack.iterations++;

      // Check exit conditions
      // Exit if: maxSteps reached OR we came from a merge node (implicit exit branch)
      const cameFromMerge = this.visitedNodes.length > 1 &&
        this.isNodeType(this.visitedNodes[this.visitedNodes.length - 2], 'merge');
      const shouldExit = this.stepCount >= this.config.maxSteps || cameFromMerge;

      if (shouldExit) {
        // Exit recursion
        if (this.stepCount >= this.config.maxSteps) {
          this.reachedMaxSteps = true;
        }

        // Record exit event if tracing
        if (this.config.recordTrace) {
          const event: RecursionEvent = {
            type: 'recursion',
            timestamp: Date.now(),
            action: 'exit',
            label: node.label,
            iteration: inStack.iterations,
            nodeId: node.id,
          };
          this.trace.events.push(event);
        }

        // Remove from stack
        const index = this.recursionStack.findIndex(c => c.label === node.label);
        if (index !== -1) {
          this.recursionStack.splice(index, 1);
        }

        // Take exit edge if available, otherwise just stay at current node
        if (exitEdge) {
          this.transitionTo(exitEdge.to);
        }

        return {
          success: true,
          state: this.getState(),
        };
      } else {
        // Continue looping - take forward edge again
        if (this.config.recordTrace) {
          const event: RecursionEvent = {
            type: 'recursion',
            timestamp: Date.now(),
            action: 'continue',
            label: node.label,
            iteration: inStack.iterations,
            nodeId: node.id,
          };
          this.trace.events.push(event);
        }

        // Take forward edge back into loop body
        this.transitionTo(forwardEdge.to);

        return {
          success: true,
          state: this.getState(),
        };
      }
    }
  }

  /**
   * Helper to check if a node ID is a terminal node
   */
  private isTerminalNode(nodeId: string): boolean {
    const node = this.cfg.nodes.find(n => n.id === nodeId);
    return node?.type === 'terminal';
  }

  /**
   * Helper to check if a node ID has a specific type
   */
  private isNodeType(nodeId: string, type: string): boolean {
    const node = this.cfg.nodes.find(n => n.id === nodeId);
    return node?.type === type;
  }


  /**
   * Execute fork node (branch point in parallel)
   * Sets up interleaving execution of parallel branches
   */
  private executeFork(): CFGStepResult {
    const forkNode = this.getNode(this.currentNode);
    if (!forkNode || forkNode.type !== 'fork') {
      throw new Error(`Expected fork node at ${this.currentNode}`);
    }

    const forkEdges = this.getOutgoingEdges(this.currentNode).filter(e => e.edgeType === 'fork');

    if (forkEdges.length === 0) {
      throw new Error(`Fork node ${this.currentNode} has no fork edges`);
    }

    // Find the matching join node
    const joinNode = this.cfg.nodes.find(n =>
      n.type === 'join' && (n as any).parallel_id === (forkNode as any).parallel_id
    );
    if (!joinNode) {
      throw new Error(`No matching join node for fork ${this.currentNode}`);
    }

    // Set up parallel state with all branches
    this.inParallel = true;
    this.parallelBranches = forkEdges.map(edge => [edge.to]); // Each branch starts with one node
    this.parallelBranchIndex = 0;
    this.parallelBranchesCompleted = new Set();
    this.parallelJoinNode = joinNode.id;

    // Record fork event if tracing
    if (this.config.recordTrace) {
      const event: ParallelEvent = {
        type: 'parallel',
        timestamp: Date.now(),
        action: 'fork',
        branches: forkEdges.length,
        nodeId: this.currentNode,
      };
      this.trace.events.push(event);
    }

    // Transition to first node of first branch
    this.currentNode = this.parallelBranches[0][0];
    this.visitedNodes.push(this.currentNode);

    // Return without event - let executeUntilAction continue to action
    return {
      success: true,
      state: this.getState(),
    };
  }

  /**
   * Execute join node (merge parallel branches)
   * Marks current branch as complete and checks if all branches done
   */
  private executeJoin(): CFGStepResult {
    // Mark current branch as complete
    this.parallelBranchesCompleted.add(this.parallelBranchIndex);

    // Check if all branches have reached join
    if (this.parallelBranchesCompleted.size < this.parallelBranches.length) {
      // Not all branches complete yet - switch to next incomplete branch
      this.parallelBranchIndex++;

      // Find next incomplete branch
      while (this.parallelBranchIndex < this.parallelBranches.length &&
             this.parallelBranchesCompleted.has(this.parallelBranchIndex)) {
        this.parallelBranchIndex++;
      }

      if (this.parallelBranchIndex < this.parallelBranches.length) {
        // Move to next incomplete branch
        const nextBranch = this.parallelBranches[this.parallelBranchIndex];
        this.currentNode = nextBranch[0];
        this.visitedNodes.push(this.currentNode);

        return {
          success: true,
          state: this.getState(),
        };
      }
    }

    // All branches complete - exit parallel
    this.inParallel = false;
    this.parallelBranches = [];
    this.parallelBranchIndex = 0;
    this.parallelBranchesCompleted = new Set();
    this.parallelJoinNode = null;

    // Record join event if tracing
    if (this.config.recordTrace) {
      const event: ParallelEvent = {
        type: 'parallel',
        timestamp: Date.now(),
        action: 'join',
        nodeId: this.currentNode,
      };
      this.trace.events.push(event);
    }

    // Transition to next node without returning join event
    return this.transitionToNext();
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
    const initialNode = this.cfg.nodes.find(n => n.type === 'initial');
    if (!initialNode) {
      throw new Error('CFG has no initial node');
    }

    this.currentNode = initialNode.id;
    this.visitedNodes = [initialNode.id];
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
