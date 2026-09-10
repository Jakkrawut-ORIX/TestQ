/**
 * app.js — Application Orchestrator
 * เชื่อม Calculator, UI, Storage และ Excel Export เข้าด้วยกัน
 */

import { DEFAULT_VALUES } from './config.js';
import {
  $, getVal, setVal, setupNumericFormatting,
} from './utils.js';
import { Calculator } from './calculator.js';
import { UIManager } from './ui-manager.js';
import { StorageManager } from './storage.js';

export class App {
  constructor() {
    this.calculator = new Calculator({});
    this.storage = new StorageManager();
    this.ui = new UIManager(this.calculator, this.storage);

    this.onRecalc = this.onRecalc.bind(this);
    this.print = this.print.bind(this);
    this.exportExcel = this.exportExcel.bind(this);
    this.resetAll = this.resetAll.bind(this);
    this.solveFlatFromIRR = this.solveFlatFromIRR.bind(this);
    this.goalSeekDown = this.goalSeekDown.bind(this);
  }

  /** เริ่มต้นแอป */
  init() {
    // Merge defaults เพื่อรองรับข้อมูลเก่าที่ไม่มี paymentTiming
    const saved = this.storage.load();
    const initialData = { ...DEFAULT_VALUES, ...(saved || {}) };

    this.loadValues(initialData);
    setupNumericFormatting();

    this.ui.onRecalc(this.onRecalc);
    this.ui.setupEventListeners();
    this.recalculate();

    // ฟังก์ชันสำหรับปุ่ม onclick ใน index.html
    window.app = this;
    window.exportExcel = this.exportExcel;
    window.resetAll = this.resetAll;
    window.printQuotation = this.print;

    // รองรับ inline onchange เดิมใน index.html
    window.onGuarNone = (checkbox) => {
      if (!checkbox) return;
      if (checkbox.checked) {
        if ($('guar_personal')) $('guar_personal').checked = false;
        if ($('guar_corporate')) $('guar_corporate').checked = false;
      } else if (!$('guar_personal')?.checked && !$('guar_corporate')?.checked) {
        checkbox.checked = true;
      }
    };

    window.onGuarCheck = (checkbox) => {
      if (!checkbox) return;
      if (checkbox.checked && $('guar_none')) $('guar_none').checked = false;
      if (!$('guar_personal')?.checked && !$('guar_corporate')?.checked && $('guar_none')) {
        $('guar_none').checked = true;
      }
    };
  }

  /** โหลดค่าไปยัง input */
  loadValues(data) {
    Object.entries(data).forEach(([key, value]) => setVal(key, value));
  }

  /** รับ action จาก UI */
  onRecalc(action = null) {
    if (action === 'solveIRR') return this.solveFlatFromIRR();
    if (action === 'goalSeek') return this.goalSeekDown();
    return this.recalculate();
  }

  /** คำนวณและวาดผลลัพธ์ใหม่ */
  recalculate() {
    try {
      const inputs = this.ui.readInputs();
      this.calculator.inputs = inputs;

      const results = this.calculator.getResults();
      this.ui.updateHeroPayment(results);
      this.ui.updateResults(results);
      this.ui.updateWorksheet(results);
      this.ui.updateQuotation(results);
      this.ui.updateWarnings(results.warnings);

      this.storage.save(inputs);
      return results;
    } catch (error) {
      console.error('Calculation error:', error);
      this.ui.showError(`❌ ${error.message}`);
      return null;
    }
  }

  /** หา Flat Rate จาก IRR Target */
  solveFlatFromIRR() {
    try {
      // อ่านค่าปัจจุบันก่อน เพื่อให้ paymentTiming ถูกส่งเข้า Calculator
      this.calculator.inputs = this.ui.readInputs();
      const irrTarget = getVal('irrTargetPct') / 100;

      if (!(irrTarget > 0)) throw new Error('กรุณากำหนด IRR Target');

      const flatRate = this.calculator.solveFlatRateFromIRR(irrTarget);
      if (!Number.isFinite(flatRate) || flatRate < 0) {
        throw new Error('ไม่สามารถคำนวณ Flat Rate ได้');
      }

      setVal('flatRate', (flatRate * 100).toFixed(4));
      const results = this.recalculate();
      const actualIRR = results?.irr;

      this.ui.showSuccess(
        `✅ Flat = ${(flatRate * 100).toFixed(4)}% ` +
        `(IRR = ${Number.isFinite(actualIRR) ? (actualIRR * 100).toFixed(4) : '—'}%)`
      );
    } catch (error) {
      this.ui.showError(`❌ ${error.message}`);
    }
  }

