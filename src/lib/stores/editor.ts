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

// Mock parse action (for UI testing)
export function mockParse(content: string) {
  parseStatus.set('parsing');
  parseError.set(null);

  // Simulate async parsing
  setTimeout(() => {
    if (content.trim().length === 0) {
      parseStatus.set('error');
      parseError.set('Empty protocol');
      return;
    }

    // Mock success
    parseStatus.set('success');

    // Mock verification results
    verificationResult.set({
      deadlockFree: true,
      livenessSatisfied: true,
      safetySatisfied: true,
      warnings: [],
      errors: []
    });

    // Mock projection data
    projectionData.set([
      {
        role: 'Client',
        states: ['S0', 'S1', 'S2'],
        transitions: [
          { from: 'S0', to: 'S1', label: 'send Request' },
          { from: 'S1', to: 'S2', label: 'recv Response' }
        ]
      },
      {
        role: 'Server',
        states: ['S0', 'S1', 'S2'],
        transitions: [
          { from: 'S0', to: 'S1', label: 'recv Request' },
          { from: 'S1', to: 'S2', label: 'send Response' }
        ]
      }
    ]);

    // Mock generated TypeScript code
    generatedCode.set({
      Client: `// Generated TypeScript for Client role
export class ClientProtocol {
  private state: 'S0' | 'S1' | 'S2' = 'S0';

  async sendRequest(data: string): Promise<void> {
    if (this.state !== 'S0') {
      throw new Error('Invalid state for sendRequest');
    }
    // Send request to Server
    this.state = 'S1';
  }

  async recvResponse(): Promise<number> {
    if (this.state !== 'S1') {
      throw new Error('Invalid state for recvResponse');
    }
    // Receive response from Server
    this.state = 'S2';
    return 42; // Mock response
  }
}`,
      Server: `// Generated TypeScript for Server role
export class ServerProtocol {
  private state: 'S0' | 'S1' | 'S2' = 'S0';

  async recvRequest(): Promise<string> {
    if (this.state !== 'S0') {
      throw new Error('Invalid state for recvRequest');
    }
    // Receive request from Client
    this.state = 'S1';
    return 'request data'; // Mock request
  }

  async sendResponse(result: number): Promise<void> {
    if (this.state !== 'S1') {
      throw new Error('Invalid state for sendResponse');
    }
    // Send response to Client
    this.state = 'S2';
  }
}`
    });
  }, 500);
}
