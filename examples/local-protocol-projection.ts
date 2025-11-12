/**
 * Example: Local Protocol Projection
 *
 * Demonstrates how to use the AST-based local protocol projector to:
 * 1. Parse a global protocol
 * 2. Project it to local protocols for each role
 * 3. Serialize the local protocols to Scribble text
 */

import { parse } from '../src/core/parser/parser';
import { projectToLocalProtocols, projectForRole } from '../src/core/projection/ast-projector';
import { serializeLocalProtocol } from '../src/core/serializer/local-serializer';

// ============================================================================
// Example 1: Simple Request-Response
// ============================================================================

console.log('=' project const requestResponse = `
  protocol RequestResponse(role Client, role Server) {
    Client -> Server: Request(Int);
    Server -> Client: Response(String);
  }
`;

console.log('Global Protocol:');
console.log(requestResponse);

const ast1 = parse(requestResponse);
const globalProtocol1 = ast1.declarations[0];

if (globalProtocol1.type === 'GlobalProtocolDeclaration') {
  const result = projectToLocalProtocols(globalProtocol1);

  console.log('\nLocal Protocol for Client:');
  const clientLocal = result.localProtocols.get('Client')!;
  console.log(serializeLocalProtocol(clientLocal));

  console.log('\nLocal Protocol for Server:');
  const serverLocal = result.localProtocols.get('Server')!;
  console.log(serializeLocalProtocol(serverLocal));
}

// ============================================================================
// Example 2: Choice (Internal vs External)
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('Example 2: Choice (Internal vs External)');
console.log('='.repeat(80));

const choiceProtocol = `
  protocol LoginOrRegister(role Client, role Server) {
    choice at Client {
      Client -> Server: Login(String);
      Server -> Client: Welcome();
    } or {
      Client -> Server: Register(String);
      Server -> Client: Confirm();
    }
  }
`;

console.log('\nGlobal Protocol:');
console.log(choiceProtocol);

const ast2 = parse(choiceProtocol);
const globalProtocol2 = ast2.declarations[0];

if (globalProtocol2.type === 'GlobalProtocolDeclaration') {
  console.log('\nLocal Protocol for Client (Internal Choice - SELECT):');
  const clientLocal = projectForRole(globalProtocol2, 'Client');
  console.log(serializeLocalProtocol(clientLocal));

  console.log('\nLocal Protocol for Server (External Choice - OFFER):');
  const serverLocal = projectForRole(globalProtocol2, 'Server');
  console.log(serializeLocalProtocol(serverLocal));
}

// ============================================================================
// Example 3: Recursion
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('Example 3: Recursion (Loop Until Done)');
console.log('='.repeat(80));

const recursionProtocol = `
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
`;

console.log('\nGlobal Protocol:');
console.log(recursionProtocol);

const ast3 = parse(recursionProtocol);
const globalProtocol3 = ast3.declarations[0];

if (globalProtocol3.type === 'GlobalProtocolDeclaration') {
  console.log('\nLocal Protocol for Client:');
  const clientLocal = projectForRole(globalProtocol3, 'Client');
  console.log(serializeLocalProtocol(clientLocal));

  console.log('\nLocal Protocol for Server:');
  const serverLocal = projectForRole(globalProtocol3, 'Server');
  console.log(serializeLocalProtocol(serverLocal));
}

// ============================================================================
// Example 4: Three-Role Protocol with Tau-Elimination
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('Example 4: Three-Role Protocol with Tau-Elimination');
console.log('='.repeat(80));

const threeRoleProtocol = `
  protocol Buyer seller protocol Buyer seller CreditAgency) {
    Buyer -> Seller: Order(String);
    Seller -> CreditAgency: CheckCredit(Int);
    CreditAgency -> Seller: Approved();
    Seller -> Buyer: Invoice(Int);
  }
`;

console.log('\nGlobal Protocol:');
console.log(threeRoleProtocol);

const ast4 = parse(threeRoleProtocol);
const globalProtocol4 = ast4.declarations[0];

if (globalProtocol4.type === 'GlobalProtocolDeclaration') {
  const result = projectToLocalProtocols(globalProtocol4);

  console.log('\nLocal Protocol for Buyer:');
  const buyerLocal = result.localProtocols.get('Buyer')!;
  console.log(serializeLocalProtocol(buyerLocal));
  console.log('(Note: CheckCredit and Approved are tau-eliminated - not visible to Buyer)');

  console.log('\nLocal Protocol for Seller:');
  const sellerLocal = result.localProtocols.get('Seller')!;
  console.log(serializeLocalProtocol(sellerLocal));
  console.log('(Note: All messages visible to Seller as mediator)');

  console.log('\nLocal Protocol for CreditAgency:');
  const agencyLocal = result.localProtocols.get('CreditAgency')!;
  console.log(serializeLocalProtocol(agencyLocal));
  console.log('(Note: Only CheckCredit and Approved visible - Order and Invoice tau-eliminated)');
}

// ============================================================================
// Example 5: Scribble Spec Example (Travel Agency)
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('Example 5: Travel Agency (From Scribble Specification Paper)');
console.log('='.repeat(80));

const travelAgency = `
  protocol BookJourney(role Customer, role Agency, role Service) {
    rec Loop {
      choice at Customer {
        Customer -> Agency: query();
        Agency -> Customer: price();
        Agency -> Service: info();
        continue Loop;
      } or {
        choice at Customer {
          Customer -> Agency: ACCEPT();
          Agency -> Service: ACCEPT();
          Customer -> Service: Address();
          Service -> Customer: Date();
        } or {
          Customer -> Agency: REJECT();
          Agency -> Service: REJECT();
        }
      }
    }
  }
`;

console.log('\nGlobal Protocol:');
console.log(travelAgency);

const ast5 = parse(travelAgency);
const globalProtocol5 = ast5.declarations[0];

if (globalProtocol5.type === 'GlobalProtocolDeclaration') {
  console.log('\nLocal Protocol for Customer:');
  const customerLocal = projectForRole(globalProtocol5, 'Customer');
  console.log(serializeLocalProtocol(customerLocal));

  console.log('\nLocal Protocol for Agency:');
  const agencyLocal = projectForRole(globalProtocol5, 'Agency');
  console.log(serializeLocalProtocol(agencyLocal));

  console.log('\nLocal Protocol for Service:');
  const serviceLocal = projectForRole(globalProtocol5, 'Service');
  console.log(serializeLocalProtocol(serviceLocal));
}

console.log('\n\n' + '='.repeat(80));
console.log('Examples Complete!');
console.log('='.repeat(80));
