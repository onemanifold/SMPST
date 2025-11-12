/**
 * Reusable protocol definitions for testing
 *
 * These protocols represent common patterns from:
 * - Session types literature
 * - Real-world use cases
 * - Edge cases and corner cases
 */

// ============================================================================
// Basic Patterns
// ============================================================================

export const EMPTY_PROTOCOL = `
  protocol Empty(role A, role B) {
  }
`;

export const SIMPLE_SEND = `
  protocol SimpleSend(role A, role B) {
    A -> B: Message();
  }
`;

export const SIMPLE_RECEIVE = `
  protocol SimpleReceive(role A, role B) {
    A -> B: Message();
  }
`;

export const REQUEST_RESPONSE = `
  protocol RequestResponse(role Client, role Server) {
    Client -> Server: Request();
    Server -> Client: Response();
  }
`;

export const THREE_ROLE_CHAIN = `
  protocol ThreeRoles(role A, role B, role C) {
    A -> B: M1();
    B -> C: M2();
    C -> A: M3();
  }
`;

// ============================================================================
// Choice Patterns
// ============================================================================

export const INTERNAL_CHOICE = `
  protocol InternalChoice(role Client, role Server) {
    choice at Client {
      Client -> Server: Login();
    } or {
      Client -> Server: Register();
    }
  }
`;

export const EXTERNAL_CHOICE = `
  protocol ExternalChoice(role Client, role Server) {
    choice at Client {
      Client -> Server: Login();
    } or {
      Client -> Server: Register();
    }
  }
`;

export const NESTED_CHOICE = `
  protocol NestedChoice(role A, role B) {
    choice at A {
      A -> B: Opt1();
      choice at B {
        B -> A: Opt1A();
      } or {
        B -> A: Opt1B();
      }
    } or {
      A -> B: Opt2();
    }
  }
`;

export const THREE_WAY_CHOICE = `
  protocol ThreeWayChoice(role Client, role Server) {
    choice at Client {
      Client -> Server: Option1();
    } or {
      Client -> Server: Option2();
    } or {
      Client -> Server: Option3();
    }
  }
`;

export const CHOICE_WITH_CONTINUATION = `
  protocol ChoiceWithContinuation(role A, role B) {
    choice at A {
      A -> B: Yes();
      B -> A: Ack1();
    } or {
      A -> B: No();
      B -> A: Ack2();
    }
    A -> B: Final();
  }
`;

export const EMPTY_BRANCH_CHOICE = `
  protocol EmptyBranchChoice(role A, role B) {
    choice at A {
      A -> B: Something();
    } or {
    }
  }
`;

// ============================================================================
// Parallel Patterns
// ============================================================================

export const PARALLEL_SINGLE_BRANCH = `
  protocol ParallelSingle(role A, role B, role C) {
    par {
      A -> B: M1();
    } and {
      C -> B: M2();
    }
  }
`;

export const PARALLEL_MULTIPLE_BRANCHES = `
  protocol ParallelMultiple(role A, role B, role C) {
    par {
      A -> B: M1();
    } and {
      A -> C: M2();
    }
  }
`;

export const THREE_WAY_PARALLEL = `
  protocol ThreeWayParallel(role A, role B, role C, role D) {
    par {
      A -> B: M1();
    } and {
      A -> C: M2();
    } and {
      A -> D: M3();
    }
  }
`;

export const PARALLEL_WITH_SEQUENCES = `
  protocol ParallelSequences(role A, role B, role C) {
    par {
      A -> B: M1();
      B -> A: M2();
    } and {
      A -> C: M3();
      C -> A: M4();
    }
  }
`;

export const NESTED_PARALLEL = `
  protocol NestedParallel(role A, role B, role C, role D) {
    par {
      par {
        A -> B: M1();
      } and {
        A -> C: M2();
      }
    } and {
      A -> D: M3();
    }
  }
`;

export const PARALLEL_UNINVOLVED_ROLE = `
  protocol ParallelUninvolved(role A, role B, role C) {
    par {
      A -> B: M1();
    } and {
      B -> A: M2();
    }
  }
`;

// ============================================================================
// Recursion Patterns
// ============================================================================

export const INFINITE_LOOP = `
  protocol InfiniteLoop(role A, role B) {
    rec Loop {
      A -> B: Data();
      continue Loop;
    }
  }
`;

export const CONDITIONAL_LOOP = `
  protocol ConditionalLoop(role Server, role Client) {
    rec Loop {
      choice at Server {
        Server -> Client: Data();
        continue Loop;
      } or {
        Server -> Client: End();
      }
    }
  }
`;

export const NESTED_RECURSION = `
  protocol NestedRecursion(role A, role B) {
    rec Outer {
      A -> B: Start();
      rec Inner {
        A -> B: Data();
        choice at A {
          continue Inner;
        } or {
        }
      }
      choice at A {
        continue Outer;
      } or {
      }
    }
  }
`;

export const RECURSION_WITH_CONTINUATION = `
  protocol RecWithContinuation(role A, role B) {
    rec Loop {
      choice at A {
        A -> B: More();
        continue Loop;
      } or {
        A -> B: Done();
      }
    }
    B -> A: Final();
  }
`;

export const MULTI_CONTINUE = `
  protocol MultiContinue(role A, role B) {
    rec Loop {
      choice at A {
        A -> B: Option1();
        continue Loop;
      } or {
        A -> B: Option2();
        continue Loop;
      } or {
        A -> B: Exit();
      }
    }
  }
`;

