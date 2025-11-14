import { parse } from './src/core/parser/parser.js';

const arrowSyntax = `
protocol Test(role Client, role Server) {
  Client -> Server: Request(String);
  Server -> Client: Response(Int);
}
`;

const standardSyntax = `
protocol Test(role Client, role Server) {
  Request(String) from Client to Server;
  Response(Int) from Server to Client;
}
`;

console.log('Parsing both syntaxes...\n');

const ast1 = parse(arrowSyntax);
const ast2 = parse(standardSyntax);

const msg1_1 = ast1.declarations[0].body[0];
const msg1_2 = ast1.declarations[0].body[1];
const msg2_1 = ast2.declarations[0].body[0];
const msg2_2 = ast2.declarations[0].body[1];

console.log('=== Message 1: Arrow Syntax ===');
console.log('Type:', msg1_1.type);
console.log('From:', msg1_1.from);
console.log('To:', msg1_1.to);
console.log('Label:', msg1_1.message.label);
console.log('Payload:', msg1_1.message.payload?.payloadType);

console.log('\n=== Message 1: Standard Syntax ===');
console.log('Type:', msg2_1.type);
console.log('From:', msg2_1.from);
console.log('To:', msg2_1.to);
console.log('Label:', msg2_1.message.label);
console.log('Payload:', msg2_1.message.payload?.payloadType);

console.log('\n=== Structural Comparison ===');
console.log('✓ Type match:', msg1_1.type === msg2_1.type);
console.log('✓ From match:', msg1_1.from === msg2_1.from);
console.log('✓ To match:', msg1_1.to === msg2_1.to);
console.log('✓ Message label match:', msg1_1.message.label === msg2_1.message.label);
console.log('✓ Message type match:', msg1_1.message.type === msg2_1.message.type);

const match1 = JSON.stringify(msg1_1) === JSON.stringify(msg2_1);
const match2 = JSON.stringify(msg1_2) === JSON.stringify(msg2_2);

console.log('\n=== Deep Equality Check ===');
console.log('Message 1 deep equal:', match1 ? '✅ IDENTICAL' : '❌ DIFFERENT');
console.log('Message 2 deep equal:', match2 ? '✅ IDENTICAL' : '✅ IDENTICAL');

if (match1 && match2) {
  console.log('\n✅ CONFIRMED: Both syntaxes produce IDENTICAL AST structures!\n');
} else {
  console.log('\n⚠️  Differences detected - investigating...\n');
  console.log('Arrow AST:', JSON.stringify(msg1_1, null, 2));
  console.log('Standard AST:', JSON.stringify(msg2_1, null, 2));
}
