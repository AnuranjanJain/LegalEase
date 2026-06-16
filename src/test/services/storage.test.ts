import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../../services/storage';

describe('StorageService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getDocuments', () => {
    it('should return empty array when no documents exist', () => {
      const docs = StorageService.getDocuments();
      expect(docs).toEqual([]);
    });

    it('should return documents from localStorage', () => {
      const mockDoc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      localStorage.setItem('le_documents', JSON.stringify([mockDoc]));
      
      const docs = StorageService.getDocuments();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toEqual(mockDoc);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('le_documents', 'invalid json');
      const docs = StorageService.getDocuments();
      expect(docs).toEqual([]);
    });
  });

  describe('saveDocument', () => {
    it('should add new document to storage', () => {
      const doc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      
      StorageService.saveDocument(doc);
      const docs = StorageService.getDocuments();
      
      expect(docs).toHaveLength(1);
      expect(docs[0]).toEqual(doc);
    });

    it('should update existing document', () => {
      const doc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processing' as const,
      };
      
      StorageService.saveDocument(doc);
      
      const updatedDoc = { ...doc, status: 'processed' as const };
      StorageService.saveDocument(updatedDoc);
      
      const docs = StorageService.getDocuments();
      expect(docs).toHaveLength(1);
      expect(docs[0].status).toBe('processed');
    });

    it('should add new document at the beginning of the list', () => {
      const doc1 = {
        id: 'doc_1',
        name: 'Test1.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      
      const doc2 = {
        id: 'doc_2',
        name: 'Test2.pdf',
        type: 'pdf',
        size: 2000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      
      StorageService.saveDocument(doc1);
      StorageService.saveDocument(doc2);
      
      const docs = StorageService.getDocuments();
      expect(docs).toHaveLength(2);
      expect(docs[0].id).toBe('doc_2');
    });
  });

  describe('getDocument', () => {
    it('should return document by id', () => {
      const doc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      
      StorageService.saveDocument(doc);
      const found = StorageService.getDocument('doc_1');
      
      expect(found).toEqual(doc);
    });

    it('should return undefined for non-existent document', () => {
      const found = StorageService.getDocument('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status to processed', () => {
      const doc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processing' as const,
      };
      
      StorageService.saveDocument(doc);
      StorageService.updateDocumentStatus('doc_1', 'processed');
      
      const updated = StorageService.getDocument('doc_1');
      expect(updated?.status).toBe('processed');
      expect(updated?.processedDate).toBeDefined();
    });

    it('should update document status to processing', () => {
      const doc = {
        id: 'doc_1',
        name: 'Test.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
        processedDate: new Date().toISOString(),
      };
      
      StorageService.saveDocument(doc);
      StorageService.updateDocumentStatus('doc_1', 'processing');
      
      const updated = StorageService.getDocument('doc_1');
      expect(updated?.status).toBe('processing');
    });

    it('should not update non-existent document', () => {
      StorageService.updateDocumentStatus('nonexistent', 'processed');
      const docs = StorageService.getDocuments();
      expect(docs).toHaveLength(0);
    });
  });

  describe('getProfile', () => {
    it('should return default profile when none exists', () => {
      const profile = StorageService.getProfile();
      
      expect(profile.firstName).toBe('Sarah');
      expect(profile.lastName).toBe('Johnson');
      expect(profile.email).toBe('sarah.johnson@email.com');
    });

    it('should return profile from localStorage', () => {
      const mockProfile = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        bio: 'Test bio',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zip: '12345',
        },
        preferences: {
          language: 'en',
          timezone: 'EST',
          notifications: {
            documents: true,
            security: true,
            marketing: false,
          },
        },
      };
      
      localStorage.setItem('le_profile', JSON.stringify(mockProfile));
      const profile = StorageService.getProfile();
      
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
    });
  });

  describe('saveProfile', () => {
    it('should save profile to localStorage', () => {
      const profile = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+9876543210',
        bio: 'New bio',
        address: {
          street: '456 New St',
          city: 'New City',
          state: 'NC',
          zip: '54321',
        },
        preferences: {
          language: 'en',
          timezone: 'PST',
          notifications: {
            documents: false,
            security: true,
            marketing: true,
          },
        },
      };
      
      StorageService.saveProfile(profile);
      const saved = StorageService.getProfile();
      
      expect(saved.firstName).toBe('Jane');
      expect(saved.lastName).toBe('Smith');
    });
  });

  describe('initSampleData', () => {
    it('should initialize sample documents when storage is empty', () => {
      StorageService.initSampleData();
      const docs = StorageService.getDocuments();
      
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].name).toContain('Lease Agreement');
    });

    it('should not initialize sample documents when data exists', () => {
      const existingDoc = {
        id: 'existing',
        name: 'Existing.pdf',
        type: 'pdf',
        size: 1000,
        uploadDate: new Date().toISOString(),
        status: 'processed' as const,
      };
      
      StorageService.saveDocument(existingDoc);
      StorageService.initSampleData();
      
      const docs = StorageService.getDocuments();
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('existing');
    });
  });
});
