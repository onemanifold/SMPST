import { describe, it, expect } from 'vitest';
import { ScribbleCore, examples } from './core.js';

describe('ScribbleCore', () => {
    examples.forEach(example => {
        it(`should process example: ${example.name}`, () => {
            const { ast, error: parseError } = ScribbleCore.parse(example.code);

            if (example.shouldFail === 'parse') {
                expect(parseError).not.toBeNull();
                return;
            }

            expect(parseError).toBeNull();
            expect(ast).not.toBeNull();

            const validationErrors = ScribbleCore.validate(ast);

            if (example.shouldFail === 'validate') {
                expect(validationErrors.length).toBeGreaterThan(0);
                return;
            }

            expect(validationErrors.length).toBe(0);
        });
    });
});
