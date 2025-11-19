/**
 * Versioned CFSM Runtime Support
 *
 * Implements data structures and utilities for updatable CFSM execution.
 * Based on Castro-Perez & Yoshida (ECOOP 2023), Section 3.2.
 *
 * Key concepts:
 * - VersionedCFSM: A specific version of a CFSM for a role
 * - CFSMVersionRegistry: Tracks all versions of all CFSMs
 * - CFSMUpdate: Descriptor for protocol updates (continue-with)
 */

import type { CFSM, CFSMTransition } from '../projection/types';

// ============================================================================
// CFSM Validation Utilities (Phase 1: Critical Safety)
// ============================================================================

/**
 * Validate CFSM well-formedness
 *
 * Checks that a CFSM has valid structure:
 * - Non-empty states
 * - Valid initial state
 * - Valid terminal states
 * - All transitions reference existing states
 *
 * @param cfsm - CFSM to validate
 * @throws Error if CFSM is malformed
 */
export function validateCFSM(cfsm: CFSM): void {
  if (!cfsm) {
    throw new Error('CFSM cannot be null or undefined');
  }

  // Check states
  if (!cfsm.states || cfsm.states.length === 0) {
    throw new Error('CFSM must have at least one state');
  }

  const stateIds = new Set(cfsm.states.map(s => s.id));

  // Check initial state
  if (!cfsm.initialState) {
    throw new Error('CFSM must have an initial state');
  }

  if (!stateIds.has(cfsm.initialState)) {
    throw new Error(
      `Initial state "${cfsm.initialState}" does not exist in states [${Array.from(stateIds).join(', ')}]`
    );
  }

  // Check terminal states
  if (cfsm.terminalStates) {
    for (const terminal of cfsm.terminalStates) {
      if (!stateIds.has(terminal)) {
        throw new Error(
          `Terminal state "${terminal}" does not exist in states [${Array.from(stateIds).join(', ')}]`
        );
      }
    }
  }

  // Check transitions
  if (cfsm.transitions) {
    for (const trans of cfsm.transitions) {
      if (!stateIds.has(trans.from)) {
        throw new Error(
          `Transition "${trans.id}" has invalid 'from' state "${trans.from}"`
        );
      }
      if (!stateIds.has(trans.to)) {
        throw new Error(
          `Transition "${trans.id}" has invalid 'to' state "${trans.to}"`
        );
      }
    }
  }
}

/**
 * Validate recursion variable
 *
 * @param recursionVar - Recursion variable name
 * @throws Error if invalid
 */
export function validateRecursionVar(recursionVar: string): void {
  if (recursionVar === null || recursionVar === undefined) {
    throw new Error('Recursion variable cannot be null or undefined');
  }

  if (typeof recursionVar !== 'string') {
    throw new Error('Recursion variable must be a string');
  }

  if (recursionVar.trim().length === 0) {
    throw new Error('Recursion variable cannot be empty');
  }
}

/**
 * Validate update descriptor
 *
 * @param update - CFSM update descriptor
 * @throws Error if invalid
 */
export function validateUpdate(update: CFSMUpdate): void {
  if (!update) {
    throw new Error('Update cannot be null or undefined');
  }

  if (!update.protocolName || update.protocolName.trim().length === 0) {
    throw new Error('Update must have a non-empty protocol name');
  }

  if (!update.roleName || update.roleName.trim().length === 0) {
    throw new Error('Update must have a non-empty role name');
  }

  if (!update.recursionVar || update.recursionVar.trim().length === 0) {
    throw new Error('Update must have a non-empty recursion variable');
  }

  if (!update.extension) {
    throw new Error('Update must have an extension CFSM');
  }

  if (update.targetVersion < 1) {
    throw new Error('Update target version must be >= 1');
  }

  // Validate extension CFSM structure
  validateCFSM(update.extension);

  // Validate role name matches extension role
  if (update.extension.role !== update.roleName) {
    throw new Error(
      `Role name mismatch: update specifies role "${update.roleName}" ` +
      `but extension CFSM has role "${update.extension.role}"`
    );
  }
}

/**
 * Versioned CFSM entry
 *
 * Tracks a specific version of a CFSM for a role.
 * Multiple versions can coexist during protocol evolution.
 *
 * @example
 * // Version 1: Original CFSM
 * { version: 1, cfsm: originalCFSM, createdAt: 1234567890 }
 *
 * // Version 2: Extended via continue-with
 * { version: 2, cfsm: extendedCFSM, parentVersion: 1, extension: extensionCFSM, createdAt: 1234567900 }
 */
