/**
 * config.js — Configuration & Constants
 * เก็บค่าคงที่ทั้งหมด ค่าตั้งต้น และ labels
 * ปรับแต่งที่นี่เพื่อเปลี่ยนพฤติกรรมของแอป
 */

export const CONSTANTS = {
  // ตัวเลขสำคัญ
  PURCHASE_OPTION_INC: 1070,      // ราคาซื้อสิทธิ์ default (Baht)
  MAX_BALLOON_PERCENT: 0.30,      // Balloon limit (30%)
  MAX_ITERATIONS: 100,             // Binary search iterations
  TOLERANCE: 1e-12,                // Floating point tolerance
  
  // ช่วง default สำหรับ goal seek
  DOWN_SEARCH_STEP: 1,             // increment ในการค้นหา
  IRR_SEARCH_RANGE: [1e-6, 0.40],  // ช่วง flat rate (0% - 40%)
};

export const DEFAULT_VALUES = {
  // ราคา & VAT
  gross: 0,
  discount: 0,
  optionPlus: 0,
  vatPct: 7,
  
  // ระยะเวลา
  termUnit: 'years',
  termVal: 5,
  
  // เงินดาวน์
  downType: 'amount',
  downInput: 0,
  
  // Balloon
  balloonEnable: 'false',
  balloonType: 'amount',
  balloonInput: 0,
  
  // อัตราและคอม
  mode: 'Flat',
  flatRate: 0,
  irrTargetPct: 5.75,
  
  // Commission
  commBaseChoice: 'finance',
  commPct: 2.5,
  commExtra: 0,
  
  // เงื่อนไขอื่น
  paymentMethod: 'transfer',
  
  // ข้อมูลเอกสาร
  custName: 'Test',
  fromName: 'Jakkrawut Naksomphan',
  quotationNo: '',
  issueDate: '',
  validDays: 30,
  
  // ทรัพย์สิน
  assetName: '',
  assetColor: '',
  assetQty: 1,
  
  // Goal seek
  targetMonthlyInc: '',
  
  // UI
  quoteLang: 'EN',
};

/**
 * LABELS — ป้ายข้อความภาษาไทย/อังกฤษ
 * ใช้สำหรับใบเสนอราคาและ UI
 */
