import {
    GlobalProtocol, GlobalInteraction, Role, RecursionLabel, Choice, Continue, MessageTransfer, Recursion, GlobalProtocolBody, ValidationError, LocalProtocol, LocalInteraction, FsmGraph, FsmNode, FsmEdge,
} from './types';

// Tokenizer, Parser, Validator... (Code is identical to previous version)
const tokenRegex = /global|protocol|role|choice|at|or|rec|continue|from|to|[A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9]*|[(){};,:]/g;
function tokenize(code: string): string[] { return code.match(tokenRegex) || []; }
class Parser {
    private tokens: string[] = [];
    private current = 0;
    parse(code: string): GlobalProtocol {
        this.tokens = tokenize(code);
        this.current = 0;
        return this.parseGlobalProtocol();
    }
    private parseGlobalProtocol(): GlobalProtocol {
        this.consume('global'); this.consume('protocol');
        const protocolName = this.consumeIdentifier();
        this.consume('(');
        const roles: Role[] = [];
        while (this.peek() !== ')') {
            this.consume('role');
            roles.push(this.consumeIdentifier());
            if (this.peek() === ',') this.consume(',');
        }
        this.consume(')'); this.consume('{');
        const body = this.parseProtocolBody();
        this.consume('}');
        return { type: 'GlobalProtocol', protocolName, roles, body: body.interactions };
    }
    private parseProtocolBody(): GlobalProtocolBody {
        const interactions: GlobalInteraction[] = [];
        while (this.peek() !== '}' && this.peek() !== undefined) {
            interactions.push(this.parseInteraction());
        }
        return { type: 'GlobalProtocolBody', interactions };
    }
    private parseInteraction(): GlobalInteraction {
        if (this.peek() === 'choice') return this.parseChoice();
        if (this.peek() === 'rec') return this.parseRecursion();
        if (this.peek() === 'continue') return this.parseContinue();
        return this.parseMessageTransfer();
    }
    private parseMessageTransfer(): MessageTransfer {
        const label = this.consumeIdentifier();
        this.consume('('); const payloadType = this.consumeIdentifier(); this.consume(')');
        this.consume('from'); const sender = this.consumeIdentifier();
        this.consume('to'); const receiver = this.consumeIdentifier();
        this.consume(';');
        return { type: 'MessageTransfer', label, payloadType, sender, receiver };
    }
    private parseChoice(): Choice {
        this.consume('choice'); this.consume('at');
        const decider = this.consumeIdentifier();
        this.consume('{');
        const branches: GlobalProtocolBody[] = [this.parseProtocolBody()];
        this.consume('}');
        while (this.peek() === 'or') {
            this.consume('or'); this.consume('{');
            branches.push(this.parseProtocolBody());
            this.consume('}');
        }
        return { type: 'Choice', decider, branches };
    }
    private parseRecursion(): Recursion {
        this.consume('rec'); const label = this.consumeIdentifier();
        this.consume('{'); const body = this.parseProtocolBody(); this.consume('}');
        return { type: 'Recursion', label, body };
    }
    private parseContinue(): Continue {
        this.consume('continue'); const label = this.consumeIdentifier(); this.consume(';');
        return { type: 'Continue', label };
    }
    private consume(expected?: string): string {
        const token = this.tokens[this.current++];
        if (expected && token !== expected) throw new Error(`Expected '${expected}' but got '${token}'`);
        if (token === undefined) throw new Error('Unexpected end of input.');
        return token;
    }
    private consumeIdentifier(): string {
        const token = this.tokens[this.current++];
        if (!/^[a-zA-Z]/.test(token)) throw new Error(`Expected id but got '${token}'`);
        return token;
    }
    private peek(): string { return this.tokens[this.current]; }
}
class Validator {
    private errors: ValidationError[] = [];
    private declaredRoles: Set<Role> = new Set();
    private recursionLabels: Set<RecursionLabel>[] = [];
    validate(protocol: GlobalProtocol): ValidationError[] {
        this.errors = [];
        this.declaredRoles = new Set(protocol.roles);
        const roleCounts = protocol.roles.reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {} as { [k: string]: number });
        for (const role in roleCounts) if (roleCounts[role] > 1) this.errors.push({ type: 'DuplicateRole', message: `Role '${role}' declared > once.`, offendingEntity: role });
        this.recursionLabels.push(new Set());
        this.traverseInteractions(protocol.body);
        this.recursionLabels.pop();
        return this.errors;
    }
    private traverseInteractions(interactions: GlobalInteraction[]) {
        interactions.forEach(i => {
            if (i.type === 'MessageTransfer') this.validateMessageTransfer(i);
            else if (i.type === 'Choice') this.validateChoice(i);
            else if (i.type === 'Recursion') this.validateRecursion(i);
            else if (i.type === 'Continue') this.validateContinue(i);
        });
    }
    private validateMessageTransfer(i: MessageTransfer) {
        if (!this.declaredRoles.has(i.sender)) this.errors.push({ type: 'UndeclaredRole', message: `Sender '${i.sender}' undeclared.`, offendingEntity: i.sender });
        if (!this.declaredRoles.has(i.receiver)) this.errors.push({ type: 'UndeclaredRole', message: `Receiver '${i.receiver}' undeclared.`, offendingEntity: i.receiver });
    }
    private validateChoice(i: Choice) {
        if (!this.declaredRoles.has(i.decider)) this.errors.push({ type: 'UndeclaredRole', message: `Decider '${i.decider}' undeclared.`, offendingEntity: i.decider });
        i.branches.forEach(b => {
            if (b.interactions.length > 0 && b.interactions[0].type === 'MessageTransfer') {
                const first = b.interactions[0];
                if (first.sender !== i.decider) this.errors.push({ type: 'InconsistentChoice', message: `Choice branch at '${i.decider}' initiated by '${first.sender}'.`, offendingEntity: first.sender });
            }
            this.traverseInteractions(b.interactions);
        });
    }
    private validateRecursion(i: Recursion) {
        const currentScope = this.recursionLabels[this.recursionLabels.length - 1];
        if (currentScope.has(i.label)) this.errors.push({ type: 'DuplicateRecursionLabel', message: `Rec label '${i.label}' redefined.`, offendingEntity: i.label });
        const newScope = new Set(currentScope);
        newScope.add(i.label);
        this.recursionLabels.push(newScope);
        this.traverseInteractions(i.body.interactions);
        this.recursionLabels.pop();
    }
    private validateContinue(i: Continue) {
        if (!this.recursionLabels.some(s => s.has(i.label))) this.errors.push({ type: 'DanglingContinue', message: `Continue '${i.label}' has no matching rec.`, offendingEntity: i.label });
    }
}
class Projector {
    project(protocol: GlobalProtocol, role: Role): LocalProtocol {
        return { type: 'LocalProtocol', role, body: this.projectInteractions(protocol.body, role) };
    }
    private projectInteractions(interactions: GlobalInteraction[], role: Role): LocalInteraction[] {
        return interactions.map(i => this.projectInteraction(i, role)).filter((i): i is LocalInteraction => i !== null);
    }
    private projectInteraction(i: GlobalInteraction, role: Role): LocalInteraction | null {
        switch (i.type) {
            case 'MessageTransfer':
                if (i.sender === role) return { type: 'Send', ...i };
                if (i.receiver === role) return { type: 'Receive', ...i };
                return null;
            case 'Choice':
                if (i.decider === role) return { type: 'InternalChoice', branches: Object.fromEntries(i.branches.map(b => [(b.interactions[0] as MessageTransfer).label, { type: 'LocalProtocol', role, body: this.projectInteractions(b.interactions.slice(1), role) }])) };
                const participating = i.branches.filter(b => (b.interactions[0] as MessageTransfer).receiver === role);
                if (participating.length > 0) return { type: 'ExternalChoice', branches: Object.fromEntries(participating.map(b => [(b.interactions[0] as MessageTransfer).label, { type: 'LocalProtocol', role, body: this.projectInteractions(b.interactions.slice(1), role) }])) };
                return null;
            case 'Recursion': return { type: 'LocalRecursion', label: i.label, body: { type: 'LocalProtocol', role, body: this.projectInteractions(i.body.interactions, role) } };
            case 'Continue': return { type: 'LocalContinue', label: i.label };
        }
    }
}

