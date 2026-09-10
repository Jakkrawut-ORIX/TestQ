/**
 * utils.js — Utility Functions
 * ฟังก์ชันช่วยสำหรับ DOM manipulation, formatting, calculations
 * ใช้ได้ทั่วทั้งแอป
 */

/**
 * DOM Helpers
 */
export const $ = (id) => document.getElementById(id);

export const getVal = (id) => {
  const el = $(id);
  if (!el) return null;
  
  // ตรวจสอบว่าเป็น number input หรือมี data-num flag
  const isNum = el.getAttribute?.('data-num') === '1' || el.type === 'number';
  
  if (isNum) {
    const v = parseFloat((el.value || '').replace(/,/g, '').trim());
    return isNaN(v) ? 0 : v;
  }
  
  return el.value || '';
};

export const setVal = (id, v) => {
  const el = $(id);
  if (el) el.value = v;
};

export const setText = (id, v) => {
  const el = $(id);
  if (el) el.textContent = v;
};

export const setHTML = (id, v) => {
  const el = $(id);
  if (el) el.innerHTML = v;
};

export const addClass = (id, className) => {
  const el = $(id);
  if (el) el.classList.add(className);
};

export const removeClass = (id, className) => {
  const el = $(id);
  if (el) el.classList.remove(className);
};

export const toggleClass = (id, className, force) => {
  const el = $(id);
  if (el) el.classList.toggle(className, force);
};

export const setDisplay = (id, show = true) => {
  const el = $(id);
  if (el) el.style.display = show ? '' : 'none';
};

/**
 * Toast/Notification
 */
let _toastTimer = null;
export const showToast = (msg, type = 'success') => {
  const el = $('toast');
  if (!el) return;
  
  el.textContent = msg;
  el.className = `show ${type}`;
  
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.className = '';
  }, 3800);
};

