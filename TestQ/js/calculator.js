/**
 * calculator.js — Core Calculation Engine
 * บรรจุตรรกะการคำนวณทั้งหมด
 * ไม่เกี่ยวข้องกับ UI - สามารถ test แยกได้
 */

import { CONSTANTS } from './config.js';
import { rate, binarySearch, round } from './utils.js';

export class Calculator {
  constructor(inputs = {}) {
    this.inputs = inputs;
  }

  /**
   * คำนวณราคาสุทธิ (Net Price)
   * Net = Gross - Discount + Option
   */
  calculateNetPrice() {
    const { gross = 0, discount = 0, optionPlus = 0 } = this.inputs;
    return Math.max(0, gross - discount + optionPlus);
  }

  /**
   * คำนวณเงินดาวน์ (Down Payment)
   */
  calculateDownPayment() {
    const { downType, downInput, vatPct = 7 } = this.inputs;
    const net = this.calculateNetPrice();
    
    if (downType === 'percent') {
      return net * (downInput / 100);
    }
    return Math.max(0, downInput);
  }

  /**
   * คำนวณ Balloon Payment
   */
  calculateBalloonPayment() {
    const { 
      balloonEnable, 
      balloonType, 
      balloonInput,
    } = this.inputs;
    
    if (balloonEnable !== 'true') return 0;
    
    const net = this.calculateNetPrice();
    
    if (balloonType === 'percent') {
      return net * (balloonInput / 100);
    }
    return Math.max(0, balloonInput);
  }

  /**
   * คำนวณยอดจัด (Finance Amount)
   * Finance = Net - Down
   */
  calculateFinance() {
    const net = this.calculateNetPrice();
    const down = this.calculateDownPayment();
    return Math.max(0, net - down);
  }

  /**
   * คำนวณยอดจัดหลังลบ Balloon
   * Finance - Balloon (สำหรับ payment calculation)
   */
  calculateFinanceMinusBalloon() {
    const finance = this.calculateFinance();
    const balloon = this.calculateBalloonPayment();
    return Math.max(0, finance - balloon);
  }

  /**
   * คำนวณระยะเวลา (ในหน่วยต่างๆ)
   */
  calculateTerm() {
    const { termUnit = 'years', termVal = 0 } = this.inputs;
    
    let years = 0;
    let months = 0;
    
    if (termUnit === 'months') {
      months = Math.trunc(termVal);
      years = termVal / 12;
    } else {
      years = Math.max(0, termVal);
      months = Math.trunc(termVal * 12);
    }
    
    return { years, months };
  }

  /**
   * คำนวณดอกเบี้ยรวม (Flat Rate)
   * Interest = Finance × Rate × Years
   */
  calculateTotalInterest() {
    const { flatRate = 0 } = this.inputs;
    const finance = this.calculateFinanceMinusBalloon();
    const { years } = this.calculateTerm();
    
    if (finance <= 0 || years <= 0) return 0;
    
    return finance * flatRate * years;
  }

  /**
   * คำนวณค่างวด (Monthly Payment)
   * PMT = (Finance + Interest) / Months
   */
  calculateMonthlyPayment(includeBalloon = true) {
    const { months } = this.calculateTerm();
    const finance = includeBalloon 
      ? this.calculateFinanceMinusBalloon() 
      : this.calculateFinance();
    const interest = this.calculateTotalInterest();
    
    if (months <= 0) return 0;
    
    return (finance + interest) / months;
  }

  /**
   * คำนวณค่างวดปัดขึ้น (ตรงกับ UI display)
   */
  calculateMonthlyPaymentRounded() {
    const pmt = this.calculateMonthlyPayment();
    return Math.ceil(Math.round(pmt * 100) / 100);
  }

  /**
   * คำนวณ VAT ของค่างวด
   */
  calculateMonthlyVAT() {
    const { vatPct = 7 } = this.inputs;
    const pmtInc = this.calculateMonthlyPaymentRounded();
    const pmtEx = pmtInc / (1 + vatPct / 100);
    return pmtInc - pmtEx;
  }

  /**
   * คำนวณคอมมิชชั่น
   * Base: finance หรือ interest
   */
  calculateCommission() {
    const { 
      commBaseChoice = 'finance', 
      commPct = 0, 
      commExtra = 0 
    } = this.inputs;
    
    let base = 0;
    
    if (commBaseChoice === 'interest') {
      base = this.calculateTotalInterest();
    } else {
      base = this.calculateFinance();
    }
    
    return Math.round(base * (commPct / 100) + (commExtra || 0));
  }

  /**
   * คำนวณ IRR (Internal Rate of Return)
   * รวมคอมมิชชั่นของบริษัท
   */
  calculateIRR() {
    const { months } = this.calculateTerm();
    const { vatPct = 7 } = this.inputs;
    
    if (months <= 0) return null;
    
    const finance = this.calculateFinance();
    const commission = this.calculateCommission();
    const pmtEx = this.calculateMonthlyPayment(true) / (1 + vatPct / 100);
    const fv = this.calculateBalloonPayment() / (1 + vatPct / 100);
    
    if (pmtEx <= 0) return null;
    
    const pv = -(finance + commission) / (1 + vatPct / 100);
    
    // rate() returns monthly rate, convert to annual
    const monthlyRate = rate(months, pmtEx, pv, fv, 0, 0.01);
    return isFinite(monthlyRate) ? monthlyRate * 12 : null;
  }

