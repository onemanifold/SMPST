import { parse } from './src/core/parser/parser.js';

const withGlobal = `global protocol Test(role A, role B) {
  A -> B: Hello();
}`;

const withoutGlobal = `protocol Test(role A, role B) {
  A -> B: Hello();
}`;

const standardSyntax = `global protocol Test(role A, role B) {
  Hello() from A to B;
}`;

console.log('=== Test 1: WITHOUT global keyword ===');
try {
  const ast1 = parse(withoutGlobal);
  console.log('✅ SUCCESS:', ast1.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}

console.log('\n=== Test 2: WITH global keyword (arrow syntax) ===');
try {
  const ast2 = parse(withGlobal);
  console.log('✅ SUCCESS:', ast2.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}

console.log('\n=== Test 3: WITH global keyword (standard syntax) ===');
try {
  const ast3 = parse(standardSyntax);
  console.log('✅ SUCCESS:', ast3.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}

console.log('\n=== Checking parser module structure ===');
const testModule = parse(withGlobal);
console.log('Module type:', testModule.type);
console.log('Declarations:', testModule.declarations.length);
console.log('First declaration type:', testModule.declarations[0].type);
