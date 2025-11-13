# Command Line Interface (CLI) Tools

The SMPST IDE provides powerful command-line tools for working with Scribble protocols.

## Available Commands

### 1. `npm run parse` - Parse Scribble Protocols

Parse and validate Scribble protocol files, displaying the AST and summary information.

**Usage:**
```bash
npm run parse <file.scr>
npm run parse -- --stdin
```

**Examples:**
```bash
# Parse a protocol file
npm run parse examples/two-phase.scr

# Parse from stdin
echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run parse -- --stdin

# Parse and inspect AST
npm run parse examples/request-response.scr | jq '.declarations[0]'
```

**Output:**
- ✓ Parse status (success/failure)
- Complete AST in JSON format
- Summary statistics (protocols, roles, interactions)

---

### 2. `npm run project` - Project to Local Protocols

Project global protocols to local protocols following formal MPST rules.

**Usage:**
```bash
npm run project <file.scr> [options]
npm run project -- --stdin [options]
```

**Options:**
- `--role <name>` - Project for a specific role only
- `--output-dir <dir>` - Save local protocols to directory (one file per role)
- `--format <fmt>` - Output format: `text` (default), `json`, or `both`
- `--stdin` - Read from standard input
- `--help`, `-h` - Show help message

**Examples:**

```bash
# Project all roles to console (text format)
npm run project examples/two-phase.scr

# Project specific role
npm run project examples/two-phase.scr --role Client

# Save to files (creates Client.scr, Server.scr, etc.)
npm run project examples/two-phase.scr --output-dir ./local-protocols

# JSON output (AST format)
npm run project examples/two-phase.scr --format json

# Both text and JSON
npm run project examples/two-phase.scr --format both --output-dir ./out

# Read from stdin
echo "protocol Test(role A, role B) { A -> B: Msg(); }" | npm run project -- --stdin

# Pipeline: parse then project
cat examples/two-phase.scr | npm run project -- --stdin --role Client

# Show help
npm run project:help
```

**Output Formats:**

1. **Text** (default) - Scribble local protocol syntax
   ```scribble
   local protocol RequestResponse_Client at Client() {
     Request() to Server;
     Response() from Server;
   }
   ```

2. **JSON** - Local protocol AST
   ```json
   {
     "type": "LocalProtocolDeclaration",
     "name": "RequestResponse_Client",
     "role": "Client",
     "body": [...]
   }
   ```

3. **Both** - Generates both text and JSON files

---

## Complete Workflow Examples

### Example 1: Simple Request-Response

**Input file** (`examples/request-response.scr`):
```scribble
protocol RequestResponse(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}
```

**Command:**
```bash
npm run project examples/request-response.scr --output-dir ./local
```

**Output:**
```
📖 Parsing: examples/request-response.scr
═══════════════════════════════════════════════════════════════════════════════
✓ Parse successful!
  Protocol: RequestResponse
  Roles: Client, Server

🔄 Projecting to local protocols...
───────────────────────────────────────────────────────────────────────────────

📝 Local Protocol for: Client
───────────────────────────────────────────────────────────────────────────────
💾 Saved to: ./local/Client.scr
  Interactions: 2, Actions: 2

📝 Local Protocol for: Server
───────────────────────────────────────────────────────────────────────────────
💾 Saved to: ./local/Server.scr
  Interactions: 2, Actions: 2

───────────────────────────────────────────────────────────────────────────────
Summary:
  Total roles projected: 2
  Roles: Client, Server
  Output directory: ./local

═══════════════════════════════════════════════════════════════════════════════
✓ Projection complete!
```

**Generated files:**

`./local/Client.scr`:
```scribble
local protocol RequestResponse_Client at Client() {
  Request(String) to Server;
  Response(Int) from Server;
}
```

`./local/Server.scr`:
```scribble
local protocol RequestResponse_Server at Server() {
  Request(String) from Client;
  Response(Int) to Client;
}
```

---

### Example 2: Choice with Specific Role

