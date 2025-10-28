import React, { useState, useEffect, useCallback } from 'react';
import { examples } from './examples';
import { ScribbleCore } from './core';
import { ProtocolExample, GlobalProtocol, Role, FsmGraph, ValidationError } from './types';
import FsmVisualizer from './components/FsmVisualizer';

type ViewMode = 'FSM' | 'API';

interface TestSummary {
    passed: number;
    failed: number;
    total: number;
}

function App() {
    const [testSummary, setTestSummary] = useState<TestSummary>({ passed: 0, failed: 0, total: 0 });
    const [editorCode, setEditorCode] = useState<string>(examples[0].code);
    const [currentAst, setCurrentAst] = useState<GlobalProtocol | null>(null);
    const [errors, setErrors] = useState<(string | ValidationError)[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [projectionView, setProjectionView] = useState<ViewMode>('FSM');
    const [fsmGraph, setFsmGraph] = useState<FsmGraph | null>(null);
    const [apiCode, setApiCode] = useState<string>('');
    const [protocolExamples, setProtocolExamples] = useState<ProtocolExample[]>(examples);

    const processCode = useCallback((code: string) => {
        const { ast, error: parseError } = ScribbleCore.parse(code);
        if (parseError) {
            setErrors([`Parse Error: ${parseError}`]);
            setCurrentAst(null);
            return;
        }

        if (ast) {
            const validationErrors = ScribbleCore.validate(ast);
            if (validationErrors.length > 0) {
                setErrors(validationErrors);
            } else {
                setErrors([]);
            }
            setCurrentAst(ast);
            setSelectedRole(ast.roles[0] || null);
        }
    }, []);

    useEffect(() => {
        processCode(editorCode);
    }, [editorCode, processCode]);

    useEffect(() => {
        if (currentAst && selectedRole) {
            const localAst = ScribbleCore.project(currentAst, selectedRole);
            setFsmGraph(ScribbleCore.generateFsm(localAst));
            setApiCode(ScribbleCore.generateApi(localAst));
        } else {
            setFsmGraph(null);
            setApiCode('');
        }
    }, [currentAst, selectedRole]);

    useEffect(() => {
        const runTests = () => {
            console.log('--- Starting Automated Test Suite ---');
            let passed = 0;
            const total = examples.length;

            examples.forEach((example: ProtocolExample) => {
                console.log(`[TEST] Running: ${example.name}`);
                const { ast, error: parseError } = ScribbleCore.parse(example.code);

                if (parseError) {
                    if (example.shouldFail === 'parse') {
                        console.log(`  ✅ PASSED (Expected): Parser failed as expected. Error: ${parseError}`);
                        passed++;
                    } else {
                        console.error(`  ❌ FAILED (Unexpected): Parser failed. Error: ${parseError}`);
                    }
                    return;
                }

                if (example.shouldFail === 'parse') {
                    console.error(`  ❌ FAILED (Unexpected): Parser succeeded but was expected to fail.`);
                    return;
                }

                if (!ast) {
                    console.error(`  ❌ FAILED (Unexpected): AST is null after successful parse.`);
                    return;
                }

                const validationErrors = ScribbleCore.validate(ast);

                if (validationErrors.length > 0) {
                    if (example.shouldFail === 'validate') {
                        console.log(`  ✅ PASSED (Expected): Validation failed as expected. Errors:`, validationErrors.map(e => e.message));
                        passed++;
                    } else {
                        console.error(`  ❌ FAILED (Unexpected): Validation failed. Errors:`, validationErrors.map(e => e.message));
                    }
                    return;
                }

                if (example.shouldFail === 'validate') {
                     console.error(`  ❌ FAILED (Unexpected): Validation succeeded but was expected to fail.`);
                     return;
                }

                ast.roles.forEach(role => {
                    ScribbleCore.project(ast, role);
                });

                console.log(`  ✅ PASSED: Parsed and validated successfully.`);
                passed++;
            });

            const failed = total - passed;
            console.log(`--- Test Suite Complete ---`);
            console.log(`Result: ${passed} / ${total} passed.`);
            setTestSummary({ passed, failed, total });
        };

        runTests();
    }, []);

    const loadExample = (code: string) => {
        setEditorCode(code);
    };

    const addNewExample = () => {
        const newExample: ProtocolExample = {
            name: `New Protocol ${protocolExamples.length + 1}`,
            code: `global protocol NewProtocol(role A, role B) {\n\t// Your protocol here\n}`,
            description: "A new user-defined protocol."
        };
        setProtocolExamples([...protocolExamples, newExample]);
        setEditorCode(newExample.code);
    };

    const saveCurrent = () => {
        alert("Save functionality is not implemented in this demo.");
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-300 font-sans">
            <header className="bg-gray-800 shadow-md flex-shrink-0">
                <div className="max-w-full mx-auto py-3 px-4 sm:px-6 lg:px-8">
                    <h1 className="text-xl font-bold text-white">Secure Scribble IDE</h1>
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-1/4 bg-gray-800 p-4 overflow-y-auto">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 text-white">Test Suite Status</h2>
                        <div className="p-3 bg-gray-700 rounded-lg">
                            <p>Passed: <span className="font-bold text-green-400">{testSummary.passed}</span></p>
                            <p>Failed: <span className="font-bold text-red-400">{testSummary.failed}</span></p>
                            <p>Total: <span className="font-bold text-white">{testSummary.total}</span></p>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold mb-2 text-white">Examples</h2>
                        <div className="space-y-2 mb-4">
                             <button onClick={addNewExample} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Add New</button>
                             <button onClick={saveCurrent} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Save Current</button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {protocolExamples.map((ex, i) => (
                                <div key={i} onClick={() => loadExample(ex.code)} className="p-3 bg-gray-700 rounded-lg mb-2 cursor-pointer hover:bg-gray-600">
                                    <h3 className="font-bold text-white">{ex.name}</h3>
                                    <p className="text-sm text-gray-400">{ex.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                             <h2 className="text-xl font-semibold mb-2 text-white">Protocol Editor</h2>
                             <textarea value={editorCode} onChange={(e) => setEditorCode(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-4 font-mono text-sm resize-none" spellCheck="false" />
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-white">Errors & Validation</h3>
                                <div className="h-32 bg-gray-800 border border-gray-600 rounded-lg p-2 overflow-y-auto text-sm">
                                    {errors.length === 0 ? <p className="text-green-400">No errors detected.</p> : errors.map((e, i) => <p key={i} className="text-red-400">{typeof e === 'string' ? e : e.message}</p>)}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-semibold text-white">Projection</h2>
                                <div className="flex items-center space-x-4">
                                    <select value={selectedRole || ''} onChange={(e) => setSelectedRole(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1" disabled={!currentAst}>
                                        {currentAst?.roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <div>
                                        <button onClick={() => setProjectionView('FSM')} className={`px-3 py-1 rounded ${projectionView === 'FSM' ? 'bg-blue-600' : 'bg-gray-600'}`}>FSM</button>
                                        <button onClick={() => setProjectionView('API')} className={`px-3 py-1 rounded ${projectionView === 'API' ? 'bg-blue-600' : 'bg-gray-600'}`}>API</button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-2">
                                {projectionView === 'FSM' ? (fsmGraph ? <FsmVisualizer graph={fsmGraph} /> : <p>Select a valid protocol and role.</p>) : (<pre className="h-full overflow-y-auto text-sm"><code>{apiCode}</code></pre>)}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;
