import React, { useState, useEffect, useCallback, useRef } from 'react';
import { examples } from './examples';
import { ScribbleCore } from './core';
import { ProtocolExample, GlobalProtocol, Role, FsmGraph, ValidationError } from './types';
import FsmVisualizer from './components/FsmVisualizer';
import CfgVisualizer from './components/CfgVisualizer';
import SimulatorControls from './components/SimulatorControls';
import CallStackDisplay from './components/CallStackDisplay';

// Import simulators and types
import { CFGSimulator } from './src/core/simulation/cfg-simulator';
import { CFSMSimulator } from './src/core/simulation/cfsm-simulator';
import { buildCFG } from './src/core/cfg/cfg-builder';
import { projectProtocol } from './src/core/projection/projection';
import type { CFG } from './src/core/cfg/types';
import type { CFSM } from './src/core/projection/types';
import type { CFGExecutionState } from './src/core/simulation/types';
import type { CFSMExecutionState } from './src/core/simulation/cfsm-simulator-types';
import type { ProtocolCallFrame } from './src/core/simulation/call-stack-types';
import { CallStackManager } from './src/core/simulation/call-stack-manager';

type ViewMode = 'FSM' | 'CFG' | 'API';
type SimulatorView = 'CFSM' | 'CFG' | 'BOTH';

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
    const [viewMode, setViewMode] = useState<ViewMode>('CFG');
    const [simulatorView, setSimulatorView] = useState<SimulatorView>('BOTH');
    const [fsmGraph, setFsmGraph] = useState<FsmGraph | null>(null);
    const [apiCode, setApiCode] = useState<string>('');
    const [protocolExamples, setProtocolExamples] = useState<ProtocolExample[]>(examples);

    // Simulator state
    const [cfg, setCfg] = useState<CFG | null>(null);
    const [cfsm, setCfsm] = useState<CFSM | null>(null);
    const [cfgSimulator, setCfgSimulator] = useState<CFGSimulator | null>(null);
    const [cfsmSimulator, setCfsmSimulator] = useState<CFSMSimulator | null>(null);
    const [callStackManager, setCallStackManager] = useState<CallStackManager | null>(null);

    // Execution state
    const [cfgState, setCfgState] = useState<CFGExecutionState | null>(null);
    const [cfsmState, setCfsmState] = useState<CFSMExecutionState | null>(null);
    const [callStack, setCallStack] = useState<ProtocolCallFrame[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const runningRef = useRef(false);

    const processCode = useCallback((code: string) => {
        setSelectedRole(null);
        try {
            const { ast, error: parseError } = ScribbleCore.parse(code);
            if (parseError) {
                setErrors([`Parse Error: ${parseError}`]);
                setCurrentAst(null);
                setCfg(null);
                return;
            }

            if (ast) {
                const validationErrors = ScribbleCore.validate(ast);
                if (validationErrors.length > 0) {
                    setErrors(validationErrors);
                    setCfg(null);
                } else {
                    setErrors([]);
                    // Build CFG from AST
                    try {
                        const builtCfg = buildCFG(ast);
                        setCfg(builtCfg);
                    } catch (e: any) {
                        setErrors([`CFG Build Error: ${e.message}`]);
                        setCfg(null);
                    }
                }
                setCurrentAst(ast);
                setSelectedRole(ast.roles[0] || null);
            }
        } catch (e: any) {
            setErrors([`Error: ${e.message}`]);
            setCurrentAst(null);
            setCfg(null);
        }
    }, []);

    useEffect(() => {
        processCode(editorCode);
    }, [editorCode, processCode]);

    // Project to selected role and create CFSM
    useEffect(() => {
        if (currentAst && selectedRole && cfg) {
            try {
                const localAst = ScribbleCore.project(currentAst, selectedRole);
                setFsmGraph(ScribbleCore.generateFsm(localAst));
                setApiCode(ScribbleCore.generateApi(localAst));

                // Project CFG to CFSM
                const projectedCfsm = projectProtocol(cfg, selectedRole);
                setCfsm(projectedCfsm);
            } catch (e: any) {
                setErrors([...errors, `Projection Error: ${e.message}`]);
                setCfsm(null);
            }
        } else {
            setFsmGraph(null);
            setApiCode('');
            setCfsm(null);
        }
    }, [currentAst, selectedRole, cfg]);

    // Initialize simulators when CFG and CFSM are ready
    useEffect(() => {
        if (!cfg) {
            setCfgSimulator(null);
            setCfsmSimulator(null);
            setCallStackManager(null);
            return;
        }

        // Create call stack manager
        const csManager = new CallStackManager({
            maxDepth: 100,
            maxIterations: 1000,
            emitEvents: true,
        });

        // Listen to call stack events
        csManager.on('frame-push', () => {
            setCallStack([...csManager.getState().frames]);
        });
        csManager.on('frame-pop', () => {
            setCallStack([...csManager.getState().frames]);
        });
        csManager.on('frame-step', () => {
            setCallStack([...csManager.getState().frames]);
        });

        setCallStackManager(csManager);

        // Create CFG simulator
        const cfgSim = new CFGSimulator(cfg, {
            maxSteps: 10000,
            recordTrace: true,
            choiceStrategy: 'first',
            callStackManager: csManager,
            executionHistory: {
                enabled: true,
                maxSnapshots: 1000,
            },
        });

        // Listen to CFG simulator events
        cfgSim.on('step-forward', () => {
            setCfgState(cfgSim.getState());
        });
        cfgSim.on('step-back', () => {
            setCfgState(cfgSim.getState());
        });
        cfgSim.on('complete', () => {
            setCfgState(cfgSim.getState());
        });

        setCfgSimulator(cfgSim);
        setCfgState(cfgSim.getState());

        // Create CFSM simulator if CFSM is available
        if (cfsm) {
            const cfsmSim = new CFSMSimulator(cfsm, {
                maxSteps: 10000,
                recordTrace: true,
                executionHistory: {
                    enabled: true,
                    maxSnapshots: 1000,
                },
            });

            // Listen to CFSM simulator events
            cfsmSim.on('step-forward', () => {
                setCfsmState(cfsmSim.getState());
            });
            cfsmSim.on('step-back', () => {
                setCfsmState(cfsmSim.getState());
            });
            cfsmSim.on('complete', () => {
                setCfsmState(cfsmSim.getState());
            });

            setCfsmSimulator(cfsmSim);
            setCfsmState(cfsmSim.getState());
        }

        return () => {
            // Cleanup
            csManager.reset();
        };
    }, [cfg, cfsm]);

    // Stepping controls
    const handleStepForward = useCallback(async () => {
        if (cfgSimulator) {
            cfgSimulator.stepForward();
            setCfgState(cfgSimulator.getState());
        }
        if (cfsmSimulator && simulatorView !== 'CFG') {
            await cfsmSimulator.stepForward();
            setCfsmState(cfsmSimulator.getState());
        }
    }, [cfgSimulator, cfsmSimulator, simulatorView]);

    const handleStepBackward = useCallback(() => {
        if (cfgSimulator) {
            cfgSimulator.stepBackward();
            setCfgState(cfgSimulator.getState());
        }
        if (cfsmSimulator && simulatorView !== 'CFG') {
            cfsmSimulator.stepBackward();
            setCfsmState(cfsmSimulator.getState());
        }
    }, [cfgSimulator, cfsmSimulator, simulatorView]);

    const handleStepInto = useCallback(async () => {
        if (cfgSimulator) {
            cfgSimulator.stepInto();
            setCfgState(cfgSimulator.getState());
        }
        if (cfsmSimulator && simulatorView !== 'CFG') {
            await cfsmSimulator.stepInto();
            setCfsmState(cfsmSimulator.getState());
        }
    }, [cfgSimulator, cfsmSimulator, simulatorView]);

    const handleStepOut = useCallback(async () => {
        if (cfgSimulator) {
            cfgSimulator.stepOut();
            setCfgState(cfgSimulator.getState());
        }
        if (cfsmSimulator && simulatorView !== 'CFG') {
            await cfsmSimulator.stepOut();
            setCfsmState(cfsmSimulator.getState());
        }
    }, [cfgSimulator, cfsmSimulator, simulatorView]);

    const handleStepOver = useCallback(() => {
        if (cfgSimulator) {
            cfgSimulator.stepOver();
            setCfgState(cfgSimulator.getState());
        }
    }, [cfgSimulator]);

    const handleReset = useCallback(() => {
        if (cfgSimulator) {
            cfgSimulator.reset();
            setCfgState(cfgSimulator.getState());
        }
        if (cfsmSimulator) {
            cfsmSimulator.reset();
            setCfsmState(cfsmSimulator.getState());
        }
        if (callStackManager) {
            callStackManager.reset();
            setCallStack([]);
        }
        setIsRunning(false);
        runningRef.current = false;
    }, [cfgSimulator, cfsmSimulator, callStackManager]);

    const handleRun = useCallback(async () => {
        setIsRunning(true);
        runningRef.current = true;

        const runStep = async () => {
            if (!runningRef.current) return;

            if (cfgSimulator && !cfgSimulator.getState().completed) {
                const result = cfgSimulator.stepForward();
                setCfgState(cfgSimulator.getState());

                if (result.success && !cfgSimulator.getState().completed) {
                    setTimeout(runStep, 500); // 500ms delay between steps
                } else {
                    setIsRunning(false);
                    runningRef.current = false;
                }
            } else {
                setIsRunning(false);
                runningRef.current = false;
            }
        };

        runStep();
    }, [cfgSimulator]);

    const handlePause = useCallback(() => {
        setIsRunning(false);
        runningRef.current = false;
    }, []);

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
        handleReset();
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
                    <h1 className="text-xl font-bold text-white">Secure Scribble IDE with Stepping Debugger</h1>
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-1/5 bg-gray-800 p-4 overflow-y-auto">
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
                <main className="flex-1 flex flex-col p-4 overflow-hidden">
                    <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
                        {/* Left column: Editor */}
                        <div className="flex flex-col overflow-hidden">
                             <h2 className="text-xl font-semibold mb-2 text-white">Protocol Editor</h2>
                             <textarea
                                value={editorCode}
                                onChange={(e) => setEditorCode(e.target.value)}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-4 font-mono text-sm resize-none overflow-auto"
                                spellCheck="false"
                             />
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-white">Errors & Validation</h3>
                                <div className="h-24 bg-gray-800 border border-gray-600 rounded-lg p-2 overflow-y-auto text-sm">
                                    {errors.length === 0 ? <p className="text-green-400">No errors detected.</p> : errors.map((e, i) => <p key={i} className="text-red-400">{typeof e === 'string' ? e : e.message}</p>)}
                                </div>
                            </div>
                        </div>

                        {/* Right column: Visualization and Controls */}
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-semibold text-white">Visualization</h2>
                                <div className="flex items-center space-x-4">
                                    <select
                                        value={selectedRole || ''}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
                                        disabled={!currentAst}
                                    >
                                        {currentAst?.roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <div>
                                        <button
                                            onClick={() => setViewMode('CFG')}
                                            className={`px-3 py-1 rounded ${viewMode === 'CFG' ? 'bg-blue-600' : 'bg-gray-600'}`}
                                        >
                                            CFG
                                        </button>
                                        <button
                                            onClick={() => setViewMode('FSM')}
                                            className={`px-3 py-1 rounded ${viewMode === 'FSM' ? 'bg-blue-600' : 'bg-gray-600'}`}
                                        >
                                            FSM
                                        </button>
                                        <button
                                            onClick={() => setViewMode('API')}
                                            className={`px-3 py-1 rounded ${viewMode === 'API' ? 'bg-blue-600' : 'bg-gray-600'}`}
                                        >
                                            API
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Visualization area */}
                            <div className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-2 overflow-hidden">
                                {viewMode === 'CFG' ? (
                                    cfg ? (
                                        <CfgVisualizer
                                            cfg={cfg}
                                            currentNode={cfgState?.currentNode}
                                            visitedNodes={cfgState?.visitedNodes || []}
                                            highlightPath={true}
                                        />
                                    ) : (
                                        <p className="text-gray-400">No valid CFG available.</p>
                                    )
                                ) : viewMode === 'FSM' ? (
                                    fsmGraph ? (
                                        <FsmVisualizer
                                            graph={fsmGraph}
                                            currentState={cfsmState?.currentState}
                                            visitedStates={cfsmState?.visitedStates || []}
                                            highlightPath={true}
                                        />
                                    ) : (
                                        <p className="text-gray-400">Select a valid protocol and role.</p>
                                    )
                                ) : (
                                    <pre className="h-full overflow-y-auto text-sm"><code>{apiCode}</code></pre>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="mt-4">
                                <SimulatorControls
                                    onStepForward={handleStepForward}
                                    onStepBackward={handleStepBackward}
                                    onStepInto={handleStepInto}
                                    onStepOut={handleStepOut}
                                    onStepOver={handleStepOver}
                                    onReset={handleReset}
                                    onRun={handleRun}
                                    onPause={handlePause}
                                    isRunning={isRunning}
                                    isCompleted={cfgState?.completed || false}
                                    canStepBackward={(cfgSimulator?.getExecutionHistory().canUndo() || false)}
                                    canStepOut={callStack.length > 0}
                                    stepCount={cfgState?.stepCount || 0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Call Stack at bottom */}
                    {callStack.length > 0 && (
                        <div className="mt-4">
                            <CallStackDisplay frames={callStack} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
