/**
 * calculator.js — Core Calculation Engine
 * บรรจุตรรกะการคำนวณทั้งหมด
 * ไม่เกี่ยวข้องกับ UI และสามารถทดสอบแยกได้
 */

import { CONSTANTS, PAYMENT_TIMINGS } from './config.js';
import { rate, binarySearch } from './utils.js';

export class Calculator {
  constructor(inputs = {}) {
    this.inputs = inputs;
  }

  /** ราคาสุทธิ = Gross - Discount + Option */
  calculateNetPrice() {
    const { gross = 0, discount = 0, optionPlus = 0 } = this.inputs;
    return Math.max(0, gross - discount + optionPlus);
  }

  /** เงินดาวน์ */
  calculateDownPayment() {
    const { downType = 'amount', downInput = 0 } = this.inputs;
    const net = this.calculateNetPrice();
    return downType === 'percent'
      ? Math.max(0, net * downInput / 100)
      : Math.max(0, downInput);
  }

  /** Balloon */
  calculateBalloonPayment() {
    const {
      balloonEnable = 'false',
      balloonType = 'amount',
      balloonInput = 0,
    } = this.inputs;

    if (balloonEnable !== 'true') return 0;

    const net = this.calculateNetPrice();
    return balloonType === 'percent'
      ? Math.max(0, net * balloonInput / 100)
      : Math.max(0, balloonInput);
  }

  /** ยอดจัด = Net - Down */
  calculateFinance() {
    return Math.max(0, this.calculateNetPrice() - this.calculateDownPayment());
  }

  /** ยอดจัดหลังหัก Balloon */
  calculateFinanceMinusBalloon() {
    return Math.max(
      0,
      this.calculateFinance() - this.calculateBalloonPayment()
    );
  }

  /** ระยะเวลา */
  calculateTerm() {
    const { termUnit = 'years', termVal = 0 } = this.inputs;
    const value = Math.max(0, Number(termVal) || 0);

    if (termUnit === 'months') {
      return {
        years: value / 12,
        months: Math.trunc(value),
      };
    }

    return {
      years: value,
      months: Math.trunc(value * 12),
    };
  }

  /**
   * RATE payment type
   * advance = ต้นงวด = 1
   * arrears = ปลายงวด = 0
   */
  getPaymentType() {
    const timing = this.inputs.paymentTiming || 'advance';
    return PAYMENT_TIMINGS[timing]?.type ?? 0;
  }

  /** ดอกเบี้ยรวม Flat = (Finance - Balloon) × Flat Rate × Years */
  calculateTotalInterest() {
    const { flatRate = 0 } = this.inputs;
    const principal = this.calculateFinanceMinusBalloon();
    const { years } = this.calculateTerm();

    if (principal <= 0 || years <= 0) return 0;
    return principal * flatRate * years;
  }

  /**
   * ค่างวดรวม VAT ตามสูตร Excel เดิม
   * Payment Timing ไม่เปลี่ยนค่างวด
   * ต้นงวด/ปลายงวดมีผลเฉพาะ RATE/IRR
   */
  calculateMonthlyPayment(includeBalloon = true) {
    const { months } = this.calculateTerm();
    if (months <= 0) return 0;

    const principal = includeBalloon
      ? this.calculateFinanceMinusBalloon()
      : this.calculateFinance();

    return (principal + this.calculateTotalInterest()) / months;
  }

  /** ค่างวดปัดขึ้นสำหรับแสดงผล */
  calculateMonthlyPaymentRounded() {
    const pmt = this.calculateMonthlyPayment();
    return Math.ceil(Math.round(pmt * 100) / 100);
  }

  /** VAT ของค่างวดที่ปัดขึ้น */
  calculateMonthlyVAT() {
    const { vatPct = 7 } = this.inputs;
    const factor = 1 + vatPct / 100;
    const pmtInc = this.calculateMonthlyPaymentRounded();
    const pmtEx = factor > 0 ? pmtInc / factor : 0;
    return pmtInc - pmtEx;
  }

  /** Commission */
  calculateCommission() {
    const {
      commBaseChoice = 'finance',
      commPct = 0,
      commExtra = 0,
    } = this.inputs;

    const base = commBaseChoice === 'interest'
      ? this.calculateTotalInterest()
      : this.calculateFinance();

    return Math.round(base * (commPct / 100) + (Number(commExtra) || 0));
  }

  /** IRR บริษัท รวม Commission */
  calculateIRR() {
    const { months } = this.calculateTerm();
    const { vatPct = 7 } = this.inputs;
    if (months <= 0) return null;

    const factor = 1 + vatPct / 100;
    if (factor <= 0) return null;

    const finance = this.calculateFinance();
    const commission = this.calculateCommission();
    const pmtEx = this.calculateMonthlyPayment(true) / factor;
    const pv = -(finance + commission) / factor;
    const fv = this.calculateBalloonPayment() / factor;

    if (pmtEx <= 0) return null;

    const monthlyRate = rate(
      months,
      pmtEx,
      pv,
      fv,
      this.getPaymentType(),
      0.01
    );

    return Number.isFinite(monthlyRate) ? monthlyRate * 12 : null;
  }

  /** Total Return ลูกค้า ไม่รวม Commission */
  calculateTotalReturnCustomer() {
    const { months } = this.calculateTerm();
    const { vatPct = 7 } = this.inputs;
    if (months <= 0) return null;

    const factor = 1 + vatPct / 100;
    if (factor <= 0) return null;

    const finance = this.calculateFinance();
    const pmtEx = this.calculateMonthlyPayment(true) / factor;
    const pv = -finance / factor;
    const fv = this.calculateBalloonPayment() / factor;

    if (pmtEx <= 0) return null;

    const monthlyRate = rate(
      months,
      pmtEx,
      pv,
      fv,
      this.getPaymentType(),
      0.01
    );

    return Number.isFinite(monthlyRate) ? monthlyRate * 12 : null;
  }

