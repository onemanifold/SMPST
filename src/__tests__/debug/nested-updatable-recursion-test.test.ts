/**
 * Test nested updatable recursion
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { verifyProtocol } from '../../core/verification/verifier';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Nested Updatable Recursion Test', () => {
  it('should parse nested updatable recursion', () => {
    const protocol = `
      protocol NestedUpdatable(role Server, role Client) {
        rec Outer {
          Server -> Client: OuterStart();
          rec Inner {
            Server -> Client: InnerWork();
            choice at Client {
              continue Inner with {
                Client -> Server: InnerExtra();
              };
            } or {
              Client -> Server: InnerDone();
            }
          }
          choice at Server {
            continue Outer with {
              Server -> Client: OuterExtra();
            };
          } or {
            Server -> Client: OuterDone();
          }
        }
      }
    `;

    const ast = parse(protocol);
    expect(ast.declarations).toHaveLength(1);
  });

  it('should build CFG for nested updatable recursion', () => {
    const protocol = `
      protocol NestedUpdatable(role Server, role Client) {
        rec Outer {
          Server -> Client: OuterStart();
          rec Inner {
            Server -> Client: InnerWork();
            choice at Client {
              continue Inner with {
                Client -> Server: InnerExtra();
              };
            } or {
              Client -> Server: InnerDone();
            }
          }
          Server -> Client: OuterDone();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    expect(cfg.nodes.length).toBeGreaterThan(0);
  });

  it('should verify nested updatable recursion is well-formed', () => {
    const protocol = `
      protocol NestedUpdatable(role Server, role Client) {
        rec Outer {
          Server -> Client: OuterMsg();
          rec Inner {
            Server -> Client: InnerMsg();
            choice at Client {
              continue Inner with {
                Client -> Server: Extra();
              };
            } or {
              Client -> Server: Done();
            }
          }
          Server -> Client: Finish();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
    const wf = verifyProtocol(cfg);

    expect(wf.structural.valid).toBe(true);
  });
});
