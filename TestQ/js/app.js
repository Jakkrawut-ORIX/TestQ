/**
 * storage.js — Storage Management
 * บริหารจัดการการบันทึก/โหลด configuration
 */

export class StorageManager {
  constructor(storageKey = 'lease-calculator-v3') {
    this.key = storageKey;
  }

  /**
   * บันทึก data ลง localStorage
   */
  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Storage save failed:', e);
      return false;
    }
  }

  /**
   * โหลด data จาก localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Storage load failed:', e);
      return null;
    }
  }

  /**
   * ลบ data ออก
   */
  clear() {
    try {
      localStorage.removeItem(this.key);
      return true;
    } catch (e) {
      console.warn('Storage clear failed:', e);
      return false;
    }
  }

  /**
   * Export เป็น JSON file
   */
  exportToFile(data, filename = 'lease-config.json') {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Import จาก JSON file
   */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }
}

/**
 * app.js — Application Orchestrator
 * ผูกโมดูลต่างๆ เข้าด้วยกัน
 */

import { DEFAULT_VALUES } from './config.js';
import { $, setVal, showToast, setupNumericFormatting } from './utils.js';
import { Calculator } from './calculator.js';
import { UIManager } from './ui-manager.js';

export class App {
  constructor() {
    this.calculator = new Calculator({});
    this.ui = new UIManager(this.calculator, null);
    this.storage = new StorageManager();
    
    // Bind methods
    this.onRecalc = this.onRecalc.bind(this);
    this.print = this.print.bind(this);
    this.exportExcel = this.exportExcel.bind(this);
    this.resetAll = this.resetAll.bind(this);
    this.solveFlatFromIRR = this.solveFlatFromIRR.bind(this);
    this.goalSeekDown = this.goalSeekDown.bind(this);
  }