  /**
   * คำนวณ Total Return สำหรับลูกค้า
   * ไม่รวมคอมมิชชั่น
   */
  calculateTotalReturnCustomer() {
    const { months } = this.calculateTerm();
    const { vatPct = 7 } = this.inputs;
    
    if (months <= 0) return null;
    
    const finance = this.calculateFinance();
    const pmtEx = this.calculateMonthlyPayment(true) / (1 + vatPct / 100);
    const fv = this.calculateBalloonPayment() / (1 + vatPct / 100);
    
    if (pmtEx <= 0) return null;
    
    const pv = -finance / (1 + vatPct / 100);
    
    const monthlyRate = rate(months, pmtEx, pv, fv, 0, 0.01);
    return isFinite(monthlyRate) ? monthlyRate * 12 : null;
  }

  /**
   * Solve: หา Flat Rate จาก IRR Target
   * ใช้ binary search
   */
  solveFlatRateFromIRR(irrTarget) {
    const { months } = this.calculateTerm();
    
    if (months <= 0) {
      throw new Error('กรุณากำหนดระยะเวลา');
    }
    
    const self = this;
    
    // ฟังก์ชันคำนวณ IRR จาก flat rate
    const irrFromFlat = (flatRate) => {
      const savedRate = self.inputs.flatRate;
      self.inputs.flatRate = flatRate;
      const irr = self.calculateIRR();
      self.inputs.flatRate = savedRate;
      return irr || 0;
    };
    
    // Binary search
    const [lo, hi] = CONSTANTS.IRR_SEARCH_RANGE;
    const flatRate = binarySearch(
      (f) => irrFromFlat(f),
      irrTarget,
      lo,
      hi,
      80,
      1e-7
    );
    
    return flatRate;
  }

  /**
   * Solve: หา Down Payment จากค่างวดเป้าหมาย
   * ใช้ binary search
   */
  solveDownPaymentFromTarget(targetMonthly) {
    const net = this.calculateNetPrice();
    const { months } = this.calculateTerm();
    
    if (months <= 0) {
      throw new Error('กรุณากำหนดระยะเวลา');
    }
    
    const self = this;
    
    // ฟังก์ชันคำนวณค่างวด from down amount
    const pmtFromDown = (down) => {
      const savedDown = self.inputs.downInput;
      self.inputs.downType = 'amount';
      self.inputs.downInput = Math.round(down);
      
      const pmt = self.calculateMonthlyPaymentRounded();
      
      self.inputs.downInput = savedDown;
      return pmt;
    };
    
    // Binary search
    let lo = 0;
    let hi = net;
    let best = 0;
    
    for (let k = 0; k < 40; k++) {
      const mid = Math.floor((lo + hi) / 2);
      const p = pmtFromDown(mid);
      
      if (p === targetMonthly) {
        best = mid;
        break;
      }
      
      // ถ้าค่างวดมากเกินไป → ต้องเพิ่มดาวน์
      if (p > targetMonthly) {
        lo = mid + 1;
        best = mid;
      } else {
        hi = mid - 1;
        best = mid;
      }
    }
    
    return best;
  }

  /**
   * คำนวณราคาซื้อสิทธิ์ (Purchase Option)
   */
  calculatePurchaseOption() {
    const down = this.calculateDownPayment();
    const balloon = this.calculateBalloonPayment();
    
    if (balloon > 0) {
      return down + balloon;
    }
    
    if (down > 0) {
      return down;
    }
    
    return CONSTANTS.PURCHASE_OPTION_INC;
  }

  /**
   * Validation: ตรวจเงื่อนไขที่อาจเป็นปัญหา
   */
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
        message: `Balloon > ${CONSTANTS.MAX_BALLOON_PERCENT * 100}% Net` 
      });
    }
    
    if (down + balloon > net) {
      warnings.push({ 
        level: 'error', 
        message: 'Down + Balloon > 100% Net' 
      });
    }
    
    return warnings;
  }

  /**
   * สรุปผลลัพธ์ทั้งหมด
   * Returns object พร้อมค่าที่คำนวณได้
   */
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
    
    // For OWS working sheet
    const { vatPct = 7 } = this.inputs;
    const pmtEx = pmt / (1 + vatPct / 100);
    const netEx = net / (1 + vatPct / 100);
    const downEx = down / (1 + vatPct / 100);
    const finEx = finance / (1 + vatPct / 100);
    const commEx = commission / (1 + vatPct / 100);
    const rvEx = (down + balloon) / (1 + vatPct / 100);
    
    return {
      // Prices
      net,
      down,
      balloon,
      finance,
      finMinusBalloon,
      purchaseOption,
      
      // Term
      years,
      months,
      
      // Payments
      interest,
      pmt,
      pmtRounded,
      pmtVAT,
      pmtEx,
      
      // Commission & Returns
      commission,
      irr,
      tr,
      
      // OWS
      netEx,
      downEx,
      finEx,
      commEx,
      rvEx,
      
      // Validation
      warnings,
    };
  }
}
