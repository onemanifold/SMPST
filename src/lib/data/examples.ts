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
  // ============================================================================
  // DMst (Dynamically Updatable MPST) Examples
  // From Castro-Perez & Yoshida (ECOOP 2023)
  // ============================================================================
  {
    id: 'dynamic-worker',
    name: 'Dynamic Worker',
    description: 'Dynamic participant creation with invitation protocol',
    category: 'DMst',
    code: `protocol DynamicWorker(role Manager) {
  // Dynamic role declaration
  new role Worker;

  // Manager creates a Worker instance
  Manager creates Worker;

  // Manager invites Worker to join protocol
  Manager invites Worker;

  // After invitation, standard protocol interactions
  Manager -> Worker: Task(string);
  Worker -> Manager: Result(int);
}`
  },
  {
    id: 'updatable-pipeline',
    name: 'Updatable Pipeline',
    description: 'Growing participant set with updatable recursion',
    category: 'DMst',
    code: `protocol Pipeline(role Manager) {
  new role Worker;

  rec Loop {
    // Main loop body: process task with existing workers
    Manager creates Worker as w1;
    Manager invites w1;
    Manager -> w1: Task(string);
    w1 -> Manager: Result(int);

    choice at Manager {
      // Branch 1: Add a new worker (updatable recursion)
      continue Loop with {
        // Update body: create and assign task to new worker
        Manager creates Worker as w_new;
        Manager invites w_new;
        Manager -> w_new: Task(string);
        w_new -> Manager: Result(int);
      };
    } or {
      // Branch 2: Finish processing
      Manager -> w1: Done();
    }
  }
}`
  },
  {
    id: 'protocol-call',
    name: 'Protocol Call',
    description: 'Nested protocol composition with combining operator',
    category: 'DMst',
    code: `// Sub-protocol: Worker reports status
protocol SubTask(role w) {
  w -> Manager: Status(string);
}

// Main protocol: Coordinator manages Worker via SubTask
protocol Main(role Coordinator) {
  new role Worker;

  // Create and invite Worker
  Coordinator creates Worker;
  Coordinator invites Worker;

  // Call SubTask with Worker as parameter
  Coordinator calls SubTask(Worker);

  // Continue Main protocol after SubTask completes
  Coordinator -> Worker: Continue(string);
  Worker -> Coordinator: Done();
}`
  },
  {
    id: 'map-reduce',
    name: 'Map-Reduce',
    description: 'Elastic worker pool with all DMst features',
    category: 'DMst',
    code: `// Map task protocol: Worker processes chunk
protocol MapTask(role w, role m) {
  m -> w: Chunk(string);
  w -> m: MapResult(int);
}

// Main map-reduce protocol
protocol MapReduce(role Master) {
  new role Worker;

  // Create initial worker pool
  Master creates Worker as w1;
  Master invites w1;

  rec ProcessingLoop {
    // Distribute map task to worker
    Master calls MapTask(w1, Master);

    choice at Master {
      // Branch 1: Add worker and continue (updatable recursion)
      continue ProcessingLoop with {
        // Update body: add new worker
        Master creates Worker as w_new;
        Master invites w_new;
        Master calls MapTask(w_new, Master);
      };
    } or {
      // Branch 2: Reduce phase
      Master -> w1: Reduce();
      w1 -> Master: FinalResult(int);
    }
  }
}`
  }
];

export const categories = ['All', 'Basic', 'Classic', 'Advanced', 'DMst'];

export function getExampleById(id: string): ProtocolExample | undefined {
  return protocolExamples.find(ex => ex.id === id);
}

export function getExamplesByCategory(category: string): ProtocolExample[] {
  if (category === 'All') {
    return protocolExamples;
  }
  return protocolExamples.filter(ex => ex.category === category);
}
