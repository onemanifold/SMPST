import { parse } from './src/core/parser/parser.js';

const withBlockComment = `/**
 * Authentication Protocol
 */

protocol Authentication(role User, role Server) {
  User -> Server: LoginRequest(String);
}`;

const withLineComment = `// This is a comment

protocol Test(role A, role B) {
  A -> B: Hello();
}`;

console.log('=== Test 1: Protocol with block comment ===');
try {
  const ast1 = parse(withBlockComment);
  console.log('✅ SUCCESS:', ast1.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}

console.log('\n=== Test 2: Protocol with line comment ===');
try {
  const ast2 = parse(withLineComment);
  console.log('✅ SUCCESS:', ast2.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}

const actualFile = `/**
 * Authentication Protocol
 *
 * A two-party protocol demonstrating:
 * - Login with credentials
 * - Choice (success vs failure)
 * - Subsequent actions based on authentication result
 *
 * Flow:
 * 1. User sends login credentials to Server
 * 2. Server authenticates and chooses:
 *    - Success: Send token, User can request data
 *    - Failure: Send error, protocol ends
 */

protocol Authentication(role User, role Server) {
  // User sends login request
  User -> Server: LoginRequest(String);

  // Server authenticates
  choice at Server {
    // Authentication successful
    Server -> User: AuthToken(String);
    User -> Server: DataRequest(String);
    Server -> User: DataResponse(String);
  } or {
    // Authentication failed
    Server -> User: AuthError(String);
  }
}`;

console.log('\n=== Test 3: Actual authentication.smp file ===');
try {
  const ast3 = parse(actualFile);
  console.log('✅ SUCCESS:', ast3.declarations[0].name);
} catch (e) {
  console.log('❌ ERROR:', e.message);
}
