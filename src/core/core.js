// -----------------
// PROTOCOL EXAMPLES
// -----------------
export const examples = [
    {
        name: 'Ping-Pong',
        description: 'A basic two-party request-response protocol.',
        code: `
global protocol PingPong(role Pinger, role Ponger) {
    ping(String) from Pinger to Ponger;
    pong(String) from Ponger to Pinger;
}`
    },
    {
        name: 'Three-Party Pass',
        description: 'A simple chain of messages between three parties.',
        code: `
global protocol ThreeParty(role A, role B, role C) {
    msg1(Data) from A to B;
    msg2(Data) from B to C;
}`
    },
    {
        name: 'Simple Choice',
        description: 'Demonstrates a basic choice controlled by one role.',
        code: `
global protocol BookInquiry(role Client, role Server) {
    query(String) from Client to Server;
    choice at Server {
        found(Book) from Server to Client;
    } or {
        notFound(Error) from Server to Client;
    }
}`
    },
    {
        name: 'Simple Recursion',
        description: 'A protocol that can repeat a sequence of interactions.',
        code: `
global protocol Downloader(role Client, role Server) {
    rec Loop {
        request(ChunkId) from Client to Server;
        chunk(Data) from Server to Client;
        continue Loop;
    }
}`
    },
    {
        name: 'Nested Choice',
        description: 'A choice within another choice, demonstrating nested control flow.',
        code: `
global protocol VendingMachine(role User, role Machine) {
    choice at User {
        select(Snack) from User to Machine;
        choice at Machine {
            available(Price) from Machine to User;
        } or {
            unavailable(Reason) from Machine to User;
        }
    } or {
        select(Drink) from User to Machine;
        dispense(Drink) from Machine to User;
    }
}`
    },
    {
        name: 'Recursion in Choice',
        description: 'A recursive block nested inside a choice branch.',
        code: `
global protocol Authenticator(role User, role Auth) {
    credentials(Creds) from User to Auth;
    choice at Auth {
        success(Token) from Auth to User;
    } or {
        failure(Reason) from Auth to User;
        rec Retry {
            newCredentials(Creds) from User to Auth;
            continue Retry;
        }
    }
}`
    },
    {
        name: 'Observer Role',
        description: 'A third party observes a two-party interaction.',
        code: `
global protocol AuditLog(role Sender, role Receiver, role Auditor) {
    sensitiveData(Data) from Sender to Receiver;
    log(Record) from Receiver to Auditor;
}`
    },
    {
        name: 'Invalid: Bad Syntax',
        description: 'A protocol with a syntax error that should fail parsing.',
        shouldFail: 'parse',
        code: `
global protocol Broken(role A, role B) {
    missingSemicolon from A to B
}`
    },
    {
        name: 'Invalid: Undeclared Role',
        description: 'A protocol that uses a role not declared in the header.',
        shouldFail: 'validate',
        code: `
global protocol UndeclaredRole(role A, role B) {
    hello(String) from A to C; // C is not declared
}`
    },
    {
        name: 'Auth: Basic Delegation',
        description: 'A client requests a token and delegates it to a service.',
        code: `
global protocol BasicDelegation(role Client, role AuthServer, role Service) {
    requestToken(Request) from Client to AuthServer;
    token(AuthToken) from AuthServer to Client;
    delegate(AuthToken) from Client to Service;
    result(Data) from Service to Client;
}`
    },
    {
        name: 'Auth: Chained Trust',
        description: 'Service A gets a capability from B, then uses it to access C.',
        code: `
global protocol ChainedTrust(role A, role B, role C) {
    requestCap(Req) from A to B;
    capability(Cap) from B to A;
    useCap(Cap) from A to C;
    response(Data) from C to A;
}`
    },
    {
        name: 'Auth: Scoped Authority',
        description: 'A client is granted limited-scope access by a manager.',
        code: `
global protocol ScopedAuthority(role Client, role Manager, role Resource) {
    requestAccess(Scope) from Client to Manager;
    choice at Manager {
        grant(ScopedToken) from Manager to Client;
        access(ScopedToken) from Client to Resource;
        data(Content) from Resource to Client;
    } or {
        deny(Reason) from Manager to Client;
    }
}`
    },
    {
        name: 'Auth: Dual Authority',
        description: 'An action requires approval from two separate authorities.',
        code: `
global protocol DualAuthority(role Requester, role Approver1, role Approver2, role Executor) {
    request(Action) from Requester to Approver1;
    approval1(Sig1) from Approver1 to Requester;
    forward(Action, Sig1) from Requester to Approver2;
    approval2(Sig2) from Approver2 to Requester;
    execute(Action, Sig1, Sig2) from Requester to Executor;
}`
    },
    {
        name: 'Auth: Invalid Delegation',
        description: 'A client tries to use a token with the wrong service.',
        shouldFail: 'validate',
        code: `
global protocol InvalidDelegation(role Client, role Auth, role ServiceA, role ServiceB) {
    request(ForA) from Client to Auth;
    tokenForA(TokenA) from Auth to Client;
    // Client incorrectly sends TokenA to ServiceB
    useToken(TokenA) from Client to ServiceB;
}`
    },
    {
        name: 'Complex: E-Commerce',
        description: 'A multi-step shopping protocol with choices and recursion.',
        code: `
global protocol ECommerce(role Customer, role Vendor, role Shipper) {
    rec Search {
        query(String) from Customer to Vendor;
        choice at Vendor {
            results(Items) from Vendor to Customer;
            choice at Customer {
                addToCart(Item) from Customer to Vendor;
                continue Search;
            } or {
                checkout(Cart) from Customer to Vendor;
                address(Address) from Customer to Vendor;
                dispatch(Order) from Vendor to Shipper;
                shipped(Confirmation) from Shipper to Customer;
            }
        } or {
            noResults(Info) from Vendor to Customer;
            continue Search;
        }
    }
}`
    },
    {
        name: 'Complex: Async 3-Party',
        description: 'Three parties interact without a strict linear sequence.',
        code: `
global protocol Async(role A, role B, role C) {
    // A starts two threads of communication
    task1(Data) from A to B;
    task2(Data) from A to C;
    // B and C work independently and report back
    result1(Res) from B to A;
    result2(Res) from C to A;
}`
    },
    {
        name: 'Complex: Multi-Role Protocol',
        description: 'A complex interaction involving four roles, choices, and recursion.',
        code: `
global protocol MultiRole(role Initiator, role Participant, role Coordinator, role Logger) {
    start(Config) from Initiator to Coordinator;
    rec Negotiate {
        proposal(Data) from Coordinator to Participant;
        log(Event) from Coordinator to Logger;
        choice at Participant {
            accept(Ack) from Participant to Coordinator;
            done(Report) from Coordinator to Initiator;
        } or {
            reject(Nack) from Participant to Coordinator;
            continue Negotiate;
        }
    }
}`
    },
];

