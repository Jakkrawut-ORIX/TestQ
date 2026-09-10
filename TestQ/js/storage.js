/**
 * storage.js — Storage Management
 * บริหารการบันทึก โหลด ล้าง Export และ Import configuration
 */

export class StorageManager {
  constructor(storageKey = 'lease-calculator-v3') {
    this.key = storageKey;
  }

  /** ตรวจว่าเป็น plain object ที่ใช้เป็น configuration ได้ */
  isValidData(data) {
    return data !== null && typeof data === 'object' && !Array.isArray(data);
  }

  /** บันทึก configuration ลง localStorage */
  save(data) {
    if (!this.isValidData(data)) {
      console.warn('Storage save failed: invalid data');
      return false;
    }

    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('Storage save failed:', error);
      return false;
    }
  }

  /** โหลด configuration จาก localStorage */
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;

      const data = JSON.parse(raw);
      return this.isValidData(data) ? data : null;
    } catch (error) {
      console.warn('Storage load failed:', error);
      return null;
    }
  }

  /** ลบ configuration ที่บันทึกไว้ */
  clear() {
    try {
      localStorage.removeItem(this.key);
      return true;
    } catch (error) {
      console.warn('Storage clear failed:', error);
      return false;
    }
  }

  /** Export configuration เป็นไฟล์ JSON */
  exportToFile(data, filename = 'lease-config.json') {
    if (!this.isValidData(data)) {
      throw new Error('Invalid configuration data');
    }

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // รอให้ browser เริ่มดาวน์โหลดก่อนคืนหน่วยความจำ
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** Import configuration จากไฟล์ JSON */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!(file instanceof Blob)) {
        reject(new Error('Invalid file'));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || ''));

          if (!this.isValidData(data)) {
            throw new Error('Invalid configuration data');
          }

          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };

      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file, 'UTF-8');
    });
  }
}
