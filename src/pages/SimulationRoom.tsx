import { useState, useRef, useEffect } from 'react';
import { Bot, User, Scale, Play, CheckCircle, AlertTriangle, RefreshCcw, FileText } from 'lucide-react';
import { NegotiationService, NegotiationMessage, FinalCompromiseDraft } from '../services/negotiationService';
import { useToast } from '../contexts/ToastContext';
import { useCompliance } from '../contexts/ComplianceContext';

export function SimulationRoom() {
  const [clauseText, setClauseText] = useState('In the event of a breach, the receiving party shall hold the disclosing party harmless against any and all claims, without limitation to time or monetary cap, including all indirect and consequential damages.');
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'negotiating' | 'arbitrating' | 'complete'>('idle');
  const [finalDraft, setFinalDraft] = useState<FinalCompromiseDraft | null>(null);
  const { showToast } = useToast();
  const { requireCompliance } = useCompliance();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const startSimulation = () => {
    requireCompliance(async () => {
      if (!clauseText.trim()) {
        showToast("Please enter a legal clause to simulate.", "warning");
        return;
      }
      
      setMessages([]);
      setFinalDraft(null);
      setStatus('negotiating');
    
    try {
      // Turn 1: Opposing Counsel
      const msg1 = await NegotiationService.startNegotiation('clause-1', clauseText);
      setMessages(prev => [...prev, msg1]);
      
      // Turn 2: Originating Counsel
      const msg2 = await NegotiationService.counterProposal('clause-1', clauseText, msg1.content);
      setMessages(prev => [...prev, msg2]);
      
      setStatus('arbitrating');
      showToast("Negotiation complete. Arbitrator is reviewing the transcript...", "info");
      
      // Turn 3: Arbitrator
      const draft = await NegotiationService.resolveConflict('clause-1', clauseText, [msg1, msg2]);
      setFinalDraft(draft);
      setStatus('complete');
      showToast("Arbitration complete. Final draft ready.", "success");
      
      } catch (err) {
        console.error("Simulation failed:", err);
        showToast("Simulation failed to complete. Please try again.", "error");
        setStatus('idle');
      }
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'opposing_counsel': return <AlertTriangle size={18} className="text-red-500" />;
      case 'originating_counsel': return <User size={18} className="text-blue-500" />;
      case 'arbitrator': return <Scale size={18} className="text-purple-500" />;
      default: return <Bot size={18} />;
    }
  };

  const getRoleName = (role: string) => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 relative overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scale size={24} className="text-purple-600 dark:text-purple-400" />
            Mock Arbitrator Workspace
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Multi-Agent Negotiation Simulator
          </p>
        </div>
        <button
          onClick={startSimulation}
          disabled={status === 'negotiating' || status === 'arbitrating'}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {status === 'idle' || status === 'complete' ? <Play size={16} /> : <RefreshCcw size={16} className="animate-spin" />}
          {status === 'idle' ? 'Start Simulation' : status === 'complete' ? 'Restart' : 'Simulating...'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Original Clause */}
        <div className="w-1/3 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <FileText size={18} /> Source Clause
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <textarea
              className="w-full h-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none"
              value={clauseText}
              onChange={(e) => setClauseText(e.target.value)}
              placeholder="Paste a contract clause here to simulate negotiation..."
            />
          </div>
        </div>

        {/* Center Pane: Agent Debate Stream */}
        <div className="w-1/3 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Bot size={18} /> Negotiation Feed
          </div>
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
            {messages.length === 0 && status === 'idle' && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                Click "Start Simulation" to begin the AI negotiation process.
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  {getRoleIcon(msg.role)}
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                    {getRoleName(msg.role)}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            
            {(status === 'negotiating' || status === 'arbitrating') && (
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 p-4">
                <RefreshCcw size={16} className="animate-spin" />
                <span className="text-sm italic">
                  {status === 'negotiating' ? 'Agents are debating...' : 'Arbitrator is reviewing...'}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Right Pane: Arbitrator Output Diff */}
        <div className="w-1/3 flex flex-col bg-white dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <CheckCircle size={18} /> Arbitrator Resolution
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {!finalDraft ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
                Awaiting arbitrator decision...
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2 flex items-center gap-2">
                    <Scale size={16} /> Final Compromise Draft
                  </h3>
                  <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {finalDraft.proposedRevision}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Arbitrator Explanation</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                    {finalDraft.explanation}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resilience Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500" 
                        style={{ width: `${finalDraft.resilienceScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {finalDraft.resilienceScore}/100
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
