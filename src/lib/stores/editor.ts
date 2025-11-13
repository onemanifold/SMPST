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
export const parseStatus = writable<ParseStatus>('idle');
export const parseError = writable<string | null>(null);

// Mock verification results (for UI demonstration)
export interface VerificationResult {
  deadlockFree: boolean;
  livenessSatisfied: boolean;
  safetySatisfied: boolean;
  warnings: string[];
  errors: string[];
}

export const verificationResult = writable<VerificationResult | null>(null);

// Mock projection data (for UI demonstration)
export interface ProjectionData {
  role: string;
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    label: string;
  }>;
}

export const projectionData = writable<ProjectionData[]>([]);

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

// Actions
export function setEditorContent(content: string) {
  editorContent.set(content);
  parseStatus.set('idle');
  parseError.set(null);
}

export function loadExample(example: ProtocolExample) {
  selectedExample.set(example);
  editorContent.set(example.code);
  parseStatus.set('idle');
  parseError.set(null);
}

export function clearEditor() {
  editorContent.set('');
  selectedExample.set(null);
  parseStatus.set('idle');
  parseError.set(null);
  verificationResult.set(null);
  projectionData.set([]);
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

    // 1. Parse Scribble
    const ast = parse(content);

    if (!ast || ast.type !== 'GlobalProtocol') {
      throw new Error('Expected global protocol');
    }

    // 2. Build CFG
    const cfg = buildCFG(ast as any);

    // 3. Verify protocol
    const result = verifyProtocol(cfg);

    // 4. Project to CFSMs
    const projectionResult = projectAll(cfg);

    // Extract roles from projection result
    const roles = projectionResult.roles;

    // 5. Collect errors and warnings from verification
    const errors: string[] = [];
    const warnings: string[] = [];

    // Deadlock
    if (result.deadlock.hasDeadlock) {
      errors.push(`Deadlock detected: ${result.deadlock.cycles.length} cycle(s)`);
    }

    // Liveness
    if (!result.liveness.isLive) {
      errors.push(`Liveness violated: ${result.liveness.violations.length} violation(s)`);
    }

    // Parallel deadlock
    if (result.parallelDeadlock.hasDeadlock) {
      errors.push(`Parallel deadlock detected: ${result.parallelDeadlock.conflicts.length} conflict(s)`);
    }

    // Race conditions
    if (result.raceConditions.hasRaces) {
      warnings.push(`Race conditions detected: ${result.raceConditions.races.length} race(s)`);
    }

    // Progress
    if (!result.progress.canProgress) {
      errors.push(`Progress not satisfied: ${result.progress.blockedNodes.length} blocked node(s)`);
    }

    // Choice determinism
    if (!result.choiceDeterminism.isDeterministic) {
      errors.push(`Choice non-determinism: ${result.choiceDeterminism.violations.length} violation(s)`);
    }

    // Multicast warnings
    if (result.multicast && result.multicast.warnings.length > 0) {
      result.multicast.warnings.forEach(w => warnings.push(`Multicast: ${w.message}`));
    }

    // 6. Update stores
    parseStatus.set('success');
    verificationResult.set({
      deadlockFree: !result.deadlock.hasDeadlock,
      livenessSatisfied: result.liveness.isLive,
      safetySatisfied: errors.length === 0,
      warnings,
      errors
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

    // Update projection data
    projectionData.set(
      roles.map((role: string) => {
        const cfsm = projectionResult.cfsms.get(role);
        if (!cfsm) {
          return {
            role,
            states: [],
            transitions: []
          };
        }

        return {
          role,
          states: cfsm.states.map(s => s.id),
          transitions: cfsm.transitions.map(t => ({
            from: t.from,
            to: t.to,
            label: formatActionLabel(t.action)
          }))
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
    parseError.set(message);
    return { success: false, error: message };
  }
}

// Keep mock for backward compatibility (can be removed later)
export function mockParse(content: string) {
  parseProtocol(content);
}
