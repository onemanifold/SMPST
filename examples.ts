import { ProtocolExample } from './types';

export const examples: ProtocolExample[] = [
    // 1. Simple Ping-Pong
    {
        name: 'Ping-Pong',
        description: 'A basic two-party request-response protocol.',
        code: `
global protocol PingPong(role Pinger, role Ponger) {
    ping(String) from Pinger to Ponger;
    pong(String) from Ponger to Pinger;
}`
    },
    // 2. Three-Party Pass
    {
        name: 'Three-Party Pass',
        description: 'A simple chain of messages between three parties.',
        code: `
global protocol ThreeParty(role A, role B, role C) {
    msg1(Data) from A to B;
    msg2(Data) from B to C;
}`
    },
    // 3. Simple Choice
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
    // 4. Simple Recursion
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
    // 5. Nested Choice
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
    // 6. Recursion in Choice
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
    // 7. Observer Role
    {
        name: 'Observer Role',
        description: 'A third party observes a two-party interaction.',
        code: `
global protocol AuditLog(role Sender, role Receiver, role Auditor) {
    sensitiveData(Data) from Sender to Receiver;
    log(Record) from Receiver to Auditor;
}`
    },
    // 8. Should Fail Parsing
    {
        name: 'Invalid: Bad Syntax',
        description: 'A protocol with a syntax error that should fail parsing.',
        shouldFail: 'parse',
        code: `
global protocol Broken(role A, role B) {
    missingSemicolon from A to B
}`
    },
    // 9. Should Fail Validation
    {
        name: 'Invalid: Undeclared Role',
        description: 'A protocol that uses a role not declared in the header.',
        shouldFail: 'validate',
        code: `
global protocol UndeclaredRole(role A, role B) {
    hello(String) from A to C; // C is not declared
}`
    },
    // --- Authority Propagation Patterns ---
    // 10. Basic Delegation
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
    // 11. Chained Trust
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
    // 12. Scoped Authority
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
    // 13. Dual Authority
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
    // 14. Invalid Delegation Flow (Validation Failure)
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
    // --- Additional Complex Examples ---
    // 15. Online Shopping
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
    // 16. Asynchronous Three-Party Interaction
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
    // 17. Choice with Recursion and Observers
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
