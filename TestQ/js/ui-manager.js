/**
 * ui-manager.js — UI Management
 * จัดการ event listeners และการอัปเดต UI
 * แยกจาก business logic
 */

import { 
  $, getVal, setVal, setText, setHTML, setDisplay, 
  showToast, fmt0, fmt2, fmt4, fmtNum 
} from './utils.js';
import { LABELS, PAYMENT_METHODS, GUARANTOR_TYPES } from './config.js';

export class UIManager {
  constructor(calculator, storage) {
    this.calculator = calculator;
    this.storage = storage;
    this.language = 'EN';
    this._prevTermUnit = 'years';
    this.recalcCallback = null;
  }

  /**
   * ตั้งค่า callback ที่จะเรียกเมื่อต้อง recalculate
   */
  onRecalc(callback) {
    this.recalcCallback = callback;
  }

  /**
   * อ่านค่าทั้งหมดจาก inputs
   */
  readInputs() {
    return {
      gross: getVal('gross'),
      discount: getVal('discount'),
      optionPlus: getVal('optionPlus'),
      vatPct: getVal('vatPct'),
      termUnit: getVal('termUnit') || 'years',
      termVal: getVal('termVal'),
      downType: getVal('downType'),
      downInput: getVal('downInput'),
      balloonEnable: getVal('balloonEnable'),
      balloonType: getVal('balloonType'),
      balloonInput: getVal('balloonInput'),
      mode: getVal('mode'),
      flatRate: getVal('flatRate'),
      irrTargetPct: getVal('irrTargetPct'),
      commBaseChoice: getVal('commBaseChoice'),
      commPct: getVal('commPct'),
      commExtra: getVal('commExtra'),
      paymentMethod: getVal('paymentMethod'),
      custName: getVal('custName'),
      fromName: getVal('fromName'),
      quotationNo: getVal('quotationNo'),
      issueDate: getVal('issueDate'),
      validDays: getVal('validDays'),
      assetName: getVal('assetName'),
      assetColor: getVal('assetColor'),
      assetQty: getVal('assetQty'),
      targetMonthlyInc: getVal('targetMonthlyInc'),
      quoteLang: getVal('quoteLang') || 'EN',
    };
  }

  /**
   * อัปเดต main results section
   */
  updateResults(results) {
    const { 
      net, down, balloon, finance, finMinusBalloon, months,
      interest, pmtRounded, commission, irr, tr
    } = results;

    setText('netPrice', fmt2(net));
    setText('downBaht', fmt2(down));
    setText('balloonBaht', fmt2(balloon));
    setText('finance', fmt2(finance));
    setText('months', `${months} เดือน`);
    setText('finMinusBalloon', fmt2(finMinusBalloon));
    setText('totalInterest', fmt2(interest));
    setText('pmtInc', fmt0(pmtRounded));
    setText('commission', fmt2(commission));
    
    // IRR & TR
    if (irr !== null && isFinite(irr)) {
      setText('irr', `${(irr * 100).toFixed(4)} %`);
    } else {
      setText('irr', '—');
    }
    
    if (tr !== null && isFinite(tr)) {
      setText('trCustomer', `${(tr * 100).toFixed(4)} %`);
    } else {
      setText('trCustomer', '—');
    }
  }

  /**
   * อัปเดต hero payment display
   */
  updateHeroPayment(results) {
    const { pmtRounded, months } = results;
    setText('pmtRounded', fmt0(pmtRounded));
    setText('months_hero', `${months} งวด`);
  }

  /**
   * อัปเดต OWS Working Sheet
   */
  updateWorksheet(results) {
    const { 
      netEx, net, 
      downEx, down, 
      finEx, finance, 
      pmtEx, pmtRounded, 
      commEx, commission, 
      rvEx, down: rvInc 
    } = results;

    setText('ws_net_ex', fmt4(netEx));
    setText('ws_net_inc', fmt2(net));
    setText('ws_dep_ex', fmt4(downEx));
    setText('ws_dep_inc', fmt2(down));
    setText('ws_fin_ex', fmt4(finEx));
    setText('ws_fin_inc', fmt2(finance));
    setText('ws_pmt_ex', fmt4(pmtEx));
    setText('ws_pmt_inc', fmt0(pmtRounded));
    setText('ws_comm_ex', fmt4(commEx));
    setText('ws_comm_inc', fmt2(commission));
    setText('ws_rv_ex', fmt4(rvEx));
    setText('ws_rv_inc', fmt2(down + results.balloon));
  }