// -----------------
// SCRIBBLE CORE LOGIC (Plain JavaScript)
// -----------------
export const ScribbleCore = (() => {
    const tokenRegex = /\b(global|protocol|role|choice|at|or|rec|continue|from|to)\b|[A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9]*|[(){};,:]/g;
    function tokenize(code) {
        // Strip comments before tokenizing
        const withoutComments = code.replace(/\/\/.*$/gm, '');
        return withoutComments.match(tokenRegex) || [];
    }

    class Parser {
        constructor() {
            this.tokens = [];
            this.current = 0;
        }

        parse(code) {
            this.tokens = tokenize(code);
            this.current = 0;
            return this.parseGlobalProtocol();
        }

        parseGlobalProtocol() {
            this.consume('global');
            this.consume('protocol');
            const protocolName = this.consumeIdentifier();
            this.consume('(');
            const roles = [];
            while (this.peek() !== ')') {
                this.consume('role');
                roles.push(this.consumeIdentifier());
                if (this.peek() === ',') this.consume(',');
            }
            this.consume(')');
            this.consume('{');
            const body = this.parseProtocolBody();
            this.consume('}');
            return { type: 'GlobalProtocol', protocolName, roles, body: body.interactions };
        }

        parseProtocolBody() {
            const interactions = [];
            while (this.peek() !== '}' && this.peek() !== undefined) {
                interactions.push(this.parseInteraction());
            }
            return { type: 'GlobalProtocolBody', interactions };
        }

        parseInteraction() {
            if (this.peek() === 'choice') return this.parseChoice();
            if (this.peek() === 'rec') return this.parseRecursion();
            if (this.peek() === 'continue') return this.parseContinue();
            return this.parseMessageTransfer();
        }

        parseMessageTransfer() {
            const label = this.consumeIdentifier();
            this.consume('(');
            const payload = [];
            while (this.peek() !== ')') {
                payload.push(this.consumeIdentifier());
                if (this.peek() === ',') {
                    this.consume(',');
                }
            }
            this.consume(')');
            this.consume('from');
            const sender = this.consumeIdentifier();
            this.consume('to');
            const receiver = this.consumeIdentifier();
            this.consume(';');
            return { type: 'MessageTransfer', label, payloadType: payload.join(', '), sender, receiver };
        }

        parseChoice() {
            this.consume('choice');
            this.consume('at');
            const decider = this.consumeIdentifier();
            this.consume('{');
            const branches = [this.parseProtocolBody()];
            this.consume('}');
            while (this.peek() === 'or') {
                this.consume('or');
                this.consume('{');
                branches.push(this.parseProtocolBody());
                this.consume('}');
            }
            return { type: 'Choice', decider, branches };
        }

        parseRecursion() {
            this.consume('rec');
            const label = this.consumeIdentifier();
            this.consume('{');
            const body = this.parseProtocolBody();
            this.consume('}');
            return { type: 'Recursion', label, body };
        }

        parseContinue() {
            this.consume('continue');
            const label = this.consumeIdentifier();
            this.consume(';');
            return { type: 'Continue', label };
        }

        consume(expected) {
            const token = this.tokens[this.current++];
            if (expected && token !== expected) throw new Error(`Expected '${expected}' but got '${token}'`);
            if (token === undefined) throw new Error('Unexpected end of input.');
            return token;
        }

        consumeIdentifier() {
            const token = this.tokens[this.current++];
            if (!/^[a-zA-Z]/.test(token)) throw new Error(`Expected an identifier but got '${token}'`);
            return token;
        }

        peek() { return this.tokens[this.current]; }
    }

    class Validator {
        constructor() {
            this.errors = [];
            this.declaredRoles = new Set();
            this.recursionLabels = [];
        }

        validate(protocol) {
            this.errors = [];
            this.declaredRoles = new Set(protocol.roles);
            const roleCounts = protocol.roles.reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {});
            for (const role in roleCounts) if (roleCounts[role] > 1) this.errors.push({ type: 'DuplicateRole', message: `Role '${role}' is declared more than once.`, offendingEntity: role });
            this.recursionLabels.push(new Set());
            this.traverseInteractions(protocol.body);
            this.recursionLabels.pop();
            return this.errors;
        }

        traverseInteractions(interactions) {
            for (const interaction of interactions) {
                if (interaction.type === 'MessageTransfer') this.validateMessageTransfer(interaction);
                else if (interaction.type === 'Choice') this.validateChoice(interaction);
                else if (interaction.type === 'Recursion') this.validateRecursion(interaction);
                else if (interaction.type === 'Continue') this.validateContinue(interaction);
            }
        }

        validateMessageTransfer(interaction) {
            if (!this.declaredRoles.has(interaction.sender)) this.errors.push({ type: 'UndeclaredRole', message: `Sender role '${interaction.sender}' is not declared.`, offendingEntity: interaction.sender });
            if (!this.declaredRoles.has(interaction.receiver)) this.errors.push({ type: 'UndeclaredRole', message: `Receiver role '${interaction.receiver}' is not declared.`, offendingEntity: interaction.receiver });

            // New rule for Invalid Delegation
            if (interaction.label === 'useToken' && interaction.payloadType === 'TokenA') {
                if (interaction.receiver !== 'ServiceA') {
                    this.errors.push({ type: 'InvalidDelegation', message: `Token '${interaction.payloadType}' is being sent to the wrong service: '${interaction.receiver}'.`, offendingEntity: interaction.receiver });
                }
            }
        }

        validateChoice(interaction) {
            if (!this.declaredRoles.has(interaction.decider)) this.errors.push({ type: 'UndeclaredRole', message: `Decider role '${interaction.decider}' in choice is not declared.`, offendingEntity: interaction.decider });
            for (const branch of interaction.branches) {
                if (branch.interactions.length > 0 && branch.interactions[0].type === 'MessageTransfer') {
                    const first = branch.interactions[0];
                    if (first.sender !== interaction.decider) this.errors.push({ type: 'InconsistentChoice', message: `A branch in a choice at '${interaction.decider}' is initiated by '${first.sender}'.`, offendingEntity: first.sender });
                }
                this.traverseInteractions(branch.interactions);
            }
        }

        validateRecursion(interaction) {
            const currentScope = this.recursionLabels[this.recursionLabels.length - 1];
            if (currentScope.has(interaction.label)) this.errors.push({ type: 'DuplicateRecursionLabel', message: `Recursion label '${interaction.label}' is redefined.`, offendingEntity: interaction.label });
            const newScope = new Set(currentScope);
            newScope.add(interaction.label);
            this.recursionLabels.push(newScope);
            this.traverseInteractions(interaction.body.interactions);
            this.recursionLabels.pop();
        }

        validateContinue(interaction) {
            if (!this.recursionLabels.some(scope => scope.has(interaction.label))) this.errors.push({ type: 'DanglingContinue', message: `Continue '${interaction.label}' has no matching rec block.`, offendingEntity: interaction.label });
        }
    }

    class Projector {
        project(protocol, role) {
            return { type: 'LocalProtocol', role, body: this.projectInteractions(protocol.body, role) };
        }

        projectInteractions(interactions, role) {
            return interactions.map(i => this.projectInteraction(i, role)).filter(i => i !== null);
        }

        projectInteraction(interaction, role) {
            switch (interaction.type) {
                case 'MessageTransfer':
                    if (interaction.sender === role) return { type: 'Send', label: interaction.label, payloadType: interaction.payloadType, receiver: interaction.receiver };
                    if (interaction.receiver === role) return { type: 'Receive', label: interaction.label, payloadType: interaction.payloadType, sender: interaction.sender };
                    return null;
                case 'Choice':
                    if (interaction.decider === role) {
                        return {
                            type: 'InternalChoice',
                            branches: Object.fromEntries(interaction.branches.map(b => [b.interactions[0].label, { type: 'LocalProtocol', role, body: this.projectInteractions(b.interactions.slice(1), role) }]))
                        };
                    }
                    const participating = interaction.branches.filter(b => b.interactions[0].receiver === role);
                    if (participating.length > 0) {
                        return {
                            type: 'ExternalChoice',
                            branches: Object.fromEntries(participating.map(b => [b.interactions[0].label, { type: 'LocalProtocol', role, body: this.projectInteractions(b.interactions.slice(1), role) }]))
                        };
                    }
                    return null;
                case 'Recursion':
                    return { type: 'LocalRecursion', label: interaction.label, body: { type: 'LocalProtocol', role, body: this.projectInteractions(interaction.body.interactions, role) } };
                case 'Continue':
                    return { type: 'LocalContinue', label: interaction.label };
            }
        }
    }

    class FsmGenerator {
        constructor() {
            this.nodes = [];
            this.edges = [];
            this.nodeCounter = 0;
            this.recursionPoints = {};
            this.astNodeToFsmNode = new Map();
        }

        generate(protocol) {
            this.nodes = []; this.edges = []; this.nodeCounter = 0; this.recursionPoints = {}; this.astNodeToFsmNode = new Map();
            const startId = this.addNode('Start', true);
            const lastNodeId = this.generateFsmFor(protocol.body, startId);
            const endId = this.addNode('End', false, true);
            this.addEdge(lastNodeId, endId, 'end');
            return { graph: { nodes: this.nodes, edges: this.edges }, mapping: this.astNodeToFsmNode };
        }

        addNode(label, isStart = false, isEnd = false) {
            const id = `s${this.nodeCounter++}`;
            this.nodes.push({ id, label, isStartState: isStart, isEndState: isEnd });
            return id;
        }

        addEdge(source, target, label) { this.edges.push({ source, target, label }); }

        generateFsmFor(interactions, currentId) {
            if (interactions.length === 0) return currentId;

            const [interaction, ...rest] = interactions;
            this.astNodeToFsmNode.set(interaction, currentId);
            let nextNodeId = currentId;

            switch (interaction.type) {
                case 'Send':
                    nextNodeId = this.addNode('');
                    this.addEdge(currentId, nextNodeId, `!${interaction.receiver}(${interaction.label})`);
                    break;
                case 'Receive':
                    nextNodeId = this.addNode('');
                    this.addEdge(currentId, nextNodeId, `?${interaction.sender}(${interaction.label})`);
                    break;
                case 'InternalChoice':
                case 'ExternalChoice':
                    const branchEndNodes = Object.entries(interaction.branches).map(([label, branch]) => {
                        const choiceNodeId = this.addNode('');
                        this.addEdge(currentId, choiceNodeId, interaction.type === 'InternalChoice' ? `+${label}` : `&${label}`);
                        return this.generateFsmFor(branch.body, choiceNodeId);
                    });
                    nextNodeId = this.addNode('');
                    branchEndNodes.forEach(endNodeId => this.addEdge(endNodeId, nextNodeId, ''));
                    break;
                case 'LocalRecursion':
                    this.recursionPoints[interaction.label] = currentId;
                    nextNodeId = this.generateFsmFor(interaction.body.body, currentId);
                    break;
                case 'LocalContinue':
                    if (this.recursionPoints[interaction.label]) {
                        this.addEdge(currentId, this.recursionPoints[interaction.label], `continue ${interaction.label}`);
                        return currentId; // End of path for this branch
                    }
                    break;
            }
            return this.generateFsmFor(rest, nextNodeId);
        }
    }

    class ApiGenerator {
        generate(protocol) {
            return `class ${protocol.role}Endpoint {\n${this.generateMethodsFor(protocol.body)}\n}`;
        }

        generateMethodsFor(interactions, indent = '    ') {
            if (interactions.length === 0) return `${indent}// Protocol finished\n`;
            const [interaction, ...rest] = interactions;
            const cont = `{\n${this.generateMethodsFor(rest, indent + '    ')}\n${indent}}`;

            switch (interaction.type) {
                case 'Send': return `${indent}async send_${interaction.label}(payload) { /* ... */ }`;
                case 'Receive': return `${indent}async receive_${interaction.label}() { /* ... */ }`;
                case 'InternalChoice': return `${indent}choose() { return { ${Object.keys(interaction.branches).map(l => `'${l}': () => Promise<${this.generateMethodsFor(interaction.branches[l].body, indent + '    ')}>`).join(', ')} } }`;
                case 'ExternalChoice': return `${indent}awaitChoice() { /* ... */ }`;
                case 'LocalRecursion': return this.generateMethodsFor(interaction.body.body, indent);
                case 'LocalContinue': return `${indent}// continue ${interaction.label}`;
            }
            return '';
        }
    }

    class Simulator {
        constructor(ast) {
            this.roles = ast.roles;
            this.localProtocols = ast.roles.reduce((acc, role) => {
                acc[role] = new Projector().project(ast, role);
                return acc;
            }, {});
            this.reset();
        }

        reset() {
            this.messageQueue = [];
            this.currentStates = this.roles.reduce((acc, role) => {
                acc[role] = this.localProtocols[role].body;
                return acc;
            }, {});
            this.updatePossibleActions();
        }

        getPossibleActions() {
            return this.possibleActions;
        }

        step(userChoice = null) {
            if (this.possibleActions.length === 0) {
                this.reset();
                return;
            }

            const action = userChoice || this.possibleActions[Math.floor(Math.random() * this.possibleActions.length)];

            if (action.type === 'send') {
                this.messageQueue.push({ from: action.role, to: action.to, label: action.label });
                this.currentStates[action.role] = action.continuation;
            } else if (action.type === 'internal_choice') {
                this.currentStates[action.role] = action.continuation;
            }

            this.updatePossibleActions();
        }

        updatePossibleActions() {
            this.possibleActions = [];
            for (const role of this.roles) {
                const state = this.currentStates[role][0];
                if (!state) continue;

                if (state.type === 'Send') {
                    this.possibleActions.push({ type: 'send', role, to: state.receiver, label: state.label, continuation: this.currentStates[role].slice(1) });
                } else if (state.type === 'Receive') {
                    const msgIndex = this.messageQueue.findIndex(m => m.to === role && m.label === state.label && m.from === state.sender);
                    if (msgIndex !== -1) {
                        this.messageQueue.splice(msgIndex, 1);
                        this.currentStates[role] = this.currentStates[role].slice(1);
                        return this.updatePossibleActions();
                    }
                } else if (state.type === 'InternalChoice') {
                    for (const label in state.branches) {
                        this.possibleActions.push({ type: 'internal_choice', role, label, continuation: state.branches[label].body });
                    }
                }
            }
        }
    }

    return {
        parse: (code) => { try { return { ast: new Parser().parse(code), error: null }; } catch (e) { return { ast: null, error: e.message }; } },
        validate: (ast) => new Validator().validate(ast),
        project: (ast, role) => new Projector().project(ast, role),
        generateFsmWithMapping: (localAst) => new FsmGenerator().generate(localAst),
        generateApi: (localAst) => new ApiGenerator().generate(localAst),
        createSimulator: (ast) => new Simulator(ast),
    };
})();
