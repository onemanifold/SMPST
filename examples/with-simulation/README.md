# SMPST Protocol Examples with Simulation

This directory contains real-world protocol examples with complete simulation demonstrations.

## Overview

Each example includes:
- **`.smp` file**: Protocol specification in SMPST syntax
- **`.ts` file**: Simulation script showing how to run the protocol
- **Complete output**: Expected execution traces and results

## Examples

### 1. E-Commerce (Buyer-Seller-Shipper)

**File:** `buyer-seller-shipper.smp`

**Description:** Three-party protocol demonstrating multi-role coordination in an e-commerce scenario.

**Flow:**
```
Buyer → Seller:  Order
Seller → Shipper: ShipRequest
Shipper → Buyer:  DeliveryConfirmation
```

**Run:**
```bash
npx ts-node examples/with-simulation/buyer-seller-shipper.ts
```

**Expected Output:**
- 3 roles projected (Buyer, Seller, Shipper)
- All roles complete successfully
- 3 messages exchanged
- Sequential coordination verified

**Concepts Demonstrated:**
- Multi-party protocols
- Message routing between roles
- Sequential workflow
- FIFO message delivery

---

### 2. Banking Transaction

**File:** `banking-transaction.smp`

**Description:** Two-party protocol with choice, demonstrating error handling in financial transactions.

**Flow:**
```
Client → Bank: TransferRequest
Bank → Client: TransferSuccess  (success branch)
           OR
           TransferFailure (failure branch)
```

**Run:**
```bash
npx ts-node examples/with-simulation/banking-transaction.ts
```

**Expected Output:**
- 2 roles projected (Client, Bank)
- Choice point at Bank role
- Multiple simulations show both branches
- Success and failure paths verified

**Concepts Demonstrated:**
- Choice/branching protocols
- Non-deterministic execution
- Error handling patterns
- Request-response with outcomes

---

### 3. Authentication

**File:** `authentication.smp`

**Description:** Login protocol with conditional data access based on authentication result.

**Flow:**
```
Success path:
  User → Server: LoginRequest
  Server → User: AuthToken
  User → Server: DataRequest
  Server → User: DataResponse

Failure path:
  User → Server: LoginRequest
  Server → User: AuthError
  (protocol terminates)
```

**Run:**
```bash
npx ts-node examples/with-simulation/authentication.ts
```

**Expected Output:**
- 2 roles projected (User, Server)
- Choice based on authentication
- Success path: 4 messages
- Failure path: 2 messages
- Both branches verified

**Concepts Demonstrated:**
- Authentication patterns
- Conditional protocol continuation
- Choice with different path lengths
- Session management

---

## How to Run

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

### Running an Example

```bash
npx ts-node examples/with-simulation/<example-name>.ts
```

For example:
```bash
npx ts-node examples/with-simulation/buyer-seller-shipper.ts
```

### What You'll See

Each simulation shows:
1. **Parsing**: Protocol source → AST
2. **CFG Building**: AST → Control Flow Graph
3. **Projection**: CFG → CFSMs (one per role)
4. **Simulation**: Distributed execution
5. **Traces**: Event timeline for each role
6. **Results**: Success/failure, message flow

## Understanding the Output

### Parsing Output
```
📄 Step 1: Parsing protocol...
   ✓ Parsed protocol: ECommerce
   ✓ Roles: Buyer, Seller, Shipper
```

Shows successful protocol parsing and role identification.

### CFG Building
```
🔧 Step 2: Building Control Flow Graph...
   ✓ CFG nodes: 8
   ✓ CFG edges: 7
```

Displays the internal control flow graph structure.

### Projection Output
```
📊 Step 3: Projecting to CFSMs (pure LTS)...
   ✓ Projected 3 roles
     - Buyer: 3 states, 2 transitions
     - Seller: 4 states, 3 transitions
     - Shipper: 3 states, 2 transitions
```

Shows each role's CFSM structure (states and transitions).

### Simulation Output
```
🎬 Step 4: Simulating distributed execution...
   ✓ Simulation completed successfully!
   ✓ Total steps: 6
```

