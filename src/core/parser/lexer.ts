/**
 * Lexer (Tokenizer) for Scribble 2.0
 * Defines all tokens used in the language
 */

import { createToken, Lexer } from 'chevrotain';

// ============================================================================
// Keywords
// ============================================================================

export const Protocol = createToken({ name: 'Protocol', pattern: /protocol/ });
export const Global = createToken({ name: 'Global', pattern: /global/ });
export const Local = createToken({ name: 'Local', pattern: /local/ });
export const Role = createToken({ name: 'Role', pattern: /role/ });
export const Type = createToken({ name: 'Type', pattern: /type/ });
export const Sig = createToken({ name: 'Sig', pattern: /sig/ });
export const Import = createToken({ name: 'Import', pattern: /import/ });
export const From = createToken({ name: 'From', pattern: /from/ });
export const As = createToken({ name: 'As', pattern: /as/ });
export const Choice = createToken({ name: 'Choice', pattern: /choice/ });
export const At = createToken({ name: 'At', pattern: /at/ });
export const Or = createToken({ name: 'Or', pattern: /or/ });
export const Par = createToken({ name: 'Par', pattern: /par/ });
export const And = createToken({ name: 'And', pattern: /and/ });
export const Rec = createToken({ name: 'Rec', pattern: /rec/ });
export const Continue = createToken({ name: 'Continue', pattern: /continue/ });
export const Do = createToken({ name: 'Do', pattern: /do/ });

// Future features
export const Try = createToken({ name: 'Try', pattern: /try/ });
export const Catch = createToken({ name: 'Catch', pattern: /catch/ });
export const Throw = createToken({ name: 'Throw', pattern: /throw/ });
export const Within = createToken({ name: 'Within', pattern: /within/ });
export const Timeout = createToken({ name: 'Timeout', pattern: /timeout/ });
export const Extends = createToken({ name: 'Extends', pattern: /extends/ });

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
