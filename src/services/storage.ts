export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  processedDate?: string;
  status: 'processed' | 'processing' | 'error';
  extractedText?: string;
  summary?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      documents: boolean;
      security: boolean;
      marketing: boolean;
    };
  };
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  time: string;
  timestamp?: string;
}

export interface ChatSessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSessionData {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentContext?: {
    name: string;
    text: string;
  };
}

const STORAGE_KEYS = {
  DOCUMENTS: 'le_documents',
  PROFILE: 'le_profile',
  CHAT_SESSIONS: 'le_chat_sessions',
  CHAT_ACTIVE_ID: 'le_chat_active_id',
  CHAT_SESSION_PREFIX: 'le_chat_session_',
};

export const StorageService = {
  getDocuments: (): Document[] => {
    try {
      const docs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      return docs ? JSON.parse(docs) : [];
    } catch (error) {
      console.error('Error reading documents from storage:', error);
      return [];
    }
  },

  saveDocument: (doc: Document) => {
    try {
      const docs = StorageService.getDocuments();
      const existingIndex = docs.findIndex(d => d.id === doc.id);
      if (existingIndex !== -1) {
        docs[existingIndex] = doc;
      } else {
        docs.unshift(doc);
      }
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    } catch (error) {
      console.error('Error saving document to storage:', error);
    }
  },

  getDocument: (id: string): Document | undefined => {
    return StorageService.getDocuments().find(d => d.id === id);
  },

  updateDocumentStatus: (id: string, status: 'processed' | 'processing' | 'error') => {
    const docs = StorageService.getDocuments();
    const docIndex = docs.findIndex(d => d.id === id);
    if (docIndex !== -1) {
      docs[docIndex].status = status;
      if (status === 'processed') {
        docs[docIndex].processedDate = new Date().toISOString();
      }
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    }
  },

  updateDocument: (id: string, updates: Partial<Document>) => {
    try {
      const docs = StorageService.getDocuments();
      const docIndex = docs.findIndex(d => d.id === id);
      if (docIndex !== -1) {
        docs[docIndex] = { ...docs[docIndex], ...updates };
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
      }
    } catch (error) {
      console.error('Error updating document in storage:', error);
    }
  },

  getProfile: (): UserProfile => {
    try {
      const profile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return profile ? JSON.parse(profile) : StorageService.initSampleProfile();
    } catch (error) {
      console.error('Error reading profile from storage:', error);
      return StorageService.initSampleProfile();
    }
  },

  saveProfile: (profile: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving profile to storage:', error);
    }
  },

  initSampleProfile: (): UserProfile => {
    const defaultProfile: UserProfile = {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1 (555) 123-4567',
      bio: 'Legal professional with 5+ years of experience in contract law and compliance.',
      address: {
        street: '123 Main Street, Apt 4B',
        city: 'New York',
        state: 'NY',
        zip: '10001'
      },
      preferences: {
        language: 'en',
        timezone: 'EST',
        notifications: {
          documents: true,
          security: true,
          marketing: false
        }
      }
    };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));
    return defaultProfile;
  },

  initSampleData: () => {
    if (StorageService.getDocuments().length === 0) {
      const sampleDocs: Document[] = [
        {
          id: 'doc_1',
          name: 'Lease Agreement - Apartment 4B.pdf',
          type: 'pdf',
          size: 2400000,
          uploadDate: new Date(Date.now() - 7200000).toISOString(),
          status: 'processed',
          processedDate: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'doc_2',
          name: 'Employment Contract - TechCorp.docx',
          type: 'docx',
          size: 1800000,
          uploadDate: new Date(Date.now() - 86400000).toISOString(),
          status: 'processing'
        },
        {
          id: 'doc_3',
          name: 'Privacy Policy Update.pdf',
          type: 'pdf',
          size: 952000,
          uploadDate: new Date(Date.now() - 259200000).toISOString(),
          status: 'processed',
          processedDate: new Date(Date.now() - 172800000).toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(sampleDocs));
    }
  }
};