  /** หาเงินดาวน์จากค่างวดเป้าหมาย */
  goalSeekDown() {
    try {
      const target = getVal('targetMonthlyInc');
      if (!(target > 0)) throw new Error('กรุณากรอกค่างวดเป้าหมาย');

      this.calculator.inputs = this.ui.readInputs();
      const down = this.calculator.solveDownPaymentFromTarget(target);

      setVal('downType', 'amount');
      setVal('downInput', String(down));
      this.recalculate();

      this.calculator.inputs = this.ui.readInputs();
      const finalPmt = this.calculator.calculateMonthlyPaymentRounded();
      const exact = finalPmt === Math.trunc(target);

      this.ui.showSuccess(
        exact
          ? `✅ เงินดาวน์ ${down.toLocaleString('th-TH')} บาท → ค่างวด ${finalPmt.toLocaleString('th-TH')} บาท`
          : `⚠ ใกล้เคียง: ดาวน์ ${down.toLocaleString('th-TH')} บาท → ค่างวด ${finalPmt.toLocaleString('th-TH')} บาท`
      );
    } catch (error) {
      this.ui.showError(`❌ ${error.message}`);
    }
  }

  print() {
    window.print();
  }

  /** Export XLSX: Quotation + OWS Working Sheet */
  async exportExcel() {
    try {
      const Excel = window.ExcelJS;
      if (!Excel) throw new Error('ไม่พบ ExcelJS library');

      this.recalculate();

      const wb = new Excel.Workbook();
      wb.creator = 'Thai ORIX Leasing';
      wb.created = new Date();

      const text = (id) => {
        const element = $(id);
        return element ? (element.innerText || element.textContent || '').trim() : '';
      };
      const clean = (id) => text(id).replace(/\s+/g, ' ').trim();

      const border = {
        top: { style: 'thin', color: { argb: 'FF999999' } },
        left: { style: 'thin', color: { argb: 'FF999999' } },
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
        right: { style: 'thin', color: { argb: 'FF999999' } },
      };

      const style = (cell, options = {}) => {
        cell.font = {
          name: 'Calibri',
          size: options.size || 10,
          bold: Boolean(options.bold),
          color: { argb: options.color || 'FF111111' },
        };
        cell.alignment = options.alignment || {
          vertical: 'middle',
          horizontal: options.horizontal || 'left',
          wrapText: true,
        };
        if (options.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: options.fill },
          };
        }
        if (options.border) cell.border = options.border;
      };

      const addImage = async (sheet, src, range) => {
        try {
          const response = await fetch(src);
          if (!response.ok) return;
          const imageId = wb.addImage({
            buffer: await response.arrayBuffer(),
            extension: 'png',
          });
          sheet.addImage(imageId, range);
        } catch (error) {
          console.warn(`Cannot add image: ${src}`, error);
        }
      };

      // Quotation sheet
      const qs = wb.addWorksheet('Quotation', {
        views: [{ showGridLines: false }],
        pageSetup: {
          paperSize: 9,
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: {
            left: 0.25, right: 0.25, top: 0.25, bottom: 0.25,
            header: 0, footer: 0,
          },
        },
      });

      qs.columns = [5, 20, 13, 13, 8, 13, 9, 13, 13, 6, 10]
        .map((width) => ({ width }));
      qs.properties.defaultRowHeight = 18;

      qs.mergeCells('A1:B4');
      qs.mergeCells('C1:H4');
      qs.mergeCells('I1:K2');
      qs.mergeCells('I3:K4');

      qs.getCell('C1').value =
        `${text('q_co_name')}\n` +
        `${text('q_hd_title')}: ${text('q_hd_a1')} ${text('q_hd_a2')} ${text('q_hd_tel')}\n` +
        `${text('q_eb_title')}: ${text('q_eb_a1')} ${text('q_eb_a2')} ${text('q_eb_tel')}`;
      style(qs.getCell('C1'), {
        size: 9,
        bold: true,
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
      });

