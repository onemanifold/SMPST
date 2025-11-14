/**
 * Golden Test Runner
 *
 * Implements snapshot-based regression testing for safe language evolution.
 *
 * This runner:
 * 1. Parses protocols
 * 2. Builds CFGs and snapshots them
 * 3. Verifies protocols and snapshots verification results
 * 4. Projects to CFSMs and snapshots them
 * 5. Serializes to local protocols and snapshots them
 * 6. Validates all snapshots match expected golden outputs
 * 7. Checks performance benchmarks
 *
 * Usage:
 *   const runner = new GoldenTestRunner('tests/golden');
 *   await runner.runGoldenTest('protocols/complex/two-buyer.scr', metadata);
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { verifyProtocol } from '../../src/core/verification/verifier';
import { projectAll } from '../../src/core/projection/projector';
import { serializeCFSM } from '../../src/core/serializer/cfsm-serializer';
import type { GlobalProtocolDeclaration } from '../../src/core/ast/types';
import type { CFG } from '../../src/core/cfg/types';
import type { CFSM } from '../../src/core/projection/types';
import type { CompleteVerification } from '../../src/core/verification/types';

// ============================================================================
// Types
// ============================================================================

export interface GoldenTestMetadata {
  name: string;
  description: string;
  category: string;
  expectedProperties: {
    roles: string[];
    hasDeadlock: boolean;
    hasRaces: boolean;
    messageCount: number;
    stateCount: Record<string, number>; // Per role
  };
  performance: {
    maxParseTimeMs: number;
    maxProjectionTimeMs: number;
  };
}

interface CFGSnapshot {
  nodeCount: number;
  edgeCount: number;
  roles: string[];
  protocolName: string;
  structureHash: string;
}

interface CFSMSnapshot {
  role: string;
  protocolName: string;
  stateCount: number;
  transitionCount: number;
  protocolActionCount: number;
  cfsm: CFSM;
}

// ============================================================================
// Golden Test Runner
// ============================================================================

export class GoldenTestRunner {
  private baseDir: string;
  private snapshotDir: string;
  private metadataDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.snapshotDir = path.join(baseDir, 'snapshots');
    this.metadataDir = path.join(baseDir, 'metadata');
  }

  /**
   * Run full golden test suite:
   * 1. Parse protocol
   * 2. Build CFG and snapshot
   * 3. Verify and snapshot results
   * 4. Project to CFSMs and snapshot
   * 5. Serialize to local protocols and snapshot
   * 6. Verify all snapshots match
   * 7. Check performance benchmarks
   */
  async runGoldenTest(
    protocolPath: string,
    metadata: GoldenTestMetadata
  ): Promise<void> {
    const fullPath = path.join(this.baseDir, protocolPath);
    const protocolName = path.basename(protocolPath, '.scr');
    const source = fs.readFileSync(fullPath, 'utf-8');

    // 1. Parse
    const parseStart = Date.now();
    const ast = parse(source);
    const parseTime = Date.now() - parseStart;
    expect(parseTime).toBeLessThan(metadata.performance.maxParseTimeMs);

    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.type).toBe('GlobalProtocolDeclaration');

    // 2. Build CFG
    const cfg = buildCFG(protocol);

    // Snapshot CFG structure
    const cfgSnapshot = this.snapshotCFG(cfg);
    this.assertSnapshotMatches('cfg', protocolName, cfgSnapshot);

    // 3. Verify
    const verification = verifyProtocol(cfg);

    // Check expected properties
    expect(verification.deadlock.hasDeadlock).toBe(
      metadata.expectedProperties.hasDeadlock
    );
    expect(verification.raceConditions.hasRaces).toBe(
      metadata.expectedProperties.hasRaces
    );

    // Snapshot verification results
    this.assertSnapshotMatches('verification', protocolName, verification);

    // 4. Project
    const projectStart = Date.now();
    const result = projectAll(cfg);
    const projectTime = Date.now() - projectStart;
    expect(projectTime).toBeLessThan(metadata.performance.maxProjectionTimeMs);

    // Check roles
    expect(Array.from(result.cfsms.keys()).sort()).toEqual(
      metadata.expectedProperties.roles.sort()
    );

    // 5. Snapshot each CFSM
    for (const [role, cfsm] of result.cfsms) {
      const cfsmSnapshot = this.snapshotCFSM(cfsm);
      this.assertSnapshotMatches('cfsm', `${protocolName}_${role}`, cfsmSnapshot);

      // Check expected state count (if specified)
      if (metadata.expectedProperties.stateCount && metadata.expectedProperties.stateCount[role]) {
        expect(cfsm.states.length).toBe(
          metadata.expectedProperties.stateCount[role]
        );
      }
    }

    // 6. Serialize to local protocols
    for (const [role, cfsm] of result.cfsms) {
      const localProtocol = serializeCFSM(cfsm);
      this.assertSnapshotMatches('local', `${protocolName}_${role}`, localProtocol);
    }
  }

  /**
   * Snapshot CFG structure for comparison
   */
  private snapshotCFG(cfg: CFG): CFGSnapshot {
    // Remove non-deterministic fields for stable snapshots
    return {
      nodeCount: cfg.nodes.length,
      edgeCount: cfg.edges.length,
      roles: cfg.roles.sort(),
      protocolName: cfg.protocolName,
      // Include structural hash for quick comparison
      structureHash: this.hashStructure(cfg),
    };
  }

  /**
   * Snapshot CFSM for comparison
   */
  private snapshotCFSM(cfsm: CFSM): CFSMSnapshot {
    return {
      role: cfsm.role,
      protocolName: cfsm.protocolName,
      stateCount: cfsm.states.length,
      transitionCount: cfsm.transitions.length,
      protocolActionCount: cfsm.transitions.filter(
        t => t.action.type === 'send' || t.action.type === 'receive'
      ).length,
      // Full CFSM for detailed comparison
      cfsm: cfsm,
    };
  }

  /**
   * Assert snapshot matches or create new snapshot
   */
  private assertSnapshotMatches(
    type: string,
    name: string,
    data: any
  ): void {
    const snapshotPath = path.join(this.snapshotDir, type, `${name}.json`);

    if (!fs.existsSync(snapshotPath)) {
      // First run - create snapshot
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2));
      console.warn(`Created new snapshot: ${snapshotPath}`);
      return;
    }

    // Compare with existing snapshot
    const existing = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    expect(data).toEqual(existing);
  }

  /**
   * Hash CFG structure for quick comparison
   */
  private hashStructure(cfg: CFG): string {
    // Simple structural hash for quick comparison
    const str = JSON.stringify({
      nodes: cfg.nodes.map(n => n.type),
      edges: cfg.edges.map(e => `${e.from}-${e.edgeType}-${e.to}`),
    });
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Load metadata for a protocol
   */
  static loadMetadata(baseDir: string, protocolName: string): GoldenTestMetadata {
    const metadataPath = path.join(baseDir, 'metadata', 'protocols.json');
    const allMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    return allMetadata[protocolName];
  }

  /**
   * Update all snapshots (use with caution!)
   */
  updateSnapshots(force: boolean = false): void {
    if (!force) {
      throw new Error('Must pass force=true to update snapshots. This will overwrite all golden outputs!');
    }

    const snapshotDirs = ['cfg', 'cfsm', 'local', 'verification'];
    for (const dir of snapshotDirs) {
      const dirPath = path.join(this.snapshotDir, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true });
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
  }
}

// ============================================================================
// Example Usage (will be moved to actual test files)
// ============================================================================

// This will be used in tests/golden/__tests__/golden.test.ts
export function createGoldenTests() {
  describe('Golden Tests', () => {
    const runner = new GoldenTestRunner('tests/golden');

    it('TwoBuyer protocol', async () => {
      await runner.runGoldenTest(
        'protocols/complex/two-buyer.scr',
        {
          name: 'TwoBuyer',
          description: 'Classic two-buyer protocol with choice',
          category: 'complex',
          expectedProperties: {
            roles: ['Seller', 'Buyer1', 'Buyer2'],
            hasDeadlock: false,
            hasRaces: false,
            messageCount: 4,
            stateCount: {
              'Seller': 6,
              'Buyer1': 5,
              'Buyer2': 7,
            },
          },
          performance: {
            maxParseTimeMs: 100,
            maxProjectionTimeMs: 500,
          },
        }
      );
    });
  });
}