  /**
   * Initialize app
   */
  init() {
    // 1. Load saved data หรือใช้ defaults
    const saved = this.storage.load();
    const initialData = saved || DEFAULT_VALUES;
    this.loadValues(initialData);

    // 2. Setup numeric formatting
    setupNumericFormatting();

    // 3. Setup UI event listeners
    this.ui.onRecalc(this.onRecalc);
    this.ui.setupEventListeners();

    // 4. Initial calculation
    this.recalculate();

  // 5. Expose public methods to window
window.app = this;

window.exportExcel = () => this.exportExcel();
window.resetAll = () => this.resetAll();
window.printQuotation = () => this.print();

window.onGuarNone = (cb) => {
  if (this.ui.onGuarNone) {
    this.ui.onGuarNone(cb);
  } else {
    this.recalculate();
  }
};

window.onGuarCheck = (cb) => {
  if (this.ui.onGuarCheck) {
    this.ui.onGuarCheck(cb);
  } else {
    this.recalculate();
  }
};

  /**
   * โหลดค่าไปยัง inputs
   */
  loadValues(data) {
    Object.entries(data).forEach(([key, value]) => {
      setVal(key, value);
    });
  }

  /**
   * Callback: เรียกเมื่อ UI เปลี่ยน
   */
  onRecalc(action = null) {
    if (action === 'solveIRR') {
      this.solveFlatFromIRR();
    } else if (action === 'goalSeek') {
      this.goalSeekDown();
    } else {
      this.recalculate();
    }
  }

  /**
   * Main recalculation flow
   */
  recalculate() {
    try {
      // 1. Read inputs
      const inputs = this.ui.readInputs();
      
      // 2. Update calculator
      this.calculator.inputs = inputs;

      // 3. Calculate
      const results = this.calculator.getResults();

      // 4. Update UI
      this.ui.updateHeroPayment(results);
      this.ui.updateResults(results);
      this.ui.updateWorksheet(results);
      this.ui.updateQuotation(results);
      this.ui.updateWarnings(results.warnings);

      // 5. Auto-save
      this.storage.save(inputs);
    } catch (error) {
      console.error('Calculation error:', error);
      this.ui.showError('❌ ' + error.message);
    }
  }

  /**
   * Solve: Flat Rate from IRR Target
   */
  solveFlatFromIRR() {
    try {
      const irrTarget = $('irrTargetPct').value / 100;
      
      if (irrTarget <= 0) {
        throw new Error('กรุณากำหนด IRR Target');
      }

      const flatRate = this.calculator.solveFlatRateFromIRR(irrTarget);

      if (!isFinite(flatRate) || flatRate < 0) {
        throw new Error('ไม่สามารถคำนวณ Flat Rate ได้ (ค่ามากเกินไป)');
      }

      // Set and recalc
      setVal('flatRate', (flatRate * 100).toFixed(4));
      this.recalculate();

      this.ui.showSuccess(
        `✅ Flat = ${(flatRate * 100).toFixed(4)}% ` +
        `(IRR ≈ ${(irrTarget * 100).toFixed(4)}%)`
      );
    } catch (error) {
      this.ui.showError('❌ ' + error.message);
    }
  }

  /**
   * Solve: Down Payment from Target Monthly
   */
  goalSeekDown() {
    try {
      const target = $('targetMonthlyInc').value;

      if (!(target > 0)) {
        throw new Error('กรุณากรอกค่างวดเป้าหมาย');
      }

      const down = this.calculator.solveDownPaymentFromTarget(target);

      // Set and recalc
      setVal('downType', 'amount');
      setVal('downInput', String(down));
      this.recalculate();

      const inputs = this.ui.readInputs();
      this.calculator.inputs = inputs;
      const finalPmt = this.calculator.calculateMonthlyPaymentRounded();

      if (finalPmt === parseInt(target)) {
        this.ui.showSuccess(
          `✅ เงินดาวน์ ${down.toLocaleString('th-TH')} บาท ` +
          `→ ค่างวด ${finalPmt.toLocaleString('th-TH')} บาท`
        );
      } else {
        this.ui.showSuccess(
          `⚠ ใกล้เคียง: ดาวน์ ${down.toLocaleString('th-TH')} ` +
          `→ ${finalPmt.toLocaleString('th-TH')} บาท`
        );
      }
    } catch (error) {
      this.ui.showError('❌ ' + error.message);
    }
  }

  /**
   * Print quotation
   */
  print() {
    window.print();
  }

  /**
 * Export as real XLSX
 * Creates:
 * - Sheet 1: Quotation
 * - Sheet 2: OWS Working Sheet
 */
async exportExcel() {
  try {
    const Excel = window.ExcelJS;

    if (!Excel) {
      throw new Error('ไม่พบ ExcelJS library กรุณาเพิ่ม exceljs.min.js ก่อน app.js');
    }

    // Ensure latest calculation before export
    this.recalculate();

    const wb = new Excel.Workbook();
    wb.creator = 'Thai ORIX Leasing';
    wb.created = new Date();

    const lang = $('quoteLang') ? $('quoteLang').value : 'TH';
    const isTH = lang === 'TH';

    const getText = (id) => {
      const el = $(id);
      return el ? (el.innerText || el.textContent || '').trim() : '';
    };

    const getCleanText = (id) => {
      const el = $(id);
      return el
        ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        : '';
    };

    const moneyText = (id) => getText(id) || '-';

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF999999' } },
      left: { style: 'thin', color: { argb: 'FF999999' } },
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
      right: { style: 'thin', color: { argb: 'FF999999' } }
    };

    const softBorder = {
      top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
    };

    const styleCell = (cell, opt = {}) => {
      cell.font = {
        name: 'Calibri',
        size: opt.size || 10,
        bold: !!opt.bold,
        color: { argb: opt.color || 'FF111111' }
      };

      cell.alignment = opt.alignment || {
        vertical: 'middle',
        horizontal: opt.horizontal || 'left',
        wrapText: true
      };

      if (opt.fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: opt.fill }
        };
      }

      if (opt.border) {
        cell.border = opt.border;
      }
    };

    const addImageIfExists = async (sheet, src, range, ext = 'png') => {
      try {
        const res = await fetch(src);
        if (!res.ok) return;

        const buffer = await res.arrayBuffer();

        const imageId = wb.addImage({
          buffer,
          extension: ext
        });

        sheet.addImage(imageId, range);
      } catch (err) {
        console.warn('Cannot add image:', src, err);
      }
    };

    /* =====================================================
       SHEET 1 — QUOTATION
       ===================================================== */

