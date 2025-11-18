/**
 * Svelte stores for IDE state management
 */
import { writable, derived } from 'svelte/store';
import type { ProtocolExample } from '../data/examples';

// Editor state
export const editorContent = writable<string>('');
export const selectedExample = writable<ProtocolExample | null>(null);

// UI state
export const activeTab = writable<'verification' | 'projection' | 'errors'>('verification');
export const libraryOpen = writable<boolean>(true);
export const visualizerOpen = writable<boolean>(true);
export const outputPanelCollapsed = writable<boolean>(false);

// View mode: 'global' shows CFG, role names show CFSM for that role
export type ViewMode = 'global' | string; // 'global' or role name
export const viewMode = writable<ViewMode>('global');

// Editor view mode: Scribble protocol or generated TypeScript
export type EditorView = 'scribble' | 'typescript';
export const editorView = writable<EditorView>('scribble');

// Generated TypeScript code per role
export const generatedCode = writable<Record<string, string>>({});

// Parse state
export type ParseStatus = 'idle' | 'parsing' | 'success' | 'error';

// Parse error with optional location information for precise error highlighting
export interface ParseErrorInfo {
  message: string;
  location?: {
    line: number;
    column: number;
  };
}

export const parseStatus = writable<ParseStatus>('idle');
export const parseError = writable<ParseErrorInfo | null>(null);

// Complete verification results (ALL 16 checks from backend)
export interface VerificationCheckResult {
  valid: boolean;
  issues: string[];
}

export interface VerificationResult {
  // Original properties (backward compatible)
  deadlockFree: boolean;
  livenessSatisfied: boolean;
  safetySatisfied: boolean;
  warnings: string[];
  errors: string[];

  // ALL 16 verification checks (comprehensive backend contract)
  structural: VerificationCheckResult;
  deadlock: VerificationCheckResult;
  liveness: VerificationCheckResult;
  parallelDeadlock: VerificationCheckResult;
  raceConditions: VerificationCheckResult;
  progress: VerificationCheckResult;
  choiceDeterminism: VerificationCheckResult;
  choiceMergeability: VerificationCheckResult;
  connectedness: VerificationCheckResult;
  nestedRecursion: VerificationCheckResult;
  recursionInParallel: VerificationCheckResult;
  forkJoinStructure: VerificationCheckResult;
  multicast: VerificationCheckResult;
  selfCommunication: VerificationCheckResult;
  emptyChoiceBranch: VerificationCheckResult;
  mergeReachability: VerificationCheckResult;
}

export const verificationResult = writable<VerificationResult | null>(null);

// Projection data with serialized local protocols
export interface ProjectionData {
  role: string;
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    label: string;
  }>;
  // Serialized Scribble local protocol text
  localProtocol: string;
}

export const projectionData = writable<ProjectionData[]>([]);

// Projection errors (from projectAll)
export interface ProjectionErrorInfo {
  role: string;
  message: string;
  nodeId?: string;
  phase?: 'merging' | 'continuation' | 'projection';
}

export const projectionErrors = writable<ProjectionErrorInfo[]>([]);

// Mock simulation state
export interface SimulationState {
  running: boolean;
  step: number;
  maxSteps: number;
  currentRoleStates: Record<string, string>;
  messageQueue: Array<{
    from: string;
    to: string;
    label: string;
  }>;
}

export const simulationState = writable<SimulationState>({
  running: false,
  step: 0,
  maxSteps: 100,
  currentRoleStates: {},
  messageQueue: []
});

// Derived stores
export const hasErrors = derived(
  parseError,
  $parseError => $parseError !== null
);

export const canSimulate = derived(
  [parseStatus, verificationResult],
  ([$parseStatus, $verificationResult]) =>
    $parseStatus === 'success' && $verificationResult?.deadlockFree === true
);

export const hasProjectionErrors = derived(
  projectionErrors,
  $errors => $errors.length > 0
);

// Actions
export function setEditorContent(content: string) {
  editorContent.set(content);
  parseStatus.set('idle');
  parseError.set(null);
}

export async function loadExample(example: ProtocolExample) {
  selectedExample.set(example);
  editorContent.set(example.code);
  parseStatus.set('idle');
  parseError.set(null);

  // Automatically parse the protocol
  // This ensures parsing happens even when editor is not mounted (e.g., in simulation tab)
  await parseProtocol(example.code);
}

