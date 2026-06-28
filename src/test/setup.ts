import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => {
    const data = (global as any).__localStorageData || {};
    return data[key] || null;
  },
  setItem: (key: string, value: string) => {
    const data = (global as any).__localStorageData || {};
    data[key] = value;
    (global as any).__localStorageData = data;
  },
  removeItem: (key: string) => {
    const data = (global as any).__localStorageData || {};
    delete data[key];
    (global as any).__localStorageData = data;
  },
  clear: () => {
    (global as any).__localStorageData = {};
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Reset localStorage before each test
beforeEach(() => {
  (global as any).__localStorageData = {};
});

// Mock scrollIntoView since jsdom doesn't support it
window.HTMLElement.prototype.scrollIntoView = () => {};
