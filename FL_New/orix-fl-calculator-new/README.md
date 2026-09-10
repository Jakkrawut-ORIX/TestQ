# ORIX Financial Lease Calculator

เปิดผ่าน web server หรือ GitHub Pages ไม่ควรเปิดด้วย `file://` เพราะใช้ ES Modules

## สูตรหลัก
- Net = Gross - Discount + Option
- Finance = Net - Down
- Principal = Finance - Balloon
- Interest = Principal × Flat Rate × Years
- Monthly Raw = (Principal + Interest) / Months
- IRR ใช้ Monthly Raw Ex. VAT
- Quotation และ OWS ใช้ Monthly Rounded
- Advance = RATE type 1, Arrears = RATE type 0

## ทดสอบ
```bash
node tests/test-engine.mjs
```
