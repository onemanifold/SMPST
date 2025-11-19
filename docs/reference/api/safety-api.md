# Safety API Guide for Frontend Developers

## Overview

The Safety API provides a clean, high-level interface for integrating "Less is More" MPST safety checking into the frontend without dealing with low-level details of parsing, projection, and CFSM manipulation.

**Location**: `src/core/safety-api.ts`

## Quick Start

```typescript
import { checkProtocolSafety } from './core/safety-api';

const result = checkProtocolSafety(protocolCode);

if ('type' in result) {
  // Handle error
  console.error(result.message);
} else {
  // Handle success
  if (result.safe) {
    console.log('✓ Protocol is safe!');
  } else {
    console.log('✗ Protocol has violations:');
    result.violations.forEach(v => console.log(`  - ${v.message}`));
  }
}
```

## Core Functions

### 1. `checkProtocolSafety(protocolCode: string)`

Main entry point for safety checking. Parses protocol, projects to CFSMs, and checks safety.

**Returns**: `ProtocolCheckResult | ProtocolError`

#### Success Result (`ProtocolCheckResult`)

```typescript
{
  safe: boolean;              // Whether protocol is safe
  violations: SafetyViolation[];  // List of violations (empty if safe)
  protocol: {
    name: string;            // Protocol name
    roles: string[];         // Role names
  };
  metrics: {
    statesExplored: number;  // States explored during check
    checkTime: number;       // Check time in milliseconds
    roleCount: number;       // Number of roles
    totalCFSMStates: number; // Total states across all CFSMs
  };
  cfsms: Map<string, CFSM>;  // CFSMs for visualization
}
```

#### Error Result (`ProtocolError`)

```typescript
{
  type: 'parse' | 'projection' | 'safety' | 'execution';
  message: string;
  location?: {
    line: number;
    column: number;
  };
}
```

**Example**:

```typescript
const oauth = `
  protocol OAuth(role s, role c, role a) {
    choice at s {
      s -> c: login();
      c -> a: passwd(String);
      a -> s: auth(Boolean);
    } or {
      s -> c: cancel();
      c -> a: quit();
    }
  }
`;

const result = checkProtocolSafety(oauth);

if ('type' in result) {
  console.error('Error:', result.message);
} else {
  console.log('Safe:', result.safe);
  console.log('States explored:', result.metrics.statesExplored);
  console.log('Check time:', result.metrics.checkTime + 'ms');
}
```

---

### 2. `executeProtocol(protocolCode: string, maxSteps?: number)`

Execute protocol step-by-step for visualization and debugging.

**Returns**: `ProtocolTrace | ProtocolError`

#### Success Result (`ProtocolTrace`)

```typescript
{
  contexts: TypingContext[];      // Sequence of execution states
  communications: Communication[]; // Messages sent
  completed: boolean;             // Whether execution reached terminal state
  steps: number;                  // Number of steps executed
}
```

**Example**:

```typescript
const trace = executeProtocol(protocolCode);

if ('type' in trace) {
  console.error('Execution failed:', trace.message);
} else {
  console.log(`Executed ${trace.steps} steps:`);
  trace.communications.forEach((comm, i) => {
    console.log(`${i + 1}. ${comm.sender} → ${comm.receiver}: ${comm.message}`);
  });
}
```

**Use Cases**:
- Protocol simulation in UI
- Step-by-step debugging
- Generating execution traces for visualization
- Testing protocol behavior

---

### 3. `getProtocolCFSMs(protocolCode: string)`

Get CFSMs without running safety check (faster for visualization only).

**Returns**: `Map<string, CFSM> | ProtocolError`

**Example**:

```typescript
const cfsmsOrError = getProtocolCFSMs(protocolCode);

if ('type' in cfsmsOrError) {
  console.error('Error:', cfsmsOrError.message);
} else {
  // Visualize CFSMs
  for (const [role, cfsm] of cfsmsOrError) {
    console.log(`Role ${role}:`, cfsm.states.length, 'states');
  }
}
```

---

### 4. `getRoleCFSM(protocolCode: string, role: string)`

Get CFSM for a specific role.

**Returns**: `CFSM | ProtocolError`

**Example**:

```typescript
const cfsmOrError = getRoleCFSM(protocolCode, 'Client');

if ('type' in cfsmOrError) {
  console.error('Error:', cfsmOrError.message);
} else {
  // Visualize specific role's CFSM
  console.log('States:', cfsmOrError.states);
  console.log('Transitions:', cfsmOrError.transitions);
}
```

---

## Utility Functions

### `formatViolation(violation: SafetyViolation): string`

Format violation for display.

```typescript
result.violations.forEach(v => {
  console.log(formatViolation(v));
});
```

### `formatCommunication(comm: Communication): string`

Format communication for display.

```typescript
trace.communications.forEach(c => {
  console.log(formatCommunication(c));
});
// Output: "Client → Server: Request(String)"
```

### `getProtocolStats(protocolCode: string)`

Get protocol statistics.

**Returns**: `{ roles: number; states: number; transitions: number } | ProtocolError`

```typescript
const stats = getProtocolStats(protocolCode);
if ('type' in stats) {
  console.error('Error:', stats.message);
} else {
  console.log(`${stats.roles} roles, ${stats.states} states, ${stats.transitions} transitions`);
}
```

---

## Type Reference

### `SafetyViolation`

```typescript
interface SafetyViolation {
  type: ViolationType;
  roles: string[];        // Roles involved
  message: string;        // Human-readable message
  context?: TypingContext; // Where violation occurred
  details?: {
    messageLabel?: string;
    sender?: string;
    receiver?: string;
    expected?: string;
    actual?: string;
  };
}

type ViolationType =
  | 'send-receive-mismatch'
  | 'orphan-receive'
  | 'type-mismatch'
  | 'recursion-error'
  | 'preservation-error'
  | 'stuck-state'
  | 'other';
```

