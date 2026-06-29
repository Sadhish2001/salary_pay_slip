import { jsPDF } from 'jspdf';

// ── helpers ──────────────────────────────────────────────────────────────────
const money = n => Number(n || 0).toFixed(2);
const up = v => (v ?? '').toString().toUpperCase();
const genderLabel = v => ({ M: 'MALE', F: 'FEMALE', O: 'OTHER' }[v] ?? up(v));

function amountWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(num) {
    if (num === 0) return 'Zero';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  }
  return `(RUPEES ${convert(Math.round(Number(n || 0))).toUpperCase()} ONLY)`;
}

// ── Load logo as base64 from public folder ────────────────────────────────────
async function loadLogoBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── hline / vline ─────────────────────────────────────────────────────────────
function hline(doc, y, x1, x2) {
  doc.setDrawColor(0).setLineWidth(0.5).line(x1, y, x2, y);
}
function vline(doc, x, y1, y2) {
  doc.setDrawColor(0).setLineWidth(0.5).line(x, y1, x, y2);
}

// ── Main PDF builder ──────────────────────────────────────────────────────────
// ── Internal core builder — returns a jsPDF doc instance ────────────────────
async function _buildDoc(p) {
  // A4 = 210 × 297 mm  but jsPDF uses pt by default in 'pt' unit
  // We'll work in points to match pdfkit (595.28 × 841.89)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // ── Layout constants (identical to backend pdfGenerator.js) ──────────────
  const LEFT   = 36;
  const RIGHT  = 559;
  const TOP    = 36;
  const BOTTOM = 805;
  const W      = RIGHT - LEFT;   // 523
  const TXT_L  = LEFT + 10;      // 46
  const TXT_R  = RIGHT - 10;     // 549

  // Column x positions
  const C_EARN_NAME  = TXT_L;
  const C_CURR_MONTH = TXT_L + 175;
  const C_ARREAR     = TXT_L + 238;
  const C_YTD        = TXT_L + 293;
  const C_DIVIDER    = TXT_L + 340;
  const C_DED_NAME   = TXT_L + 348;
  const C_DED_CURR   = TXT_L + 428;
  const C_DED_YTD    = TXT_L + 470;

  // ── Outer border ──────────────────────────────────────────────────────────
  doc.setDrawColor(0).setLineWidth(0.8).rect(LEFT, TOP, W, BOTTOM - TOP, 'S');

  let y = TOP + 1;

  // ── Header: Logo (left) + Company name (centered) ────────────────────────
  const LOGO_W = 80;
  const LOGO_H = Math.round(180 / 2.333); // ≈ 77 pt → keep tight like backend

  const logoBase64 = await loadLogoBase64('/aaha_logo.png');
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', TXT_L, y, LOGO_W, LOGO_H);
  }

  // Company name centered
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(45, 45, 45);
  const TEXT_Y = y + Math.round((LOGO_H - 16) / 2);
  doc.text('AAHA eCOM Solutions', LEFT + W / 2, TEXT_Y + 12, { align: 'center' });

  y += LOGO_H + 2;

  // Payslip subtitle
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(45, 45, 45);
  doc.text(`PAYSLIP FOR THE MONTH OF ${up(p.month)} ${p.year}`, TXT_L, y);
  y += 10;

  hline(doc, y, LEFT, RIGHT); y += 8;

  // ── Employee Details ──────────────────────────────────────────────────────
  const rightColX = LEFT + 310;
  doc.setFontSize(7).setTextColor(0, 0, 0);

  const detailRow = (l1, v1, l2, v2) => {
    doc.setFont('courier', 'bold').text(l1, TXT_L, y);
    doc.setFont('courier', 'normal').text(String(v1 || ''), TXT_L + 78, y);
    if (l2) {
      doc.setFont('courier', 'bold').text(l2, rightColX, y);
      doc.setFont('courier', 'normal').text(String(v2 || ''), rightColX + 74, y);
    }
    y += 9;
  };

  detailRow('EMP NO    :', p.empNo || p.emp_no, 'JOIN DATE :', p.joinDate || p.join_date);
  detailRow('EMP NAME  :', up(p.empName || p.emp_name), 'BANK NAME :', up(p.bankName || p.bank_name));
  detailRow('LOCATION  :', up(p.location), 'A/C NO    :', p.accountNo || p.account_no);
  detailRow('GENDER    :', genderLabel(p.gender), 'EMP PAN   :', up(p.pan));
  detailRow('GRADE     :', up(p.grade), 'PF NO     :', p.pfNo || p.pf_no || '');
  detailRow('DEPARTMENT:', up(p.department), 'UAN       :', p.uan || '');
  detailRow('ESIC NO   :', up(p.esicNo || p.esic_no), 'NPS_NO    :', p.npsNo || p.nps_no || '');

  // Designation (single row)
  doc.setFont('courier', 'bold').text('DESIGNATION:', TXT_L, y);
  doc.setFont('courier', 'normal').text(up(p.designation), TXT_L + 78, y);
  y += 11;

  hline(doc, y, LEFT, RIGHT); y += 7;

  // ── Earnings / Deductions Table Header ────────────────────────────────────
  doc.setFont('courier', 'bold').setFontSize(7);
  doc.text('EARNINGS', C_EARN_NAME, y);
  doc.text('CURRENT MONTH', C_CURR_MONTH, y);
  doc.text('ARREAR(+/-)', C_ARREAR, y);
  doc.text('YTD', C_YTD, y);
  doc.text('DEDUCTIONS', C_DED_NAME, y);
  doc.text('CURRENT MONTH', C_DED_CURR, y);
  doc.text('YTD', C_DED_YTD, y);
  y += 8;
  hline(doc, y, LEFT, RIGHT); y += 7;

  // ── Earnings / Deductions Rows ────────────────────────────────────────────
  const earnings   = p.earnings   || [];
  const deductions = p.deductions || [];
  const maxRows    = Math.max(earnings.length, deductions.length, 2);

  doc.setFont('courier', 'normal').setFontSize(7);
  const tableStartY = y;

  for (let i = 0; i < maxRows; i++) {
    const e = earnings[i]   || {};
    const d = deductions[i] || {};

    if (e.name) {
      doc.text(up(e.name), C_EARN_NAME, y);
      doc.text(money(e.current), C_CURR_MONTH + 48, y, { align: 'right' });
      doc.text(money(e.arrear),  C_ARREAR + 43, y, { align: 'right' });
      doc.text(money(e.ytd),     C_YTD + 38, y, { align: 'right' });
    }
    if (d.name) {
      doc.text(up(d.name), C_DED_NAME, y);
      doc.text(money(d.current), C_DED_CURR + 36, y, { align: 'right' });
      doc.text(money(d.ytd),     TXT_R, y, { align: 'right' });
    }
    y += 9;
  }

  const tableEndY = y;
  vline(doc, C_DIVIDER, tableStartY - 7, tableEndY + 3);

  y += 3;
  hline(doc, y, LEFT, RIGHT); y += 7;

  // ── Gross Earnings / Total Deductions row ────────────────────────────────
  const gross          = Number(p.grossEarnings || 0);
  const totalDeductions = Number(p.totalDeductions || 0);
  const netPay         = Number(p.netPay || 0);
  const grossYtd       = Number(p.grossYtd || 0);

  doc.setFont('courier', 'bold').setFontSize(7);
  doc.text('GROSS EARNINGS', C_EARN_NAME, y);
  doc.text(money(gross), C_CURR_MONTH + 48, y, { align: 'right' });
  doc.text('0.00', C_ARREAR + 43, y, { align: 'right' });
  doc.text(money(grossYtd), C_YTD + 38, y, { align: 'right' });

  vline(doc, C_DIVIDER, y - 7, y + 10);

  doc.text('TOTAL DEDUCTIONS', C_DED_NAME, y);
  doc.text(money(totalDeductions), C_DED_CURR + 36, y, { align: 'right' });

  y += 10;
  hline(doc, y, LEFT, RIGHT); y += 7;

  // ── Net Pay ───────────────────────────────────────────────────────────────
  doc.setFont('courier', 'bold').setFontSize(7);
  doc.text('NET PAY', TXT_L, y);
  doc.text(money(netPay), TXT_L + 80, y);

  y += 10;
  hline(doc, y, LEFT, RIGHT); y += 8;

  // ── Amount in words ───────────────────────────────────────────────────────
  doc.setFont('courier', 'normal').setFontSize(7);
  const words = amountWords(netPay);
  doc.text(words, TXT_L, y, { maxWidth: TXT_R - TXT_L });
  y += 10;
  hline(doc, y, LEFT, RIGHT); y += 16;

  // ── Calendar Days Table ───────────────────────────────────────────────────
  hline(doc, y, LEFT, RIGHT); y += 7;

  const calHeaders = [
    { label: 'CALENDAR DAYS', x: TXT_L },
    { label: 'LOSS OF PAY',   x: TXT_L + 105 },
    { label: 'LOP REVERSAL',  x: TXT_L + 200 },
    { label: 'ARREAR DAYS',   x: TXT_L + 300 },
    { label: 'DAYS PAYABLE',  x: TXT_L + 395 },
  ];

  doc.setFont('courier', 'bold').setFontSize(7);
  calHeaders.forEach(h => doc.text(h.label, h.x, y));
  [TXT_L + 97, TXT_L + 192, TXT_L + 292, TXT_L + 387].forEach(px => doc.text('|', px, y));

  y += 8;
  hline(doc, y, LEFT, RIGHT); y += 7;

  const calValues = [
    { val: money(p.calendarDays || p.calendar_days), x: TXT_L + 10 },
    { val: money(p.lossOfPay   || p.loss_of_pay),   x: TXT_L + 120 },
    { val: money(p.lopReversal || p.lop_reversal),   x: TXT_L + 215 },
    { val: money(p.arrearDays  || p.arrear_days),    x: TXT_L + 315 },
    { val: money(p.daysPayable || p.days_payable),   x: TXT_L + 410 },
  ];

  doc.setFont('courier', 'normal').setFontSize(7);
  calValues.forEach(v => doc.text(v.val, v.x, y));
  [TXT_L + 97, TXT_L + 192, TXT_L + 292, TXT_L + 387].forEach(px => doc.text('|', px, y));

  y += 9;
  hline(doc, y, LEFT, RIGHT); y += 16;



  // ── Footer Notes ──────────────────────────────────────────────────────────
  doc.setFont('courier', 'normal').setFontSize(6.5).setTextColor(0);
  doc.text(
    '*Component mentioned in Payslip are subject to Audit. Rectification, if any, would be carried out and difference payable/recoverable would be effected subsequently.',
    TXT_L, y,
    { maxWidth: TXT_R - TXT_L }
  );
  y += 14;
  doc.text(
    '*This is a computer generated Payslip and does not require signature.',
    TXT_L, y,
    { maxWidth: TXT_R - TXT_L }
  );

  return doc;
}

// ── Download PDF ─────────────────────────────────────────────────────────────
export async function buildPayslipPdf(p) {
  const doc = await _buildDoc(p);
  const fname = `aaha-payslip-${p.empNo || p.emp_no}-${p.month}-${p.year}.pdf`;
  doc.save(fname);
}

// ── Return a blob URL (for iframe preview) ────────────────────────────────────
export async function getPayslipBlobUrl(p) {
  const doc = await _buildDoc(p);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
