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
  },

  // "Less is More" Examples - Protocols that demonstrate bottom-up MPST
  {
    id: 'oauth',
    name: 'OAuth Protocol ⭐',
    description: 'The breakthrough example! Safe but not consistent with classic MPST. Demonstrates why bottom-up MPST is more general.',
    category: 'Less is More',
    code: `protocol OAuth(role s, role c, role a) {
  choice at s {
    s -> c: login();
    c -> a: passwd(String);
    a -> s: auth(Boolean);
  } or {
    s -> c: cancel();
    c -> a: quit();
  }
}`
  },
  {
    id: 'travel-agency',
    name: 'Travel Agency',
    description: 'Nested choices with asymmetric participation (from "Less is More" paper Fig 4.2)',
    category: 'Less is More',
    code: `protocol TravelAgency(role c, role a, role s) {
  choice at c {
    c -> a: query();
    a -> c: quote(Int);
    choice at c {
      c -> a: accept();
      a -> c: invoice(Int);
      c -> a: pay();
      a -> s: confirm();
    } or {
      c -> a: reject();
    }
  } or {
    c -> a: cancel();
  }
}`
  },
  {
    id: 'three-buyer-extended',
    name: 'Three-Buyer (Extended)',
    description: 'Extended three-buyer with multicast messages (classic MPST example)',
    category: 'Less is More',
    code: `protocol ThreeBuyer(role S, role B1, role B2, role B3) {
  S -> B1: title(String);
  B1 -> B2: title(String);
  B1 -> B3: title(String);
  S -> B1: price(Int);
  B1 -> B2: price(Int);
  B1 -> B3: price(Int);
  B2 -> B1: share(Int);
  B3 -> B1: share(Int);
  choice at B1 {
    B1 -> S: ok();
    B1 -> B2: ok();
    B1 -> B3: ok();
    B2 -> S: addr(String);
  } or {
    B1 -> S: quit();
    B1 -> B2: quit();
    B1 -> B3: quit();
  }
}`
  },
  {
    id: 'tcp-handshake',
    name: 'TCP Handshake',
    description: 'Simplified TCP connection establishment',
    category: 'Less is More',
    code: `protocol TCPHandshake(role Client, role Server) {
  Client -> Server: SYN();
  Server -> Client: SYNACK();
  Client -> Server: ACK();
}`
  },
  {
    id: 'http-request',
    name: 'HTTP Request-Response',
    description: 'HTTP protocol with optional keep-alive',
    category: 'Less is More',
    code: `protocol HTTPRequest(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
  choice at Client {
    Client -> Server: KeepAlive();
    Client -> Server: Request(String);
    Server -> Client: Response(Int);
  } or {
    Client -> Server: Close();
  }
}`
  }
];

export const categories = ['All', 'Basic', 'Classic', 'Advanced', 'Less is More'];

export function getExampleById(id: string): ProtocolExample | undefined {
  return protocolExamples.find(ex => ex.id === id);
}

export function getExamplesByCategory(category: string): ProtocolExample[] {
  if (category === 'All') {
    return protocolExamples;
  }
  return protocolExamples.filter(ex => ex.category === category);
}
