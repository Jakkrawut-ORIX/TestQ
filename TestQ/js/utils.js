/**
 * utils.js — Utility Functions
 * DOM, formatting, financial calculations และ file export helpers
 */

/* =========================================================
   DOM HELPERS
========================================================= */

export const $ = (id) => document.getElementById(id);

export const getVal = (id) => {
  const element = $(id);
  if (!element) return null;

  const isNumeric =
    element.getAttribute?.('data-num') === '1' ||
    element.type === 'number';

  if (!isNumeric) return element.value || '';

  const value = Number.parseFloat(
    String(element.value || '').replace(/,/g, '').trim()
  );
  return Number.isFinite(value) ? value : 0;
};

export const setVal = (id, value) => {
  const element = $(id);
  if (!element) return;

  element.value = value ?? '';

  // หลัง setupNumericFormatting ช่องตัวเลขเป็น text และมี data-num="1"
  if (element.getAttribute('data-num') === '1' && element.value !== '') {
    element.value = formatWithComma(element.value);
  }
};

export const setText = (id, value) => {
  const element = $(id);
  if (element) element.textContent = value ?? '';
};

export const setHTML = (id, value) => {
  const element = $(id);
  if (element) element.innerHTML = value ?? '';
};

export const addClass = (id, className) => $(id)?.classList.add(className);
export const removeClass = (id, className) => $(id)?.classList.remove(className);
export const toggleClass = (id, className, force) =>
  $(id)?.classList.toggle(className, force);

export const setDisplay = (id, show = true) => {
  const element = $(id);
  if (element) element.style.display = show ? '' : 'none';
};

/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

export const showToast = (message, type = 'success') => {
  const element = $('toast');
  if (!element) return;

  element.textContent = message;
  element.className = `show ${type}`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.className = '';
  }, 3800);
};

/* =========================================================
   DATE
========================================================= */

export const todayIso = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const addDays = (isoDate, days) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const formatDateDisplay = (isoDate, separator = '/') => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return parts.length === 3 ? [parts[2], parts[1], parts[0]].join(separator) : '';
};

/* =========================================================
   NUMBER FORMATTING
========================================================= */

export const fmtNum = (value, decimals = 2) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '—';

export const fmt0 = (value) =>
  Number.isFinite(Number(value))
    ? Math.round(Number(value)).toLocaleString('th-TH')
    : '—';

export const fmt2 = (value) => fmtNum(value, 2);
export const fmt4 = (value) => fmtNum(value, 4);

export const unformat = (value) => String(value ?? '').replace(/,/g, '');

export const parseNumber = (value) => {
  const number = Number.parseFloat(unformat(value).trim());
  return Number.isFinite(number) ? number : 0;
};

export const formatWithComma = (value) => {
  if (value === null || value === undefined || value === '') return '';

  let text = unformat(value).trim();
  if (text === '.' || text === '-' || text === '-.') return text;

  const number = Number(text);
  if (!Number.isFinite(number)) return String(value);

  const negative = text.startsWith('-') ? '-' : '';
  text = text.replace(/^-/, '').replace(/^0+(?=\d)/, '');

  const dotIndex = text.indexOf('.');
  const integerPart = dotIndex >= 0 ? text.slice(0, dotIndex) : text;
  const decimalPart = dotIndex >= 0 ? text.slice(dotIndex + 1) : null;
  const formattedInteger = Number(integerPart || 0).toLocaleString('th-TH');

  return `${negative}${formattedInteger}${decimalPart !== null ? `.${decimalPart}` : ''}`;
};

/* =========================================================
   FINANCIAL RATE
========================================================= */

/**
 * มูลค่าสมการ RATE
 * type 0 = ชำระปลายงวด
 * type 1 = ชำระต้นงวด
 */
const rateEquation = (nper, pmt, pv, fv, type, r) => {
  if (Math.abs(r) < 1e-10) {
    // Limit เมื่อ rate เข้าใกล้ 0
    return pv + pmt * nper + fv;
  }

  const power = Math.pow(1 + r, nper);
  return pv * power + pmt * (1 + r * type) * (power - 1) / r + fv;
};

