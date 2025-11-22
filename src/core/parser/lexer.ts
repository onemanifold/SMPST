/**
 * Lexer (Tokenizer) for Scribble 2.0
 * Defines all tokens used in the language
 */

import { createToken, Lexer } from 'chevrotain';

// ============================================================================
// Keywords
// ============================================================================

// Note: All keywords use word boundary \b to prevent matching parts of identifiers
// e.g., /do\b/ matches 'do' but not 'done'
export const Protocol = createToken({ name: 'Protocol', pattern: /protocol\b/ });
export const Global = createToken({ name: 'Global', pattern: /global\b/ });
export const Local = createToken({ name: 'Local', pattern: /local\b/ });
export const Role = createToken({ name: 'Role', pattern: /role\b/ });
export const Type = createToken({ name: 'Type', pattern: /type\b/ });
export const Sig = createToken({ name: 'Sig', pattern: /sig\b/ });
export const Import = createToken({ name: 'Import', pattern: /import\b/ });
export const From = createToken({ name: 'From', pattern: /from\b/ });
export const To = createToken({ name: 'To', pattern: /to\b/ });
export const As = createToken({ name: 'As', pattern: /as\b/ });
export const Choice = createToken({ name: 'Choice', pattern: /choice\b/ });
export const At = createToken({ name: 'At', pattern: /at\b/ });
export const Or = createToken({ name: 'Or', pattern: /or\b/ });
export const Par = createToken({ name: 'Par', pattern: /par\b/ });
export const And = createToken({ name: 'And', pattern: /and\b/ });
export const Rec = createToken({ name: 'Rec', pattern: /rec\b/ });
export const Continue = createToken({ name: 'Continue', pattern: /continue\b/ });
export const Do = createToken({ name: 'Do', pattern: /do\b/ });

// Future features
export const Try = createToken({ name: 'Try', pattern: /try\b/ });
export const Catch = createToken({ name: 'Catch', pattern: /catch\b/ });
export const Throw = createToken({ name: 'Throw', pattern: /throw\b/ });
export const Within = createToken({ name: 'Within', pattern: /within\b/ });
export const Timeout = createToken({ name: 'Timeout', pattern: /timeout\b/ });
export const Extends = createToken({ name: 'Extends', pattern: /extends\b/ });

// DMst (Dynamically Updatable MPST) - Castro-Perez & Yoshida ECOOP 2023
export const New = createToken({ name: 'New', pattern: /new\b/ });
export const Calls = createToken({ name: 'Calls', pattern: /calls\b/ });
export const With = createToken({ name: 'With', pattern: /with\b/ });
export const Creates = createToken({ name: 'Creates', pattern: /creates\b/ });
export const Invites = createToken({ name: 'Invites', pattern: /invites\b/ });

// ============================================================================
// Operators and Punctuation
// ============================================================================

export const Arrow = createToken({ name: 'Arrow', pattern: /->/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Dot = createToken({ name: 'Dot', pattern: /\./ });

export const LCurly = createToken({ name: 'LCurly', pattern: /{/ });
export const RCurly = createToken({ name: 'RCurly', pattern: /}/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LAngle = createToken({ name: 'LAngle', pattern: /</ });
export const RAngle = createToken({ name: 'RAngle', pattern: />/ });

// ============================================================================
// Identifiers and Literals
// ============================================================================

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/,
});

export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /[0-9]+/,
});

// ============================================================================
// Whitespace and Comments
// ============================================================================

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n\r]*/,
  group: Lexer.SKIPPED,
});

export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
});

// ============================================================================
// Token Array (Order matters! Keywords before Identifier)
// ============================================================================

export const allTokens = [
  // Whitespace and comments (skipped)
  WhiteSpace,
  LineComment,
  BlockComment,

  // Keywords (must come before Identifier)
  Protocol,
  Global,
  Local,
  Role,
  Type,
  Sig,
  Import,
  From,
  To,
  As,
  Choice,
  At,
  Or,
  Par,
  And,
  Rec,
  Continue,
  Do,
  // Future features
  Try,
  Catch,
  Throw,
  Within,
  Timeout,
  Extends,

  // DMst keywords
  New,
  Calls,
  With,
  Creates,
  Invites,

  // Operators (must come before single-char tokens)
  Arrow,

  // Punctuation
  Colon,
  Semicolon,
  Comma,
  Dot,
  LCurly,
  RCurly,
  LParen,
  RParen,
  LAngle,
  RAngle,

  // Identifiers and literals
  NumberLiteral,
  Identifier,
  StringLiteral,
];

// ============================================================================
// Create Lexer Instance
// ============================================================================

export const ScribbleLexer = new Lexer(allTokens, {
  // Improve error recovery
  ensureOptimizations: true,
  // Track line and column numbers
  positionTracking: 'full',
});
