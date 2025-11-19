# CLI Quick Start Guide

Get started with SMPST CLI tools in 5 minutes!

## Installation

```bash
cd SMPST
npm install
```

## Basic Usage

### 1. Parse a Protocol

Check if your protocol is valid:

```bash
npm run parse examples/request-response.scr
```

**Output:**
```
Parsing: examples/request-response.scr
✓ Parse successful!

Summary:
  Declarations: 1
  - Protocol: RequestResponse
    Roles: Client, Server
    Interactions: 2
```

### 2. Project to Local Protocols

Convert global protocol to local protocols:

```bash
npm run project examples/request-response.scr
```

**Output:**
```
📖 Parsing: examples/request-response.scr
✓ Parse successful!
  Protocol: RequestResponse
  Roles: Client, Server

📝 Local Protocol for: Client
local protocol RequestResponse_Client at Client () {
  Request(String) to Server;
  Response(Int) from Server;
}

📝 Local Protocol for: Server
local protocol RequestResponse_Server at Server () {
  Request(String) from Client;
  Response(Int) to Client;
}

✓ Projection complete!
```

### 3. Project Specific Role

Get local protocol for one role only:

```bash
npm run project examples/buyer-seller-agency.scr -- --role Buyer
```

**Output:**
```
📝 Local Protocol for: Buyer
local protocol Purchase_Buyer at Buyer () {
  Order(String) to Seller;
  Invoice(Int) from Seller;
}
```

### 4. Save to Files

Generate `.scr` files for each role:

```bash
npm run project examples/login-or-register.scr -- --output-dir ./local
```

This creates:
- `./local/Client.scr`
- `./local/Server.scr`

### 5. Quick Test with Stdin

Test projection without creating files:

```bash
echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run project -- --stdin
```

## Common Commands

```bash
# Show help
npm run project:help

# Parse protocol
npm run parse examples/request-response.scr

# Project all roles
npm run project examples/request-response.scr

# Project specific role
npm run project examples/request-response.scr -- --role Client

# Save to directory
npm run project examples/request-response.scr -- --output-dir ./local

# JSON format
npm run project examples/request-response.scr -- --format json

# Both text and JSON
npm run project examples/request-response.scr -- --format both --output-dir ./out

# From stdin
cat examples/request-response.scr | npm run project -- --stdin
```

## Example Protocols

Try these included examples:

```bash
# Simple request-response
npm run project examples/request-response.scr

# Choice (login or register)
npm run project examples/login-or-register.scr

# Recursion (streaming)
npm run project examples/stream-data.scr

# Three roles (with tau-elimination)
npm run project examples/buyer-seller-agency.scr

# Complex (travel agency from spec)
npm run project examples/travel-agency.scr
```

## Workflow Example

**Step 1:** Write a global protocol (`my-protocol.scr`)
```scribble
protocol MyProtocol(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}
```

**Step 2:** Validate it
```bash
npm run parse my-protocol.scr
```

**Step 3:** Generate local protocols
```bash
npm run project my-protocol.scr -- --output-dir ./local
```

**Step 4:** Use the generated files
```bash
ls ./local/
# Client.scr  Server.scr

cat ./local/Client.scr
```

## Next Steps

- **Full CLI Documentation**: See [docs/CLI.md](./CLI.md)
- **Projection Theory**: See [docs/LOCAL_PROTOCOL_PROJECTION.md](./LOCAL_PROTOCOL_PROJECTION.md)
- **API Usage**: See [src/core/projection/](../src/core/projection/)
- **More Examples**: See [examples/](../examples/)

## Troubleshooting

**Command not found?**
```bash
npm install
```

**Parse error?**
Check your protocol syntax against [Scribble specification](http://www.scribble.org/)

**Projection error?**
Make sure the role name matches exactly (case-sensitive):
```bash
npm run project protocol.scr -- --role Client  # ✓
npm run project protocol.scr -- --role client  # ✗ (wrong case)
```

**Need help?**
```bash
npm run project:help
```

## Tips

💡 **Use `--` when passing flags to npm scripts:**
```bash
npm run project file.scr -- --role Client
                          ^^
                          Required separator
```

💡 **Batch process multiple files:**
```bash
for file in examples/*.scr; do
  npm run project "$file" -- --output-dir ./local
done
```

💡 **Pipe to file:**
```bash
npm run project examples/protocol.scr -- --role Client > Client.scr
```

💡 **Check generated files immediately:**
```bash
npm run project protocol.scr -- --output-dir ./local && cat ./local/Client.scr
```

---

**Ready to dive deeper?** Check out the [full CLI documentation](./CLI.md)!
