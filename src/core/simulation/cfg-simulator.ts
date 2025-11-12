/**
 * CFG Simulator (Orchestration-based)
 *
 * Centralized execution from global CFG - represents the "choreographer's view"
 * where a global coordinator orchestrates all protocol actions.
 *
 * ============================================================================
 * ASSUMPTIONS (What the Verifier Guarantees)
 * ============================================================================
 *
 * This simulator ASSUMES the CFG has been VERIFIED and is CORRECT.
 * The verifier (Layer 3) guarantees:
 *
 * 1. **Structural Correctness**:
 *    - All nodes reachable from initial node
 *    - All paths lead to terminal or recursion
 *    - Fork-join pairs properly matched
 *    - No orphaned nodes or edges
 *
 * 2. **Deadlock Freedom**:
 *    - No cycles (except recursion via continue edges)
 *    - No parallel deadlocks (role sending in multiple branches)
 *    - No circular dependencies between parallel branches
 *
 * 3. **Choice Correctness**:
 *    - All choice branches are deterministic (distinguishable by first message)
 *    - All choice branches are mergeable (consistent role participation)
 *    - All branches converge at merge node
 *
 * 4. **Role Connectivity**:
 *    - All declared roles participate in protocol
 *    - No orphaned roles
 *
 * 5. **Recursion Well-Formedness**:
 *    - All continue statements target valid rec labels
 *    - Nested recursion properly scoped
 *    - No recursion spanning parallel boundaries
 *
 * If any of these properties are violated, the verifier will REJECT the CFG
 * before it reaches the simulator.
 *
 * ============================================================================
 * GUARANTEES (What the Simulator Promises)
 * ============================================================================
 *
 * Given a verified CFG, this simulator guarantees:
 *
 * 1. **Faithful Execution**:
 *    - Executes CFG exactly as specified by Scribble semantics
 *    - One step() = one protocol-level action (message/choice/fork/join)
 *    - Total order of events (global choreography view)
 *
 * 2. **Complete State Tracking**:
 *    - currentNode always valid and in CFG
 *    - visitedNodes monotonically increasing (except reset)
 *    - Recursion stack properly maintained
 *
 * 3. **Termination**:
 *    - Either completes successfully (reaches terminal)
 *    - Or hits maxSteps limit (for bounded recursion testing)
 *    - Never infinite loops without recursion
 *
 * 4. **Event Emission**:
 *    - Every protocol action emits corresponding event
 *    - Events in causal order
 *    - No missed or duplicate events
 *
 * 5. **Execution Model**:
 *    - Synchronous orchestration (centralized coordinator)
 *    - Parallel branches execute in interleaved order
 *    - No message buffers (atomic delivery)
 *
 * ============================================================================
 * Key Principle
 * ============================================================================
 *
 * The simulator IS the operational semantics of the global CFG.
 * If a protocol executes here without errors, the global choreography is valid.
 *
 * Note: This does NOT test distributed execution semantics (async, buffers, etc.)
 * That is the job of the CFSM-based distributed simulator (Layer 5).
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
  SimulatorEventType,
  EventCallback,
  EnhancedChoiceOption,
  ActionPreview,
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

  // Event subscription system
  private listeners: Map<SimulatorEventType, Set<EventCallback>> = new Map();

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
    // Emit step-start event
    this.emit('step-start', { stepCount: this.stepCount, currentNode: this.currentNode });

    // Check if already completed
    if (this.completed) {
      const error = {
        type: 'already-completed' as const,
        message: 'Protocol execution already completed',
        nodeId: this.currentNode,
      };
      this.emit('error', error);
      return {
        success: false,
        error,
        state: this.getState(),
      };
    }

    // Check max steps
    if (this.stepCount >= this.config.maxSteps) {
      this.reachedMaxSteps = true;
      const error = {
        type: 'max-steps-reached' as const,
        message: `Maximum steps (${this.config.maxSteps}) reached`,
        nodeId: this.currentNode,
      };
      this.emit('error', error);
      return {
        success: false,
        error,
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
        const error = {
          type: 'choice-required' as const,
          message: 'At choice point - must call choose() before step()',
          nodeId: this.currentNode,
        };
        this.emit('error', error);
        return {
          success: false,
          error,
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

      // Emit step-end event
      this.emit('step-end', { stepCount: this.stepCount, result, state: this.getState() });

      return result;
    } catch (error) {
      const execError = {
        type: 'invalid-node' as const,
        message: error instanceof Error ? error.message : String(error),
        nodeId: this.currentNode,
      };
      this.emit('error', execError);
      return {
        success: false,
        error: execError,
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

      // Capture any event
      if (result.event) {
        lastEvent = result.event;
      }

      // After executing current node, check if we should stop
      const currentNode = this.getNode(this.currentNode);
      if (!currentNode) {
        return {
          success: false,
          error: {
            type: 'invalid-node',
            message: `Node ${this.currentNode} not found`,
            nodeId: this.currentNode,
          },
          state: this.getState(),
        };
      }

      // Stop if we have an event AND we're now at an action node
      // This prevents executing the same action multiple times in one step
      // (Branch nodes need to be executed to set up choice state, so don't stop at them)
      if (lastEvent && currentNode.type === 'action') {
        return {
          success: true,
          event: lastEvent,
          state: this.getState(),
        };
      }

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
            success: true,
            event: lastEvent,
            state: this.getState(),
          };
        }
      }

      // No event or structural node - continue looping to find the next action
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

    // Emit complete event
    this.emit('complete', {
      totalSteps: this.stepCount,
      completionTime: Date.now(),
    });

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

    // Emit message event for subscribers
    this.emit('message', {
      from: action.from,
      to: action.to,
      label: action.label,
      payloadType: action.payloadType,
      nodeId: node.id,
    });

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

      // Emit choice-selected event
      this.emit('choice-selected', {
        nodeId: node.id,
        role: node.at,
        choiceIndex,
      });

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
          decidingRole: node.at,
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

    // Emit choice-point event
    this.emit('choice-point', {
      nodeId: node.id,
      role: node.at,
      options: this.pendingChoice,
    });

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

      // Emit recursion-enter event
      this.emit('recursion-enter', {
        label: node.label,
        nodeId: node.id,
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
      // With correct CFG: only exit when maxSteps reached
      // (Branches without 'continue' will never reach this recursive node)
      const shouldExit = this.stepCount >= this.config.maxSteps;

      if (shouldExit) {
        // Exit recursion due to maxSteps limit
        this.reachedMaxSteps = true;

        // Emit recursion-exit event
        this.emit('recursion-exit', {
          label: node.label,
          iteration: inStack.iterations,
          nodeId: node.id,
        });

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

        // Don't transition when exiting due to maxSteps
        // The protocol is incomplete, so stay at current node
        // (If we took the exit edge to terminal, it would incorrectly mark as completed)

        return {
          success: true,
          state: this.getState(),
        };
      } else {
        // Continue looping - take forward edge again

        // Emit recursion-continue event
        this.emit('recursion-continue', {
          label: node.label,
          iteration: inStack.iterations,
          nodeId: node.id,
        });

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

    // Emit fork event
    this.emit('fork', {
      nodeId: this.currentNode,
      branches: forkEdges.length,
      parallelId: (forkNode as any).parallel_id,
    });

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

    // Emit join event
    this.emit('join', {
      nodeId: this.currentNode,
    });

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
    // Emit node-exit for current node
    this.emit('node-exit', { nodeId: this.currentNode });

    // Transition
    this.currentNode = nodeId;
    this.visitedNodes.push(nodeId);

    // Emit node-enter for new node
    this.emit('node-enter', { nodeId: this.currentNode });

    // Note: state-change events are too low-level for the trace
    // Only protocol-level events (messages, choices, recursion, parallel) are recorded
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
   * Subscribe to simulator events
   * Returns unsubscribe function
   *
   * Example:
   * ```typescript
   * const unsubscribe = simulator.on('message', ({ from, to, label }) => {
   *   console.log(`${from} -> ${to}: ${label}`);
   * });
   *
   * // Later: unsubscribe()
   * ```
   */
  on(event: SimulatorEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from simulator events
   */
  off(event: SimulatorEventType, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: SimulatorEventType, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          // Swallow callback errors to prevent simulation disruption
          console.error(`Error in event callback for '${event}':`, error);
        }
      }
    }
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

    // Auto-advance to first meaningful state
    this.advanceToNextMeaningfulState();
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