export const ChatStorageService = {
  getSessions: (): ChatSessionMetadata[] => {
    try {
      const sessions = localStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      return sessions ? JSON.parse(sessions) : [];
    } catch (error) {
      console.error('Error reading chat sessions from storage:', error);
      return [];
    }
  },

  saveSession: (sessionData: ChatSessionData) => {
    try {
      const sessionKey = STORAGE_KEYS.CHAT_SESSION_PREFIX + sessionData.id;
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));

      const sessions = ChatStorageService.getSessions();
      const metadata: ChatSessionMetadata = {
        id: sessionData.id,
        title: sessionData.title || 'New Conversation',
        createdAt: sessionData.messages[0]?.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: sessionData.messages.length
      };

      const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
      if (existingIndex !== -1) {
        sessions[existingIndex] = metadata;
      } else {
        sessions.unshift(metadata);
      }
      localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat session to storage:', error);
    }
  },

  getSession: (id: string): ChatSessionData | null => {
    try {
      const sessionKey = STORAGE_KEYS.CHAT_SESSION_PREFIX + id;
      const sessionData = localStorage.getItem(sessionKey);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Error reading chat session from storage:', error);
      return null;
    }
  },

  createSession: (title: string = 'New Conversation'): ChatSessionData => {
    const id = crypto.randomUUID();
    const sessionData: ChatSessionData = {
      id,
      messages: [],
      title
    };
    ChatStorageService.saveSession(sessionData);
    ChatStorageService.setActiveSessionId(id);
    return sessionData;
  },

  deleteSession: (id: string) => {
    try {
      const sessionKey = STORAGE_KEYS.CHAT_SESSION_PREFIX + id;
      localStorage.removeItem(sessionKey);

      const sessions = ChatStorageService.getSessions();
      const filteredSessions = sessions.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(filteredSessions));

      const activeId = ChatStorageService.getActiveSessionId();
      if (activeId === id) {
        localStorage.removeItem(STORAGE_KEYS.CHAT_ACTIVE_ID);
      }
    } catch (error) {
      console.error('Error deleting chat session from storage:', error);
    }
  },

  getActiveSessionId: (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CHAT_ACTIVE_ID);
    } catch (error) {
      console.error('Error reading active session ID from storage:', error);
      return null;
    }
  },

  setActiveSessionId: (id: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_ACTIVE_ID, id);
    } catch (error) {
      console.error('Error setting active session ID in storage:', error);
    }
  },

  clearAllSessions: () => {
    try {
      const sessions = ChatStorageService.getSessions();
      sessions.forEach(session => {
        const sessionKey = STORAGE_KEYS.CHAT_SESSION_PREFIX + session.id;
        localStorage.removeItem(sessionKey);
      });
      localStorage.removeItem(STORAGE_KEYS.CHAT_SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.CHAT_ACTIVE_ID);
    } catch (error) {
      console.error('Error clearing all chat sessions from storage:', error);
    }
  },

  migrateOldChatHistory: () => {
    try {
      const oldHistory = localStorage.getItem('chatHistory');
      if (oldHistory) {
        const parsedHistory = JSON.parse(oldHistory);
        if (!Array.isArray(parsedHistory)) {
          localStorage.removeItem('chatHistory');
          return;
        }

        const sessionId = crypto.randomUUID();
        const firstUserMessage = parsedHistory.find((m: any) => m.sender === 'user');
        const title = firstUserMessage
          ? firstUserMessage.text.substring(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '')
          : 'Migrated Conversation';

        const sessionData: ChatSessionData = {
          id: sessionId,
          messages: parsedHistory.map((m: any) => ({
            ...m,
            id: String(m.id),
            timestamp: m.timestamp || new Date().toISOString()
          })),
          title
        };

        ChatStorageService.saveSession(sessionData);
        ChatStorageService.setActiveSessionId(sessionId);
        localStorage.removeItem('chatHistory');
      }
    } catch (error) {
      console.error('Error migrating old chat history:', error);
      localStorage.removeItem('chatHistory');
    }
  }
};