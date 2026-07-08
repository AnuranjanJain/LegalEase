import { api } from './api';

export interface NegotiationState {
  originalText: string;
  clauseId: string;
  turnCount: number;
  maxTurns: number;
  status: 'idle' | 'negotiating' | 'arbitrating' | 'complete';
  messages: NegotiationMessage[];
  finalDraft?: FinalCompromiseDraft;
}

export interface NegotiationMessage {
  id: string;
  role: 'opposing_counsel' | 'originating_counsel' | 'arbitrator';
  content: string;
  timestamp: string;
}

export interface FinalCompromiseDraft {
  clauseId: string;
  originalText: string;
  proposedRevision: string;
  resilienceScore: number;
  explanation: string;
}

export class NegotiationService {
  /**
   * Evaluates the initial contract text to flag loopholes (Opposing Counsel)
   */
  static async startNegotiation(_clauseId: string, text: string): Promise<NegotiationMessage> {
    const prompt = `As Opposing Counsel, analyze the following legal clause and flag any liability loopholes, vague compliance parameters, or unfavorable indemnification allocations. Clause: "${text}"`;
    
    // Using the generic chat endpoint to simulate the agent
    const response = await api.post<{ response: string }>('/chat', {
      message: prompt,
      context: text
    });

    return {
      id: crypto.randomUUID(),
      role: 'opposing_counsel',
      content: response.response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Originating Counsel responds to objections
   */
  static async counterProposal(_clauseId: string, text: string, objections: string): Promise<NegotiationMessage> {
    const prompt = `As Originating Counsel, review these objections: "${objections}". Draft a counter-argument and structural amendments to protect our client while addressing valid concerns.`;
    
    const response = await api.post<{ response: string }>('/chat', {
      message: prompt,
      context: text
    });

    return {
      id: crypto.randomUUID(),
      role: 'originating_counsel',
      content: response.response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Arbitrator rules on the negotiation and provides a final structural diff
   */
  static async resolveConflict(clauseId: string, text: string, transcript: NegotiationMessage[]): Promise<FinalCompromiseDraft> {
    const historyText = transcript.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\\n\\n');
    const prompt = `As a Mock Arbitrator, review this negotiation transcript:\\n\\n${historyText}\\n\\nBased on the arguments, output a JSON object strictly containing:
    {
      "clauseId": "${clauseId}",
      "originalText": "...",
      "proposedRevision": "...",
      "resilienceScore": <number 0-100>,
      "explanation": "..."
    }`;

    // Here we'd ideally hit a specific endpoint that forces JSON schema.
    // For now, we simulate with the chat endpoint and parse the JSON.
    const response = await api.post<{ response: string }>('/chat', {
      message: prompt,
      context: text
    });

    try {
      // Basic JSON extraction to handle markdown blocks
      let jsonStr = response.response;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      }
      return JSON.parse(jsonStr) as FinalCompromiseDraft;
    } catch (e) {
      console.warn("Failed to parse JSON from arbitrator. Fallback to basic extraction.");
      return {
        clauseId,
        originalText: text,
        proposedRevision: response.response,
        resilienceScore: 50,
        explanation: "JSON parsing failed. Raw output provided."
      };
    }
  }
}