### `Communication`

```typescript
interface Communication {
  sender: string;
  receiver: string;
  message: string;
  payloadType?: string;
  senderTransition: string;
  receiverTransition: string;
}
```

### `CFSM`

```typescript
interface CFSM {
  role: string;
  protocolName: string;
  states: CFSMState[];
  transitions: CFSMTransition[];
  initialState: string;
  terminalStates: string[];
}
```

---

## Frontend Integration Examples

### Example 1: Safety Panel Component

```typescript
import { checkProtocolSafety, formatViolation } from '@/core/safety-api';

function SafetyPanel({ protocolCode }: { protocolCode: string }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const checkResult = checkProtocolSafety(protocolCode);
    setResult(checkResult);
  }, [protocolCode]);

  if (!result) return <div>Checking...</div>;

  if ('type' in result) {
    return <div className="error">{result.message}</div>;
  }

  return (
    <div className="safety-panel">
      <h3>Safety Check</h3>
      <div className={result.safe ? 'safe' : 'unsafe'}>
        {result.safe ? '✓ SAFE' : '✗ UNSAFE'}
      </div>

      {result.violations.length > 0 && (
        <div className="violations">
          <h4>Violations:</h4>
          <ul>
            {result.violations.map((v, i) => (
              <li key={i}>{formatViolation(v)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="metrics">
        <p>States explored: {result.metrics.statesExplored}</p>
        <p>Check time: {result.metrics.checkTime}ms</p>
      </div>
    </div>
  );
}
```

### Example 2: Protocol Simulator

```typescript
import { executeProtocol, formatCommunication } from '@/core/safety-api';

function ProtocolSimulator({ protocolCode }: { protocolCode: string }) {
  const [trace, setTrace] = useState(null);

  const runSimulation = () => {
    const result = executeProtocol(protocolCode);

    if ('type' in result) {
      alert('Execution error: ' + result.message);
      return;
    }

    setTrace(result);
  };

  return (
    <div>
      <button onClick={runSimulation}>Run Simulation</button>

      {trace && (
        <div>
          <h3>Execution Trace ({trace.steps} steps)</h3>
          <ol>
            {trace.communications.map((comm, i) => (
              <li key={i}>{formatCommunication(comm)}</li>
            ))}
          </ol>
          {trace.completed && <p>✓ Completed successfully</p>}
        </div>
      )}
    </div>
  );
}
```

### Example 3: CFSM Visualizer

```typescript
import { getProtocolCFSMs } from '@/core/safety-api';

function CFSMVisualizer({ protocolCode, selectedRole }: Props) {
  const [cfsms, setCFSMs] = useState(null);

  useEffect(() => {
    const result = getProtocolCFSMs(protocolCode);

    if ('type' in result) {
      console.error(result.message);
      return;
    }

    setCFSMs(result);
  }, [protocolCode]);

  if (!cfsms) return <div>Loading...</div>;

  const cfsm = cfsms.get(selectedRole);
  if (!cfsm) return <div>Role not found</div>;

  return (
    <div>
      <h3>CFSM for {selectedRole}</h3>
      <div>
        <h4>States ({cfsm.states.length})</h4>
        <ul>
          {cfsm.states.map(s => (
            <li key={s.id}>{s.id}</li>
          ))}
        </ul>

        <h4>Transitions ({cfsm.transitions.length})</h4>
        <ul>
          {cfsm.transitions.map(t => (
            <li key={t.id}>
              {t.from} → {t.to}: {JSON.stringify(t.action)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## Error Handling Best Practices

Always check for errors using type discrimination:

```typescript
const result = checkProtocolSafety(protocolCode);

// Type guard
if ('type' in result) {
  // It's an error
  handleError(result);
} else {
  // It's a success result
  handleSuccess(result);
}
```

**Error types**:
- `'parse'`: Syntax error in Scribble code
- `'projection'`: Projection failed (malformed protocol)
- `'safety'`: Safety check encountered an error
- `'execution'`: Protocol execution failed (stuck/infinite loop)

---

## Performance Considerations

1. **Safety checking** is O(2^n) in the number of CFSM states, but:
   - Most protocols have < 100 states
   - Typical check time: 10-50ms
   - OAuth example: ~12ms

2. **Protocol execution** is linear in the number of steps:
   - Use `maxSteps` parameter to prevent infinite loops
   - Default: 1000 steps

3. **CFSM retrieval** is fast (no safety check):
   - Use `getProtocolCFSMs()` for visualization-only scenarios
   - Use `getRoleCFSM()` for single-role visualization

---

## Testing Your Integration

```typescript
import { checkProtocolSafety } from '@/core/safety-api';

describe('Safety API Integration', () => {
  it('should check OAuth protocol', () => {
    const oauth = `protocol OAuth(role s, role c, role a) {
      choice at s {
        s -> c: login();
        c -> a: passwd(String);
        a -> s: auth(Boolean);
      } or {
        s -> c: cancel();
        c -> a: quit();
      }
    }`;

    const result = checkProtocolSafety(oauth);

    expect('type' in result).toBe(false); // Not an error
    expect(result.safe).toBe(true);        // OAuth is safe!
  });
});
```

---

## Next Steps

1. **Implement UI components** using the API functions above
2. **Test with examples** in `src/lib/data/examples.ts`
3. **Add visualizations** using the CFSM data structures
4. **Extend with property selectors** (future: deadlock-freedom, liveness)

## Support

For questions or issues:
- See `docs/theory/safety-invariant-deep-dive.md` for theoretical background
- See `docs/UI_AND_TESTING_PLAN.md` for full UI roadmap
- See `src/__tests__/theorems/safety/` for usage examples