export interface VersionedCFSM {
  version: number;              // Version number (increments on update)
  cfsm: CFSM;                   // The actual CFSM
  parentVersion?: number;       // Version this extends (for continue-with)
  extension?: CFSM;             // Extension added via continue-with
  createdAt: number;            // Timestamp
}

/**
 * CFSM version registry
 *
 * Stores all versions of all CFSMs in a protocol.
 * Key format: `${protocolName}:${roleName}`
 *
 * @example
 * {
 *   versions: Map([
 *     ["TaskDistribution:Coordinator", [v1, v2, v3]],
 *     ["TaskDistribution:Worker", [v1, v2, v3]]
 *   ]),
 *   activeVersion: Map([
 *     ["TaskDistribution:Coordinator", 2],
 *     ["TaskDistribution:Worker", 2]
 *   ])
 * }
 */
export interface CFSMVersionRegistry {
  versions: Map<string, VersionedCFSM[]>;  // All versions per role
  activeVersion: Map<string, number>;      // Current version per role
}

/**
 * CFSM update descriptor
 *
 * Describes a protocol update to be applied.
 * Created when `continue X with { G }` is executed.
 */
export interface CFSMUpdate {
  protocolName: string;
  roleName: string;
  recursionVar: string;         // Which recursion point (e.g., "X")
  extension: CFSM;              // New behavior to add
  targetVersion: number;        // Version to extend
}

/**
 * Updateable recursion variable metadata
 *
 * Tracks recursion points that can be updated via continue-with.
 */
export interface UpdateableRecursionVar {
  name: string;                 // Recursion variable name (e.g., "X")
  entryState: string;           // State where recursion begins
  returnState: string;          // State where continue returns to
  protocol: string;             // Protocol name
}

/**
 * Create a new CFSM version registry
 *
 * @returns Empty registry
 */
export function createVersionRegistry(): CFSMVersionRegistry {
  return {
    versions: new Map(),
    activeVersion: new Map(),
  };
}

/**
 * Register initial CFSM version
 *
 * Called during simulator initialization to register v1 of each CFSM.
 *
 * @param registry - Version registry
 * @param protocolName - Protocol name
 * @param roleName - Role name
 * @param cfsm - Initial CFSM
 * @returns Version number (always 1 for initial)
 */
export function registerInitialVersion(
  registry: CFSMVersionRegistry,
  protocolName: string,
  roleName: string,
  cfsm: CFSM
): number {
  const key = `${protocolName}:${roleName}`;

  const versionedCFSM: VersionedCFSM = {
    version: 1,
    cfsm,
    createdAt: Date.now(),
  };

  registry.versions.set(key, [versionedCFSM]);
  registry.activeVersion.set(key, 1);

  return 1;
}

/**
 * Register a CFSM update
 *
 * Called when `continue X with { G }` is executed.
 * Creates a new version by extending the target version.
 *
 * @param registry - Version registry
 * @param update - Update descriptor
 * @returns New version number
 */
export function registerCFSMUpdate(
  registry: CFSMVersionRegistry,
  update: CFSMUpdate
): number {
  // Validate update descriptor (Phase 1: Critical Safety)
  validateUpdate(update);

  const key = `${update.protocolName}:${update.roleName}`;

  // Get existing versions
  const versions = registry.versions.get(key);
  if (!versions || versions.length === 0) {
    throw new Error(`Protocol/role not found: ${key}`);
  }

  // Get target version
  const targetVersioned = versions.find(v => v.version === update.targetVersion);
  if (!targetVersioned) {
    throw new Error(`Version ${update.targetVersion} not found for ${key}`);
  }

  // Create extended CFSM
  const extendedCFSM = extendCFSM(
    targetVersioned.cfsm,
    update.extension,
    update.recursionVar
  );

  // Create new version
  const newVersion = versions.length + 1;
  const newVersioned: VersionedCFSM = {
    version: newVersion,
    cfsm: extendedCFSM,
    parentVersion: update.targetVersion,
    extension: update.extension,
    createdAt: Date.now(),
  };

  // Register new version
  versions.push(newVersioned);
  registry.activeVersion.set(key, newVersion);

  return newVersion;
}

/**
 * Get active CFSM version
 *
 * @param registry - Version registry
 * @param protocolName - Protocol name
 * @param roleName - Role name
 * @returns Active versioned CFSM, or undefined if not found
 */
export function getActiveVersion(
  registry: CFSMVersionRegistry,
  protocolName: string,
  roleName: string
): VersionedCFSM | undefined {
  const key = `${protocolName}:${roleName}`;

  const activeVersionNum = registry.activeVersion.get(key);
  if (!activeVersionNum) {
    return undefined;
  }

  const versions = registry.versions.get(key);
  if (!versions) {
    return undefined;
  }

  return versions.find(v => v.version === activeVersionNum);
}