  /** หา Flat Rate จาก IRR Target */
  solveFlatRateFromIRR(irrTarget) {
    const { months } = this.calculateTerm();
    if (months <= 0) throw new Error('กรุณากำหนดระยะเวลา');
    if (!(irrTarget > 0)) throw new Error('กรุณากำหนด IRR Target');

    const savedRate = this.inputs.flatRate;

    const irrFromFlat = (flatRate) => {
      this.inputs.flatRate = flatRate;
      const irr = this.calculateIRR();
      return Number.isFinite(irr) ? irr : 0;
    };

    try {
      const [lo, hi] = CONSTANTS.IRR_SEARCH_RANGE;
      return binarySearch(
        irrFromFlat,
        irrTarget,
        lo,
        hi,
        80,
        1e-7
      );
    } finally {
      this.inputs.flatRate = savedRate;
    }
  }

  /** หา Down Payment จากค่างวดเป้าหมาย */
  solveDownPaymentFromTarget(targetMonthly) {
    const net = this.calculateNetPrice();
    const { months } = this.calculateTerm();

    if (months <= 0) throw new Error('กรุณากำหนดระยะเวลา');
    if (!(targetMonthly > 0)) throw new Error('กรุณากรอกค่างวดเป้าหมาย');

    const savedDownType = this.inputs.downType;
    const savedDownInput = this.inputs.downInput;

    const pmtFromDown = (down) => {
      this.inputs.downType = 'amount';
      this.inputs.downInput = Math.round(down);
      return this.calculateMonthlyPaymentRounded();
    };

    let lo = 0;
    let hi = Math.floor(net);
    let best = 0;
    let bestDiff = Infinity;

    try {
      for (let k = 0; k < 40 && lo <= hi; k++) {
        const mid = Math.floor((lo + hi) / 2);
        const pmt = pmtFromDown(mid);
        const diff = Math.abs(pmt - targetMonthly);

        if (diff < bestDiff || (diff === bestDiff && mid < best)) {
          best = mid;
          bestDiff = diff;
        }

        if (pmt === targetMonthly) {
          best = mid;
          break;
        }

        if (pmt > targetMonthly) lo = mid + 1;
        else hi = mid - 1;
      }

      return best;
    } finally {
      this.inputs.downType = savedDownType;
      this.inputs.downInput = savedDownInput;
    }
  }

  /** ราคาซื้อสิทธิ์ */
  calculatePurchaseOption() {
    const down = this.calculateDownPayment();
    const balloon = this.calculateBalloonPayment();

    if (balloon > 0) return down + balloon;
    if (down > 0) return down;
    return CONSTANTS.PURCHASE_OPTION_INC;
  }

  /** ตรวจเงื่อนไข */
  validatePolicies() {
    const net = this.calculateNetPrice();
    const down = this.calculateDownPayment();
    const balloon = this.calculateBalloonPayment();
    const warnings = [];

    if (net <= 0) {
      warnings.push({ level: 'error', message: 'ราคาสุทธิต้องมากกว่า 0' });
    }

    if (balloon > net * CONSTANTS.MAX_BALLOON_PERCENT) {
      warnings.push({
        level: 'warn',
        message: `Balloon > ${CONSTANTS.MAX_BALLOON_PERCENT * 100}% Net`,
      });
    }

    if (down + balloon > net) {
      warnings.push({
        level: 'error',
        message: 'Down + Balloon > 100% Net',
      });
    }

    return warnings;
  }

  /** สรุปผลลัพธ์ทั้งหมด */
  getResults() {
    const net = this.calculateNetPrice();
    const down = this.calculateDownPayment();
    const balloon = this.calculateBalloonPayment();
    const finance = this.calculateFinance();
    const finMinusBalloon = this.calculateFinanceMinusBalloon();
    const { years, months } = this.calculateTerm();
    const interest = this.calculateTotalInterest();
    const pmt = this.calculateMonthlyPayment();
    const pmtRounded = this.calculateMonthlyPaymentRounded();
    const pmtVAT = this.calculateMonthlyVAT();
    const commission = this.calculateCommission();
    const irr = this.calculateIRR();
    const tr = this.calculateTotalReturnCustomer();
    const purchaseOption = this.calculatePurchaseOption();
    const warnings = this.validatePolicies();

    const paymentTiming = this.inputs.paymentTiming || 'advance';
    const paymentType = this.getPaymentType();

    const { vatPct = 7 } = this.inputs;
    const factor = 1 + vatPct / 100;
    const safeFactor = factor > 0 ? factor : 1;

    const pmtEx = pmt / safeFactor;
    const pmtRoundedEx = pmtRounded / safeFactor;
    const netEx = net / safeFactor;
    const downEx = down / safeFactor;
    const finEx = finance / safeFactor;
    const commEx = commission / safeFactor;
    const rvEx = (down + balloon) / safeFactor;

    return {
      paymentTiming,
      paymentType,
      isAdvance: paymentType === 1,

      net,
      down,
      balloon,
      finance,
      finMinusBalloon,
      purchaseOption,

      years,
      months,

      interest,
      pmt,
      pmtRounded,
      pmtVAT,
      pmtEx,
      pmtRoundedEx,

      commission,
      irr,
      tr,

      netEx,
      downEx,
      finEx,
      commEx,
      rvEx,

      warnings,
    };
  }
}
