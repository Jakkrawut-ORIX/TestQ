/**
 * ui-manager.js — UI Management
 * จัดการ event listeners และการอัปเดต UI
 * แยกจาก business logic
 */

import {
  $, getVal, setVal, setText, setHTML, setDisplay,
  showToast, fmt0, fmt2, fmt4, fmtNum,
} from './utils.js';
import {
  LABELS,
  PAYMENT_METHODS,
  PAYMENT_TIMINGS,
  GUARANTOR_TYPES,
} from './config.js';

export class UIManager {
  constructor(calculator, storage) {
    this.calculator = calculator;
    this.storage = storage;
    this.language = 'TH';
    this._prevTermUnit = 'years';
    this.recalcCallback = null;
  }

  onRecalc(callback) {
    this.recalcCallback = callback;
  }

  /** อ่านค่าทั้งหมดจากหน้า UI */
  readInputs() {
    const assetQtyEl = $('assetQty');
    const assetQtyRaw = assetQtyEl
      ? String(assetQtyEl.value || '').replace(/,/g, '').trim()
      : '';

    return {
      gross: getVal('gross'),
      discount: getVal('discount'),
      optionPlus: getVal('optionPlus'),
      vatPct: getVal('vatPct'),
      termUnit: getVal('termUnit') || 'years',
      termVal: getVal('termVal'),
      downType: getVal('downType') || 'amount',
      downInput: getVal('downInput'),
      balloonEnable: getVal('balloonEnable') || 'false',
      balloonType: getVal('balloonType') || 'amount',
      balloonInput: getVal('balloonInput'),
      mode: getVal('mode') || 'Flat',
      flatRate: getVal('flatRate')/100,
      irrTargetPct: getVal('irrTargetPct'),
      commBaseChoice: getVal('commBaseChoice') || 'finance',
      commPct: getVal('commPct'),
      commExtra: getVal('commExtra'),
      paymentMethod: getVal('paymentMethod') || 'transfer',
      paymentTiming: getVal('paymentTiming') || 'advance',
      custName: getVal('custName') || '',
      fromName: getVal('fromName') || '',
      quotationNo: getVal('quotationNo') || '',
      issueDate: getVal('issueDate') || '',
      validDays: getVal('validDays'),
      assetName: getVal('assetName') || '',
      assetColor: getVal('assetColor') || '',
      assetQty: assetQtyRaw === '' ? '' : Math.max(0, parseInt(assetQtyRaw, 10) || 0),
      targetMonthlyInc: getVal('targetMonthlyInc'),
      quoteLang: getVal('quoteLang') || 'TH',
    };
  }