Confirms successful execution and total steps taken.

### Execution Traces
```
📋 Step 5: Execution Traces

Buyer:
  Steps: 2
  Events: 2
  Completed: ✓

  Event Timeline:
    1. [10:30:15] SEND Order → Seller
    2. [10:30:15] RECV DeliveryConfirmation ← Shipper
```

Shows detailed event timeline for each role.

## Key Concepts

### Pure LTS Semantics

All examples use **pure LTS (Labeled Transition System)** semantics:
- States are control locations
- Actions live on transitions
- No CFG pollution in CFSM interface

### FIFO Message Delivery

Messages are delivered in **FIFO order** (First-In-First-Out):
- One queue per sender-receiver pair
- Messages consumed in send order
- Verified by Theorem 5.3 (Honda et al. 2016)

### Asynchronous Execution

Protocols execute **asynchronously**:
- Send operations are non-blocking
- Receive operations block until message available
- Roles progress independently

### Deadlock Detection

Simulator detects **deadlocks** at runtime:
- No role has enabled transitions
- Not all roles reached terminal states
- Reports which roles are stuck

## Creating Your Own Examples

### 1. Write Protocol

Create a `.smp` file:
```
protocol MyProtocol(role A, role B) {
  A -> B: Message1(String);
  B -> A: Message2(Int);
}
```

### 2. Create Simulation Script

```typescript
import { parse } from '../../src/core/parser/parser';
import { buildCFG } from '../../src/core/cfg/builder';
import { projectAll } from '../../src/core/projection/projector';
import { DistributedSimulator } from '../../src/core/simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../../src/core/parser/ast';

// Parse
const ast = parse(protocolSource);
const protocol = ast.declarations[0] as GlobalProtocolDeclaration;

// Build CFG
const cfg = buildCFG(protocol);

// Project
const projection = projectAll(cfg);

// Simulate
const sim = new DistributedSimulator(projection.cfsms, {
  schedulingStrategy: 'round-robin',
  recordTrace: true,
});

const result = sim.run();

// Check results
if (result.success) {
  console.log('Success!');
  console.log('Traces:', result.traces);
} else {
  console.error('Failed:', result.error);
}
```

### 3. Run

```bash
npx ts-node your-example.ts
```

## Troubleshooting

### Parse Errors

**Error:** `Parser error at line X, column Y`

**Solution:** Check protocol syntax:
- Role declarations: `role RoleName`
- Message syntax: `Sender -> Receiver: Label(Type)`
- Choice syntax: `choice at Role { ... } or { ... }`

### Projection Errors

**Error:** `Projection failed for role X`

**Solution:** Check protocol structure:
- All roles must have actions
- Message flows must be consistent
- No orphaned roles

### Simulation Errors

**Error:** `Deadlock detected`

**Solution:** Check protocol logic:
- Ensure receives have matching sends
- Verify no circular waits
- Check choice branches are reachable

**Error:** `Maximum steps reached`

**Solution:**
- Increase `maxSteps` in simulator config
- Check for infinite loops in protocol
- Verify protocol reaches terminal states

## References

### Academic Papers

- Honda, K., Yoshida, N., & Carbone, M. (2016). "Multiparty Asynchronous Session Types." Journal of the ACM, 63(1).
- Brand, D., & Zafiropulo, P. (1983). "On Communicating Finite-State Machines." Journal of the ACM, 30(2), 323-342.

### Documentation

- **End-to-End Integration Test:** `/src/core/__tests__/end-to-end.test.ts`
- **Simulation Engine Documentation:** `/docs/implementation/simulation-status.md`
- **Usage Examples:** `/docs/examples/simulation-usage.md`
- **Formal Verification:** `/docs/implementation/simulation-formal-verification.md`

## Contributing

To add a new example:

1. Create `example-name.smp` protocol file
2. Create `example-name.ts` simulation script
3. Test with `npx ts-node example-name.ts`
4. Update this README with description
5. Commit both files

## License

MIT