/** Derivative ที่ถูกต้องของ rateEquation */
const rateDerivative = (nper, pmt, pv, fv, type, r) => {
  if (Math.abs(r) < 1e-7) {
    // Numerical derivative ปลอดภัยกว่าใกล้ศูนย์
    const h = 1e-6;
    return (
      rateEquation(nper, pmt, pv, fv, type, r + h) -
      rateEquation(nper, pmt, pv, fv, type, r - h)
    ) / (2 * h);
  }

  const power = Math.pow(1 + r, nper);
  const powerPrev = Math.pow(1 + r, nper - 1);
  const annuity = (power - 1) / r;
  const annuityDerivative =
    (nper * powerPrev * r - (power - 1)) / (r * r);

  return (
    pv * nper * powerPrev +
    pmt * (type * annuity + (1 + r * type) * annuityDerivative)
  );
};

/**
 * RATE แบบเดียวกับ Excel โดยคืนค่าอัตราต่องวด
 * ใช้ Newton-Raphson ก่อน และ fallback เป็น bracket/bisection
 */
export const rate = (
  nper,
  pmt,
  pv,
  fv = 0,
  type = 0,
  guess = 0.01
) => {
  nper = Number(nper);
  pmt = Number(pmt);
  pv = Number(pv);
  fv = Number(fv);
  type = Number(type) === 1 ? 1 : 0;

  if (!(nper > 0) || ![pmt, pv, fv].every(Number.isFinite)) return NaN;
  if (Math.abs(pmt) < 1e-18 && Math.abs(fv) < 1e-18) return NaN;

  let current = Number.isFinite(Number(guess)) ? Number(guess) : 0.01;
  current = Math.max(-0.999999, current);

  // Newton-Raphson
  for (let iteration = 0; iteration < 100; iteration++) {
    const value = rateEquation(nper, pmt, pv, fv, type, current);
    const derivative = rateDerivative(nper, pmt, pv, fv, type, current);

    if (!Number.isFinite(value) || !Number.isFinite(derivative)) break;
    if (Math.abs(value) < 1e-10) return current;
    if (Math.abs(derivative) < 1e-14) break;

    const next = current - value / derivative;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - current) < 1e-12) return next;

    current = next;
  }

  // Fallback: หา bracket ตั้งแต่เกือบ -100% ถึงอัตราสูง
  const points = [
    -0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, -0.1, -0.05,
    -0.01, -0.001, 0, 0.001, 0.005, 0.01, 0.02, 0.05,
    0.1, 0.2, 0.5, 1, 2, 5, 10,
  ];

  let left = points[0];
  let leftValue = rateEquation(nper, pmt, pv, fv, type, left);

  for (let index = 1; index < points.length; index++) {
    const right = points[index];
    const rightValue = rateEquation(nper, pmt, pv, fv, type, right);

    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      left = right;
      leftValue = rightValue;
      continue;
    }

    if (Math.abs(leftValue) < 1e-10) return left;
    if (Math.abs(rightValue) < 1e-10) return right;

    if (leftValue * rightValue < 0) {
      let a = left;
      let b = right;
      let fa = leftValue;

      for (let iteration = 0; iteration < 200; iteration++) {
        const mid = (a + b) / 2;
        const fm = rateEquation(nper, pmt, pv, fv, type, mid);

        if (!Number.isFinite(fm)) return NaN;
        if (Math.abs(fm) < 1e-10 || Math.abs(b - a) < 1e-12) return mid;

        if (fa * fm <= 0) {
          b = mid;
        } else {
          a = mid;
          fa = fm;
        }
      }

      return (a + b) / 2;
    }

    left = right;
    leftValue = rightValue;
  }

  return NaN;
};

/* =========================================================
   BINARY SEARCH
========================================================= */

