/**
 * Simple parser test to verify empty messages and nested structures
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';

describe('Parser Simple Tests', () => {
  it('should parse choice with empty messages', () => {
    const source = `
      protocol Test(role A, role B) {
        choice at A {
          A -> B: Yes();
        } or {
          A -> B: No();
        }
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
  });

  it('should parse nested rec with continue statements', () => {
    const source = `
      global protocol NestedRec(role A, role B) {
        rec Outer {
          A -> B: msg1(String);
          rec Inner {
            B -> A: msg2(String);
            choice at A {
              A -> B: repeat(String);
              continue Inner;
            } or {
              A -> B: breakInner(String);
            }
          }
          choice at B {
            B -> A: repeatOuter(String);
            continue Outer;
          } or {
            B -> A: done(String);
          }
        }
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
  });

  it('should parse standard syntax with empty messages', () => {
    const source = `
      global protocol Test(role A, role B) {
        rec Outer {
          msg1() from A to B;
          choice at B {
            repeatOuter() from B to A;
            continue Outer;
          } or {
            done() from B to A;
          }
        }
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
  });
});
