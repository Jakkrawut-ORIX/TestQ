/**
 * storage.js — Storage Management
 */
export class StorageManager {
  constructor(storageKey = 'lease-calculator-v4') {
    this.key = storageKey;
  }

  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('Storage save failed:', error);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (error) {
      console.warn('Storage load failed:', error);
      return null;
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
      return true;
    } catch (error) {
      console.warn('Storage clear failed:', error);
      return false;
    }
  }
}