      qs.getCell('I1').value = text('q_doctype') || 'QUOTATION';
      style(qs.getCell('I1'), {
        size: 22,
        bold: true,
        alignment: { vertical: 'middle', horizontal: 'right', wrapText: true },
      });
      qs.getCell('I3').value = text('q_docsub') || 'Leasing';
      style(qs.getCell('I3'), {
        size: 12,
        bold: true,
        alignment: { vertical: 'top', horizontal: 'right', wrapText: true },
      });

      await addImage(qs, 'orix_logo.png', {
        tl: { col: 0.25, row: 0.8 },
        ext: { width: 78, height: 74 },
      });

      qs.mergeCells('A6:C6');
      qs.mergeCells('D6:F6');
      qs.mergeCells('G6:K8');
      qs.getCell('A6').value = `${text('lbl_qi_to')} ${text('q_to')}`;
      qs.getCell('D6').value = `${text('lbl_qi_from')} ${text('q_from')}`;
      qs.getCell('G6').value =
        `${text('lbl_qi_qno')} ${text('q_no')}\n` +
        `${text('lbl_qi_issue')} ${text('q_issue')}\n` +
        `${text('lbl_qi_exp')} ${text('q_expire')}`;
      ['A6', 'D6', 'G6'].forEach((address) => style(qs.getCell(address), {
        bold: true,
        border,
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
      }));

      qs.mergeCells('A10:K10');
      qs.getCell('A10').value = text('q_intro');
      style(qs.getCell('A10'));

      const headers = [
        text('col_no'), text('col_asset'), clean('col_list'), clean('col_dep'),
        clean('col_term'), clean('col_pmt_ex'), text('col_vat'),
        clean('col_pmt_inc'), clean('col_purchase'), text('col_qty'), text('col_color'),
      ];
      const values = [
        '1', text('q_asset'), text('q_list'), text('q_deposit'), text('q_term'),
        text('q_pmt_ex'), text('q_vat'), text('q_pmt_inc'), text('q_purchase'),
        text('q_qty'), text('q_color'),
      ];
      qs.getRow(12).values = headers;
      qs.getRow(13).values = values;

      for (let column = 1; column <= 11; column++) {
        style(qs.getCell(12, column), {
          size: 9,
          bold: true,
          fill: 'FFE6ECF4',
          border,
          alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        });
        style(qs.getCell(13, column), {
          border,
          alignment: {
            vertical: 'middle',
            horizontal: [2, 11].includes(column) ? 'left' : 'right',
            wrapText: true,
          },
        });
      }
      qs.getRow(12).height = 42;
      qs.getRow(13).height = 38;

      qs.mergeCells('A16:K18');
      qs.getCell('A16').value =
        `${text('rb_k1')} : ${text('rb_v1')}        ${text('rb_k4')} : ${text('rb_v4')}\n` +
        `${text('rb_k2')} : ${text('rb_v2')}        ${text('rb_k5')} : ${text('rb_v5')}\n` +
        `${text('rb_k3')} : ${text('rb_v3')}`;
      style(qs.getCell('A16'), { border });

      qs.mergeCells('A20:K20');
      qs.getCell('A20').value = text('q_subject');
      style(qs.getCell('A20'), { bold: true });

      qs.mergeCells('A22:K22');
      qs.getCell('A22').value = text('h_terms');
      style(qs.getCell('A22'), { bold: true });

      qs.mergeCells('A23:K24');
      qs.getCell('A23').value = text('ol_terms_en');
      style(qs.getCell('A23'), {
        size: 9.5,
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
      });

      qs.mergeCells('A26:K26');
      qs.getCell('A26').value = text('h_details');
      style(qs.getCell('A26'), { bold: true });

      qs.mergeCells('A27:K32');
      qs.getCell('A27').value =
        `${text('cond1_title')}\n${text('condition1')}\n\n` +
        `${text('q_clause2')}\n\n${text('condition2')}\n\n${text('q_clause3')}`;
      style(qs.getCell('A27'), {
        size: 9.5,
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
      });

      qs.mergeCells('A36:E36');
      qs.mergeCells('G36:K36');
      qs.getCell('A36').value = text('lbl_authsig');
      qs.getCell('G36').value = text('q_sign_confirm');
      ['A36', 'G36'].forEach((address) => style(qs.getCell(address), {
        bold: true,
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      }));

