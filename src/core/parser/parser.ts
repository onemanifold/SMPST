/**
 * Parser for Scribble 2.0
 * Uses Chevrotain to build AST from source code
 */

import { CstParser, type IToken } from 'chevrotain';
import { ScribbleLexer, allTokens } from './lexer';
import * as tokens from './lexer';
import type * as AST from '../ast/types';

// ============================================================================
// Parser Class
// ============================================================================

class ScribbleParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full',
    });
    this.performSelfAnalysis();
  }

  // ==========================================================================
  // Module
  // ==========================================================================

  public module = this.RULE('module', () => {
    this.MANY(() => {
      this.SUBRULE(this.moduleDeclaration);
    });
  });

  private moduleDeclaration = this.RULE('moduleDeclaration', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.importDeclaration) },
      { ALT: () => this.SUBRULE(this.typeDeclaration) },
      { ALT: () => this.SUBRULE(this.globalProtocolDeclaration) },
      { ALT: () => this.SUBRULE(this.protocolExtension) },       // Future: Subtyping
      { ALT: () => this.SUBRULE(this.localProtocolDeclaration) },
    ]);
  });

  // ==========================================================================
  // Import Declaration
  // ==========================================================================

  private importDeclaration = this.RULE('importDeclaration', () => {
    this.CONSUME(tokens.Import);
    this.CONSUME(tokens.StringLiteral);
    this.OPTION(() => {
      this.CONSUME(tokens.LCurly);
      this.CONSUME(tokens.Identifier);
      this.MANY(() => {
        this.CONSUME(tokens.Comma);
        this.CONSUME2(tokens.Identifier);
      });
      this.CONSUME(tokens.RCurly);
    });
    this.CONSUME(tokens.Semicolon);
  });

  // ==========================================================================
  // Type Declaration
  // ==========================================================================

  private typeDeclaration = this.RULE('typeDeclaration', () => {
    this.CONSUME(tokens.Type);
    this.CONSUME(tokens.Identifier);
    this.CONSUME(tokens.As);
    this.SUBRULE(this.typeExpression);
    this.CONSUME(tokens.Semicolon);
  });

  // ==========================================================================
  // Global Protocol Declaration
  // ==========================================================================

  private globalProtocolDeclaration = this.RULE('globalProtocolDeclaration', () => {
    this.CONSUME(tokens.Protocol);
    this.CONSUME(tokens.Identifier);

    // Type parameters
    this.OPTION(() => {
      this.SUBRULE(this.typeParameters);
    });

    // Role parameters
    this.CONSUME(tokens.LParen);
    this.SUBRULE(this.roleDeclarationList);
    this.CONSUME(tokens.RParen);

    // Body
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody);
    this.CONSUME(tokens.RCurly);
  });

  private typeParameters = this.RULE('typeParameters', () => {
    this.CONSUME(tokens.LAngle);
    this.SUBRULE(this.typeParameter);
    this.MANY(() => {
      this.CONSUME(tokens.Comma);
      this.SUBRULE2(this.typeParameter);
    });
    this.CONSUME(tokens.RAngle);
  });

  private typeParameter = this.RULE('typeParameter', () => {
    this.OR([
      { ALT: () => this.CONSUME(tokens.Type) },
      { ALT: () => this.CONSUME(tokens.Sig) },
    ]);
    this.CONSUME(tokens.Identifier);
  });

  private roleDeclarationList = this.RULE('roleDeclarationList', () => {
    this.AT_LEAST_ONE_SEP({
      SEP: tokens.Comma,
      DEF: () => {
        this.CONSUME(tokens.Role);
        this.CONSUME(tokens.Identifier);
      },
    });
  });

  private globalProtocolBody = this.RULE('globalProtocolBody', () => {
    this.MANY(() => {
      this.SUBRULE(this.globalInteraction);
    });
  });

  // ==========================================================================
  // Protocol Extension (Subtyping - Future Feature)
  // Based on docs/theory/asynchronous-subtyping.md
  // ==========================================================================

  /**
   * Protocol extension for subtyping
   * Syntax: protocol Enhanced(role A, role B) extends Basic(A, B) { ... }
   */
  private protocolExtension = this.RULE('protocolExtension', () => {
    this.CONSUME(tokens.Protocol);
    this.CONSUME(tokens.Identifier, { LABEL: 'name' });

    // Type parameters (optional)
    this.OPTION(() => {
      this.SUBRULE(this.typeParameters);
    });

    // Role parameters
    this.CONSUME(tokens.LParen);
    this.SUBRULE(this.roleDeclarationList);
    this.CONSUME(tokens.RParen);

    // Extends clause
    this.CONSUME(tokens.Extends);
    this.CONSUME2(tokens.Identifier, { LABEL: 'baseProtocol' });

    // Type arguments for base protocol (optional)
    this.OPTION2(() => {
      this.SUBRULE(this.typeArguments);
    });

    // Role arguments for base protocol
    this.CONSUME2(tokens.LParen);
    this.AT_LEAST_ONE_SEP({
      SEP: tokens.Comma,
      DEF: () => {
        this.CONSUME3(tokens.Identifier, { LABEL: 'baseRoleArg' });
      },
    });
    this.CONSUME2(tokens.RParen);

    // Refinement body
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody, { LABEL: 'refinements' });
    this.CONSUME(tokens.RCurly);
  });

  // ==========================================================================
  // Local Protocol Declaration
  // ==========================================================================

  private localProtocolDeclaration = this.RULE('localProtocolDeclaration', () => {
    this.CONSUME(tokens.Local);
    this.CONSUME(tokens.Protocol);
    this.CONSUME(tokens.Identifier);

    this.OPTION(() => {
      this.SUBRULE(this.typeParameters);
    });

    this.CONSUME(tokens.LParen);
    this.CONSUME(tokens.Role);
    this.CONSUME2(tokens.Identifier); // self role
    this.CONSUME(tokens.RParen);

    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.localProtocolBody);
    this.CONSUME(tokens.RCurly);
  });

  private localProtocolBody = this.RULE('localProtocolBody', () => {
    this.MANY(() => {
      this.SUBRULE(this.localInteraction);
    });
  });

  // ==========================================================================
  // Global Interactions
  // ==========================================================================

  private globalInteraction = this.RULE('globalInteraction', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.messageTransfer) },
      { ALT: () => this.SUBRULE(this.timedMessage) },       // Future: Timed types
      { ALT: () => this.SUBRULE(this.choice) },
      { ALT: () => this.SUBRULE(this.parallel) },
      { ALT: () => this.SUBRULE(this.recursion) },
      { ALT: () => this.SUBRULE(this.continueStatement) },
      { ALT: () => this.SUBRULE(this.doStatement) },
      { ALT: () => this.SUBRULE(this.tryStatement) },       // Future: Exceptions
      { ALT: () => this.SUBRULE(this.throwStatement) },     // Future: Exceptions
      { ALT: () => this.SUBRULE(this.timeoutStatement) },   // Future: Timed types
    ]);
  });

  private messageTransfer = this.RULE('messageTransfer', () => {
    this.CONSUME(tokens.Identifier, { LABEL: 'from' });
    this.CONSUME(tokens.Arrow);

    // Support multicast: to1, to2, to3
    this.CONSUME2(tokens.Identifier, { LABEL: 'to' });
    this.MANY(() => {
      this.CONSUME(tokens.Comma);
      this.CONSUME3(tokens.Identifier, { LABEL: 'toAdditional' });
    });

    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.message);
    this.CONSUME(tokens.Semicolon);
  });

  private message = this.RULE('message', () => {
    this.CONSUME(tokens.Identifier, { LABEL: 'label' });
    this.CONSUME(tokens.LParen);
    this.OPTION(() => {
      this.SUBRULE(this.typeExpression);
    });
    this.CONSUME(tokens.RParen);
  });

  private choice = this.RULE('choice', () => {
    this.CONSUME(tokens.Choice);
    this.CONSUME(tokens.At);
    this.CONSUME(tokens.Identifier, { LABEL: 'at' });
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody, { LABEL: 'firstBranch' });
    this.CONSUME(tokens.RCurly);

    this.AT_LEAST_ONE(() => {
      this.CONSUME(tokens.Or);
      this.CONSUME2(tokens.LCurly);
      this.SUBRULE2(this.globalProtocolBody, { LABEL: 'branch' });
      this.CONSUME2(tokens.RCurly);
    });
  });

  private parallel = this.RULE('parallel', () => {
    this.CONSUME(tokens.Par);
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody, { LABEL: 'firstBranch' });
    this.CONSUME(tokens.RCurly);

    this.AT_LEAST_ONE(() => {
      this.CONSUME(tokens.And);
      this.CONSUME2(tokens.LCurly);
      this.SUBRULE2(this.globalProtocolBody, { LABEL: 'branch' });
      this.CONSUME2(tokens.RCurly);
    });
  });

  private recursion = this.RULE('recursion', () => {
    this.CONSUME(tokens.Rec);
    this.CONSUME(tokens.Identifier, { LABEL: 'label' });
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody);
    this.CONSUME(tokens.RCurly);
  });

  private continueStatement = this.RULE('continueStatement', () => {
    this.CONSUME(tokens.Continue);
    this.CONSUME(tokens.Identifier, { LABEL: 'label' });
    this.CONSUME(tokens.Semicolon);
  });

  private doStatement = this.RULE('doStatement', () => {
    this.CONSUME(tokens.Do);
    this.CONSUME(tokens.Identifier, { LABEL: 'protocol' });

    this.OPTION(() => {
      this.SUBRULE(this.typeArguments);
    });

    this.CONSUME(tokens.LParen);
    this.AT_LEAST_ONE_SEP({
      SEP: tokens.Comma,
      DEF: () => {
        this.CONSUME2(tokens.Identifier, { LABEL: 'roleArg' });
      },
    });
    this.CONSUME(tokens.RParen);
    this.CONSUME(tokens.Semicolon);
  });

  // ==========================================================================
  // Exception Handling (Future Feature)
  // Based on docs/theory/exception-handling.md
  // ==========================================================================

  /**
   * Try-catch block
   * Syntax: try { ... } catch Label { ... }
   */
  private tryStatement = this.RULE('tryStatement', () => {
    this.CONSUME(tokens.Try);
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody, { LABEL: 'body' });
    this.CONSUME(tokens.RCurly);

    // One or more catch handlers
    this.AT_LEAST_ONE(() => {
      this.CONSUME(tokens.Catch);
      this.CONSUME(tokens.Identifier, { LABEL: 'exceptionLabel' });
      this.CONSUME2(tokens.LCurly);
      this.SUBRULE2(this.globalProtocolBody, { LABEL: 'handler' });
      this.CONSUME2(tokens.RCurly);
    });
  });

  /**
   * Throw statement
   * Syntax: throw Label;
   */
  private throwStatement = this.RULE('throwStatement', () => {
    this.CONSUME(tokens.Throw);
    this.CONSUME(tokens.Identifier, { LABEL: 'exceptionLabel' });
    this.CONSUME(tokens.Semicolon);
  });

  // ==========================================================================
  // Timed Session Types (Future Feature)
  // Based on docs/theory/timed-session-types.md
  // ==========================================================================

  /**
   * Timed message with deadline
   * Syntax: A -> B: Msg() within 5s;
   */
  private timedMessage = this.RULE('timedMessage', () => {
    this.CONSUME(tokens.Identifier, { LABEL: 'from' });
    this.CONSUME(tokens.Arrow);
    this.CONSUME2(tokens.Identifier, { LABEL: 'to' });
    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.message);
    this.CONSUME(tokens.Within);
    this.SUBRULE(this.timeConstraint);
    this.CONSUME(tokens.Semicolon);
  });

  /**
   * Time constraint: value + unit
   * Syntax: 5s, 100ms, 2min
   */
  private timeConstraint = this.RULE('timeConstraint', () => {
    this.CONSUME(tokens.NumberLiteral, { LABEL: 'value' });
    this.CONSUME(tokens.Identifier, { LABEL: 'unit' }); // 's', 'ms', 'min'
  });

  /**
   * Timeout handler
   * Syntax: timeout(5s) { ... }
   */
  private timeoutStatement = this.RULE('timeoutStatement', () => {
    this.CONSUME(tokens.Timeout);
    this.CONSUME(tokens.LParen);
    this.SUBRULE(this.timeConstraint);
    this.CONSUME(tokens.RParen);
    this.CONSUME(tokens.LCurly);
    this.SUBRULE(this.globalProtocolBody);
    this.CONSUME(tokens.RCurly);
  });

  // ==========================================================================
  // Local Interactions
  // NOTE: Local protocols are typically generated through projection,
  // not parsed directly. For now, we treat local interactions similarly
  // to global interactions but within a local context.
  // ==========================================================================

  private localInteraction = this.RULE('localInteraction', () => {
    this.OR([
      // Reuse global interaction rules for local protocols
      // The distinction between send/receive will be made during projection
      { ALT: () => this.SUBRULE(this.messageTransfer) },
      { ALT: () => this.SUBRULE(this.choice) },
      { ALT: () => this.SUBRULE(this.parallel) },
      { ALT: () => this.SUBRULE(this.recursion) },
      { ALT: () => this.SUBRULE(this.continueStatement) },
      { ALT: () => this.SUBRULE(this.doStatement) },
      { ALT: () => this.SUBRULE(this.tryStatement) },       // Future: Exceptions
      { ALT: () => this.SUBRULE(this.throwStatement) },     // Future: Exceptions
      { ALT: () => this.SUBRULE(this.timeoutStatement) },   // Future: Timed types
    ]);
  });

  // ==========================================================================
  // Type Expressions
  // ==========================================================================

  private typeExpression = this.RULE('typeExpression', () => {
    this.CONSUME(tokens.Identifier, { LABEL: 'typeName' });
    this.OPTION(() => {
      this.SUBRULE(this.typeArguments);
    });
  });

  private typeArguments = this.RULE('typeArguments', () => {
    this.CONSUME(tokens.LAngle);
    this.SUBRULE(this.typeExpression);
    this.MANY(() => {
      this.CONSUME(tokens.Comma);
      this.SUBRULE2(this.typeExpression);
    });
    this.CONSUME(tokens.RAngle);
  });
}

