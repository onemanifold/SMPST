/**
 * Test if parser can handle nested recursion
 */

import { describe, it } from 'vitest';
import { parse } from '../../core/parser/parser';

describe('Parser Nested Recursion Test', () => {
  it('should test if parser can parse nested recursion', () => {
    const nested = `
      global protocol NestedRec(role A, role B) {
        rec Outer {
          msg1() from A to B;
          rec Inner {
            msg2() from B to A;
            choice at A {
              repeat() from A to B;
              continue Inner;
            } or {
              breakInner() from A to B;
            }
          }
          choice at B {
            repeatOuter() from B to A;
            continue Outer;
          } or {
            done() from B to A;
          }
        }
      }
    `;

    console.log('\n=== Parser Nested Recursion Test ===\n');
    console.log('Protocol:', nested);
    console.log('\nAttempting to parse...\n');

    try {
      const ast = parse(nested);
      console.log('✅ Parser succeeded!');
      console.log('AST:', JSON.stringify(ast, null, 2));
    } catch (error) {
      console.log('❌ Parser failed!');
      console.log('Error:', (error as Error).message);
    }

    console.log('\n=== End Test ===\n');
  });
});
