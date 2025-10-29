import { useState, useEffect, useCallback } from 'react';
import { html } from '../ht-element.js';
import { ScribbleCore, examples } from '../core/core.js';
import FsmVisualizer from './FsmVisualizer.js';

function App() {
    const [testSummary, setTestSummary] = useState({ passed: 0, failed: 0, total: 0 });
    const [testFailures, setTestFailures] = useState([]);
    const [editorCode, setEditorCode] = useState(examples[0].code);
    const [currentAst, setCurrentAst] = useState(null);
    const [errors, setErrors] = useState([]);
    const [fsmGraphs, setFsmGraphs] = useState({});
    const [astToFsmMap, setAstToFsmMap] = useState({});
    const [protocolExamples, setProtocolExamples] = useState(examples);
    const [simulator, setSimulator] = useState(null);
    const [possibleActions, setPossibleActions] = useState([]);

    const processCode = useCallback((code) => {
        const { ast, error } = ScribbleCore.parse(code);
        if (error) { setErrors([`Parse Error: ${error}`]); setCurrentAst(null); setFsmGraphs({}); setSimulator(null); return; }
        if (ast) {
            const validationErrors = ScribbleCore.validate(ast);
            setErrors(validationErrors);
            setCurrentAst(ast);
            if (validationErrors.length === 0) {
                const sim = ScribbleCore.createSimulator(ast);
                setSimulator(sim);
                setPossibleActions(sim.getPossibleActions());
                const newGraphs = {};
                const newMappings = {};
                ast.roles.forEach(role => {
                    const localAst = ScribbleCore.project(ast, role);
                    const { graph, mapping } = ScribbleCore.generateFsmWithMapping(localAst);
                    newGraphs[role] = graph;
                    newMappings[role] = mapping;
                });
                setFsmGraphs(newGraphs);
                setAstToFsmMap(newMappings);
            } else {
                setFsmGraphs({});
            }
        }
    }, []);

    useEffect(() => { processCode(editorCode); }, [editorCode]);

    useEffect(() => {
        const failures = [];
        let passed = 0;
        examples.forEach(ex => {
            const { ast, error } = ScribbleCore.parse(ex.code);
            if (error) { if (ex.shouldFail === 'parse') passed++; else failures.push({ name: ex.name, reason: `Unexpected parser error: ${error}` }); }
            else if (ex.shouldFail === 'parse') failures.push({ name: ex.name, reason: 'Expected parser to fail, but it succeeded.' });
            else if (ast) {
                const validationErrors = ScribbleCore.validate(ast);
                if (validationErrors.length > 0) { if (ex.shouldFail === 'validate') passed++; else failures.push({ name: ex.name, reason: `Unexpected validation error: ${validationErrors[0].message}` }); }
                else if (ex.shouldFail === 'validate') failures.push({ name: ex.name, reason: 'Expected validation to fail, but it succeeded.' });
                else passed++;
            }
        });
        setTestSummary({ passed, failed: examples.length - passed, total: examples.length });
        setTestFailures(failures);
    }, []);

    const handleStep = (action) => {
        if (!simulator) return;
        simulator.step(action);
        setPossibleActions([...simulator.getPossibleActions()]);
        // Force a re-render to update the current state highlighting
        setCurrentAst({ ...currentAst });
    };

    const handleReset = () => {
        if (!simulator) return;
        simulator.reset();
        setPossibleActions([...simulator.getPossibleActions()]);
        setCurrentAst({ ...currentAst });
    };

    return html`
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
                            <p>Passed: <span className="font-bold text-green-400">${testSummary.passed}</span></p>
                            <p>Failed: <span className="font-bold text-red-400">${testSummary.failed}</span></p>
                            <p>Total: <span className="font-bold text-white">${testSummary.total}</span></p>
                        </div>
                        ${testFailures.length > 0 && html`
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-red-400 mb-2">Failed Tests</h3>
                                <div className="p-3 bg-gray-800 rounded-lg max-h-40 overflow-y-auto">
                                    ${testFailures.map((failure, i) => html`
                                        <div key=${i} className="mb-2">
                                            <p className="font-bold text-white">${failure.name}</p>
                                            <p className="text-sm text-gray-400">${failure.reason}</p>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold mb-2 text-white">Examples</h2>
                        <div className="max-h-96 overflow-y-auto">
                            ${protocolExamples.map((ex, i) => html`
                                <div key=${i} onClick=${() => setEditorCode(ex.code)} className="p-3 bg-gray-700 rounded-lg mb-2 cursor-pointer hover:bg-gray-600">
                                    <h3 className="font-bold text-white">${ex.name}</h3>
                                    <p className="text-sm text-gray-400">${ex.description}</p>
                                </div>
                            `)}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                             <h2 className="text-xl font-semibold mb-2 text-white">Protocol Editor</h2>
                             <textarea value=${editorCode} onChange=${(e) => setEditorCode(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-4 font-mono text-sm resize-none" spellCheck="false" />
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-white">Errors & Validation</h3>
                                <div className="h-32 bg-gray-800 border border-gray-600 rounded-lg p-2 overflow-y-auto text-sm">
                                    ${errors.length === 0 ? html`<p className="text-green-400">No errors detected.</p>` : errors.map((e, i) => html`<p key=${i} className="text-red-400">${typeof e === 'string' ? e : e.message}</p>`)}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col overflow-y-auto">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold mb-2 text-white">Simulation Controls</h2>
                                <div className="flex space-x-2">
                                    <button onClick=${() => handleStep(null)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Auto-Play Step</button>
                                    <button onClick=${() => handleStep(possibleActions[0])} disabled=${!simulator || possibleActions.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Step</button>
                                    <button onClick=${handleReset} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Reset</button>
                                </div>
                                <div className="mt-2 space-x-2">
                                    ${possibleActions.map((action, i) => html`
                                        <button key=${i} onClick=${() => handleStep(action)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm">
                                            ${action.role} chooses ${action.label}
                                        </button>
                                    `)}
                                </div>
                            </div>
                            <h2 className="text-xl font-semibold mb-2 text-white">Role Projections</h2>
                            <div className="space-y-4">
                                ${Object.entries(fsmGraphs).map(([role, graph]) => html`
                                    <div key=${role} className="bg-gray-800 border border-gray-600 rounded-lg p-2">
                                        <h3 className="text-lg font-semibold text-white mb-2">${role}</h3>
                                        <div style=${{ height: '300px' }}>
                                            <${FsmVisualizer} graph=${graph} currentNodeId=${astToFsmMap[role]?.get(simulator?.currentStates[role]?.[0]) || null} />
                                        </div>
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;
}

export default App;