// Create singleton parser instance
const parserInstance = new ScribbleParser();

// ============================================================================
// CST to AST Visitor
// ============================================================================

const BaseCstVisitor = parserInstance.getBaseCstVisitorConstructor();

class ScribbleToAstVisitor extends BaseCstVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  module(ctx: any): AST.Module {
    const declarations: AST.ModuleDeclaration[] = [];
    if (ctx.moduleDeclaration) {
      for (const decl of ctx.moduleDeclaration) {
        declarations.push(this.visit(decl));
      }
    }
    return {
      type: 'Module',
      declarations,
    };
  }

  moduleDeclaration(ctx: any): AST.ModuleDeclaration {
    if (ctx.importDeclaration) {
      return this.visit(ctx.importDeclaration);
    }
    if (ctx.typeDeclaration) {
      return this.visit(ctx.typeDeclaration);
    }
    if (ctx.globalProtocolDeclaration) {
      return this.visit(ctx.globalProtocolDeclaration);
    }
    if (ctx.localProtocolDeclaration) {
      return this.visit(ctx.localProtocolDeclaration);
    }
    throw new Error('Unknown module declaration');
  }

  importDeclaration(ctx: any): AST.ImportDeclaration {
    const modulePath = ctx.StringLiteral[0].image.slice(1, -1); // Remove quotes
    let importedNames: string[] | undefined;

    if (ctx.Identifier) {
      importedNames = ctx.Identifier.map((id: IToken) => id.image);
    }

    return {
      type: 'ImportDeclaration',
      modulePath,
      importedNames,
      location: this.getLocation(ctx),
    };
  }

  typeDeclaration(ctx: any): AST.TypeDeclaration {
    return {
      type: 'TypeDeclaration',
      name: ctx.Identifier[0].image,
      typeValue: this.visit(ctx.typeExpression),
      location: this.getLocation(ctx),
    };
  }

  globalProtocolDeclaration(ctx: any): AST.GlobalProtocolDeclaration {
    const name = ctx.Identifier[0].image;
    const parameters: AST.ProtocolParameter[] = ctx.typeParameters
      ? this.visit(ctx.typeParameters)
      : [];
    const roles: AST.RoleDeclaration[] = this.visit(ctx.roleDeclarationList);
    const body: AST.GlobalProtocolBody = this.visit(ctx.globalProtocolBody);

    return {
      type: 'GlobalProtocolDeclaration',
      name,
      parameters,
      roles,
      body,
      location: this.getLocation(ctx),
    };
  }

  typeParameters(ctx: any): AST.ProtocolParameter[] {
    const params: AST.ProtocolParameter[] = [];
    for (let i = 0; i < ctx.typeParameter.length; i++) {
      params.push(this.visit(ctx.typeParameter[i]));
    }
    return params;
  }

  typeParameter(ctx: any): AST.ProtocolParameter {
    const kind = ctx.Type ? 'type' : 'sig';
    const name = ctx.Identifier[0].image;
    return {
      type: 'ProtocolParameter',
      name,
      kind,
      location: this.getLocation(ctx),
    };
  }

  roleDeclarationList(ctx: any): AST.RoleDeclaration[] {
    const roles: AST.RoleDeclaration[] = [];
    for (const id of ctx.Identifier) {
      roles.push({
        type: 'RoleDeclaration',
        name: id.image,
        location: this.getLocation(id),
      });
    }
    return roles;
  }

  globalProtocolBody(ctx: any): AST.GlobalProtocolBody {
    if (!ctx.globalInteraction) {
      return [];
    }
    return ctx.globalInteraction.map((interaction: any) => this.visit(interaction));
  }

  localProtocolDeclaration(ctx: any): AST.LocalProtocolDeclaration {
    const name = ctx.Identifier[0].image;
    const selfRole = ctx.Identifier[1].image;
    const parameters: AST.ProtocolParameter[] = ctx.typeParameters
      ? this.visit(ctx.typeParameters)
      : [];
    const body: AST.LocalProtocolBody = this.visit(ctx.localProtocolBody);

    return {
      type: 'LocalProtocolDeclaration',
      name,
      parameters,
      role: selfRole,
      selfRole,
      body,
      location: this.getLocation(ctx),
    };
  }

  localProtocolBody(ctx: any): AST.LocalProtocolBody {
    if (!ctx.localInteraction) {
      return [];
    }
    return ctx.localInteraction.map((interaction: any) => this.visit(interaction));
  }

  localInteraction(ctx: any): AST.LocalInteraction {
    // For now, local interactions use same nodes as global
    // Projection will convert these appropriately
    return this.globalInteraction(ctx) as any;
  }

  globalInteraction(ctx: any): AST.GlobalInteraction {
    if (ctx.messageTransfer) {
      return this.visit(ctx.messageTransfer);
    }
    if (ctx.choice) {
      return this.visit(ctx.choice);
    }
    if (ctx.parallel) {
      return this.visit(ctx.parallel);
    }
    if (ctx.recursion) {
      return this.visit(ctx.recursion);
    }
    if (ctx.continueStatement) {
      return this.visit(ctx.continueStatement);
    }
    if (ctx.doStatement) {
      return this.visit(ctx.doStatement);
    }
    throw new Error('Unknown global interaction');
  }

  messageTransfer(ctx: any): AST.MessageTransfer {
    // Support multicast: if toAdditional exists, create array of all receivers
    const to = ctx.toAdditional
      ? [ctx.to[0].image, ...ctx.toAdditional.map((t: any) => t.image)]
      : ctx.to[0].image;

    return {
      type: 'MessageTransfer',
      from: ctx.from[0].image,
      to,
      message: this.visit(ctx.message),
      location: this.getLocation(ctx),
    };
  }

  message(ctx: any): AST.Message {
    const payload = ctx.typeExpression
      ? {
          type: 'Payload' as const,
          payloadType: this.visit(ctx.typeExpression),
        }
      : undefined;

    return {
      type: 'Message',
      label: ctx.label[0].image,
      payload,
      location: this.getLocation(ctx),
    };
  }

  choice(ctx: any): AST.Choice {
    const branches: AST.ChoiceBranch[] = [];

    // First branch
    branches.push({
      type: 'ChoiceBranch',
      label: '', // Anonymous branch
      body: this.visit(ctx.firstBranch),
      location: this.getLocation(ctx.firstBranch),
    });

    // Remaining branches
    if (ctx.branch) {
      for (const branch of ctx.branch) {
        branches.push({
          type: 'ChoiceBranch',
          label: '',
          body: this.visit(branch),
          location: this.getLocation(branch),
        });
      }
    }

    return {
      type: 'Choice',
      at: ctx.at[0].image,
      branches,
      location: this.getLocation(ctx),
    };
  }

  parallel(ctx: any): AST.Parallel {
    const branches: AST.ParallelBranch[] = [];

    // First branch
    branches.push({
      type: 'ParallelBranch',
      body: this.visit(ctx.firstBranch),
      location: this.getLocation(ctx.firstBranch),
    });

    // Remaining branches
    if (ctx.branch) {
      for (const branch of ctx.branch) {
        branches.push({
          type: 'ParallelBranch',
          body: this.visit(branch),
          location: this.getLocation(branch),
        });
      }
    }

    return {
      type: 'Parallel',
      branches,
      location: this.getLocation(ctx),
    };
  }

  recursion(ctx: any): AST.Recursion {
    return {
      type: 'Recursion',
      label: ctx.label[0].image,
      body: this.visit(ctx.globalProtocolBody),
      location: this.getLocation(ctx),
    };
  }

  continueStatement(ctx: any): AST.Continue {
    return {
      type: 'Continue',
      label: ctx.label[0].image,
      location: this.getLocation(ctx),
    };
  }

  doStatement(ctx: any): AST.Do {
    const typeArguments = ctx.typeArguments
      ? this.visit(ctx.typeArguments)
      : undefined;

    const roleArguments = ctx.roleArg.map((id: IToken) => id.image);

    return {
      type: 'Do',
      protocol: ctx.protocol[0].image,
      typeArguments,
      roleArguments,
      location: this.getLocation(ctx),
    };
  }

  typeExpression(ctx: any): AST.Type {
    const name = ctx.typeName[0].image;
    if (ctx.typeArguments) {
      return {
        type: 'ParametricType',
        name,
        arguments: this.visit(ctx.typeArguments),
        location: this.getLocation(ctx),
      };
    }
    return {
      type: 'SimpleType',
      name,
      location: this.getLocation(ctx),
    };
  }

  typeArguments(ctx: any): AST.Type[] {
    return ctx.typeExpression.map((te: any) => this.visit(te));
  }

  private getLocation(ctx: any): AST.SourceLocation | undefined {
    if (!ctx) return undefined;

    // Handle tokens
    if (ctx.startOffset !== undefined) {
      return {
        start: {
          line: ctx.startLine || 0,
          column: ctx.startColumn || 0,
          offset: ctx.startOffset,
        },
        end: {
          line: ctx.endLine || 0,
          column: ctx.endColumn || 0,
          offset: ctx.endOffset,
        },
      };
    }

    // Handle CST nodes
    const location = ctx.location;
    if (location) {
      return {
        start: {
          line: location.startLine || 0,
          column: location.startColumn || 0,
          offset: location.startOffset || 0,
        },
        end: {
          line: location.endLine || 0,
          column: location.endColumn || 0,
          offset: location.endOffset || 0,
        },
      };
    }

    return undefined;
  }
}

// Create singleton visitor instance
const toAstVisitor = new ScribbleToAstVisitor();

// ============================================================================
// Main Parse Function
// ============================================================================

export function parse(sourceCode: string): AST.Module {
  // Tokenize
  const lexResult = ScribbleLexer.tokenize(sourceCode);

  if (lexResult.errors.length > 0) {
    const error = lexResult.errors[0];
    throw new Error(
      `Lexer error at line ${error.line}, column ${error.column}: ${error.message}`
    );
  }

  // Parse
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.module();

  if (parserInstance.errors.length > 0) {
    const error = parserInstance.errors[0];
    throw new Error(
      `Parser error at line ${error.token.startLine}, column ${error.token.startColumn}: ${error.message}`
    );
  }

  // Convert CST to AST
  const ast = toAstVisitor.visit(cst);

  return ast;
}

// Export parser instance for advanced use cases
export { parserInstance, toAstVisitor };