// FSM Generator (with bug fix)
class FsmGenerator {
    private nodes: FsmNode[] = [];
    private edges: FsmEdge[] = [];
    private nodeCounter = 0;
    private recursionPoints: { [key: string]: string } = {};

    generate(protocol: LocalProtocol): FsmGraph {
        this.nodes = []; this.edges = []; this.nodeCounter = 0; this.recursionPoints = {};
        const startId = this.addNode('Start', true);
        const endId = this.generateFsmFor(protocol.body, startId);
        this.addNode('End', false, true);
        this.nodes.forEach(node => {
            if (!this.edges.some(edge => edge.source === node.id) && node.id !== endId && !node.isStartState) {
                 if (!this.edges.some(edge => edge.target === node.id)) this.edges.push({source: node.id, target: endId, label: 'end'});
            }
        });
        return { nodes: this.nodes, edges: this.edges };
    }

    private addNode(label: string, isStart = false, isEnd = false): string {
        const id = `s${this.nodeCounter++}`;
        this.nodes.push({ id, label, isStartState: isStart, isEndState: isEnd });
        return id;
    }

    private addEdge(source: string, target: string, label: string) { this.edges.push({ source, target, label }); }

    private generateFsmFor(interactions: LocalInteraction[], currentId: string): string {
        if (interactions.length === 0) return currentId;

        const [interaction, ...rest] = interactions;
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
                // Create a single merge point for all branches
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
                    // This is a loop, so there's no single next node. We'll treat the current one as the end of this path.
                    return currentId;
                }
                break;
        }
        return this.generateFsmFor(rest, nextNodeId);
    }
}
class ApiGenerator {
    generate(p: LocalProtocol): string {
        return `class ${p.role}Endpoint {\n${this.generateMethodsFor(p.body)}\n}`;
    }
    private generateMethodsFor(i: LocalInteraction[], indent = '    '): string {
        if (i.length === 0) return `${indent}// Protocol finished\n`;
        const [h, ...t] = i;
        const cont = `{\n${this.generateMethodsFor(t, indent + '    ')}\n${indent}}`;
        switch (h.type) {
            case 'Send': return `${indent}async send_${h.label}(p: ${h.payloadType}): Promise<${cont}> { /*...*/ }`;
            case 'Receive': return `${indent}async receive_${h.label}(): Promise<{ p: ${h.payloadType}, cont: ${cont} }> { /*...*/ }`;
            case 'InternalChoice': return `${indent}choose() { return { ${Object.keys(h.branches).map(l => `'${l}': () => Promise<${this.generateMethodsFor(h.branches[l].body, indent + '    ')}>`).join(', ')} } }`;
            case 'ExternalChoice': return `${indent}awaitChoice(): Promise<${Object.keys(h.branches).map(l => `{ type: '${l}', cont: ${this.generateMethodsFor(h.branches[l].body, indent + '    ')} }`).join(' | ')}> { /*...*/ }`;
            case 'LocalRecursion': return this.generateMethodsFor(h.body.body, indent);
            case 'LocalContinue': return `${indent}// continue ${h.label}`;
        }
        return '';
    }
}

export const ScribbleCore = {
    parse: (code: string) => { try { return { ast: new Parser().parse(code), error: null }; } catch (e) { return { ast: null, error: e.message }; } },
    validate: (ast: GlobalProtocol) => new Validator().validate(ast),
    project: (ast: GlobalProtocol, role: Role) => new Projector().project(ast, role),
    generateFsm: (localAst: LocalProtocol) => new FsmGenerator().generate(localAst),
    generateApi: (localAst: LocalProtocol) => new ApiGenerator().generate(localAst)
};