**Input file** (`examples/login.scr`):
```scribble
protocol LoginOrRegister(role Client, role Server) {
  choice at Client {
    Client -> Server: Login(String);
    Server -> Client: Welcome();
  } or {
    Client -> Server: Register(String);
    Server -> Client: Confirm();
  }
}
```

**Command:**
```bash
npm run project examples/login.scr --role Client
```

**Output:**
```scribble
local protocol LoginOrRegister_Client at Client() {
  choice at Client {
    // Branch:
    Login(String) to Server;
    Welcome() from Server;
  } or {
    // Branch:
    Register(String) to Server;
    Confirm() from Server;
  }
}
```

---

### Example 3: Three-Role Protocol (Tau-Elimination)

**Input file** (`examples/buyer-seller-agency.scr`):
```scribble
protocol Purchase(role Buyer, role Seller, role CreditAgency) {
  Buyer -> Seller: Order(String);
  Seller -> CreditAgency: CheckCredit(Int);
  CreditAgency -> Seller: Approved();
  Seller -> Buyer: Invoice(Int);
}
```

**Command:**
```bash
npm run project examples/buyer-seller-agency.scr --output-dir ./out
```

**Output files:**

`./out/Buyer.scr` (CheckCredit and Approved are tau-eliminated):
```scribble
local protocol Purchase_Buyer at Buyer() {
  Order(String) to Seller;
  Invoice(Int) from Seller;
}
```

`./out/Seller.scr` (all messages visible):
```scribble
local protocol Purchase_Seller at Seller() {
  Order(String) from Buyer;
  CheckCredit(Int) to CreditAgency;
  Approved() from CreditAgency;
  Invoice(Int) to Buyer;
}
```

`./out/CreditAgency.scr` (Order and Invoice are tau-eliminated):
```scribble
local protocol Purchase_CreditAgency at CreditAgency() {
  CheckCredit(Int) from Seller;
  Approved() to Seller;
}
```

---

### Example 4: Recursion with Loop

**Input file** (`examples/stream.scr`):
```scribble
protocol StreamData(role Client, role Server) {
  rec Loop {
    choice at Client {
      Client -> Server: More();
      Server -> Client: Data(String);
      continue Loop;
    } or {
      Client -> Server: Done();
    }
  }
}
```

**Command:**
```bash
npm run project examples/stream.scr --role Server
```

**Output:**
```scribble
local protocol StreamData_Server at Server() {
  rec Loop {
    choice at Client {
      // Branch:
      More() from Client;
      Data(String) to Client;
      continue Loop;
    } or {
      // Branch:
      Done() from Client;
    }
  }
}
```

---

## Advanced Usage

### Piping and Composition

**Parse and project in one pipeline:**
```bash
cat examples/protocol.scr | npm run project -- --stdin --output-dir ./local
```

**Process multiple files:**
```bash
for file in examples/*.scr; do
  echo "Processing $file..."
  npm run project "$file" --output-dir "./local/$(basename $file .scr)"
done
```

**Extract specific role to file:**
```bash
npm run project examples/complex.scr --role Client > Client.scr
```

### JSON Processing with jq

**Extract role names:**
```bash
npm run project examples/protocol.scr --format json | jq '.role'
```

**Count interactions:**
```bash
npm run project examples/protocol.scr --format json | jq '.body | length'
```

**Get all send actions:**
```bash
npm run project examples/protocol.scr --format json | \
  jq '.body[] | select(.type == "Send") | .message.label'
```

### Batch Processing

**Project all protocols in a directory:**
```bash
#!/bin/bash
for protocol in examples/*.scr; do
  name=$(basename "$protocol" .scr)
  echo "Projecting $name..."
  npm run project "$protocol" --output-dir "./local/$name"
done
```

**Generate both formats for all roles:**
```bash
npm run project examples/protocol.scr \
  --format both \
  --output-dir ./output
```

---

## Integration with Build Systems

### Makefile Example

```makefile
# Project all protocols to local protocols
.PHONY: project-all
project-all:
	@echo "Projecting all protocols..."
	@for file in examples/*.scr; do \
		npm run project "$$file" --output-dir ./local; \
	done

# Project specific protocol
.PHONY: project-%
project-%:
	npm run project examples/$*.scr --output-dir ./local/$*

# Clean generated files
.PHONY: clean
clean:
	rm -rf ./local
```

