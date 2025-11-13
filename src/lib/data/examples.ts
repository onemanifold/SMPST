/**
 * Example Scribble protocols for the protocol library
 */

export interface ProtocolExample {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
}

export const protocolExamples: ProtocolExample[] = [
  {
    id: 'request-response',
    name: 'Request-Response',
    description: 'Simple client-server request-response pattern',
    category: 'Basic',
    code: `protocol RequestResponse(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}`
  },
  {
    id: 'two-buyer',
    name: 'Two-Buyer Protocol',
    description: 'Classic two-buyer coordination protocol',
    category: 'Classic',
    code: `protocol TwoBuyer(role Buyer1, role Buyer2, role Seller) {
  Buyer1 -> Seller: BookQuote(String);
  Seller -> Buyer1: Quote(Int);
  Seller -> Buyer2: Quote(Int);
  Buyer1 -> Buyer2: Share(Int);
  choice at Buyer2 {
    Buyer2 -> Seller: Buy();
    Buyer2 -> Buyer1: Buy();
  } or {
    Buyer2 -> Seller: Quit();
    Buyer2 -> Buyer1: Quit();
  }
}`
  },
  {
    id: 'three-party',
    name: 'Three-Party Coordination',
    description: 'Coordinator pattern with three roles',
    category: 'Basic',
    code: `protocol ThreeParty(role A, role B, role C) {
  A -> B: Init(String);
  A -> C: Init(String);
  B -> A: Ack();
  C -> A: Ack();
  A -> B: Done();
  A -> C: Done();
}`
  },
  {
    id: 'streaming',
    name: 'Streaming Protocol',
    description: 'Producer-consumer streaming with recursion',
    category: 'Advanced',
    code: `protocol Streaming(role Producer, role Consumer) {
  rec Loop {
    choice at Producer {
      Producer -> Consumer: Data(String);
      continue Loop;
    } or {
      Producer -> Consumer: End();
    }
  }
}`
  },
  {
    id: 'parallel-branches',
    name: 'Parallel Branches',
    description: 'Independent parallel communication branches',
    category: 'Advanced',
    code: `protocol Parallel(role A, role B, role C) {
  par {
    A -> B: Msg1(Int);
  } and {
    A -> C: Msg2(String);
  }
  B -> C: Sync();
}`
  },
  {
    id: 'nested-choice',
    name: 'Nested Choice',
    description: 'Protocol with nested choice constructs',
    category: 'Advanced',
    code: `protocol NestedChoice(role Client, role Server) {
  Client -> Server: Request(String);
  choice at Server {
    Server -> Client: Success(Int);
    choice at Client {
      Client -> Server: Continue();
    } or {
      Client -> Server: Stop();
    }
  } or {
    Server -> Client: Error(String);
  }
}`
  },
  {
    id: 'two-phase-commit',
    name: 'Two-Phase Commit',
    description: 'Distributed transaction coordination',
    category: 'Classic',
    code: `protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
  Coordinator -> Participant1: Prepare();
  Coordinator -> Participant2: Prepare();

  par {
    choice at Participant1 {
      Participant1 -> Coordinator: Vote(Boolean);
    }
  } and {
    choice at Participant2 {
      Participant2 -> Coordinator: Vote(Boolean);
    }
  }

  choice at Coordinator {
    Coordinator -> Participant1: Commit();
    Coordinator -> Participant2: Commit();
  } or {
    Coordinator -> Participant1: Abort();
    Coordinator -> Participant2: Abort();
  }
}`
  },
  {
    id: 'conditional-recursion',
    name: 'Conditional Recursion',
    description: 'Recursion with conditional exit',
    category: 'Advanced',
    code: `protocol ConditionalLoop(role Client, role Server) {
  rec Loop {
    Client -> Server: Request(Int);
    choice at Server {
      Server -> Client: Continue(String);
      continue Loop;
    } or {
      Server -> Client: Stop();
    }
  }
}`
  }
];

export const categories = ['All', 'Basic', 'Classic', 'Advanced'];

export function getExampleById(id: string): ProtocolExample | undefined {
  return protocolExamples.find(ex => ex.id === id);
}

export function getExamplesByCategory(category: string): ProtocolExample[] {
  if (category === 'All') {
    return protocolExamples;
  }
  return protocolExamples.filter(ex => ex.category === category);
}