/**
 * Get specific CFSM version
 *
 * @param registry - Version registry
 * @param protocolName - Protocol name
 * @param roleName - Role name
 * @param version - Version number
 * @returns Versioned CFSM, or undefined if not found
 */
export function getVersion(
  registry: CFSMVersionRegistry,
  protocolName: string,
  roleName: string,
  version: number
): VersionedCFSM | undefined {
  const key = `${protocolName}:${roleName}`;
  const versions = registry.versions.get(key);
  if (!versions) {
    return undefined;
  }
  return versions.find(v => v.version === version);
}

/**
 * Create extended CFSM
 *
 * Combines original CFSM with extension.
 * Pattern: extension ; original (extension runs, then original)
 *
 * Implementation strategy:
 * 1. Find recursion point in original CFSM
 * 2. Insert extension states before recursion point
 * 3. Redirect transitions to route through extension
 * 4. Connect extension terminal to original recursion point
 *
 * @param original - Base CFSM
 * @param extension - Extension CFSM
 * @param recursionVar - Recursion variable name (for state identification)
 * @returns New CFSM with extension integrated
 */
export function extendCFSM(
  original: CFSM,
  extension: CFSM,
  recursionVar: string
): CFSM {
  // Phase 1: Critical Safety - Validate inputs
  validateCFSM(original);
  validateCFSM(extension);
  validateRecursionVar(recursionVar);

  // Strategy: Create a new CFSM that sequences extension before original
  //
  // Original CFSM:
  //   S0 -> S1 -> S2(rec X) -> S3 -> S2
  //
  // Extension CFSM:
  //   E0 -> E1 -> E2(terminal)
  //
  // Extended CFSM:
  //   S0 -> S1 -> E0 -> E1 -> E2 -> S2 -> S3 -> S2

  // Find recursion point in original
  // Convention: Recursion points have state IDs containing the recursion var
  const recursionState = original.states.find(s =>
    s.id.includes(recursionVar)
  );

  if (!recursionState) {
    throw new Error(
      `Recursion variable "${recursionVar}" not found in CFSM. ` +
      `Available states: [${original.states.map(s => s.id).join(', ')}]`
    );
  }

  // Create unique state IDs for extension
  const stateIdMap = new Map<string, string>();
  const extStates = extension.states.map(state => {
    const newId = `ext_${state.id}_${Date.now()}`;
    stateIdMap.set(state.id, newId);
    return { ...state, id: newId };
  });

  // Remap extension transitions
  const extTransitions: CFSMTransition[] = extension.transitions.map(trans => ({
    ...trans,
    from: stateIdMap.get(trans.from)!,
    to: stateIdMap.get(trans.to)!,
  }));

  // Find extension terminal states
  const extTerminals = extension.terminalStates.map(t => stateIdMap.get(t)!);

  // Redirect transitions to recursion point -> go through extension first
  const originalTransitions = original.transitions.map(trans => {
    // If transition goes TO recursion point, redirect to extension entry
    if (trans.to === recursionState.id && trans.from !== recursionState.id) {
      return {
        ...trans,
        to: stateIdMap.get(extension.initialState)!,
      };
    }
    return trans;
  });

  // Connect extension terminals to recursion point
  const bridgeTransitions: CFSMTransition[] = extTerminals.map((terminal, idx) => ({
    id: `bridge_${idx}_${Date.now()}`,
    from: terminal,
    to: recursionState.id,
    action: { type: 'tau' as const },
  }));

  // Combine everything
  const result: CFSM = {
    role: original.role,
    protocolName: original.protocolName,
    parameters: original.parameters,
    states: [...original.states, ...extStates],
    transitions: [...originalTransitions, ...extTransitions, ...bridgeTransitions],
    initialState: original.initialState,
    terminalStates: original.terminalStates,
  };

  // Phase 1: Critical Safety - Validate output
  validateCFSM(result);

  return result;
}

/**
 * Get version history
 *
 * Returns all versions for a role in chronological order.
 *
 * @param registry - Version registry
 * @param protocolName - Protocol name
 * @param roleName - Role name
 * @returns Array of versioned CFSMs (oldest first)
 */
export function getVersionHistory(
  registry: CFSMVersionRegistry,
  protocolName: string,
  roleName: string
): VersionedCFSM[] {
  const key = `${protocolName}:${roleName}`;
  return registry.versions.get(key) || [];
}