  updateResults(results) {
    const {
      net, down, balloon, finance, finMinusBalloon, months,
      interest, pmtRounded, commission, irr, tr,
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
    setText('irr', Number.isFinite(irr) ? `${(irr * 100).toFixed(4)} %` : '—');
    setText('trCustomer', Number.isFinite(tr) ? `${(tr * 100).toFixed(4)} %` : '—');
  }

  updateHeroPayment(results) {
    setText('pmtRounded', fmt0(results.pmtRounded));
    setText('months_hero', `${results.months} งวด`);
  }

  updateWorksheet(results) {
    const {
      netEx, net, downEx, down, finEx, finance,
      pmtRoundedEx, pmtRounded, commEx, commission, rvEx, balloon,
    } = results;

    setText('ws_net_ex', fmt4(netEx));
    setText('ws_net_inc', fmt2(net));
    setText('ws_dep_ex', fmt4(downEx));
    setText('ws_dep_inc', fmt2(down));
    setText('ws_fin_ex', fmt4(finEx));
    setText('ws_fin_inc', fmt2(finance));
    setText('ws_pmt_ex', fmt4(pmtRoundedEx));
    setText('ws_pmt_inc', fmt0(pmtRounded));
    setText('ws_comm_ex', fmt4(commEx));
    setText('ws_comm_inc', fmt2(commission));
    setText('ws_rv_ex', fmt4(rvEx));
    setText('ws_rv_inc', fmt2(down + balloon));
  }

  updateQuotation(results) {
    const inputs = this.readInputs();
    const {
      net, down, balloon, months, pmtRounded, pmtRoundedEx,
      pmtVAT, purchaseOption,
    } = results;

    const lang = inputs.quoteLang || 'TH';
    const isTH = lang === 'TH';
    const issueDisp = inputs.issueDate
      ? inputs.issueDate.split('-').reverse().join('/')
      : '';

    setText('q_to', inputs.custName);
    setText('q_from', inputs.fromName);
    setText('q_no', inputs.quotationNo || '');
    setText('q_issue', issueDisp);
    setText(
      'q_expire',
      issueDisp
        ? `${inputs.validDays}${isTH ? ' วัน นับจากวันที่เสนอราคา' : ' days after the issue date'}`
        : ''
    );

    setText('q_asset', inputs.assetName || '');
    setText('q_color', inputs.assetColor || '');
    setText('q_list', fmt2(inputs.gross));
    setText('q_deposit', fmt2(down));
    setText('q_term', String(months));
    setText('q_pmt_ex', fmt2(pmtRoundedEx));
    setText('q_vat', fmt2(pmtVAT));
    setText('q_pmt_inc', fmt0(pmtRounded));
    setText('q_purchase', fmt2(purchaseOption));
    setText('q_qty', inputs.assetQty === '' ? '' : String(inputs.assetQty));
    setText('q_cust_sign', inputs.custName);

    setText('rb_v1', 'Flat Rate');
    setText('rb_v2', this._getPaymentTimingLabel(inputs.paymentTiming, isTH));
    setText('rb_v3', this._getPaymentLabel(inputs.paymentMethod, isTH));
    setText('rb_v5', this._getGuarantorLabel(isTH));

    this._updateConditionText(down, balloon, net, purchaseOption, isTH);
  }

  _updateConditionText(downBaht, balloonBaht, net, purchaseOption, isTH) {
    const hasDown = downBaht > 1e-10;
    const hasBalloon = balloonBaht > 1e-10;
    const diffEnd = hasBalloon ? Math.max(0, purchaseOption - downBaht) : 0;
    const c1 = $('condition1');

    if (c1) {
      if (isTH) {
        if (hasBalloon) {
          c1.innerHTML =
            `ผู้เช่าตกลงชำระเงินมัดจำ <strong>${fmtNum(downBaht, 2)} บาท</strong> (รวม VAT)<br/>` +
            `เงินมัดจำเป็นส่วนหนึ่งของราคาสิทธิซื้อ <strong>${fmtNum(purchaseOption, 2)} บาท</strong> ` +
            `เมื่อสัญญาสิ้นสุด ผู้เช่าชำระส่วนต่าง <strong>${fmtNum(diffEnd, 2)} บาท</strong>`;
        } else if (hasDown) {
          c1.innerHTML =
            `ผู้เช่าตกลงชำระเงินมัดจำ <strong>${fmtNum(downBaht, 2)} บาท</strong> (รวม VAT) ` +
            'เงินมัดจำจะหักเป็นราคาสิทธิซื้อโดยอัตโนมัติเมื่อสัญญาสิ้นสุด';
        } else {
          c1.innerHTML =
            `เมื่อสัญญาเช่าครบกำหนด ผู้เช่าต้องชำระราคาสิทธิซื้อ ` +
            `<strong>${fmtNum(purchaseOption, 2)} บาท</strong> (รวม VAT)`;
        }
      } else if (hasBalloon) {
        c1.innerHTML =
          `The Lessee shall pay a deposit of <strong>${fmtNum(downBaht, 2)} Baht</strong> (Inc. VAT).<br/>` +
          `The deposit forms part of the purchase price of <strong>${fmtNum(purchaseOption, 2)} Baht</strong>. ` +
          `At contract end, the Lessee shall pay the difference of <strong>${fmtNum(diffEnd, 2)} Baht</strong> (Inc. VAT).`;
      } else if (hasDown) {
        c1.innerHTML =
          `The Lessee shall pay a deposit of <strong>${fmtNum(downBaht, 2)} Baht</strong> (Inc. VAT). ` +
          'The deposit will automatically be applied toward the Purchase Price at contract expiry.';
      } else {
        c1.innerHTML =
          `Upon contract expiry, the Lessee shall pay a Purchase Option of ` +
          `<strong>${fmtNum(purchaseOption, 2)} Baht</strong> (Inc. VAT) to the Lessor.`;
      }
    }

    const q3 = $('q_clause3');
    if (!q3) return;

    q3.innerHTML = isTH
      ? `ข้อเสนอนี้รวมสิทธิซื้อมูลค่า <strong>${fmt2(purchaseOption)} บาท</strong> (รวม VAT) ` +
        'หากท่านไม่ประสงค์ซื้อเมื่อสิ้นสุดสัญญา:<div style="margin-top:3px;padding-left:4px;line-height:1.7;">' +
        'ก. บริษัทฯ จะนำทรัพย์สินออกจำหน่ายผ่านการประมูล<br/>' +
        'ข. หากราคาประมูลต่ำกว่าราคาสิทธิซื้อ ท่านตกลงชำระส่วนต่าง</div>'
      : `This offer includes a purchase option of <strong>${fmt2(purchaseOption)} Baht</strong> (Inc. VAT). ` +
        'If you choose not to purchase at the end of the lease period:<div style="margin-top:3px;padding-left:4px;line-height:1.7;">' +
        'a. The vehicle will be sold via auction to a third party<br/>' +
        'b. If the sale price is less than the purchase option price, you agree to pay the difference</div>';
  }

  updateWarnings(warnings = []) {
    const warnBox = $('policyWarnings');
    if (!warnBox) return;
    warnBox.innerHTML = '';

    warnings.forEach((warning) => {
      const span = document.createElement('span');
      span.className = `pill ${warning.level === 'error' ? 'err' : 'warn'}`;
      span.textContent = `${warning.level === 'error' ? '⛔' : '⚠'} ${warning.message}`;
      warnBox.appendChild(span);
    });
  }

  setupEventListeners() {
    this._prevTermUnit = getVal('termUnit') || 'years';

    $('termUnit')?.addEventListener('change', (event) => {
      const newUnit = event.target.value;
      this._onTermUnitChange(this._prevTermUnit, newUnit);
      this._prevTermUnit = newUnit;
      this.recalcCallback?.();
    });

    $('mode')?.addEventListener('change', (event) => {
      const isIRR = event.target.value === 'IRR';
      setDisplay('irrRow', isIRR);
      if ($('btnSolveIRR')) $('btnSolveIRR').disabled = !isIRR;
      this.recalcCallback?.();
    });

    $('balloonEnable')?.addEventListener('change', () => {
      this._toggleBalloonUI();
      this.recalcCallback?.();
    });

    $('guar_none')?.addEventListener('change', (event) => {
      if (event.target.checked) {
        if ($('guar_personal')) $('guar_personal').checked = false;
        if ($('guar_corporate')) $('guar_corporate').checked = false;
      } else if (!$('guar_personal')?.checked && !$('guar_corporate')?.checked) {
        event.target.checked = true;
      }
      this.recalcCallback?.();
    });

    [$('guar_personal'), $('guar_corporate')].forEach((element) => {
      element?.addEventListener('change', (event) => {
        if (event.target.checked && $('guar_none')) $('guar_none').checked = false;
        if (!$('guar_personal')?.checked && !$('guar_corporate')?.checked && $('guar_none')) {
          $('guar_none').checked = true;
        }
        this.recalcCallback?.();
      });
    });

    $('quoteLang')?.addEventListener('change', (event) => {
      this.language = event.target.value;
      this._applyLanguage(this.language);
      this.recalcCallback?.();
    });

    $('paymentTiming')?.addEventListener('change', () => {
      this._updatePaymentTimingDisplay();
      this.recalcCallback?.();
    });

    $('btnSolveIRR')?.addEventListener('click', () => this.recalcCallback?.('solveIRR'));
    $('btnGoalSeek')?.addEventListener('click', () => this.recalcCallback?.('goalSeek'));

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        this.recalcCallback?.('goalSeek');
      }
    });

    // Text/number inputs recalculate continuously. Selects are handled by change.
    document.addEventListener('input', (event) => {
      const element = event.target;
      if (!['INPUT', 'TEXTAREA'].includes(element.tagName)) return;
      if (['guar_none', 'guar_personal', 'guar_corporate'].includes(element.id)) return;
      this.recalcCallback?.();
    });

    // Selects that do not have a dedicated handler.
    document.addEventListener('change', (event) => {
      const element = event.target;
      if (element.tagName !== 'SELECT') return;
      if ([
        'termUnit', 'mode', 'balloonEnable', 'quoteLang', 'paymentTiming',
      ].includes(element.id)) return;
      this.recalcCallback?.();
    });

    this._toggleBalloonUI();
    this._applyLanguage(getVal('quoteLang') || 'TH');
  }

  _toggleBalloonUI() {
    const isOn = getVal('balloonEnable') === 'true';
    setDisplay('balloonFields', isOn);
    setDisplay('balloonTypeField', isOn);
  }

  _onTermUnitChange(oldUnit, newUnit) {
    const value = getVal('termVal');
    if (!value) return;

    let next = value;
    if (oldUnit === 'years' && newUnit === 'months') next = Math.round(value * 12);
    if (oldUnit === 'months' && newUnit === 'years') next = Number((value / 12).toFixed(2));
    setVal('termVal', String(next));
  }

  _applyLanguage(lang) {
    const labels = LABELS[lang] || LABELS.TH;
    const isTH = lang === 'TH';
    this.language = lang;

    const textMap = {
      q_co_name: labels.companyName,
      q_doctype: labels.docType,
      q_docsub: labels.subType,
      q_hd_title: labels.headOffice,
      q_hd_a1: labels.headAddr1,
      q_hd_a2: labels.headAddr2,
      q_hd_tel: labels.headTel,
      q_eb_title: labels.easternBranch,
      q_eb_a1: labels.easternAddr1,
      q_eb_a2: labels.easternAddr2,
      q_eb_tel: labels.easternTel,
      lbl_qi_to: labels.toLabel,
      lbl_qi_from: labels.fromLabel,
      lbl_qi_qno: labels.quotationNoLabel,
      lbl_qi_issue: labels.issueDateLabel,
      lbl_qi_exp: labels.expirationDateLabel,
      q_intro: labels.intro,
      col_no: labels.col.no,
      col_asset: labels.col.asset,
      col_vat: labels.col.vat,
      col_qty: labels.col.qty,
      col_color: labels.col.color,
      rb_k1: labels.interestRateType,
      rb_k2: labels.frequency,
      rb_k3: labels.paymentMethod,
      rb_k4: labels.endOfContract,
      rb_v4: labels.ownership,
      rb_k5: labels.guarantor,
      q_subject: labels.subject,
      h_terms: labels.termsLabel,
      h_details: labels.detailsLabel,
      cond1_title: labels.clause1Title,
      lbl_authsig: labels.yourSincerely,
      q_sign_name: labels.signatureName,
      q_sign_role: labels.signatureRole,
      q_sign_confirm: labels.signatureConfirm,
      lbl_customer: labels.customer,
      lbl_date: labels.date,
    };

    Object.entries(textMap).forEach(([id, value]) => setText(id, value));

    const htmlMap = {
      col_list: labels.col.listPrice,
      col_dep: labels.col.deposit,
      col_term: labels.col.term,
      col_pmt_ex: labels.col.paymentEx,
      col_pmt_inc: labels.col.paymentInc,
      col_purchase: labels.col.purchasePrice,
      ol_terms_en: labels.terms.map((term) => `<li>${term}</li>`).join(''),
      q_clause2: labels.clause2,
    };

    Object.entries(htmlMap).forEach(([id, value]) => setHTML(id, value));
    this._updatePaymentTimingDisplay();
    this._toggleFooterLanguage(isTH);
  }

  _updatePaymentTimingDisplay() {
    const isTH = (getVal('quoteLang') || this.language || 'TH') === 'TH';
    setText(
      'rb_v2',
      this._getPaymentTimingLabel(getVal('paymentTiming') || 'advance', isTH)
    );
  }

  _toggleFooterLanguage(isTH) {
    const footerEN = $('q_footer_content_en');
    const footerTH = $('q_footer_content_th');
    if (!footerEN || !footerTH) return;

    footerEN.classList.toggle('hidden', isTH);
    footerTH.classList.toggle('hidden', !isTH);
  }

  _getGuarantorLabel(isTH) {
    const key = isTH ? 'TH' : 'EN';
    const selected = [];
    if ($('guar_personal')?.checked) selected.push(GUARANTOR_TYPES.personal[key]);
    if ($('guar_corporate')?.checked) selected.push(GUARANTOR_TYPES.corporate[key]);
    return selected.length ? selected.join('\n') : GUARANTOR_TYPES.none[key];
  }

  _getPaymentLabel(method, isTH) {
    const key = isTH ? 'TH' : 'EN';
    return PAYMENT_METHODS[method]?.[key] || PAYMENT_METHODS.transfer[key];
  }

  _getPaymentTimingLabel(timing, isTH) {
    const key = isTH ? 'TH' : 'EN';
    return PAYMENT_TIMINGS[timing]?.[key] || PAYMENT_TIMINGS.advance[key];
  }

  showError(message) {
    showToast(message, 'error');
  }

  showSuccess(message) {
    showToast(message, 'success');
  }
}
