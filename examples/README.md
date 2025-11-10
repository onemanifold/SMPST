# Scribble Protocol Examples

This directory contains example Scribble 2.0 protocols demonstrating various features.

## Testing the Parser

You can parse any protocol file using:

```bash
npm run parse examples/<filename>.scr
```

Or parse from stdin:

```bash
echo "protocol Test(role A, role B) { A -> B: Hello(); }" | npm run parse -- --stdin
```

## Examples

### 1. Simple Request-Response
**File**: `simple-request-response.scr`

Basic client-server interaction with typed messages.

```bash
npm run parse examples/simple-request-response.scr
```

### 2. Two-Phase Commit
**File**: `two-phase-commit.scr`

Demonstrates:
- Parallel composition (votes collected concurrently)
- Choice (commit vs abort decision)
- Multiple roles coordination

```bash
npm run parse examples/two-phase-commit.scr
```

### 3. Streaming Protocol
**File**: `streaming-protocol.scr`

Demonstrates:
- Recursion (`rec` and `continue`)
- Choice within recursion for termination
- Server-initiated interactions

```bash
npm run parse examples/streaming-protocol.scr
```

### 4. Parallel Data Fetch
**File**: `parallel-data-fetch.scr`

Demonstrates:
- Parallel composition with multiple branches
- Synchronization point (join after parallel)
- Multiple server coordination

```bash
npm run parse examples/parallel-data-fetch.scr
```

## Features Covered

- ✅ Message transfer with payload types
- ✅ Choice (`choice at Role`)
- ✅ Parallel composition (`par { ... } and { ... }`)
- ✅ Recursion (`rec Label { ... }`)
- ✅ Continue statements (`continue Label`)
- ✅ Multiple roles
- ✅ Simple and parametric types (`String`, `Int`, `List<T>`)
- ✅ Protocol comments

## Next Steps

After parsing, protocols will be:
1. Transformed to CFG (Control Flow Graph)
2. Verified for deadlock, liveness, etc.
3. Projected to CFSM per role
4. Simulated interactively
5. Used to generate code
