#!/usr/bin/env tsx
/**
 * Generate Golden Protocol Test Fixtures
 *
 * Creates a comprehensive suite of Scribble protocols covering all language features.
 * These protocols serve as:
 * 1. Regression tests - catch breaking changes immediately
 * 2. Golden outputs - known-correct verified protocols
 * 3. Documentation - examples of all features
 * 4. Performance baselines - track projection/verification time
 *
 * Usage:
 *   npm run generate:golden
 *   tsx scripts/generate-golden-protocols.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProtocolSpec {
  name: string;
  category: 'simple' | 'choice' | 'multicast' | 'recursion' | 'parallel' | 'complex' | 'edge-cases' | 'types' | 'invalid';
  source: string;
  description: string;
  expectedValid: boolean;
  expectedProperties?: {
    roles: string[];
    hasDeadlock: boolean;
    hasRaces: boolean;
    messageCount: number;
    stateCount?: Record<string, number>;
  };
  performance?: {
    maxParseTimeMs: number;
    maxProjectionTimeMs: number;
  };
}

// ============================================================================
// Protocol Specifications
// ============================================================================

const protocols: ProtocolSpec[] = [
  // ========== SIMPLE PROTOCOLS ==========
  {
    name: 'request-response',
    category: 'simple',
    source: `protocol RequestResponse(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}`,
    description: 'Basic request-response pattern',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'Server'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
      stateCount: {
        'Client': 3,
        'Server': 3,
      },
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 100,
    },
  },

  {
    name: 'ping-pong',
    category: 'simple',
    source: `protocol PingPong(role A, role B) {
  A -> B: Ping();
  B -> A: Pong();
}`,
    description: 'Simple ping-pong protocol',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 100,
    },
  },

  {
    name: 'three-party',
    category: 'simple',
    source: `protocol ThreeParty(role A, role B, role C) {
  A -> B: M1(Int);
  B -> C: M2(String);
  C -> A: M3(Bool);
}`,
    description: 'Three-party circular communication',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B', 'C'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 3,
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 150,
    },
  },

  // ========== CHOICE PROTOCOLS ==========
  {
    name: 'simple-choice',
    category: 'choice',
    source: `protocol SimpleChoice(role Client, role Server) {
  choice at Client {
    Client -> Server: Accept();
  } or {
    Client -> Server: Reject();
  }
}`,
    description: 'Basic binary choice',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'Server'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'choice-with-continuation',
    category: 'choice',
    source: `protocol ChoiceWithContinuation(role A, role B) {
  choice at A {
    A -> B: Yes();
    B -> A: Confirm();
  } or {
    A -> B: No();
  }
}`,
    description: 'Choice with different continuations',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 3,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'nested-choice',
    category: 'choice',
    source: `protocol NestedChoice(role Client, role Server) {
  choice at Client {
    Client -> Server: Login(String);
    choice at Server {
      Server -> Client: Success();
    } or {
      Server -> Client: Failure();
    }
  } or {
    Client -> Server: Cancel();
  }
}`,
    description: 'Nested choice structures',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'Server'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 4,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 200,
    },
  },

  // ========== MULTICAST PROTOCOLS ==========
  {
    name: 'simple-multicast',
    category: 'multicast',
    source: `protocol SimpleMulticast(role Pub, role Sub1, role Sub2) {
  Pub -> Sub1, Sub2: Event(String);
}`,
    description: 'Basic multicast/broadcast',
    expectedValid: true,
    expectedProperties: {
      roles: ['Pub', 'Sub1', 'Sub2'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 1,
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'pub-sub',
    category: 'multicast',
    source: `protocol PubSub(role Publisher, role Sub1, role Sub2, role Sub3) {
  Publisher -> Sub1, Sub2, Sub3: Publish(Int);
  Sub1 -> Publisher: Ack1();
  Sub2 -> Publisher: Ack2();
  Sub3 -> Publisher: Ack3();
}`,
    description: 'Pub-sub with acknowledgments',
    expectedValid: true,
    expectedProperties: {
      roles: ['Publisher', 'Sub1', 'Sub2', 'Sub3'],
      hasDeadlock: false,
      hasRaces: true, // Acks can race
      messageCount: 4,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 200,
    },
  },

  {
    name: 'multicast-choice',
    category: 'multicast',
    source: `protocol MulticastChoice(role Leader, role F1, role F2) {
  choice at Leader {
    Leader -> F1, F2: Commit();
  } or {
    Leader -> F1, F2: Abort();
  }
}`,
    description: 'Multicast combined with choice',
    expectedValid: true,
    expectedProperties: {
      roles: ['Leader', 'F1', 'F2'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 200,
    },
  },

  // ========== RECURSION PROTOCOLS ==========
  {
    name: 'simple-recursion',
    category: 'recursion',
    source: `protocol SimpleRecursion(role Producer, role Consumer) {
  rec Loop {
    Producer -> Consumer: Data(String);
    choice at Consumer {
      Consumer -> Producer: Continue();
      continue Loop;
    } or {
      Consumer -> Producer: Stop();
    }
  }
}`,
    description: 'Basic recursion with termination',
    expectedValid: true,
    expectedProperties: {
      roles: ['Producer', 'Consumer'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 3,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 200,
    },
  },

  {
    name: 'streaming',
    category: 'recursion',
    source: `protocol Streaming(role Server, role Client) {
  rec Stream {
    Server -> Client: Chunk(Int);
    Client -> Server: Ack();
    continue Stream;
  }
}`,
    description: 'Infinite streaming protocol',
    expectedValid: true,
    expectedProperties: {
      roles: ['Server', 'Client'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'nested-recursion',
    category: 'recursion',
    source: `protocol NestedRecursion(role A, role B) {
  rec Outer {
    A -> B: Start();
    rec Inner {
      B -> A: Data(Int);
      choice at A {
        A -> B: MoreInner();
        continue Inner;
      } or {
        A -> B: DoneInner();
      }
    }
    choice at A {
      A -> B: MoreOuter();
      continue Outer;
    } or {
      A -> B: DoneOuter();
    }
  }
}`,
    description: 'Nested recursion structures',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 6,
    },
    performance: {
      maxParseTimeMs: 150,
      maxProjectionTimeMs: 300,
    },
  },

  // ========== PARALLEL PROTOCOLS ==========
  {
    name: 'independent-parallel',
    category: 'parallel',
    source: `protocol IndependentParallel(role A, role B, role C) {
  par {
    A -> B: M1(Int);
  } and {
    A -> C: M2(String);
  }
}`,
    description: 'Independent parallel actions',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B', 'C'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'parallel-collection',
    category: 'parallel',
    source: `protocol ParallelCollection(role Coordinator, role W1, role W2) {
  Coordinator -> W1, W2: Task(String);
  par {
    W1 -> Coordinator: Result1(Int);
  } and {
    W2 -> Coordinator: Result2(Int);
  }
}`,
    description: 'Parallel result collection',
    expectedValid: true,
    expectedProperties: {
      roles: ['Coordinator', 'W1', 'W2'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 3,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 200,
    },
  },

  // ========== COMPLEX PROTOCOLS ==========
  {
    name: 'two-buyer',
    category: 'complex',
    source: `protocol TwoBuyer(role Seller, role Buyer1, role Buyer2) {
  Seller -> Buyer1, Buyer2: Quote(Int);
  Buyer1 -> Buyer2: Share(Int);
  choice at Buyer2 {
    Buyer2 -> Seller: Accept();
    Seller -> Buyer1, Buyer2: Confirm(Bool);
  } or {
    Buyer2 -> Seller: Reject();
  }
}`,
    description: 'Classic two-buyer protocol',
    expectedValid: true,
    expectedProperties: {
      roles: ['Seller', 'Buyer1', 'Buyer2'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 5,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 300,
    },
  },

  {
    name: 'three-buyer',
    category: 'complex',
    source: `protocol ThreeBuyer(role Seller, role B1, role B2, role B3) {
  Seller -> B1, B2, B3: Quote(Int);
  B1 -> B2: Share1(Int);
  B2 -> B3: Share2(Int);
  B3 -> B1: Share3(Int);
  choice at B3 {
    B3 -> Seller: Buy(String);
    Seller -> B1, B2, B3: Confirm(Bool);
  } or {
    B3 -> Seller: Quit();
  }
}`,
    description: 'Three-buyer with circular sharing',
    expectedValid: true,
    expectedProperties: {
      roles: ['Seller', 'B1', 'B2', 'B3'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 7,
    },
    performance: {
      maxParseTimeMs: 150,
      maxProjectionTimeMs: 400,
    },
  },

  {
    name: 'two-phase-commit',
    category: 'complex',
    source: `protocol TwoPhaseCommit(role Coordinator, role P1, role P2) {
  Coordinator -> P1, P2: Prepare();
  par {
    P1 -> Coordinator: Vote1(Bool);
  } and {
    P2 -> Coordinator: Vote2(Bool);
  }
  choice at Coordinator {
    Coordinator -> P1, P2: Commit();
  } or {
    Coordinator -> P1, P2: Abort();
  }
}`,
    description: 'Two-phase commit protocol',
    expectedValid: true,
    expectedProperties: {
      roles: ['Coordinator', 'P1', 'P2'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 5,
    },
    performance: {
      maxParseTimeMs: 150,
      maxProjectionTimeMs: 300,
    },
  },

  {
    name: 'oauth-flow',
    category: 'complex',
    source: `protocol OAuth(role Client, role AuthServer, role ResourceServer) {
  Client -> AuthServer: AuthRequest(String);
  choice at AuthServer {
    AuthServer -> Client: AuthToken(String);
    Client -> ResourceServer: ResourceRequest(String);
    ResourceServer -> Client: Resource(String);
  } or {
    AuthServer -> Client: AuthDenied();
  }
}`,
    description: 'OAuth-like authentication flow',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'AuthServer', 'ResourceServer'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 5,
    },
    performance: {
      maxParseTimeMs: 150,
      maxProjectionTimeMs: 300,
    },
  },

  // ========== TYPE EXAMPLES ==========
  {
    name: 'simple-types',
    category: 'types',
    source: `protocol SimpleTypes(role A, role B) {
  A -> B: IntMsg(Int);
  A -> B: StringMsg(String);
  A -> B: BoolMsg(Bool);
}`,
    description: 'Simple type examples',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 3,
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 100,
    },
  },

  {
    name: 'parametric-types',
    category: 'types',
    source: `protocol ParametricTypes(role Client, role Server) {
  Client -> Server: ListRequest(List<String>);
  Server -> Client: MapResponse(Map<String, Int>);
}`,
    description: 'Parametric type examples',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'Server'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'nested-parametric',
    category: 'types',
    source: `protocol NestedParametric(role A, role B) {
  A -> B: Data(Map<String, List<Int>>);
  B -> A: Response(List<Map<String, Bool>>);
}`,
    description: 'Nested parametric types',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 75,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'complex-nesting',
    category: 'types',
    source: `protocol ComplexNesting(role Client, role Server) {
  Client -> Server: Request(Map<String, List<Map<Int, String>>>);
  Server -> Client: Response(List<List<Map<String, Int>>>);
}`,
    description: 'Complex deeply nested types',
    expectedValid: true,
    expectedProperties: {
      roles: ['Client', 'Server'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 2,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 150,
    },
  },

  // ========== EDGE CASES ==========
  {
    name: 'unused-role',
    category: 'edge-cases',
    source: `protocol UnusedRole(role A, role B, role C) {
  A -> B: Message(String);
}`,
    description: 'Protocol with unused role C',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B', 'C'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 1,
    },
    performance: {
      maxParseTimeMs: 50,
      maxProjectionTimeMs: 150,
    },
  },

  {
    name: 'many-roles',
    category: 'edge-cases',
    source: `protocol ManyRoles(role R1, role R2, role R3, role R4, role R5) {
  R1 -> R2: M1();
  R2 -> R3: M2();
  R3 -> R4: M3();
  R4 -> R5: M4();
  R5 -> R1: M5();
}`,
    description: 'Protocol with many roles',
    expectedValid: true,
    expectedProperties: {
      roles: ['R1', 'R2', 'R3', 'R4', 'R5'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 5,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 250,
    },
  },

  {
    name: 'long-sequence',
    category: 'edge-cases',
    source: `protocol LongSequence(role A, role B) {
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
}`,
    description: 'Long message sequence',
    expectedValid: true,
    expectedProperties: {
      roles: ['A', 'B'],
      hasDeadlock: false,
      hasRaces: false,
      messageCount: 10,
    },
    performance: {
      maxParseTimeMs: 100,
      maxProjectionTimeMs: 200,
    },
  },
];

// ============================================================================
// Generation Logic
// ============================================================================

function generateProtocols() {
  const baseDir = path.join(process.cwd(), 'tests', 'golden');

  console.log('🔧 Generating Golden Protocol Test Fixtures');
  console.log('═'.repeat(80));

  // Generate protocol files
  let count = 0;
  for (const protocol of protocols) {
    const dir = path.join(baseDir, 'protocols', protocol.category);
    const filepath = path.join(dir, `${protocol.name}.scr`);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, protocol.source.trim() + '\n');

    console.log(`✓ ${protocol.category.padEnd(15)} ${protocol.name.padEnd(30)} ${protocol.description}`);
    count++;
  }

  console.log('');
  console.log(`✓ Generated ${count} protocols`);

  // Generate metadata
  const metadata: Record<string, any> = {};
  for (const p of protocols) {
    metadata[p.name] = {
      description: p.description,
      category: p.category,
      expectedValid: p.expectedValid,
      ...(p.expectedProperties && { expectedProperties: p.expectedProperties }),
      ...(p.performance && { performance: p.performance }),
    };
  }

  const metadataPath = path.join(baseDir, 'metadata', 'protocols.json');
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');

  console.log(`✓ Generated metadata: ${metadataPath}`);

  // Generate README
  const readmePath = path.join(baseDir, 'README.md');
  const readme = generateReadme(protocols);
  fs.writeFileSync(readmePath, readme);

  console.log(`✓ Generated README: ${readmePath}`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('✓ Golden protocol generation complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review generated protocols in tests/golden/protocols/');
  console.log('  2. Run: npm run test:golden');
  console.log('  3. Generated snapshots will be created in tests/golden/snapshots/');
}

function generateReadme(protocols: ProtocolSpec[]): string {
  const byCategory: Record<string, ProtocolSpec[]> = {};
  for (const p of protocols) {
    if (!byCategory[p.category]) {
      byCategory[p.category] = [];
    }
    byCategory[p.category].push(p);
  }

  let readme = `# Golden Protocol Test Suite

This directory contains golden test protocols for regression testing and safe language evolution.

## Purpose

These protocols serve as:
1. **Regression Tests** - Catch breaking changes immediately
2. **Golden Outputs** - Known-correct verified protocols
3. **Documentation** - Examples of all language features
4. **Performance Baselines** - Track projection/verification time

## Structure

\`\`\`
tests/golden/
├── protocols/           # Source .scr files
├── snapshots/           # Golden outputs (CFG, CFSM, local protocols, verification)
├── metadata/            # Test metadata and expected properties
└── README.md            # This file
\`\`\`

## Protocol Categories

`;

  const categoryOrder = ['simple', 'choice', 'multicast', 'recursion', 'parallel', 'complex', 'types', 'edge-cases', 'invalid'];

  for (const category of categoryOrder) {
    if (!byCategory[category]) continue;

    readme += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

    for (const p of byCategory[category]) {
      readme += `- **${p.name}** - ${p.description}\n`;
    }

    readme += '\n';
  }

  readme += `## Running Tests

\`\`\`bash
# Run all golden tests
npm run test:golden

# Update snapshots (use with caution!)
npm run test:golden:update
\`\`\`

## Adding New Protocols

1. Add protocol to \`scripts/generate-golden-protocols.ts\`
2. Run \`npm run generate:golden\`
3. Run \`npm run test:golden\` to generate initial snapshots
4. Review and commit snapshots

## Generated: ${new Date().toISOString()}

Total protocols: ${protocols.length}
`;

  return readme;
}

// ============================================================================
// Main
// ============================================================================

generateProtocols();