// ============================================================================
// Literature Protocols (Known from Papers)
// ============================================================================

export const TWO_PHASE_COMMIT = `
  protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
    Coordinator -> P1: VoteRequest();
    Coordinator -> P2: VoteRequest();
    par {
      P1 -> Coordinator: Vote();
    } and {
      P2 -> Coordinator: Vote();
    }
    choice at Coordinator {
      Coordinator -> P1: Commit();
      Coordinator -> P2: Commit();
    } or {
      Coordinator -> P1: Abort();
      Coordinator -> P2: Abort();
    }
  }
`;

export const STREAMING = `
  protocol Streaming(role Producer, role Consumer) {
    rec Stream {
      choice at Producer {
        Producer -> Consumer: Data();
        continue Stream;
      } or {
        Producer -> Consumer: End();
      }
    }
  }
`;

export const THREE_BUYER = `
  protocol ThreeBuyer(role Buyer1, role Buyer2, role Seller) {
    Buyer1 -> Seller: Title();
    Seller -> Buyer1: Quote();
    Buyer1 -> Buyer2: Share();
    choice at Buyer2 {
      Buyer2 -> Seller: Accept();
      Buyer2 -> Buyer1: Ok();
    } or {
      Buyer2 -> Seller: Reject();
      Buyer2 -> Buyer1: Quit();
    }
  }
`;

export const PING_PONG = `
  protocol PingPong(role A, role B) {
    rec Game {
      choice at A {
        A -> B: Ping();
        B -> A: Pong();
        continue Game;
      } or {
        A -> B: Stop();
      }
    }
  }
`;

// ============================================================================
// Complex Integration Scenarios
// ============================================================================

export const CHOICE_IN_PARALLEL = `
  protocol ChoiceInParallel(role A, role B, role C) {
    par {
      choice at A {
        A -> B: X();
      } or {
        A -> B: Y();
      }
    } and {
      A -> C: Z();
    }
  }
`;

export const RECURSION_IN_PARALLEL = `
  protocol RecInParallel(role A, role B, role C) {
    par {
      rec Loop {
        A -> B: Data();
        choice at A {
          continue Loop;
        } or {
        }
      }
    } and {
      A -> C: Other();
    }
  }
`;

export const PARALLEL_IN_CHOICE = `
  protocol ParallelInChoice(role A, role B, role C) {
    choice at A {
      par {
        A -> B: M1();
      } and {
        A -> C: M2();
      }
    } or {
      A -> B: M3();
    }
  }
`;

export const ALL_CONSTRUCTS = `
  protocol AllConstructs(role A, role B, role C) {
    rec MainLoop {
      choice at A {
        par {
          A -> B: P1();
        } and {
          A -> C: P2();
        }
        choice at B {
          B -> A: Continue();
          continue MainLoop;
        } or {
          B -> A: Stop();
        }
      } or {
        A -> B: Quit();
      }
    }
  }
`;

// ============================================================================
// Edge Cases
// ============================================================================

export const SINGLE_ROLE = `
  protocol SingleRole(role A) {
  }
`;

export const UNUSED_ROLE = `
  protocol UnusedRole(role A, role B, role C) {
    A -> B: Message();
  }
`;

export const LONG_SEQUENCE = `
  protocol LongSequence(role A, role B) {
    A -> B: M1();
    B -> A: M2();
    A -> B: M3();
    B -> A: M4();
    A -> B: M5();
    B -> A: M6();
    A -> B: M7();
    B -> A: M8();
    A -> B: M9();
    B -> A: M10();
  }
`;

export const MANY_ROLES = `
  protocol ManyRoles(role A, role B, role C, role D, role E) {
    A -> B: M1();
    B -> C: M2();
    C -> D: M3();
    D -> E: M4();
    E -> A: M5();
  }
`;

// ============================================================================
// Completeness Test Protocols
// ============================================================================

export const COMPLETE_PROTOCOL = `
  protocol Complete(role A, role B, role C) {
    A -> B: M1();
    B -> C: M2();
    C -> A: M3();
  }
`;

export const REACHABLE_PROTOCOL = `
  protocol Reachable(role A, role B) {
    A -> B: Start();
    B -> A: Done();
  }
`;

// ============================================================================
// Formal Correctness Test Protocols
// ============================================================================

export const COMPLETION_CHECK = `
  protocol CompletionCheck(role A, role B, role C) {
    A -> B: M1();
    B -> C: M2();
    C -> A: M3();
  }
`;

export const ROLE_CORRECTNESS = `
  protocol RoleCorrectness(role A, role B, role C) {
    A -> B: M1();
    B -> C: M2();
  }
`;

export const DUALITY_PROTOCOL = `
  protocol Duality(role A, role B, role C) {
    A -> B: Request();
    B -> A: Response();
    A -> C: Forward();
  }
`;

export const REACHABILITY_PROTOCOL = `
  protocol Reachability(role A, role B) {
    A -> B: Start();
    choice at A {
      A -> B: Option1();
    } or {
      A -> B: Option2();
    }
    B -> A: Done();
  }
`;

export const DETERMINISTIC_CHOICE = `
  protocol DeterministicChoice(role Client, role Server) {
    choice at Client {
      Client -> Server: Login();
    } or {
      Client -> Server: Register();
    }
  }
`;

export const BASIC_PROTOCOL = `
  protocol BasicProtocol(role A, role B) {
    A -> B: Message();
  }
`;