/**
 * Date Utilities
 */
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const addDays = (isoDateStr, days) => {
  const d = new Date(isoDateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const formatDateDisplay = (isoDate, separator = '/') => {
  if (!isoDate) return '';
  // Convert YYYY-MM-DD to DD/MM/YYYY
  const parts = isoDate.split('-');
  return [parts[2], parts[1], parts[0]].join(separator);
};

/**
 * Number Formatting
 * ใช้ Thai locale สำหรับการแสดงผล
 */
export const fmt0 = (v) => 
  isFinite(v) ? Math.round(v).toLocaleString('th-TH') : '—';

export const fmt2 = (v) => 
  isFinite(v) 
    ? Number(v).toLocaleString('th-TH', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })
    : '—';

export const fmt4 = (v) => 
  isFinite(v) 
    ? Number(v).toLocaleString('th-TH', { 
        minimumFractionDigits: 4, 
        maximumFractionDigits: 4 
      })
    : '—';

export const fmtNum = (v, d = 2) => 
  isFinite(v) 
    ? Number(v).toLocaleString('th-TH', { 
        minimumFractionDigits: d, 
        maximumFractionDigits: d 
      })
    : '—';

/**
 * String Formatting
 * สำหรับ input display
 */
export const formatWithComma = (str) => {
  if (!str) return '';
  
  let s = String(str)
    .replace(/,/g, '')
    .trim()
    .replace(/^0+(?=[1-9])/, '');
  
  if (s === '.' || s === '-') return s;
  if (isNaN(s)) return str;
  
  const neg = s.startsWith('-') ? '-' : '';
  const body = s.replace(/^-/, '');
  const [int, frac] = body.split('.');
  
  return (
    neg + 
    (int ? Number(int).toLocaleString('th-TH') : '0') + 
    (frac != null ? '.' + frac : '')
  );
};

export const unformat = (str) => 
  String(str || '').replace(/,/g, '');

export const parseNumber = (str) => {
  const cleaned = unformat(str).trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Calculations — IRR/RATE Solver
 * ใช้ Newton's Method หา interest rate
 */
export const rate = (nper, pmt, pv, fv = 0, type = 0, guess = 0.01) => {
  const MAX = 100;
  const tol = 1e-12;
  let r = guess;
  
  // ถ้าไม่มี payment หรือ future value
  if (Math.abs(pmt) < 1e-18 && Math.abs(fv) < 1e-18) return 0;
  
  for (let i = 0; i < MAX; i++) {
    const t = Math.pow(1 + r, nper);
    
    // PV formula: pv*t + pmt*(1+r*type)*(t-1)/r + fv = 0
    const f = pv * t + pmt * (1 + r * type) * (t - 1) / r + fv;
    const df = pv * nper * Math.pow(1 + r, nper - 1) + 
               pmt * (1 + r * type) * ((t - 1) / r + nper * Math.pow(1 + r, nper - 1) / r - (t - 1) / (r * r));
    
    const nr = r - f / df;
    
    if (!isFinite(nr)) break;
    if (Math.abs(nr - r) < tol) {
      r = nr;
      break;
    }
    
    r = nr;
  }
  
  return r;
};

/**
 * Binary Search
 * สำหรับ goal seek, IRR solving
 */
export const binarySearch = (fn, target, lo, hi, maxIter = 80, tol = 1e-7) => {
  let a = lo;
  let b = hi;
  let valA = fn(a);
  
  // ค้นหาช่วงที่มี sign change
  for (let i = 0; i < maxIter; i++) {
    const mid = (a + b) / 2;
    const valM = fn(mid);
    
    if (!isFinite(valM)) break;
    
    if ((valA - target) * (valM - target) <= 0) {
      b = mid;
    } else {
      a = mid;
      valA = valM;
    }
  }
  
  // Refinement
  a = lo;
  b = hi;
  valA = fn(a);
  
  for (let j = 0; j < 120; j++) {
    const m = (a + b) / 2;
    const valM = fn(m);
    
    if (!isFinite(valM)) break;
    
    if ((valA - target) * (valM - target) <= 0) {
      b = m;
    } else {
      a = m;
      valA = valM;
    }
    
    if (Math.abs(b - a) < tol) break;
  }
  
  return (a + b) / 2;
};

/**
 * Input Formatting Setup
 * ทำให้ number inputs แสดงแบบ formatted
 */
export const setupNumericFormatting = () => {
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.setAttribute('data-num', '1');
    el._formatted = true;
    
    const savedValue = el.value;
    el.type = 'text';
    el.setAttribute('inputmode', el.getAttribute('inputmode') || 'decimal');
    el.value = savedValue;
    
    // Visual feedback
    if (!el.readOnly && !el.disabled) {
      el.classList.add('editable');
      el.addEventListener('focus', () => el.classList.add('editing'));
      el.addEventListener('blur', () => el.classList.remove('editing'));
    }
    
    // Focus: show unformatted
    el.addEventListener('focus', () => {
      el.value = unformat(el.value);
      setTimeout(() => {
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch (e) {}
      }, 0);
    });
    
    // Input: filter characters
    el.addEventListener('input', () => {
      el.value = el.value.replace(/[^0-9,.\-]/g, '');
    });
    
    // Blur: format display
    el.addEventListener('blur', () => {
      el.value = formatWithComma(el.value);
    });
    
    // Initial format
    if (el.value) {
      el.value = formatWithComma(el.value);
    }
  });
  
  // Format select inputs
  document.querySelectorAll('select').forEach((sel) => {
    if (!sel.disabled && !sel.classList.contains('term-unit-sel')) {
      sel.classList.add('editable');
      sel.addEventListener('focus', () => sel.classList.add('editing'));
      sel.addEventListener('blur', () => sel.classList.remove('editing'));
    }
  });
};

/**
 * CSV/Excel Export
 */
export const exportAsCSV = (data, filename = 'export.csv') => {
  const csv = data
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * JSON Export/Import
 */
export const exportAsJSON = (data, filename = 'export.json') => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * Validation
 */
export const isValidNumber = (value) => {
  const num = parseNumber(value);
  return isFinite(num) && num >= 0;
};

export const isValidDate = (isoDateStr) => {
  if (!isoDateStr) return false;
  const d = new Date(isoDateStr);
  return d instanceof Date && !isNaN(d);
};

/**
 * Math Helpers
 */
export const clamp = (value, min, max) => 
  Math.max(min, Math.min(max, value));

export const round = (value, decimals = 0) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