/** Binary search สำหรับฟังก์ชัน monotonic */
export const binarySearch = (
  fn,
  target,
  lo,
  hi,
  maxIter = 80,
  tolerance = 1e-7
) => {
  let left = Number(lo);
  let right = Number(hi);
  const targetValue = Number(target);
  let leftValue = fn(left);
  let rightValue = fn(right);

  if (![leftValue, rightValue, targetValue].every(Number.isFinite)) return NaN;

  const increasing = rightValue >= leftValue;

  // ถ้า target อยู่นอกช่วง ให้คืนขอบที่ใกล้ที่สุด
  if (increasing && targetValue <= leftValue) return left;
  if (increasing && targetValue >= rightValue) return right;
  if (!increasing && targetValue >= leftValue) return left;
  if (!increasing && targetValue <= rightValue) return right;

  for (let iteration = 0; iteration < maxIter; iteration++) {
    const mid = (left + right) / 2;
    const value = fn(mid);
    if (!Number.isFinite(value)) return NaN;

    if (Math.abs(value - targetValue) < tolerance || Math.abs(right - left) < tolerance) {
      return mid;
    }

    if ((increasing && value < targetValue) || (!increasing && value > targetValue)) {
      left = mid;
      leftValue = value;
    } else {
      right = mid;
      rightValue = value;
    }
  }

  return (left + right) / 2;
};

/* =========================================================
   INPUT FORMATTING
========================================================= */

export const setupNumericFormatting = () => {
  document.querySelectorAll('input[type="number"]').forEach((element) => {
    if (element.getAttribute('data-num') === '1') return;

    element.setAttribute('data-num', '1');
    const savedValue = element.value;
    element.type = 'text';
    element.setAttribute('inputmode', element.getAttribute('inputmode') || 'decimal');
    element.value = savedValue ? formatWithComma(savedValue) : '';

    if (!element.readOnly && !element.disabled) {
      element.classList.add('editable');
      element.addEventListener('focus', () => element.classList.add('editing'));
      element.addEventListener('blur', () => element.classList.remove('editing'));
    }

    element.addEventListener('focus', () => {
      element.value = unformat(element.value);
      setTimeout(() => {
        try {
          element.setSelectionRange(element.value.length, element.value.length);
        } catch (_) {
          // Input type or browser may not support selection range.
        }
      }, 0);
    });

    element.addEventListener('input', () => {
      element.value = element.value.replace(/[^0-9.\-]/g, '');

      // อนุญาตเครื่องหมายลบเฉพาะตัวแรก และจุดทศนิยมเพียงจุดเดียว
      element.value = element.value
        .replace(/(?!^)-/g, '')
        .replace(/(\..*)\./g, '$1');
    });

    element.addEventListener('blur', () => {
      element.value = formatWithComma(element.value);
    });
  });

  document.querySelectorAll('select').forEach((element) => {
    if (element.disabled || element.classList.contains('term-unit-sel')) return;
    element.classList.add('editable');
    element.addEventListener('focus', () => element.classList.add('editing'));
    element.addEventListener('blur', () => element.classList.remove('editing'));
  });

  // ป้องกัน mouse wheel เปลี่ยนค่าขณะ focus
  document.addEventListener(
    'wheel',
    () => {
      if (document.activeElement?.getAttribute?.('data-num') === '1') {
        document.activeElement.blur();
      }
    },
    { passive: true }
  );
};

/* =========================================================
   FILE EXPORT
========================================================= */

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportAsCSV = (data, filename = 'export.csv') => {
  const escapeCell = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const csv = data.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), filename);
};

export const exportAsJSON = (data, filename = 'export.json') => {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename
  );
};

/* =========================================================
   VALIDATION AND MATH
========================================================= */

export const isValidNumber = (value) => {
  const number = parseNumber(value);
  return Number.isFinite(number) && number >= 0;
};

export const isValidDate = (isoDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return false;
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isFinite(date.getTime());
};

export const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

export const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};