  /**
   * อัปเดต Quotation section
   */
  updateQuotation(results) {
    const inputs = this.readInputs();
    const { 
      net, down, balloon, months, pmtRounded, pmtEx, pmtVAT,
      purchaseOption 
    } = results;
    
    const custName = inputs.custName;
    const fromName = inputs.fromName;
    const quotationNo = inputs.quotationNo;
    const issueDate = inputs.issueDate;
    const validDays = inputs.validDays;
    const assetName = inputs.assetName;
    const assetColor = inputs.assetColor;
    const assetQty = inputs.assetQty;
    
    // Issue date display
    const issueDisp = issueDate 
      ? issueDate.split('-').reverse().join('/')
      : '';
    
    const lang = inputs.quoteLang || 'EN';
    const labels = LABELS[lang] || LABELS.EN;
    
    // Fill header
    setText('q_to', custName);
    setText('q_from', fromName);
    setText('q_no', quotationNo || '');
    setText('q_issue', issueDisp);
    
    // Expiration date
    if (issueDisp) {
      const expTxt = lang === 'TH'
        ? `${validDays} วัน หลังจากวันที่เสนอราคา`
        : `${validDays} days after the issue date`;
      setText('q_expire', expTxt);
    } else {
      setText('q_expire', '');
    }
    
    // Asset info
    const assetEl = $('q_asset');
    if (assetEl) assetEl.textContent = assetName || '';
    
    const colorEl = $('q_color');
    if (colorEl) colorEl.textContent = assetColor || '';
    
    // Prices
    setText('q_list', fmt2(inputs.gross));
    setText('q_deposit', fmt2(down));
    setText('q_term', String(months));
    setText('q_pmt_ex', fmt2(pmtEx));
    setText('q_vat', fmt2(pmtVAT));
    setText('q_pmt_inc', fmt0(pmtRounded));
    setText('q_purchase', fmt2(purchaseOption));
    setText('q_qty', String(assetQty));
    setText('q_cust_sign', custName);
    
    // Rate box
    setText('rb_v1', 'Flat Rate');
    const guarantorLabel = this._getGuarantorLabel(lang === 'TH');
    setText('rb_v5', guarantorLabel);
    
    const paymentLabel = this._getPaymentLabel(inputs.paymentMethod, lang === 'TH');
    setText('rb_v3', paymentLabel);
    
    // Update condition text
    this._updateConditionText(down, balloon, net, purchaseOption, lang === 'TH');
  }

  /**
   * อัปเดต condition text ใน quotation
   */
  _updateConditionText(downBaht, balloonBaht, net, purchaseOption, isTH) {
    const hasDown = downBaht > 1e-10;
    const hasBalloon = balloonBaht > 1e-10;
    const diffEnd = hasBalloon ? Math.max(0, purchaseOption - downBaht) : 0;
    
    const c1 = $('condition1');
    if (c1) {
      if (isTH) {
        if (hasBalloon) {
          c1.innerHTML = 
            `ผู้เช่าตกลงชำระเงินดาวน์ <strong>${fmtNum(downBaht, 2)} บาท</strong> (รวม VAT)<br/>` +
            `เงินดาวน์เป็นส่วนหนึ่งของราคาสิทธิซื้อ <strong>${fmtNum(purchaseOption, 2)} บาท</strong> ` +
            `เมื่อสัญญาสิ้นสุด ลูกค้าชำระส่วนต่าง <strong>${fmtNum(diffEnd, 2)} บาท</strong>`;
        } else if (hasDown) {
          c1.innerHTML = 
            `ผู้เช่าตกลงชำระเงินดาวน์ <strong>${fmtNum(downBaht, 2)} บาท</strong> (รวม VAT) ` +
            `เงินดาวน์จะหักเป็นราคาสิทธิซื้อโดยอัตโนมัติเมื่อสัญญาสิ้นสุด`;
        } else {
          c1.innerHTML = 
            `เมื่อสัญญาเช่าครบกำหนด ผู้เช่าต้องชำระราคาสิทธิซื้อ <strong>${fmtNum(purchaseOption, 2)} บาท</strong> (รวม VAT)`;
        }
      } else {
        if (hasBalloon) {
          c1.innerHTML = 
            `Lessee shall pay <strong>${fmtNum(downBaht, 2)} Baht</strong> (Inc. VAT) as a deposit.<br/>` +
            `Deposit is part of the purchase price of <strong>${fmtNum(purchaseOption, 2)} Baht</strong>. ` +
            `At contract end, customer shall pay the difference: <strong>${fmtNum(diffEnd, 2)} Baht</strong> (Inc. VAT).`;
        } else if (hasDown) {
          c1.innerHTML = 
            `Lessee shall pay <strong>${fmtNum(downBaht, 2)} Baht</strong> (Inc. VAT) as a deposit to Lessor. ` +
            `The deposit will be applied automatically to Purchase Price when the contract expired.`;
        } else {
          c1.innerHTML = 
            `Upon contract expiry, the Lessee shall pay a Purchase Option of <strong>${fmtNum(purchaseOption, 2)} Baht</strong> (Inc. VAT) to the Lessor.`;
        }
      }
    }
    
    // Clause 3 - purchase option detail
    const q3 = $('q_clause3');
    if (q3) {
      if (isTH) {
        q3.innerHTML = 
          `ข้อเสนอนี้รวมสิทธิซื้อมูลค่า <strong>${fmt2(purchaseOption)} บาท</strong> (รวม VAT) ` +
          `หากท่านไม่ประสงค์ซื้อเมื่อสิ้นสุดสัญญา:<div style="margin-top:3px;padding-left:4px;line-height:1.7;">` +
          `ก. บริษัทฯ จะนำทรัพย์สินออกจำหน่ายผ่านการประมูล<br/>` +
          `ข. หากราคาประมูลต่ำกว่าราคาสิทธิซื้อ ท่านตกลงชำระส่วนต่าง</div>`;
      } else {
        q3.innerHTML = 
          `This offer includes a purchase option of <strong>${fmt2(purchaseOption)} Baht</strong> (Inc. VAT). ` +
          `If you choose not to purchase at the end of the lease period:<div style="margin-top:3px;padding-left:4px;line-height:1.7;">` +
          `a. The vehicle will be sold via auction to a 3rd party<br/>` +
          `b. If the sale price is less than the purchase option price, you agree to pay the difference</div>`;
      }
    }
  }

