// Quick test to verify DMst keywords are tokenized correctly
import { ScribbleLexer } from './dist/core/parser/lexer.js';

const testCases = [
  'new role Worker',
  'Manager creates Worker',
  'Manager invites Worker',
  'Alice calls SubProtocol',
  'continue X with { }',
];

testCases.forEach((test) => {
  console.log(`\n Testing: "${test}"`);
  const result = ScribbleLexer.tokenize(test);

  if (result.errors.length > 0) {
    console.log('  Errors:', result.errors);
  } else {
    console.log('  Tokens:', result.tokens.map(t => `${t.tokenType.name}("${t.image}")`).join(', '));
  }
});