export const LABELS = {
  TH: {
    // Header
    companyName: 'บริษัท ไทยโอริกซ์ลีสซิ่ง จำกัด',
    docType: 'ใบเสนอราคา',
    subType: 'ลีสซิ่ง',
    
    // Office info
    headOffice: 'สำนักงานใหญ่',
    headAddr1: '555 อาคาร รสา ทาวเวอร์ 2 ยูนิต 1801 ชั้น 18 และ 19',
    headAddr2: 'ถนนพหลโยธิน จตุจักร กรุงเทพฯ 10900',
    headTel: 'โทร 02-792-4500   แฟกซ์ 02-792-4501',
    
    easternBranch: 'สาขาตะวันออก',
    easternAddr1: 'นิคมอมตะนคร 700/17 หมู่ 1',
    easternAddr2: 'ต.คลองตำหรุ อ.เมือง จ.ชลบุรี 20000',
    easternTel: 'โทร 0-3845-7580   แฟกซ์ 0-3845-7582',
    
    // Quotation info
    toLabel: 'เรียน :',
    fromLabel: 'จาก :',
    quotationNoLabel: 'ใบเสนอราคาเลขที่ :',
    issueDateLabel: 'วันที่เสนอราคา :',
    expirationDateLabel: 'มีผลถึง :',
    
    // Intro
    intro: 'บริษัทไทยโอริกซ์ลีสซิ่ง จำกัด ขอขอบคุณที่ท่านมีความสนใจในการใช้บริการ ทางบริษัท ขอเสนอราคาดังต่อไปนี้',
    
    // Table headers
    col: {
      no: 'ลำดับ',
      asset: 'รายการทรัพย์สิน',
      listPrice: 'ราคา<br/>(รวม VAT)',
      deposit: 'เงินมัดจำ<br/>(รวม VAT)',
      term: 'ระยะเวลา<br/>(เดือน)',
      paymentEx: 'ค่าเช่ารายเดือน<br/>(ไม่รวม VAT)',
      vat: 'VAT',
      paymentInc: 'ค่าเช่ารายเดือน<br/>(รวม VAT)',
      purchasePrice: 'ราคาซื้อสิทธิ์<br/>(รวม VAT)',
      qty: 'จำนวน',
      color: 'สี',
    },
    
    // Rate box
    interestRateType: 'ประเภทดอกเบี้ย',
    frequency: 'ความถี่ชำระ',
    paymentMethod: 'วิธีชำระเงิน',
    endOfContract: 'เงื่อนไขสิ้นสุดสัญญา',
    guarantor: 'ผู้ค้ำประกัน',
    
    // Values
    monthly: 'รายเดือน',
    ownership: 'กรรมสิทธิ์โอนให้ผู้เช่า',
    
    // Subject
    subject: '* ใบเสนอราคานี้ขึ้นอยู่กับผลการพิจารณาอนุมัติสินเชื่อของบริษัทฯ',
    
    // Terms
    termsLabel: 'เงื่อนไข :',
    detailsLabel: 'รายละเอียดเงื่อนไข :',
    
    terms: [
      'ใบเสนอราคาฉบับนี้ขึ้นอยู่กับผลการพิจารณาอนุมัติสินเชื่อของบริษัทฯ แต่เพียงผู้เดียว',
      'หากท่านยกเลิกคำสั่งซื้อหลังจากลงนามในเอกสารนี้แล้วไม่ว่าด้วยเหตุใดก็ตาม ท่านจะต้องรับผิดชอบต่อราคาซื้อรถยนต์ทั้งหมด',
    ],
    
    clause1Title: 'ราคาซื้อรถยนต์',
    clause2: '&#8226; ค่าเช่ารายเดือนข้างต้นยังไม่รวมค่าประกันภัยชั้น 1, พ.ร.บ., ภาษีรถยนต์ประจำปี และค่าธรรมเนียมการจดทะเบียน<br/>&#8226; ผู้เช่าต้องจัดทำและรับผิดชอบค่าประกันภัยชั้น 1, พ.ร.บ. และภาษีรถยนต์ตลอดสัญญา โดยระบุบริษัค ไทยโอริกซ์ลีสซิ่ง จำกัด เป็นผู้รับประโยชน์',
    clause2Label: 'ความรับผิดชอบของผู้เช่า',
    clause3Label: 'สิทธิซื้อเมื่อสิ้นสุดสัญญา',
    
    // Signature
    yourSincerely: 'ขอแสดงความนับถืออย่างสูง',
    signatureName: 'ปนัดดา เก่งเกรียงไกร',
    signatureRole: 'ผู้ช่วยรองผู้อำนวยการฝ่ายบริหารงานสินเชื่อรถยนต์',
    signatureConfirm: 'การลงนามในเอกสารฉบับนี้ถือว่าผู้เช่าได้ยืนยันการสั่งซื้อ\nและยอมรับเงื่อนไขทั้งหมดที่ระบุไว้แล้ว',
    customer: 'ลูกค้า',
    date: 'วันที่',
  },
  
  EN: {
    companyName: 'THAI ORIX LEASING CO., LTD.',
    docType: 'QUOTATION',
    subType: 'Leasing',
    
    headOffice: 'Head Office',
    headAddr1: '555 Rasa Tower2, Unit 1801 18th, 19th Floor',
    headAddr2: 'Paholyothin Rd. Chatuchak Bangkok 10900',
    headTel: 'Tel. 02-792-4500  Fax. 02-792-4501',
    
    easternBranch: 'Eastern Branch',
    easternAddr1: 'Amata Nakorn Industrial Estate 700/17 Moo 1,',
    easternAddr2: 'Tambol Klongtamru, Amphur Muang, Chonburi 20000',
    easternTel: 'Tel. 0-3845-7580  Fax. 0-3845-7582',
    
    toLabel: 'To :',
    fromLabel: 'From :',
    quotationNoLabel: 'Quotation No :',
    issueDateLabel: 'Issue Date :',
    expirationDateLabel: 'Expiration Date :',
    
    intro: 'Thank you for your trust in our service. We are pleased to offer the following prices for our service.',
    
    col: {
      no: 'No.',
      asset: 'Asset',
      listPrice: 'List Price<br/>(Incl. VAT)',
      deposit: 'Deposit<br/>(Incl. VAT)',
      term: 'Term<br/>(Month)',
      paymentEx: 'Monthly Payment<br/>(Excl. VAT)',
      vat: 'VAT',
      paymentInc: 'Monthly Payment<br/>(Incl. VAT)',
      purchasePrice: 'Purchase Price<br/>(Incl. VAT)',
      qty: 'Qty',
      color: 'Color',
    },
    
    interestRateType: 'Interest Rate Type',
    frequency: 'Frequency',
    paymentMethod: 'Payment Method',
    endOfContract: 'End of Contract',
    guarantor: 'Guarantor',
    
    monthly: 'Monthly',
    ownership: 'Ownership is transferred to lessee',
    
    subject: '* Subject to credit approval',
    
    termsLabel: 'Terms:',
    detailsLabel: 'Details of Condition:',
    
    terms: [
      'This quotation subjects to credit approval at our sole discretion.',
      'If you cancel your order after signing this document for any reason, you shall be responsible for the total vehicle purchase price.',
    ],
    
    clause1Title: 'Vehicle Purchase Price',
    clause2: '&#8226; The monthly lease rent doesn\'t include the 1st insurance, Compulsory Insurance, Tax Fee and registration Fee.<br/>&#8226; Lessee shall to be responsible for the 1st insurance, Compulsory Insurance and Tax Fee all contracts and the beneficially has to be Thai ORIX Leasing Co., Ltd.',
    clause2Label: 'Lessee Responsibilities',
    clause3Label: 'Purchase Option',
    
    yourSincerely: 'Your Sincerely,',
    signatureName: 'PANUTDA KENGKRIENGKRAI',
    signatureRole: 'Assistant Vice President',
    signatureConfirm: 'By signing this document, you have confirmed your order,\nand have read and accepted all terms and conditions in this document.',
    customer: 'Customer',
    date: 'Date',
  }
};

/**
 * Payment methods
 */
export const PAYMENT_METHODS = {
  transfer: { EN: 'Bank Transfer', TH: 'โอนเงินผ่านธนาคาร' },
  cheque_all: { EN: 'Post Date Cheque – All Contract', TH: 'เช็คลงวันที่ล่วงหน้าตลอดอายุสัญญา' },
  cheque_12: { EN: 'Post Date Cheque – 12M Roll Over', TH: 'เช็คลงวันที่ล่วงหน้า (ต่ออายุทุก 12 เดือน)' },
};

/**
 * Guarantor types
 */
export const GUARANTOR_TYPES = {
  none: { EN: '-', TH: '-' },
  personal: { EN: 'Personal (Director)', TH: 'บุคคลธรรมดา (กรรมการบริษัท)' },
  corporate: { EN: 'Corporate Guarantee', TH: 'ค้ำประกันโดยนิติบุคคล' },
};