      qs.mergeCells('A39:E39');
      qs.mergeCells('G39:K39');
      qs.getCell('A39').border = { top: { style: 'thin', color: { argb: 'FF000000' } } };
      qs.getCell('G39').border = { top: { style: 'thin', color: { argb: 'FF000000' } } };

      qs.mergeCells('A40:E40');
      qs.mergeCells('A41:E41');
      qs.mergeCells('G40:K40');
      qs.mergeCells('G41:K41');
      qs.getCell('A40').value = text('q_sign_name');
      qs.getCell('A41').value = text('q_sign_role');
      qs.getCell('G40').value = `${text('lbl_customer')} ${text('q_cust_sign')}`;
      qs.getCell('G41').value = text('lbl_date');
      style(qs.getCell('A40'), { bold: true, horizontal: 'center' });
      style(qs.getCell('A41'), { horizontal: 'center' });
      style(qs.getCell('G40'), { bold: true });
      style(qs.getCell('G41'));

      const footerRow = 44;
      qs.mergeCells(`A${footerRow}:B${footerRow + 4}`);
      qs.mergeCells(`C${footerRow}:I${footerRow + 4}`);
      qs.mergeCells(`J${footerRow}:K${footerRow + 4}`);
      const language = getVal('quoteLang') || 'TH';
      qs.getCell(`C${footerRow}`).value = text(
        language === 'TH' ? 'q_footer_content_th' : 'q_footer_content_en'
      );
      qs.getCell(`J${footerRow}`).value = text('q_pagenum') || 'Page 1/1';
      style(qs.getCell(`C${footerRow}`), {
        size: 8.5,
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
      });
      style(qs.getCell(`J${footerRow}`), {
        size: 8.5,
        bold: true,
        alignment: { vertical: 'middle', horizontal: 'right', wrapText: true },
      });

      await addImage(qs, 'qr-code.png', {
        tl: { col: 0.2, row: footerRow - 0.8 },
        ext: { width: 72, height: 72 },
      });
      qs.pageSetup.printArea = `A1:K${footerRow + 4}`;

      // OWS Working Sheet
      const os = wb.addWorksheet('OWS Working Sheet', {
        views: [{ showGridLines: false }],
      });
      os.columns = [{ width: 30 }, { width: 18 }, { width: 18 }];
      os.mergeCells('A1:C1');
      os.getCell('A1').value = 'OWS Working Sheet';
      style(os.getCell('A1'), {
        size: 16,
        bold: true,
        fill: 'FF01478C',
        color: 'FFFFFFFF',
        horizontal: 'center',
      });

      const rows = $('ws_table')
        ? Array.from($('ws_table').querySelectorAll('tr'))
        : [];
      rows.forEach((row, rowIndex) => {
        Array.from(row.querySelectorAll('th,td')).forEach((cell, columnIndex) => {
          const excelCell = os.getCell(rowIndex + 3, columnIndex + 1);
          excelCell.value = (cell.innerText || cell.textContent || '').trim();
          style(excelCell, {
            bold: rowIndex === 0,
            fill: rowIndex === 0 ? 'FFE6ECF4' : null,
            border,
            horizontal: columnIndex === 0 ? 'left' : 'right',
          });
        });
      });
      os.pageSetup = {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.3, right: 0.3, top: 0.4, bottom: 0.4,
          header: 0, footer: 0,
        },
      };

      const now = new Date();
      const stamp =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `OWS_Quotation_${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      this.ui.showSuccess('✅ Export Excel สำเร็จ');
    } catch (error) {
      console.error(error);
      this.ui.showError(`❌ Export failed: ${error.message}`);
    }
  }

  /** Reset ค่าเริ่มต้น */
  resetAll() {
    if (!window.confirm('รีเซ็ตข้อมูลทั้งหมด?')) return;

    this.storage.clear();
    this.loadValues(DEFAULT_VALUES);

    if ($('guar_none')) $('guar_none').checked = true;
    if ($('guar_personal')) $('guar_personal').checked = false;
    if ($('guar_corporate')) $('guar_corporate').checked = false;

    this.recalculate();
    this.ui.showSuccess('✅ รีเซ็ตข้อมูลเรียบร้อย');
  }

  clearStorage() {
    if (!window.confirm('ลบข้อมูลที่บันทึกไว้?')) return;
    this.storage.clear();
    this.ui.showSuccess('✅ ลบข้อมูลที่บันทึกแล้ว');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
