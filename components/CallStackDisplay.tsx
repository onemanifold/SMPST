import React from 'react';
import type { ProtocolCallFrame } from '../src/core/simulation/call-stack-types';

export interface CallStackDisplayProps {
  frames: ProtocolCallFrame[];
  onFrameClick?: (frame: ProtocolCallFrame) => void;
}

const CallStackDisplay: React.FC<CallStackDisplayProps> = ({ frames, onFrameClick }) => {
  if (frames.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Call Stack</h3>
        <div className="text-gray-400 text-sm italic">No sub-protocols active</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Call Stack</h3>
        <div className="text-xs text-gray-400">
          Depth: <span className="font-mono text-blue-400">{frames.length}</span>
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div className="mb-3 flex items-center flex-wrap gap-1 text-sm">
        <span className="text-gray-400">Root</span>
        {frames.map((frame, index) => (
          <React.Fragment key={frame.id}>
            <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <button
              onClick={() => onFrameClick?.(frame)}
              className={`hover:text-blue-400 transition-colors ${
                index === frames.length - 1 ? 'text-blue-400 font-semibold' : 'text-gray-300'
              }`}
            >
              {frame.metadata?.displayName || frame.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Stack frames list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...frames].reverse().map((frame, reverseIndex) => {
          const index = frames.length - 1 - reverseIndex;
          const isActive = index === frames.length - 1;

          return (
            <div
              key={frame.id}
              onClick={() => onFrameClick?.(frame)}
              className={`p-3 rounded border cursor-pointer transition-all ${
                isActive
                  ? 'bg-blue-900 border-blue-600 shadow-md'
                  : 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* Frame type badge */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        frame.type === 'recursion'
                          ? 'bg-yellow-600 text-yellow-100'
                          : 'bg-purple-600 text-purple-100'
                      }`}
                    >
                      {frame.type === 'recursion' ? 'REC' : 'SUB'}
                    </span>

                    {/* Frame name */}
                    <h4 className="font-semibold text-white">
                      {frame.metadata?.displayName || frame.name}
                    </h4>

                    {/* Active indicator */}
                    {isActive && (
                      <span className="ml-auto text-xs text-blue-300 font-semibold">ACTIVE</span>
                    )}
                  </div>

                  {/* Frame description */}
                  {frame.metadata?.description && (
                    <p className="text-xs text-gray-400 mt-1">{frame.metadata.description}</p>
                  )}

                  {/* Frame details */}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Current Node:</span>{' '}
                      <span className="font-mono text-blue-300">{frame.currentNode}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Steps:</span>{' '}
                      <span className="font-mono text-green-300">{frame.stepCount}</span>
                    </div>
                    {frame.iterations !== undefined && (
                      <div>
                        <span className="text-gray-400">Iterations:</span>{' '}
                        <span className="font-mono text-yellow-300">{frame.iterations}</span>
                      </div>
                    )}
                    {frame.roleMapping && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Role Mapping:</span>{' '}
                        <span className="font-mono text-purple-300 text-xs">
                          {Object.entries(frame.roleMapping)
                            .map(([formal, actual]) => `${formal}→${actual}`)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Verified badge */}
                  {frame.metadata?.verified && (
                    <div className="mt-2 flex items-center text-xs text-green-400">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Verified
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CallStackDisplay;
