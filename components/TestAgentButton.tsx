import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { analyzeChangeImpact, checkBackendHealth } from '../services/api/pythonBackend';

/**
 * Test button to trigger Python AI agents
 * Remove this component once testing is complete
 */
export const TestAgentButton: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const testBackend = async () => {
    if (!projectId) {
      alert('Navigate to a project first!');
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      // 1. Check backend health
      console.log('🔍 Checking Python backend health...');
      const health = await checkBackendHealth();
      console.log('✅ Backend health:', health);

      // 2. Trigger Change Impact Analyzer
      console.log('🚀 Triggering Change Impact Analyzer...');
      const action = await analyzeChangeImpact(
        projectId,
        'Add 3x 50A EV chargers to parking lot',
        [
          { type: 'ev_charger', amps: 50, quantity: 3 }
        ]
      );

      console.log('✅ Agent action created:', action);
      setResult(`Success! Agent action created: ${action.id}\n\nCheck the AI Copilot sidebar on the right →`);

    } catch (error: any) {
      console.error('❌ Test failed:', error);
      setResult(`Error: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={testBackend}
        disabled={testing || !projectId}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        {testing ? 'Testing...' : 'Test Python AI Agent'}
      </button>

      {result && (
        <div className="mt-2 bg-white border border-gray-300 rounded-lg p-3 shadow-lg max-w-sm">
          <pre className="text-xs whitespace-pre-wrap">{result}</pre>
          <button
            onClick={() => setResult(null)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