  /**
   * Update validation warnings
   */
  updateWarnings(warnings) {
    const warnBox = $('policyWarnings');
    if (!warnBox) return;
    
    warnBox.innerHTML = '';
    
    warnings.forEach(w => {
      const span = document.createElement('span');
      span.className = `pill ${w.level === 'error' ? 'err' : 'warn'}`;
      
      const icon = w.level === 'error' ? '⛔' : '⚠';
      span.textContent = `${icon} ${w.message}`;
      
      warnBox.appendChild(span);
    });
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Term unit change
    $('termUnit')?.addEventListener('change', (e) => {
      const newUnit = e.target.value;
      this._onTermUnitChange(this._prevTermUnit, newUnit);
      this._prevTermUnit = newUnit;
      this.recalcCallback?.();
    });
    
    // Mode toggle (Flat/IRR)
    $('mode')?.addEventListener('change', (e) => {
      const isIRR = e.target.value === 'IRR';
      setDisplay('irrRow', isIRR);
      $('btnSolveIRR').disabled = !isIRR;
      this.recalcCallback?.();
    });
    
    // Balloon enable toggle
    $('balloonEnable')?.addEventListener('change', () => {
      this._toggleBalloonUI();
      this.recalcCallback?.();
    });
    
    // Guarantor checkboxes
    $('guar_none')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        $('guar_personal').checked = false;
        $('guar_corporate').checked = false;
      } else {
        if (!$('guar_personal').checked && !$('guar_corporate').checked) {
          e.target.checked = true;
        }
      }
      this.recalcCallback?.();
    });
    
    [$('guar_personal'), $('guar_corporate')].forEach(el => {
      el?.addEventListener('change', (e) => {
        if (e.target.checked) {
          $('guar_none').checked = false;
        }
        if (!$('guar_personal').checked && !$('guar_corporate').checked) {
          $('guar_none').checked = true;
        }
        this.recalcCallback?.();
      });
    });
    
    // Language change
    $('quoteLang')?.addEventListener('change', (e) => {
      this.language = e.target.value;
      this._applyLanguage(this.language);
      this.recalcCallback?.();
    });
    
    // Solve IRR button
    $('btnSolveIRR')?.addEventListener('click', () => {
      this.recalcCallback?.('solveIRR');
    });
    
    // Goal seek button
    $('btnGoalSeek')?.addEventListener('click', () => {
      this.recalcCallback?.('goalSeek');
    });
    
    // Ctrl+Enter for goal seek
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.recalcCallback?.('goalSeek');
      }
    });
    
    // General input/change events (auto-recalc)
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (!['INPUT', 'SELECT'].includes(el.tagName)) return;
      
      // Skip termUnit (handled separately)
      if (el.id === 'termUnit') return;
      
      this.recalcCallback?.();
    });
  }

  /**
   * Toggle Balloon UI visibility
   */
  _toggleBalloonUI() {
    const isOn = getVal('balloonEnable') === 'true';
    setDisplay('balloonFields', isOn);
    setDisplay('balloonTypeField', isOn);
  }

  /**
   * Handle term unit change (years ↔ months)
   */
  _onTermUnitChange(oldUnit, newUnit) {
    const v = getVal('termVal');
    if (!v) return;
    
    let nv;
    if (oldUnit === 'years' && newUnit === 'months') {
      nv = Math.round(v * 12);
    } else if (oldUnit === 'months' && newUnit === 'years') {
      nv = parseFloat((v / 12).toFixed(2));
    } else {
      nv = v;
    }
    
    setVal('termVal', String(nv));
  }

  /**
   * Apply language changes to all labels
   */
  _applyLanguage(lang) {
    const labels = LABELS[lang] || LABELS.EN;
    const isTH = lang === 'TH';
    
    // Quotation header
    setText('q_co_name', labels.companyName);
    setText('q_doctype', labels.docType);
    setText('q_docsub', labels.subType);
    
    // Office info
    setText('q_hd_title', labels.headOffice);
    setText('q_hd_a1', labels.headAddr1);
    setText('q_hd_a2', labels.headAddr2);
    setText('q_hd_tel', labels.headTel);
    setText('q_eb_title', labels.easternBranch);
    setText('q_eb_a1', labels.easternAddr1);
    setText('q_eb_a2', labels.easternAddr2);
    setText('q_eb_tel', labels.easternTel);
    
    // Quotation info
    setText('lbl_qi_to', labels.toLabel);
    setText('lbl_qi_from', labels.fromLabel);
    setText('lbl_qi_qno', labels.quotationNoLabel);
    setText('lbl_qi_issue', labels.issueDateLabel);
    setText('lbl_qi_exp', labels.expirationDateLabel);
    
    // Intro & table
    setText('q_intro', labels.intro);
    setText('col_no', labels.col.no);
    setText('col_asset', labels.col.asset);
    setHTML('col_list', labels.col.listPrice);
    setHTML('col_dep', labels.col.deposit);
    setHTML('col_term', labels.col.term);
    setHTML('col_pmt_ex', labels.col.paymentEx);
    setText('col_vat', labels.col.vat);
    setHTML('col_pmt_inc', labels.col.paymentInc);
    setHTML('col_purchase', labels.col.purchasePrice);
    setText('col_qty', labels.col.qty);
    setText('col_color', labels.col.color);
    
    // Rate box
    setText('rb_k1', labels.interestRateType);
    setText('rb_k2', labels.frequency);
    setText('rb_k3', labels.paymentMethod);
    setText('rb_v2', labels.monthly);
    setText('rb_k4', labels.endOfContract);
    setText('rb_v4', labels.ownership);
    setText('rb_k5', labels.guarantor);
    
    // Subject & terms
    setText('q_subject', labels.subject);
    setText('h_terms', labels.termsLabel);
    setText('h_details', labels.detailsLabel);
    
    const termsHtml = labels.terms
      .map(t => `<li>${t}</li>`)
      .join('');
    setHTML('ol_terms_en', termsHtml);
    
    setText('cond1_title', labels.clause1Title);
    setHTML('q_clause2', labels.clause2);
    
    // Signature
    setText('lbl_authsig', labels.yourSincerely);
    setText('q_sign_name', labels.signatureName);
    setText('q_sign_role', labels.signatureRole);
    setText('q_sign_confirm', labels.signatureConfirm);
    setText('lbl_customer', labels.customer);
    setText('lbl_date', labels.date);
  }

  /**
   * Helper: Get guarantor label
   */
  _getGuarantorLabel(isTH) {
    const p = $('guar_personal')?.checked;
    const c = $('guar_corporate')?.checked;
    
    if (!p && !c) return '-';
    
    const parts = [];
    if (p) {
      parts.push(isTH 
        ? 'บุคคลธรรมดา (กรรมการบริษัท)' 
        : 'Personal (Director)');
    }
    if (c) {
      parts.push(isTH 
        ? 'ค้ำประกันโดยนิติบุคคล' 
        : 'Corporate Guarantee');
    }
    
    return parts.join('\n');
  }

  /**
   * Helper: Get payment method label
   */
  _getPaymentLabel(method, isTH) {
    const key = isTH ? 'TH' : 'EN';
    return PAYMENT_METHODS[method]?.[key] || PAYMENT_METHODS.transfer[key];
  }

  /**
   * Show error toast
   */
  showError(message) {
    showToast(message, 'error');
  }

  /**
   * Show success toast
   */
  showSuccess(message) {
    showToast(message, 'success');
  }
}