**Usage:**
```bash
make project-all
make project-two-phase
make clean
```

### npm Script Integration

Add to `package.json`:
```json
{
  "scripts": {
    "project:all": "for file in examples/*.scr; do npm run project \"$file\" --output-dir ./local; done",
    "project:clean": "rm -rf ./local",
    "project:watch": "nodemon -e scr --exec 'npm run project:all'"
  }
}
```

---

## Error Handling

### Parse Errors

If the input protocol has syntax errors:

```bash
$ npm run project bad-protocol.scr

📖 Parsing: bad-protocol.scr
═══════════════════════════════════════════════════════════════════════════════
✗ Parse failed!

Error: Unexpected token at line 3, column 5
Expected: role name, received: ->
```

### Projection Errors

If projection fails (e.g., invalid role):

```bash
$ npm run project examples/protocol.scr --role InvalidRole

🔄 Projecting to local protocols...
───────────────────────────────────────────────────────────────────────────────
✗ Projection failed!

Error: Role "InvalidRole" not found in protocol. Available roles: Client, Server
```

### File Not Found

```bash
$ npm run project nonexistent.scr

Error: File not found: nonexistent.scr
```

---

## Tips and Best Practices

### 1. **Organize Output Files**

Use meaningful directory names:
```bash
npm run project protocol.scr --output-dir ./generated/local-protocols
```

### 2. **Version Control**

Add to `.gitignore`:
```gitignore
# Generated local protocols
/local/
/generated/
*.local.scr
```

### 3. **Validate Before Projecting**

Always parse first to check for errors:
```bash
npm run parse protocol.scr && npm run project protocol.scr
```

### 4. **Use Format Options Wisely**

- `text`: For human-readable local protocols
- `json`: For programmatic processing
- `both`: For documentation and tooling

### 5. **Automated Testing**

Create test scripts:
```bash
#!/bin/bash
# test-projection.sh

PROTOCOL="examples/test.scr"
EXPECTED="expected/Client.scr"

npm run project "$PROTOCOL" --role Client > /tmp/output.scr

if diff -q /tmp/output.scr "$EXPECTED"; then
  echo "✓ Projection test passed"
else
  echo "✗ Projection test failed"
  diff /tmp/output.scr "$EXPECTED"
  exit 1
fi
```

---

## Troubleshooting

### Command Not Found

If you see `vitest: not found` or similar:
```bash
npm install
```

### Permission Denied

If output directory is not writable:
```bash
chmod +w ./local
npm run project protocol.scr --output-dir ./local
```

### Large Protocols

For very large protocols, increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run project large-protocol.scr
```

---

## API vs CLI

| Feature | CLI | API |
|---------|-----|-----|
| Parse protocols | `npm run parse` | `parse(source)` |
| Project to local | `npm run project` | `projectToLocalProtocols(global)` |
| Serialize | automatic | `serializeLocalProtocol(local)` |
| Batch processing | shell scripts | programmatic loops |
| Format options | `--format` | manual serialization |
| Error handling | exit codes | try/catch |

**When to use CLI:**
- Quick testing and validation
- Batch processing with shell scripts
- Build system integration
- Manual inspection of protocols

**When to use API:**
- Integration in TypeScript/JavaScript code
- Custom tooling and plugins
- IDE integrations
- Runtime protocol generation

---

## See Also

- [Local Protocol Projection Guide](./LOCAL_PROTOCOL_PROJECTION.md) - Formal specification
- [Examples](../examples/) - Sample protocols and usage
- [API Documentation](../src/core/projection/README.md) - Programmatic usage
- [Scribble Specification](http://www.scribble.org/) - Official Scribble docs

---

## Contributing

To add new CLI features:

1. Add command to `src/core/*/cli.ts`
2. Update `package.json` scripts
3. Add documentation here
4. Add tests in `src/core/*/__tests__/`
5. Update examples in `examples/`

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.
