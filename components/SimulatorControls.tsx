import React from 'react';

export interface SimulatorControlsProps {
  onStepForward: () => void;
  onStepBackward: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onStepOver: () => void;
  onReset: () => void;
  onRun: () => void;
  onPause: () => void;
  isRunning: boolean;
  isCompleted: boolean;
  canStepBackward: boolean;
  canStepOut: boolean;
  stepCount: number;
}

const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  onStepForward,
  onStepBackward,
  onStepInto,
  onStepOut,
  onStepOver,
  onReset,
  onRun,
  onPause,
  isRunning,
  isCompleted,
  canStepBackward,
  canStepOut,
  stepCount,
}) => {
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Simulation Controls</h3>
        <div className="text-sm text-gray-400">
          Step: <span className="font-mono text-blue-400">{stepCount}</span>
        </div>
      </div>

      {/* Main Control Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Play/Pause */}
        {!isRunning ? (
          <button
            onClick={onRun}
            disabled={isCompleted}
            className="flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
            title="Run to completion"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Run
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors"
            title="Pause execution"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Pause
          </button>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
          title="Reset simulation"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Reset
        </button>

        {/* Status indicator */}
        <div className="flex items-center justify-center">
          {isCompleted ? (
            <span className="text-green-400 font-semibold flex items-center">
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Complete
            </span>
          ) : isRunning ? (
            <span className="text-yellow-400 font-semibold flex items-center">
              <svg className="w-5 h-5 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running
            </span>
          ) : (
            <span className="text-gray-400 font-semibold">Ready</span>
          )}
        </div>
      </div>

      {/* Stepping Controls */}
      <div className="border-t border-gray-600 pt-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Step Controls</h4>
        <div className="grid grid-cols-2 gap-2">
          {/* Step Backward */}
          <button
            onClick={onStepBackward}
            disabled={!canStepBackward || isRunning}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            title="Step backward (undo)"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Step Back
          </button>

          {/* Step Forward */}
          <button
            onClick={onStepForward}
            disabled={isCompleted || isRunning}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            title="Step forward"
          >
            Step Forward
            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Step Into */}
          <button
            onClick={onStepInto}
            disabled={isCompleted || isRunning}
            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            title="Step into sub-protocol"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Step Into
          </button>

          {/* Step Over */}
          <button
            onClick={onStepOver}
            disabled={isCompleted || isRunning}
            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            title="Step over sub-protocol"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Step Over
          </button>

          {/* Step Out */}
          <button
            onClick={onStepOut}
            disabled={!canStepOut || isCompleted || isRunning}
            className="col-span-2 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            title="Step out of current sub-protocol"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Step Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulatorControls;
