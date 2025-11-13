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
    // Dynamic import to avoid circular dependencies
    const { ScribbleParser } = await import('../../core/parser/parser');
    const { CFGBuilder } = await import('../../core/cfg/builder');
    const { Verifier } = await import('../../core/verification/verifier');

    // 1. Parse Scribble
    const parser = new ScribbleParser();
    const ast = parser.parse(content);

    if (!ast || ast.type !== 'GlobalProtocol') {
      throw new Error('Expected global protocol');
    }

    // 2. Build CFG
    const builder = new CFGBuilder();
    const cfg = builder.build(ast as any);

    // 3. Verify protocol
    const verifier = new Verifier();
    const result = verifier.verify(cfg);

    // 4. Project to CFSMs (Phase 2)
    const { Projector } = await import('../../core/projection/projector');
    const projector = new Projector();
    const cfsms = projector.project(cfg);

    // Extract roles from AST
    const globalProtocol = ast as any;
    const roles = globalProtocol.roles?.map((r: any) => r.name) || [];

    // 5. Update stores
    parseStatus.set('success');
    verificationResult.set({
      deadlockFree: !result.errors.some(e => e.includes('deadlock')),
      livenessSatisfied: !result.errors.some(e => e.includes('liveness')),
      safetySatisfied: result.errors.length === 0,
      warnings: result.warnings,
      errors: result.errors
    });

    // Update projection data
    projectionData.set(
      roles.map((role: string) => {
        const cfsm = cfsms[role];
        if (!cfsm) {
          return {
            role,
            states: [],
            transitions: []
          };
        }

        return {
          role,
          states: Object.keys(cfsm.states),
          transitions: Object.entries(cfsm.states).flatMap(([from, state]) =>
            state.transitions.map((t: any) => ({
              from,
              to: t.target,
              label: t.action?.label || t.action?.kind || 'τ'
            }))
          )
        };
      })
    );

    // TODO: 6. Generate TypeScript (future)

    return { success: true, cfg, ast, cfsms };
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
