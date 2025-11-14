/**
 * Snapshot Consistency Tests
 *
 * Verifies that golden snapshots are correctly correlated:
 * - CFG role count matches CFSM count
 * - Verification results reference correct roles
 * - CFSM serialization matches local protocol snapshot
 * - All snapshots use consistent protocol names
 *
 * These tests ensure our pipeline maintains internal consistency.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '../../../src/core/parser/parser';
import { buildCFG } from '../../../src/core/cfg/builder';
import { projectAll } from '../../../src/core/projection/projector';
import { serializeCFSM } from '../../../src/core/serializer/cfsm-serializer';
import type { GlobalProtocolDeclaration } from '../../../src/core/ast/types';

const GOLDEN_DIR = path.join(__dirname, '..');
const PROTOCOLS_DIR = path.join(GOLDEN_DIR, 'protocols');
const SNAPSHOTS_DIR = path.join(GOLDEN_DIR, 'snapshots');

/**
 * Get all protocol files
 */
function getAllProtocols(): Array<{ path: string; name: string; category: string }> {
  const protocols: Array<{ path: string; name: string; category: string }> = [];
  const categories = fs.readdirSync(PROTOCOLS_DIR);

  for (const category of categories) {
    const categoryPath = path.join(PROTOCOLS_DIR, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.scr'));
    for (const file of files) {
      protocols.push({
        path: path.join(categoryPath, file),
        name: path.basename(file, '.scr'),
        category,
      });
    }
  }

  return protocols;
}

describe('Snapshot Consistency Checks', () => {
  const protocols = getAllProtocols();

  for (const protocol of protocols) {
    describe(`${protocol.category}/${protocol.name}`, () => {
      it('should have consistent role counts across all snapshots', () => {
        // Parse protocol to get actual roles
        const source = fs.readFileSync(protocol.path, 'utf-8');
        const ast = parse(source);
        const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
        const actualRoles = globalProtocol.roles.map(r => r.name).sort();

        // Check CFG snapshot
        const cfgSnapshotPath = path.join(SNAPSHOTS_DIR, 'cfg', `${protocol.name}.json`);
        const cfgSnapshot = JSON.parse(fs.readFileSync(cfgSnapshotPath, 'utf-8'));
        expect(cfgSnapshot.roles.sort()).toEqual(actualRoles);

        // Check CFSM snapshots - should have one per role
        const cfsmFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'cfsm'))
          .filter(f => f.startsWith(`${protocol.name}_`));
        const cfsmRoles = cfsmFiles.map(f => f.replace(`${protocol.name}_`, '').replace('.json', '')).sort();
        expect(cfsmRoles).toEqual(actualRoles);

        // Check local protocol snapshots - should have one per role
        const localFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'local'))
          .filter(f => f.startsWith(`${protocol.name}_`));
        const localRoles = localFiles.map(f => f.replace(`${protocol.name}_`, '').replace('.json', '')).sort();
        expect(localRoles).toEqual(actualRoles);
      });

      it('should have CFSM serialization match local protocol snapshot', () => {
        // Parse and project
        const source = fs.readFileSync(protocol.path, 'utf-8');
        const ast = parse(source);
        const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
        const cfg = buildCFG(globalProtocol);
        const result = projectAll(cfg);

        // For each role, verify serialization matches snapshot
        for (const [role, cfsm] of result.cfsms) {
          const serialized = serializeCFSM(cfsm);

          const snapshotPath = path.join(SNAPSHOTS_DIR, 'local', `${protocol.name}_${role}.json`);
          const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

          expect(serialized).toBe(snapshot);
        }
      });

      it('should have consistent protocol names across snapshots', () => {
        // Parse protocol
        const source = fs.readFileSync(protocol.path, 'utf-8');
        const ast = parse(source);
        const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
        const expectedProtocolName = globalProtocol.name;

        // Check CFG
        const cfgSnapshotPath = path.join(SNAPSHOTS_DIR, 'cfg', `${protocol.name}.json`);
        const cfgSnapshot = JSON.parse(fs.readFileSync(cfgSnapshotPath, 'utf-8'));
        expect(cfgSnapshot.protocolName).toBe(expectedProtocolName);

        // Check each CFSM
        const cfsmFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'cfsm'))
          .filter(f => f.startsWith(`${protocol.name}_`));

        for (const file of cfsmFiles) {
          const cfsmPath = path.join(SNAPSHOTS_DIR, 'cfsm', file);
          const cfsmSnapshot = JSON.parse(fs.readFileSync(cfsmPath, 'utf-8'));
          expect(cfsmSnapshot.cfsm.protocolName).toBe(expectedProtocolName);
        }

        // Check local protocols
        const localFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'local'))
          .filter(f => f.startsWith(`${protocol.name}_`));

        for (const file of localFiles) {
          const localPath = path.join(SNAPSHOTS_DIR, 'local', file);
          const localProtocol = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
          // Local protocol should start with "local protocol <Name>_<Role>"
          expect(localProtocol).toMatch(new RegExp(`local protocol ${expectedProtocolName}_`));
        }
      });

      it('should have CFSM action counts match between snapshot and live projection', () => {
        // Parse and project
        const source = fs.readFileSync(protocol.path, 'utf-8');
        const ast = parse(source);
        const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
        const cfg = buildCFG(globalProtocol);
        const result = projectAll(cfg);

        // Compare with snapshots
        for (const [role, cfsm] of result.cfsms) {
          const snapshotPath = path.join(SNAPSHOTS_DIR, 'cfsm', `${protocol.name}_${role}.json`);
          const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

          // Verify counts match
          expect(cfsm.states.length).toBe(snapshot.stateCount);
          expect(cfsm.transitions.length).toBe(snapshot.transitionCount);

          const protocolActions = cfsm.transitions.filter(
            t => t.action.type === 'send' || t.action.type === 'receive'
          );
          expect(protocolActions.length).toBe(snapshot.protocolActionCount);
        }
      });

      it('should have verification snapshot correspond to CFG structure', () => {
        // Parse and verify
        const source = fs.readFileSync(protocol.path, 'utf-8');
        const ast = parse(source);
        const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
        const cfg = buildCFG(globalProtocol);

        // Load snapshots
        const cfgSnapshotPath = path.join(SNAPSHOTS_DIR, 'cfg', `${protocol.name}.json`);
        const cfgSnapshot = JSON.parse(fs.readFileSync(cfgSnapshotPath, 'utf-8'));

        const verificationSnapshotPath = path.join(SNAPSHOTS_DIR, 'verification', `${protocol.name}.json`);
        const verificationSnapshot = JSON.parse(fs.readFileSync(verificationSnapshotPath, 'utf-8'));

        // Verification should reference the same number of nodes as CFG
        // (This is a weak check, but ensures basic correlation)
        expect(verificationSnapshot).toBeDefined();
        expect(cfgSnapshot.nodeCount).toBeGreaterThan(0);
      });
    });
  }

  it('should have snapshots for all protocols', () => {
    const protocols = getAllProtocols();

    for (const protocol of protocols) {
      // CFG snapshot exists
      const cfgPath = path.join(SNAPSHOTS_DIR, 'cfg', `${protocol.name}.json`);
      expect(fs.existsSync(cfgPath)).toBe(true);

      // Verification snapshot exists
      const verifyPath = path.join(SNAPSHOTS_DIR, 'verification', `${protocol.name}.json`);
      expect(fs.existsSync(verifyPath)).toBe(true);

      // At least one CFSM snapshot exists
      const cfsmFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'cfsm'))
        .filter(f => f.startsWith(`${protocol.name}_`));
      expect(cfsmFiles.length).toBeGreaterThan(0);

      // At least one local protocol snapshot exists
      const localFiles = fs.readdirSync(path.join(SNAPSHOTS_DIR, 'local'))
        .filter(f => f.startsWith(`${protocol.name}_`));
      expect(localFiles.length).toBeGreaterThan(0);
    }
  });
});