export function clearEditor() {
  editorContent.set('');
  selectedExample.set(null);
  parseStatus.set('idle');
  parseError.set(null);
  verificationResult.set(null);
  projectionData.set([]);
  projectionErrors.set([]);
}

// Real parse action (integrates parser, CFG builder, verifier)
export async function parseProtocol(content: string) {
  parseStatus.set('parsing');
  parseError.set(null);

  try {
    // Dynamic imports
    const { parse } = await import('../../core/parser/parser');
    const { buildCFG } = await import('../../core/cfg/builder');
    const { verifyProtocol } = await import('../../core/verification/verifier');
    const { projectAll } = await import('../../core/projection/projector');
    const { serializeCFSM } = await import('../../core/serializer/cfsm-serializer');

    // 1. Parse Scribble
    const ast = parse(content);

    if (!ast || ast.type !== 'Module') {
      throw new Error('Expected module from parser');
    }

    if (!ast.declarations || ast.declarations.length === 0) {
      throw new Error('No protocol declarations found');
    }

    const protocol = ast.declarations[0];
    if (protocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol declaration');
    }

    // 2. Build CFG
    const cfg = buildCFG(protocol);

    // 3. Verify protocol
    const result = verifyProtocol(cfg);

    // 4. Project to CFSMs
    const projectionResult = projectAll(cfg);

    // Extract roles from projection result
    const roles = projectionResult.roles;

    // 5. Extract ALL verification issues using contract handler
    const { extractVerificationIssues, handleProjectionResult, formatProjectionErrors } = await import('./contracts/editor-contract');
    const issues = extractVerificationIssues(result);

    // Combine errors, warnings, and critical issues
    const allErrors = [...issues.errors, ...issues.criticalIssues];
    const allWarnings = [...issues.warnings];

    // 4b. Handle projection errors using contract handler
    handleProjectionResult(projectionResult, {
      onSuccess: (result) => {
        // All roles projected successfully - clear any previous errors
        projectionErrors.set([]);
      },
      onPartialFailure: (result, errors) => {
        // Some roles failed to project - expose errors
        const formattedErrors = formatProjectionErrors(errors);
        projectionErrors.set(errors.map(err => ({
          role: err.role || 'unknown',
          message: err.message,
          nodeId: err.nodeId,
          phase: err.phase
        })));

        // Also add to warnings so users see them
        allWarnings.push(...formattedErrors);
      }
    });

    // 6. Update stores with COMPLETE verification results
    parseStatus.set('success');
    verificationResult.set({
      // Original properties (backward compatible)
      deadlockFree: !result.deadlock.hasDeadlock,
      livenessSatisfied: result.liveness.isLive,
      safetySatisfied: allErrors.length === 0,
      warnings: allWarnings,
      errors: allErrors,

      // ALL 16 verification checks (comprehensive)
      structural: {
        valid: issues.allChecks.structural,
        issues: issues.allChecks.structural ? [] : ['Structural validity check failed']
      },
      deadlock: {
        valid: issues.allChecks.deadlock,
        issues: issues.allChecks.deadlock ? [] : [`Deadlock detected: ${result.deadlock.cycles.length} cycle(s)`]
      },
      liveness: {
        valid: issues.allChecks.liveness,
        issues: issues.allChecks.liveness ? [] : [`Liveness violated: ${result.liveness.violations.length} violation(s)`]
      },
      parallelDeadlock: {
        valid: issues.allChecks.parallelDeadlock,
        issues: issues.allChecks.parallelDeadlock ? [] : [`Parallel deadlock: ${result.parallelDeadlock.conflicts.length} conflict(s)`]
      },
      raceConditions: {
        valid: issues.allChecks.raceConditions,
        issues: issues.allChecks.raceConditions ? [] : [`Race conditions: ${result.raceConditions.races.length} race(s)`]
      },
      progress: {
        valid: issues.allChecks.progress,
        issues: issues.allChecks.progress ? [] : [`Progress blocked: ${result.progress.blockedNodes.length} node(s)`]
      },
      choiceDeterminism: {
        valid: issues.allChecks.choiceDeterminism,
        issues: issues.allChecks.choiceDeterminism ? [] : [`Non-deterministic choice: ${result.choiceDeterminism.violations.length} violation(s)`]
      },
      choiceMergeability: {
        valid: issues.allChecks.choiceMergeability,
        issues: issues.allChecks.choiceMergeability ? [] : [`Choice branches inconsistent: ${result.choiceMergeability.violations?.length || 0} violation(s)`]
      },
      connectedness: {
        valid: issues.allChecks.connectedness,
        issues: issues.allChecks.connectedness ? [] : [`Protocol not connected: ${result.connectedness.disconnectedRoles?.length || 0} role(s) orphaned`]
      },
      nestedRecursion: {
        valid: issues.allChecks.nestedRecursion,
        issues: issues.allChecks.nestedRecursion ? [] : [`Recursion scope violation: ${result.nestedRecursion.violations?.length || 0} violation(s)`]
      },
      recursionInParallel: {
        valid: issues.allChecks.recursionInParallel,
        issues: issues.allChecks.recursionInParallel ? [] : [`Recursion crosses parallel boundary: ${result.recursionInParallel.violations?.length || 0} violation(s)`]
      },
      forkJoinStructure: {
        valid: issues.allChecks.forkJoinStructure,
        issues: issues.allChecks.forkJoinStructure ? [] : [`Fork-join mismatch: ${result.forkJoinStructure.violations?.length || 0} violation(s)`]
      },
      multicast: {
        valid: issues.allChecks.multicast,
        issues: issues.allChecks.multicast ? [] : result.multicast.warnings.map(w => `Multicast: ${w.message}`)
      },
      selfCommunication: {
        valid: issues.allChecks.selfCommunication,
        issues: issues.allChecks.selfCommunication ? [] : [`Self-communication: ${result.selfCommunication.violations?.length || 0} violation(s)`]
      },
      emptyChoiceBranch: {
        valid: issues.allChecks.emptyChoiceBranch,
        issues: issues.allChecks.emptyChoiceBranch ? [] : [`Empty choice branches: ${result.emptyChoiceBranch.violations?.length || 0} branch(es)`]
      },
      mergeReachability: {
        valid: issues.allChecks.mergeReachability,
        issues: issues.allChecks.mergeReachability ? [] : [`Unreachable merge: ${result.mergeReachability.violations?.length || 0} violation(s)`]
      }
    });

    // Helper to format CFSM action as display label
    const formatActionLabel = (action: any): string => {
      if (!action) return 'τ';

      switch (action.type) {
        case 'send':
          return `send ${action.label || ''}`;
        case 'receive':
          return `recv ${action.label || ''}`;
        case 'tau':
          return 'τ';
        case 'choice':
          return `choice ${action.branch || ''}`;
        default:
          return action.label || action.type || 'τ';
      }
    };

    // Update projection data with serialized local protocols
    projectionData.set(
      roles.map((role: string) => {
        const cfsm = projectionResult.cfsms.get(role);
        if (!cfsm) {
          return {
            role,
            states: [],
            transitions: [],
            localProtocol: `// No projection for role ${role}`
          };
        }

        // Serialize CFSM to Scribble local protocol text
        const localProtocol = serializeCFSM(cfsm);

        return {
          role,
          states: cfsm.states.map(s => s.id),
          transitions: cfsm.transitions.map(t => ({
            from: t.from,
            to: t.to,
            label: formatActionLabel(t.action)
          })),
          localProtocol
        };
      })
    );

    // 6. Initialize simulation with CFG
    const { initializeSimulation } = await import('./simulation');
    await initializeSimulation(cfg);

    // TODO: 7. Generate TypeScript (future)

    return { success: true, cfg, ast, cfsms: projectionResult.cfsms };
  } catch (error) {
    parseStatus.set('error');
    const message = error instanceof Error ? error.message : String(error);

    // Extract location information from error message if available
    // Parser errors format: "Parser error at line X, column Y: message"
    // Lexer errors format: "Lexer error at line X, column Y: message"
    const locationMatch = message.match(/at line (\d+), column (\d+):/);
    const errorInfo: ParseErrorInfo = {
      message,
      location: locationMatch ? {
        line: parseInt(locationMatch[1], 10),
        column: parseInt(locationMatch[2], 10)
      } : undefined
    };

    parseError.set(errorInfo);
    return { success: false, error: message };
  }
}

// Keep mock for backward compatibility (can be removed later)
export function mockParse(content: string) {
  parseProtocol(content);
}