    const qs = wb.addWorksheet('Quotation', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.25,
          bottom: 0.25,
          header: 0,
          footer: 0
        }
      },
      views: [
        {
          showGridLines: false
        }
      ]
    });

    qs.properties.defaultRowHeight = 18;

    qs.columns = [
      { width: 5 },
      { width: 20 },
      { width: 13 },
      { width: 13 },
      { width: 8 },
      { width: 13 },
      { width: 9 },
      { width: 13 },
      { width: 13 },
      { width: 6 },
      { width: 10 }
    ];

    /* Header */
    qs.mergeCells('A1:B4');
    qs.mergeCells('C1:H4');
    qs.mergeCells('I1:K2');
    qs.mergeCells('I3:K4');

    qs.getCell('C1').value =
      `${getText('q_co_name')}\n` +
      `${getText('q_hd_title')}: ${getText('q_hd_a1')} ${getText('q_hd_a2')} ${getText('q_hd_tel')}\n` +
      `${getText('q_eb_title')}: ${getText('q_eb_a1')} ${getText('q_eb_a2')} ${getText('q_eb_tel')}`;

    styleCell(qs.getCell('C1'), {
      size: 9,
      bold: true,
      alignment: {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true
      }
    });

    qs.getCell('I1').value = getText('q_doctype') || 'QUOTATION';
    styleCell(qs.getCell('I1'), {
      size: 22,
      bold: true,
      alignment: {
        vertical: 'middle',
        horizontal: 'right',
        wrapText: true
      }
    });

    qs.getCell('I3').value = getText('q_docsub') || 'Leasing';
    styleCell(qs.getCell('I3'), {
      size: 12,
      bold: true,
      color: 'FF444444',
      alignment: {
        vertical: 'top',
        horizontal: 'right',
        wrapText: true
      }
    });

    qs.getRow(1).height = 24;
    qs.getRow(2).height = 24;
    qs.getRow(3).height = 20;
    qs.getRow(4).height = 20;

    await addImageIfExists(qs, 'orix_logo.png', {
  tl: { col: 0.25, row: 0.8 },
  ext: { width: 78, height: 74 }
});

    /* Info row */
    qs.mergeCells('A6:C6');
    qs.mergeCells('D6:F6');
    qs.mergeCells('G6:K8');

    qs.getCell('A6').value = `${getText('lbl_qi_to')} ${getText('q_to')}`;
    qs.getCell('D6').value = `${getText('lbl_qi_from')} ${getText('q_from')}`;

    qs.getCell('G6').value =
      `${getText('lbl_qi_qno')} ${getText('q_no')}\n` +
      `${getText('lbl_qi_issue')} ${getText('q_issue')}\n` +
      `${getText('lbl_qi_exp')} ${getText('q_expire')}`;

    ['A6', 'D6', 'G6'].forEach((addr) => {
      styleCell(qs.getCell(addr), {
        size: 10,
        bold: true,
        border: softBorder,
        alignment: {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true
        }
      });
    });

    qs.getRow(6).height = 22;
    qs.getRow(7).height = 18;
    qs.getRow(8).height = 18;

    /* Intro */
    qs.mergeCells('A10:K10');
    qs.getCell('A10').value = getText('q_intro');
    styleCell(qs.getCell('A10'), {
      size: 10,
      alignment: {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true
      }
    });

    qs.mergeCells('J11:K11');
    qs.getCell('J11').value = '(Baht)';
    styleCell(qs.getCell('J11'), {
      size: 9,
      color: 'FF555555',
      alignment: {
        vertical: 'middle',
        horizontal: 'right',
        wrapText: true
      }
    });

    /* Main table */
    const headerRow = 12;
    const dataRow = 13;

    const headers = [
      getText('col_no'),
      getText('col_asset'),
      getCleanText('col_list'),
      getCleanText('col_dep'),
      getCleanText('col_term'),
      getCleanText('col_pmt_ex'),
      getText('col_vat'),
      getCleanText('col_pmt_inc'),
      getCleanText('col_purchase'),
      getText('col_qty'),
      getText('col_color')
    ];

    qs.getRow(headerRow).values = headers;

    qs.getRow(dataRow).values = [
      '1',
      getText('q_asset'),
      moneyText('q_list'),
      moneyText('q_deposit'),
      getText('q_term'),
      moneyText('q_pmt_ex'),
      moneyText('q_vat'),
      moneyText('q_pmt_inc'),
      moneyText('q_purchase'),
      getText('q_qty'),
      getText('q_color')
    ];

    for (let c = 1; c <= 11; c++) {
      const h = qs.getCell(headerRow, c);
      styleCell(h, {
        size: 9,
        bold: true,
        fill: 'FFE6ECF4',
        border: thinBorder,
        alignment: {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }
      });

      const d = qs.getCell(dataRow, c);
      styleCell(d, {
        size: 10,
        border: thinBorder,
        alignment: {
          vertical: 'middle',
          horizontal: c === 2 || c === 11 ? 'left' : 'center',
          wrapText: true
        }
      });
    }

    [3, 4, 6, 7, 8, 9].forEach((c) => {
      qs.getCell(dataRow, c).alignment = {
        vertical: 'middle',
        horizontal: 'right',
        wrapText: true
      };
    });

    qs.getRow(headerRow).height = 42;
    qs.getRow(dataRow).height = 38;

    /* Rate box */
    const rbStart = 16;
    qs.mergeCells(`A${rbStart}:K${rbStart + 2}`);

    qs.getCell(`A${rbStart}`).value =
      `${getText('rb_k1')} : ${getText('rb_v1')}        ${getText('rb_k4')} : ${getText('rb_v4')}\n` +
      `${getText('rb_k2')} : ${getText('rb_v2')}        ${getText('rb_k5')} : ${getText('rb_v5')}\n` +
      `${getText('rb_k3')} : ${getText('rb_v3')}`;

    styleCell(qs.getCell(`A${rbStart}`), {
      size: 10,
      border: thinBorder,
      alignment: {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true
      }
    });

    qs.getRow(rbStart).height = 22;
    qs.getRow(rbStart + 1).height = 22;
    qs.getRow(rbStart + 2).height = 22;

    /* Subject and terms */
    qs.mergeCells('A20:K20');
    qs.getCell('A20').value = getText('q_subject');
    styleCell(qs.getCell('A20'), {
      size: 10,
      bold: true
    });

    qs.mergeCells('A22:K22');
    qs.getCell('A22').value = getText('h_terms');
    styleCell(qs.getCell('A22'), {
      size: 10,
      bold: true
    });

    qs.mergeCells('A23:K24');
    qs.getCell('A23').value = getText('ol_terms_en');
    styleCell(qs.getCell('A23'), {
      size: 9.5,
      alignment: {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true
      }
    });

    qs.mergeCells('A26:K26');
    qs.getCell('A26').value = getText('h_details');
    styleCell(qs.getCell('A26'), {
      size: 10,
      bold: true
    });

    qs.mergeCells('A27:K32');
    qs.getCell('A27').value =
      `${getText('cond1_title')}\n` +
      `${getText('condition1')}\n\n` +
      `${getText('q_clause2')}\n\n` +
      `${getText('condition2')}\n\n` +
      `${getText('q_clause3')}`;

    styleCell(qs.getCell('A27'), {
      size: 9.5,
      alignment: {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true
      }
    });

    for (let r = 27; r <= 32; r++) {
      qs.getRow(r).height = 22;
    }

    /* Signature */
    const sigTop = 36;

    qs.mergeCells(`A${sigTop}:E${sigTop}`);
    qs.mergeCells(`G${sigTop}:K${sigTop}`);

    qs.getCell(`A${sigTop}`).value = getText('lbl_authsig');
    qs.getCell(`G${sigTop}`).value = getText('q_sign_confirm');

    styleCell(qs.getCell(`A${sigTop}`), {
      size: 9.5,
      bold: true,
      alignment: {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      }
    });

    styleCell(qs.getCell(`G${sigTop}`), {
      size: 9.5,
      bold: true,
      alignment: {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      }
    });

    qs.getRow(sigTop).height = 36;
    qs.getRow(sigTop + 1).height = 20;
    qs.getRow(sigTop + 2).height = 20;
    qs.getRow(sigTop + 3).height = 8;

    qs.mergeCells(`A${sigTop + 3}:E${sigTop + 3}`);
    qs.mergeCells(`G${sigTop + 3}:K${sigTop + 3}`);

    qs.getCell(`A${sigTop + 3}`).border = {
      top: { style: 'thin', color: { argb: 'FF000000' } }
    };

    qs.getCell(`G${sigTop + 3}`).border = {
      top: { style: 'thin', color: { argb: 'FF000000' } }
    };

    qs.mergeCells(`A${sigTop + 4}:E${sigTop + 4}`);
    qs.getCell(`A${sigTop + 4}`).value = getText('q_sign_name');
    styleCell(qs.getCell(`A${sigTop + 4}`), {
      size: 10.5,
      bold: true,
      alignment: {
        vertical: 'middle',
        horizontal: 'center'
      }
    });

    qs.mergeCells(`A${sigTop + 5}:E${sigTop + 5}`);
    qs.getCell(`A${sigTop + 5}`).value = getText('q_sign_role');
    styleCell(qs.getCell(`A${sigTop + 5}`), {
      size: 9,
      color: 'FF333333',
      alignment: {
        vertical: 'middle',
        horizontal: 'center'
      }
    });

    qs.mergeCells(`G${sigTop + 4}:K${sigTop + 4}`);
    qs.getCell(`G${sigTop + 4}`).value = `${getText('lbl_customer')} ${getText('q_cust_sign')}`;
    styleCell(qs.getCell(`G${sigTop + 4}`), {
      size: 9.5,
      bold: true
    });

    qs.mergeCells(`G${sigTop + 5}:K${sigTop + 5}`);
    qs.getCell(`G${sigTop + 5}`).value = getText('lbl_date');
    styleCell(qs.getCell(`G${sigTop + 5}`), {
      size: 9.5
    });

    /* Footer */
    const ft = 44;

    qs.mergeCells(`A${ft}:B${ft + 4}`);
    qs.mergeCells(`C${ft}:I${ft + 4}`);
    qs.mergeCells(`J${ft}:K${ft + 4}`);

    const footerText = isTH
      ? getText('q_footer_content_th')
      : getText('q_footer_content_en');

    qs.getCell(`C${ft}`).value = footerText;
    styleCell(qs.getCell(`C${ft}`), {
      size: 8.5,
      alignment: {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true
      }
    });

    qs.getCell(`J${ft}`).value = getText('q_pagenum') || 'Page 1/1';
    styleCell(qs.getCell(`J${ft}`), {
      size: 8.5,
      bold: true,
      alignment: {
        vertical: 'middle',
        horizontal: 'right'
      }
    });

    ['A','B','C','D','E','F','G','H','I','J','K'].forEach((col) => {
      qs.getCell(`${col}${ft}`).border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      };
    });

    await addImageIfExists(qs, 'qr-code.png', {
      tl: { col: 0.2, row: ft - 1 + 0.2 },
      ext: { width: 72, height: 72 }
    });

    for (let r = ft; r <= ft + 4; r++) {
      qs.getRow(r).height = 18;
    }

    qs.pageSetup.printArea = `A1:K${ft + 4}`;

    /* =====================================================
       SHEET 2 — OWS WORKING SHEET
       ===================================================== */

    const os = wb.addWorksheet('OWS Working Sheet', {
      views: [{ showGridLines: false }]
    });

    os.columns = [
      { width: 30 },
      { width: 18 },
      { width: 18 }
    ];

    os.mergeCells('A1:C1');
    os.getCell('A1').value = 'OWS Working Sheet';

    styleCell(os.getCell('A1'), {
      size: 16,
      bold: true,
      fill: 'FF01478C',
      color: 'FFFFFFFF',
      alignment: {
        vertical: 'middle',
        horizontal: 'center'
      }
    });

    os.getRow(1).height = 28;

    const wsTable = $('ws_table');
    const rows = wsTable ? Array.from(wsTable.querySelectorAll('tr')) : [];

    rows.forEach((tr, idx) => {
      const excelRow = idx + 3;
      const cells = Array.from(tr.querySelectorAll('th,td'));

      cells.forEach((cell, cidx) => {
        const excelCell = os.getCell(excelRow, cidx + 1);
        excelCell.value = (cell.innerText || cell.textContent || '').trim();

        styleCell(excelCell, {
          size: idx === 0 ? 10 : 11,
          bold: idx === 0,
          fill: idx === 0 ? 'FFE6ECF4' : null,
          border: thinBorder,
          alignment: {
            vertical: 'middle',
            horizontal: cidx === 0 ? 'left' : 'right',
            wrapText: true
          }
        });
      });

      os.getRow(excelRow).height = idx === 0 ? 22 : 20;
    });

    os.pageSetup = {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0,
        footer: 0
      }
    };

    /* Export */
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');

    const buffer = await wb.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `OWS_Quotation_${y}${m}${d}.xlsx`;
    a.click();

    URL.revokeObjectURL(a.href);

    this.ui.showSuccess('✅ Export Excel สำเร็จ');
  } catch (error) {
    console.error(error);
    this.ui.showError('❌ Export failed: ' + error.message);
  }
}

  /**
   * Reset ทั้งหมด
   */
  resetAll() {
    if (!confirm('รีเซ็ตทั้งหมด?')) return;
    
    this.loadValues(DEFAULT_VALUES);
    this.recalculate();
    this.ui.showSuccess('✅ Reset');
  }

  /**
   * Clear localStorage
   */
  clearStorage() {
    if (!confirm('ลบข้อมูลที่บันทึกไว้?')) return;
    
    this.storage.clear();
    this.ui.showSuccess('✅ Cleared');
  }
}

/**
 * Initialize on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
