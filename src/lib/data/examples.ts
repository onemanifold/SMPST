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
    code: `global protocol RequestResponse(role Client, role Server) {
  Request(String) from Client to Server;
  Response(Int) from Server to Client;
}`
  },
  {
    id: 'two-buyer',
    name: 'Two-Buyer Protocol',
    description: 'Classic two-buyer coordination protocol',
    category: 'Classic',
    code: `global protocol TwoBuyer(role Buyer1, role Buyer2, role Seller) {
  BookQuote(String) from Buyer1 to Seller;
  Quote(Int) from Seller to Buyer1;
  Quote(Int) from Seller to Buyer2;
  Share(Int) from Buyer1 to Buyer2;
  choice at Buyer2 {
    Buy() from Buyer2 to Seller;
    Buy() from Buyer2 to Buyer1;
  } or {
    Quit() from Buyer2 to Seller;
    Quit() from Buyer2 to Buyer1;
  }
}`
  },
  {
    id: 'three-party',
    name: 'Three-Party Coordination',
    description: 'Coordinator pattern with three roles',
    category: 'Basic',
    code: `global protocol ThreeParty(role A, role B, role C) {
  Init(String) from A to B;
  Init(String) from A to C;
  Ack() from B to A;
  Ack() from C to A;
  Done() from A to B;
  Done() from A to C;
}`
  },
  {
    id: 'streaming',
    name: 'Streaming Protocol',
    description: 'Producer-consumer streaming with recursion',
    category: 'Advanced',
    code: `global protocol Streaming(role Producer, role Consumer) {
  rec Loop {
    choice at Producer {
      Data(String) from Producer to Consumer;
      continue Loop;
    } or {
      End() from Producer to Consumer;
    }
  }
}`
  },
  {
    id: 'parallel-branches',
    name: 'Parallel Branches',
    description: 'Independent parallel communication branches',
    category: 'Advanced',
    code: `global protocol Parallel(role A, role B, role C) {
  par {
    Msg1(Int) from A to B;
  } and {
    Msg2(String) from A to C;
  }
  Sync() from B to C;
}`
  },
  {
    id: 'nested-choice',
    name: 'Nested Choice',
    description: 'Protocol with nested choice constructs',
    category: 'Advanced',
    code: `global protocol NestedChoice(role Client, role Server) {
  Request(String) from Client to Server;
  choice at Server {
    Success(Int) from Server to Client;
    choice at Client {
      Continue() from Client to Server;
    } or {
      Stop() from Client to Server;
    }
  } or {
    Error(String) from Server to Client;
  }
}`
  },
  {
    id: 'two-phase-commit',
    name: 'Two-Phase Commit',
    description: 'Distributed transaction coordination',
    category: 'Classic',
    code: `global protocol TwoPhaseCommit(role Coordinator, role Participant1, role Participant2) {
  Prepare() from Coordinator to Participant1;
  Prepare() from Coordinator to Participant2;

  par {
    choice at Participant1 {
      Vote(Boolean) from Participant1 to Coordinator;
    }
  } and {
    choice at Participant2 {
      Vote(Boolean) from Participant2 to Coordinator;
    }
  }

  choice at Coordinator {
    Commit() from Coordinator to Participant1;
    Commit() from Coordinator to Participant2;
  } or {
    Abort() from Coordinator to Participant1;
    Abort() from Coordinator to Participant2;
  }
}`
  },
  {
    id: 'conditional-recursion',
    name: 'Conditional Recursion',
    description: 'Recursion with conditional exit',
    category: 'Advanced',
    code: `global protocol ConditionalLoop(role Client, role Server) {
  rec Loop {
    Request(Int) from Client to Server;
    choice at Server {
      Continue(String) from Server to Client;
      continue Loop;
    } or {
      Stop() from Server to Client;
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
