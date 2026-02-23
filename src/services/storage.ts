export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  processedDate?: string;
  status: 'processed' | 'processing';
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

const STORAGE_KEYS = {
  DOCUMENTS: 'le_documents',
  PROFILE: 'le_profile',
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

  updateDocumentStatus: (id: string, status: 'processed' | 'processing') => {
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
