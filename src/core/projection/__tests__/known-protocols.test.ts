/**
 * CFSM Projection Tests - Known Protocols
 *
 * Tests projection of well-known protocols from session types literature.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import type { SendAction, ReceiveAction } from '../types';
import {
  findTransitionsWithAction,
  hasSendAction,
  hasReceiveAction,
} from '../__test-utils__/helpers';
import {
  REQUEST_RESPONSE,
  TWO_PHASE_COMMIT,
  STREAMING,
  THREE_BUYER,
  PING_PONG,
} from '../__fixtures__/protocols';

describe('CFSM Projection - Known Protocols', () => {
  it('[Request-Response] should project correctly', () => {
    const ast = parse(REQUEST_RESPONSE);
    const cfg = buildCFG(ast.declarations[0]);

    const clientCFSM = project(cfg, 'Client');
    const serverCFSM = project(cfg, 'Server');

    // Client: send, receive
    expect(hasSendAction(clientCFSM, 'Request')).toBe(true);
    expect(hasReceiveAction(clientCFSM, 'Response')).toBe(true);

    // Server: receive, send
    expect(hasReceiveAction(serverCFSM, 'Request')).toBe(true);
    expect(hasSendAction(serverCFSM, 'Response')).toBe(true);
  });

  it('[Two-Phase Commit] should project coordinator', () => {
    const ast = parse(TWO_PHASE_COMMIT);
    const cfg = buildCFG(ast.declarations[0]);
    const coordCFSM = project(cfg, 'Coordinator');

    // Coordinator sends vote requests
    const voteRequestSends = findTransitionsWithAction(coordCFSM, 'send').filter(
      t => t.action && (t.action as SendAction).label === 'VoteRequest'
    );
    expect(voteRequestSends.length).toBe(2);

    // Receives votes (parallel composition creates diamond pattern)
    // Diamond: receive from P1 then P2, OR receive from P2 then P1
    const voteRecvs = findTransitionsWithAction(coordCFSM, 'receive').filter(
      t => t.action && (t.action as ReceiveAction).label === 'Vote'
    );
    expect(voteRecvs.length).toBe(4); // 2 paths, each with 2 receives

    // Makes decision
    expect(hasSendAction(coordCFSM, 'Commit')).toBe(true);
    expect(hasSendAction(coordCFSM, 'Abort')).toBe(true);
  });

  it('[Streaming] should project producer and consumer', () => {
    const ast = parse(STREAMING);
    const cfg = buildCFG(ast.declarations[0]);

    const producerCFSM = project(cfg, 'Producer');
    const consumerCFSM = project(cfg, 'Consumer');

    // Producer makes choice
    expect(hasSendAction(producerCFSM, 'Data')).toBe(true);
    expect(hasSendAction(producerCFSM, 'End')).toBe(true);

    // Consumer receives
    expect(hasReceiveAction(consumerCFSM, 'Data')).toBe(true);
    expect(hasReceiveAction(consumerCFSM, 'End')).toBe(true);
  });

  it('[Three-Buyer] should project all roles correctly', () => {
    const ast = parse(THREE_BUYER);
    const cfg = buildCFG(ast.declarations[0]);

    const buyer1CFSM = project(cfg, 'Buyer1');
    const buyer2CFSM = project(cfg, 'Buyer2');
    const sellerCFSM = project(cfg, 'Seller');

    // Buyer1 starts, receives quote, shares with Buyer2
    expect(hasSendAction(buyer1CFSM, 'Title')).toBe(true);
    expect(hasReceiveAction(buyer1CFSM, 'Quote')).toBe(true);
    expect(hasSendAction(buyer1CFSM, 'Share')).toBe(true);

    // Buyer2 receives share, makes decision
    expect(hasReceiveAction(buyer2CFSM, 'Share')).toBe(true);
    expect(hasSendAction(buyer2CFSM, 'Accept')).toBe(true);
    expect(hasSendAction(buyer2CFSM, 'Reject')).toBe(true);

    // Seller receives title, sends quote, receives decision
    expect(hasReceiveAction(sellerCFSM, 'Title')).toBe(true);
    expect(hasSendAction(sellerCFSM, 'Quote')).toBe(true);
    expect(hasReceiveAction(sellerCFSM, 'Accept')).toBe(true);
    expect(hasReceiveAction(sellerCFSM, 'Reject')).toBe(true);
  });

  it('[Ping-Pong] should handle simple alternation', () => {
    const ast = parse(PING_PONG);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');
    const bCFSM = project(cfg, 'B');

    // A sends Ping, receives Pong, or sends Stop
    expect(hasSendAction(aCFSM, 'Ping')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Pong')).toBe(true);
    expect(hasSendAction(aCFSM, 'Stop')).toBe(true);

    // B receives Ping, sends Pong, or receives Stop
    expect(hasReceiveAction(bCFSM, 'Ping')).toBe(true);
    expect(hasSendAction(bCFSM, 'Pong')).toBe(true);
    expect(hasReceiveAction(bCFSM, 'Stop')).toBe(true);
  });
});
