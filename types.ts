// -----------------
// Core AST Types
// -----------------

export type Role = string;
export type ProtocolName = string;
export type RecursionLabel = string;
export type MessageLabel = string;
export type PayloadType = string;

export interface GlobalProtocol {
    type: 'GlobalProtocol';
    protocolName: ProtocolName;
    roles: Role[];
    body: GlobalInteraction[];
}

export type GlobalInteraction = MessageTransfer | Choice | Recursion | Continue;

export interface MessageTransfer {
    type: 'MessageTransfer';
    label: MessageLabel;
    payloadType: PayloadType;
    sender: Role;
    receiver: Role;
}

export interface Choice {
    type: 'Choice';
    decider: Role;
    branches: GlobalProtocolBody[];
}

export interface GlobalProtocolBody {
    type: 'GlobalProtocolBody';
    interactions: GlobalInteraction[];
}

export interface Recursion {
    type: 'Recursion';
    label: RecursionLabel;
    body: GlobalProtocolBody;
}

export interface Continue {
    type: 'Continue';
    label: RecursionLabel;
}

// -----------------
// Local AST (Projection) Types
// -----------------

export interface LocalProtocol {
    type: 'LocalProtocol';
    role: Role;
    body: LocalInteraction[];
}

export type LocalInteraction = Send | Receive | InternalChoice | ExternalChoice | LocalRecursion | LocalContinue;

export interface Send {
    type: 'Send';
    label: MessageLabel;
    payloadType: PayloadType;
    receiver: Role;
}

export interface Receive {
    type: 'Receive';
    label: MessageLabel;
    payloadType: PayloadType;
    sender: Role;
}

export interface InternalChoice {
    type: 'InternalChoice';
    branches: { [label: MessageLabel]: LocalProtocol };
}

export interface ExternalChoice {
    type: 'ExternalChoice';
    branches: { [label: MessageLabel]: LocalProtocol };
}

export interface LocalRecursion {
    type: 'LocalRecursion';
    label: RecursionLabel;
    body: LocalProtocol;
}

export interface LocalContinue {
    type: 'LocalContinue';
    label: RecursionLabel;
}

// -----------------
// Validation Types
// -----------------

export interface ValidationError {
    type: 'UndeclaredRole' | 'InconsistentChoice' | 'DanglingContinue' | 'DuplicateRole' | 'DuplicateRecursionLabel';
    message: string;
    offendingEntity?: string;
}

// -----------------
// FSM Generation Types
// -----------------

export interface FsmNode {
    id: string;
    label: string;
    isStartState?: boolean;
    isEndState?: boolean;
}

export interface FsmEdge {
    source: string;
    target: string;
    label: string;
}

export interface FsmGraph {
    nodes: FsmNode[];
    edges: FsmEdge[];
}

// -----------------
// Example Definition
// -----------------

export interface ProtocolExample {
    name: string;
    code: string;
    shouldFail?: 'parse' | 'validate';
    description: string;
}
