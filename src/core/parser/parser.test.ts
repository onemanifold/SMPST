/**
 * Parser Tests for Scribble 2.0
 * Following TDD: These tests are written BEFORE implementation
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type {
  Module,
  GlobalProtocolDeclaration,
  MessageTransfer,
  Choice,
  Parallel,
  Recursion,
  Do,
} from '../ast/types';

describe('Scribble Parser - Basic Protocol Structure', () => {
  it('should parse minimal protocol with no interactions', () => {
    const source = `
      protocol Empty(role A, role B) {
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
    expect(ast.declarations).toHaveLength(1);

    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.type).toBe('GlobalProtocolDeclaration');
    expect(protocol.name).toBe('Empty');
    expect(protocol.roles).toHaveLength(2);
    expect(protocol.roles[0].name).toBe('A');
    expect(protocol.roles[1].name).toBe('B');
    expect(protocol.body).toHaveLength(0);
  });

  it('should parse protocol with type parameters', () => {
    const source = `
      protocol Generic<type T>(role A, role B) {
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.parameters).toHaveLength(1);
    expect(protocol.parameters[0].name).toBe('T');
    expect(protocol.parameters[0].kind).toBe('type');
  });

  it('should parse protocol with multiple roles', () => {
    const source = `
      protocol MultiRole(role A, role B, role C, role D) {
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.roles).toHaveLength(4);
    expect(protocol.roles.map(r => r.name)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('Scribble Parser - Protocol Declaration Syntax', () => {
  it('should accept: protocol Name(...)', () => {
    const source = `
      protocol Test(role A, role B) {
        A -> B: Hello();
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
    expect(ast.declarations).toHaveLength(1);

    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.type).toBe('GlobalProtocolDeclaration');
    expect(protocol.name).toBe('Test');
  });

  it('should accept: global protocol Name(...)', () => {
    const source = `
      global protocol Test(role A, role B) {
        A -> B: Hello();
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
    expect(ast.declarations).toHaveLength(1);

    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.type).toBe('GlobalProtocolDeclaration');
    expect(protocol.name).toBe('Test');
  });

  it('should parse both syntaxes identically', () => {
    const source1 = `
      protocol Test(role A, role B) {
        A -> B: Hello();
      }
    `;

    const source2 = `
      global protocol Test(role A, role B) {
        A -> B: Hello();
      }
    `;

    const ast1 = parse(source1);
    const ast2 = parse(source2);

    const protocol1 = ast1.declarations[0] as GlobalProtocolDeclaration;
    const protocol2 = ast2.declarations[0] as GlobalProtocolDeclaration;

    // Compare structure (not locations, which will differ due to 'global' keyword)
    expect(protocol1.type).toBe(protocol2.type);
    expect(protocol1.name).toBe(protocol2.name);
    expect(protocol1.roles.map(r => r.name)).toEqual(protocol2.roles.map(r => r.name));
    expect(protocol1.body.length).toBe(protocol2.body.length);
  });

  it('should accept: local protocol Name(...)', () => {
    const source = `
      local protocol Test(role A) {
        A -> A: Hello();
      }
    `;

    const ast = parse(source);
    expect(ast.type).toBe('Module');
    expect(ast.declarations).toHaveLength(1);

    const protocol = ast.declarations[0];
    expect(protocol.type).toBe('LocalProtocolDeclaration');
  });
});

describe('Scribble Parser - Message Transfer', () => {
  it('should parse simple message without payload', () => {
    const source = `
      protocol SimpleMsg(role A, role B) {
        A -> B: Hello();
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(1);

    const msg = protocol.body[0] as MessageTransfer;
    expect(msg.type).toBe('MessageTransfer');
    expect(msg.from).toBe('A');
    expect(msg.to).toBe('B');
    expect(msg.message.label).toBe('Hello');
    expect(msg.message.payload).toBeUndefined();
  });

  it('should parse message with simple payload type', () => {
    const source = `
      protocol MsgWithPayload(role Client, role Server) {
        Client -> Server: Request(String);
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const msg = protocol.body[0] as MessageTransfer;

    expect(msg.message.label).toBe('Request');
    expect(msg.message.payload).toBeDefined();
    expect(msg.message.payload?.payloadType.type).toBe('SimpleType');
    expect((msg.message.payload?.payloadType as any).name).toBe('String');
  });

  it('should parse message with parametric payload type', () => {
    const source = `
      protocol MsgWithGeneric(role A, role B) {
        A -> B: Data(List<Int>);
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const msg = protocol.body[0] as MessageTransfer;

    expect(msg.message.payload?.payloadType.type).toBe('ParametricType');
    const payloadType = msg.message.payload?.payloadType as any;
    expect(payloadType.name).toBe('List');
    expect(payloadType.arguments).toHaveLength(1);
    expect(payloadType.arguments[0].name).toBe('Int');
  });

  it('should parse multiple sequential messages', () => {
    const source = `
      protocol Sequential(role A, role B, role C) {
        A -> B: Msg1();
        B -> C: Msg2();
        C -> A: Msg3();
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(3);

    const msg1 = protocol.body[0] as MessageTransfer;
    const msg2 = protocol.body[1] as MessageTransfer;
    const msg3 = protocol.body[2] as MessageTransfer;

    expect(msg1.from).toBe('A');
    expect(msg1.to).toBe('B');
    expect(msg2.from).toBe('B');
    expect(msg2.to).toBe('C');
    expect(msg3.from).toBe('C');
    expect(msg3.to).toBe('A');
  });
});

describe('Scribble Parser - Choice', () => {
  it('should parse choice with two branches', () => {
    const source = `
      protocol TwoChoice(role A, role B) {
        choice at A {
          A -> B: Yes();
        } or {
          A -> B: No();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(1);

    const choice = protocol.body[0] as Choice;
    expect(choice.type).toBe('Choice');
    expect(choice.at).toBe('A');
    expect(choice.branches).toHaveLength(2);

    expect(choice.branches[0].body).toHaveLength(1);
    expect(choice.branches[1].body).toHaveLength(1);

    const msg1 = choice.branches[0].body[0] as MessageTransfer;
    const msg2 = choice.branches[1].body[0] as MessageTransfer;
    expect(msg1.message.label).toBe('Yes');
    expect(msg2.message.label).toBe('No');
  });

  it('should parse choice with three branches', () => {
    const source = `
      protocol ThreeChoice(role A, role B) {
        choice at A {
          A -> B: Option1();
        } or {
          A -> B: Option2();
        } or {
          A -> B: Option3();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const choice = protocol.body[0] as Choice;

    expect(choice.branches).toHaveLength(3);
  });

  it('should parse nested choices', () => {
    const source = `
      protocol NestedChoice(role A, role B, role C) {
        choice at A {
          A -> B: Branch1();
          choice at B {
            B -> C: SubBranch1();
          } or {
            B -> C: SubBranch2();
          }
        } or {
          A -> B: Branch2();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const outerChoice = protocol.body[0] as Choice;

    expect(outerChoice.branches).toHaveLength(2);
    expect(outerChoice.branches[0].body).toHaveLength(2); // Message + nested choice

    const innerChoice = outerChoice.branches[0].body[1] as Choice;
    expect(innerChoice.type).toBe('Choice');
    expect(innerChoice.branches).toHaveLength(2);
  });
});

describe('Scribble Parser - Parallel Composition', () => {
  it('should parse parallel with two branches', () => {
    const source = `
      protocol TwoParallel(role A, role B, role C) {
        par {
          A -> B: Msg1();
        } and {
          A -> C: Msg2();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(1);

    const parallel = protocol.body[0] as Parallel;
    expect(parallel.type).toBe('Parallel');
    expect(parallel.branches).toHaveLength(2);

    expect(parallel.branches[0].body).toHaveLength(1);
    expect(parallel.branches[1].body).toHaveLength(1);

    const msg1 = parallel.branches[0].body[0] as MessageTransfer;
    const msg2 = parallel.branches[1].body[0] as MessageTransfer;
    expect(msg1.to).toBe('B');
    expect(msg2.to).toBe('C');
  });

  it('should parse parallel with three branches', () => {
    const source = `
      protocol ThreeParallel(role A, role B, role C, role D) {
        par {
          A -> B: Msg1();
        } and {
          A -> C: Msg2();
        } and {
          A -> D: Msg3();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const parallel = protocol.body[0] as Parallel;

    expect(parallel.branches).toHaveLength(3);
  });

  it('should parse nested parallel', () => {
    const source = `
      protocol NestedParallel(role A, role B, role C, role D) {
        par {
          par {
            A -> B: Inner1();
          } and {
            A -> C: Inner2();
          }
        } and {
          A -> D: Outer();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const outerParallel = protocol.body[0] as Parallel;

    expect(outerParallel.branches).toHaveLength(2);

    const innerParallel = outerParallel.branches[0].body[0] as Parallel;
    expect(innerParallel.type).toBe('Parallel');
    expect(innerParallel.branches).toHaveLength(2);
  });

  it('should parse protocol continuing after parallel', () => {
    const source = `
      protocol ParallelThenSequential(role A, role B, role C) {
        par {
          A -> B: Par1();
        } and {
          A -> C: Par2();
        }
        A -> B: AfterParallel();
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(2);

    expect(protocol.body[0].type).toBe('Parallel');
    expect(protocol.body[1].type).toBe('MessageTransfer');
  });
});

describe('Scribble Parser - Recursion', () => {
  it('should parse simple recursion', () => {
    const source = `
      protocol SimpleLoop(role A, role B) {
        rec Loop {
          A -> B: Msg();
          continue Loop;
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(1);

    const recursion = protocol.body[0] as Recursion;
    expect(recursion.type).toBe('Recursion');
    expect(recursion.label).toBe('Loop');
    expect(recursion.body).toHaveLength(2);

    expect(recursion.body[0].type).toBe('MessageTransfer');
    expect(recursion.body[1].type).toBe('Continue');
    expect((recursion.body[1] as any).label).toBe('Loop');
  });

  it('should parse recursion with choice for termination', () => {
    const source = `
      protocol LoopWithExit(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Continue();
            continue Loop;
          } or {
            A -> B: Stop();
          }
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const recursion = protocol.body[0] as Recursion;

    expect(recursion.body).toHaveLength(1);
    expect(recursion.body[0].type).toBe('Choice');
  });

  it('should parse nested recursion', () => {
    const source = `
      protocol NestedLoop(role A, role B) {
        rec Outer {
          A -> B: OuterMsg();
          rec Inner {
            A -> B: InnerMsg();
            continue Inner;
          }
          continue Outer;
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const outerRec = protocol.body[0] as Recursion;

    expect(outerRec.label).toBe('Outer');
    expect(outerRec.body).toHaveLength(3); // msg, inner rec, continue

    const innerRec = outerRec.body[1] as Recursion;
    expect(innerRec.type).toBe('Recursion');
    expect(innerRec.label).toBe('Inner');
  });
});

describe('Scribble Parser - Do Statement', () => {
  it('should parse do without type arguments', () => {
    const source = `
      protocol UseSub(role A, role B) {
        do SubProtocol(A, B);
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(1);

    const doStmt = protocol.body[0] as Do;
    expect(doStmt.type).toBe('Do');
    expect(doStmt.protocol).toBe('SubProtocol');
    expect(doStmt.typeArguments).toBeUndefined();
    expect(doStmt.roleArguments).toEqual(['A', 'B']);
  });

  it('should parse do with type arguments', () => {
    const source = `
      protocol UseGenericSub(role A, role B) {
        do GenericProtocol<Int, String>(A, B);
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const doStmt = protocol.body[0] as Do;

    expect(doStmt.protocol).toBe('GenericProtocol');
    expect(doStmt.typeArguments).toHaveLength(2);
    expect((doStmt.typeArguments![0] as any).name).toBe('Int');
    expect((doStmt.typeArguments![1] as any).name).toBe('String');
  });

  it('should parse do with role mapping', () => {
    const source = `
      protocol MapRoles(role Client, role Server, role Database) {
        do TwoParty(Client, Server);
        do TwoParty(Server, Database);
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(protocol.body).toHaveLength(2);

    const do1 = protocol.body[0] as Do;
    const do2 = protocol.body[1] as Do;

    expect(do1.roleArguments).toEqual(['Client', 'Server']);
    expect(do2.roleArguments).toEqual(['Server', 'Database']);
  });
});

describe('Scribble Parser - Complex Protocols', () => {
  it('should parse Two-Phase Commit protocol', () => {
    const source = `
      protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
        Coordinator -> Participant1: VoteRequest();
        Coordinator -> Participant2: VoteRequest();

        par {
          Participant1 -> Coordinator: Vote(Bool);
        } and {
          Participant2 -> Coordinator: Vote(Bool);
        }

        choice at Coordinator {
          Coordinator -> Participant1: Commit();
          Coordinator -> Participant2: Commit();
        } or {
          Coordinator -> Participant1: Abort();
          Coordinator -> Participant2: Abort();
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

    expect(protocol.name).toBe('TwoPhaseCommit');
    expect(protocol.roles).toHaveLength(3);
    expect(protocol.body).toHaveLength(4); // 2 messages, 1 parallel, 1 choice

    expect(protocol.body[0].type).toBe('MessageTransfer');
    expect(protocol.body[1].type).toBe('MessageTransfer');
    expect(protocol.body[2].type).toBe('Parallel');
    expect(protocol.body[3].type).toBe('Choice');
  });

  it('should parse protocol with mixed constructs', () => {
    const source = `
      protocol Complex(role A, role B, role C) {
        A -> B: Start();

        rec MainLoop {
          choice at A {
            par {
              A -> B: Data1();
            } and {
              A -> C: Data2();
            }
            continue MainLoop;
          } or {
            A -> B: End();
            A -> C: End();
          }
        }
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

    expect(protocol.body).toHaveLength(2);
    expect(protocol.body[0].type).toBe('MessageTransfer');
    expect(protocol.body[1].type).toBe('Recursion');

    const rec = protocol.body[1] as Recursion;
    expect(rec.body[0].type).toBe('Choice');

    const choice = rec.body[0] as Choice;
    expect(choice.branches[0].body[0].type).toBe('Parallel');
  });
});

describe('Scribble Parser - Error Handling', () => {
  it('should throw error for missing semicolon', () => {
    const source = `
      protocol BadSyntax(role A, role B) {
        A -> B: Msg()
      }
    `;

    expect(() => parse(source)).toThrow();
  });

  it('should throw error for undefined role in message', () => {
    const source = `
      protocol UndefinedRole(role A, role B) {
        A -> C: Msg();
      }
    `;

    // Note: This might be a semantic error, not parser error
    // We'll handle this in validation layer
    // For now, parser should succeed but validator should catch it
    expect(() => parse(source)).not.toThrow();
  });

  it('should throw error for invalid choice syntax', () => {
    const source = `
      protocol BadChoice(role A, role B) {
        choice at A {
          A -> B: Msg();
        }
      }
    `;

    // Choice must have at least 2 branches
    expect(() => parse(source)).toThrow();
  });

  it('should provide helpful error messages with line numbers', () => {
    const source = `
      protocol ErrorLocation(role A, role B) {
        A -> B: Valid();
        This is invalid syntax;
      }
    `;

    try {
      parse(source);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('line');
      // Should point to the line with invalid syntax
    }
  });
});

describe('Scribble Parser - Module with Multiple Protocols', () => {
  it('should parse module with multiple protocols', () => {
    const source = `
      protocol First(role A, role B) {
        A -> B: Msg1();
      }

      protocol Second(role C, role D) {
        C -> D: Msg2();
      }
    `;

    const ast = parse(source);
    expect(ast.declarations).toHaveLength(2);

    const proto1 = ast.declarations[0] as GlobalProtocolDeclaration;
    const proto2 = ast.declarations[1] as GlobalProtocolDeclaration;

    expect(proto1.name).toBe('First');
    expect(proto2.name).toBe('Second');
  });

  it('should parse module with imports and protocols', () => {
    const source = `
      import "common/types.scr";
      import "protocols/auth.scr" { AuthProtocol };

      protocol Main(role A, role B) {
        do AuthProtocol(A, B);
        A -> B: Data();
      }
    `;

    const ast = parse(source);
    expect(ast.declarations).toHaveLength(3); // 2 imports + 1 protocol

    expect(ast.declarations[0].type).toBe('ImportDeclaration');
    expect(ast.declarations[1].type).toBe('ImportDeclaration');
    expect(ast.declarations[2].type).toBe('GlobalProtocolDeclaration');
  });
});
