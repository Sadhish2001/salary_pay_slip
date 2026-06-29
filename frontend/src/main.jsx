import React, { useState, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { buildPayslipPdf, getPayslipBlobUrl } from './pdfGenerator.js';
import './style.css';

// ── Default sample data (same as original) ────────────────────────────────
const DEFAULT_FORM = {
  month: '', year: '',
  empNo: '', joinDate: '',
  empName: '', bankName: '',
  location: '', accountNo: '',
  gender: 'M', pan: '',
  grade: '', pfNo: '',
  department: '', uan: '',
  esicNo: '', npsNo: '',
  designation: '',
  calendarDays: '', lossOfPay: 0,
  lopReversal: 0, arrearDays: 0, daysPayable: '',
};

const DEFAULT_EARNINGS = [];



const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const EMPLOYEE_FIELDS = [
  { key: 'empNo', label: 'Emp No' },
  { key: 'joinDate', label: 'Join Date', placeholder: 'DD/MM/YYYY' },
  { key: 'empName', label: 'Employee Name' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'location', label: 'Location' },
  { key: 'accountNo', label: 'Account No' },
  { key: 'pan', label: 'PAN' },
  { key: 'grade', label: 'Grade' },
  { key: 'pfNo', label: 'PF No' },
  { key: 'department', label: 'Department' },
  { key: 'uan', label: 'UAN' },
  { key: 'esicNo', label: 'ESIC No' },
  { key: 'npsNo', label: 'NPS No' },
  { key: 'designation', label: 'Designation' },
];

// Gender is handled as a dedicated select — value stored as 'M', 'F', or 'O'
// but displayed as full words; the PDF generator uses up() so any value works.
const GENDER_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
];

const PAY_PERIOD_FIELDS = [
  { key: 'calendarDays', label: 'Calendar Days', type: 'number' },
  { key: 'lossOfPay', label: 'Loss of Pay', type: 'number' },
  { key: 'lopReversal', label: 'LOP Reversal', type: 'number' },
  { key: 'arrearDays', label: 'Arrear Days', type: 'number' },
  { key: 'daysPayable', label: 'Days Payable', type: 'number' },
];

const Icon = ({ name }) => {
  const icons = {
    user: '👤', bank: '🏦', calendar: '📅', earn: '💰',
    pdf: '📄', eye: '👁️', close: '✕', plus: '+', download: '⬇️',
  };
  return <span style={{ fontSize: 15 }}>{icons[name] || '•'}</span>;
};

// ── Earnings row ──────────────────────────────────────────────────────────
function EarningRow({ row, index, onChange, onRemove }) {
  const c = k => e => onChange(index, k, e.target.value);
  return (
    <div className="table-row earn-cols">
      <input placeholder="Name" value={row.name} onChange={c('name')} />
      <input type="number" placeholder="Current" value={row.current} onChange={c('current')} />
      <input type="number" placeholder="Arrear" value={row.arrear} onChange={c('arrear')} />
      <input type="number" placeholder="YTD" value={row.ytd} onChange={c('ytd')} />
      <button className="btn btn-danger" onClick={() => onRemove(index)} title="Remove">✕</button>
    </div>
  );
}



// ── Preview Modal ─────────────────────────────────────────────────────────
function PreviewModal({ blobUrl, onClose, onDownload, loading }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="card-icon"><Icon name="eye" /></div>
            <div>
              <div className="card-title">Payslip Preview</div>
              <div className="card-subtitle">Exact PDF output — what you see is what you get</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              id="modal-download-btn"
              className="btn btn-primary"
              onClick={onDownload}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" /> Generating…</>
                : <><Icon name="download" /> Download PDF</>}
            </button>
            <button className="btn btn-ghost modal-close-btn" onClick={onClose} title="Close">
              <Icon name="close" /> Close
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="modal-body">
          {blobUrl
            ? <iframe
              id="pdf-preview-iframe"
              src={blobUrl}
              title="Payslip PDF Preview"
              className="pdf-iframe"
            />
            : <div className="pdf-loading">
              <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <span style={{ color: 'var(--text2)', marginTop: 12 }}>Rendering preview…</span>
            </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [earnings, setEarnings] = useState(DEFAULT_EARNINGS);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [activeSection, setActive] = useState('employee');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const prevUrlRef = useRef(null);

  // ── Computed totals ───────────────────────────────────────────────
  const gross = useMemo(
    () => earnings.reduce((s, e) => s + Number(e.current || 0), 0),
    [earnings]
  );

  // LOP auto-calculation: daily rate = gross / daysPayable
  const dailyRate = useMemo(() => {
    const d = Number(form.daysPayable) || 0;
    return d > 0 ? gross / d : 0;
  }, [gross, form.daysPayable]);

  const lopAmt = useMemo(
    () => Math.round(Number(form.lossOfPay || 0) * dailyRate * 100) / 100,
    [form.lossOfPay, dailyRate]
  );
  const lopRevAmt = useMemo(
    () => Math.round(Number(form.lopReversal || 0) * dailyRate * 100) / 100,
    [form.lopReversal, dailyRate]
  );
  const netLop = lopAmt - lopRevAmt;
  // Final net pay = gross - net LOP effect
  const netPay = gross - netLop;

  // Inject auto-computed LOP lines into payslip data for PDF
  const payslipData = useCallback(() => {
    const lopDeds = [];
    if (lopAmt > 0)    lopDeds.push({ name: 'LOSS OF PAY',   current: lopAmt,    ytd: lopAmt });
    if (lopRevAmt > 0) lopDeds.push({ name: 'LOP REVERSAL',  current: -lopRevAmt, ytd: -lopRevAmt });
    return { ...form, earnings, deductions: lopDeds };
  }, [form, earnings, lopAmt, lopRevAmt]);


  // ── Handlers ───────────────────────────────────────────────────────────
  const changeForm = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const changeEarn = (i, k, v) =>
    setEarnings(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const addEarning = () => setEarnings(r => [...r, { name: '', current: 0, arrear: 0, ytd: 0 }]);
  const removeEarning = i => setEarnings(r => r.filter((_, idx) => idx !== i));

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // ── Open Preview ───────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewUrl(null);
    try {
      // Revoke old blob URL to free memory
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      const url = await getPayslipBlobUrl(payslipData());
      prevUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      showToast('❌ Preview failed: ' + err.message);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleClosePreview() {
    setPreviewOpen(false);
  }

  // ── Download PDF ───────────────────────────────────────────────────────
  async function handleDownload(e) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await buildPayslipPdf(payslipData());
      showToast('✅ PDF downloaded successfully!');
    } catch (err) {
      showToast('❌ PDF generation failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const navItems = [
    { id: 'employee', label: 'Employee Info', icon: 'user' },
    { id: 'payperiod', label: 'Pay Period', icon: 'calendar' },
    { id: 'earnings', label: 'Earnings', icon: 'earn' },
    { id: 'preview', label: 'Pay Summary', icon: 'pdf' },
  ];

  return (
    <div className="app-wrapper">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <img src="/aaha_logo.png" alt="AAHA Logo" />
          <span className="topbar-title">AAHA eCOM Solutions</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            id="preview-btn"
            type="button"
            className="btn btn-ghost"
            onClick={handlePreview}
          >
            <Icon name="eye" /> Preview Payslip
          </button>
          <button
            id="topbar-download-btn"
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" /> Generating…</>
              : <><Icon name="pdf" /> Download PDF</>}
          </button>
        </div>
      </header>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <nav className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Sections</div>
          {navItems.map(item => (
            <a
              key={item.id}
              className={`sidebar-link ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActive(item.id)}
              href={`#${item.id}`}
            >
              <span className="icon"><Icon name={item.icon} /></span>
              {item.label}
            </a>
          ))}
        </div>

        {/* Quick actions in sidebar */}
        <div className="sidebar-section" style={{ marginTop: 16 }}>
          <div className="sidebar-label">Actions</div>
          <button
            type="button"
            className="btn btn-ghost sidebar-action-btn"
            onClick={handlePreview}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }}
          >
            <Icon name="eye" /> Preview Payslip
          </button>
          <button
            type="button"
            className="btn btn-primary sidebar-action-btn"
            onClick={handleDownload}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            {loading
              ? <><span className="spinner" /> Generating…</>
              : <><Icon name="pdf" /> Download PDF</>}
          </button>
        </div>

        {/* Live net pay */}
        <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 24 }}>
          <div className="summary-item" style={{ textAlign: 'left' }}>
            <div className="summary-label">Net Pay</div>
            <div className="summary-value green" style={{ fontSize: 20 }}>
              ₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="main-content">
        <form onSubmit={handleDownload}>

          {/* Employee Info */}
          <section id="employee">
            <div className="page-header">
              <h1>Payslip Generator</h1>
              <p>Fill in employee details, add earnings, then preview or download the PDF.</p>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Icon name="user" /></div>
                <div>
                  <div className="card-title">Employee Information</div>
                  <div className="card-subtitle">Personal & employment details</div>
                </div>
              </div>
              <div className="form-grid">
                {EMPLOYEE_FIELDS.slice(0, 6).map(({ key, label, placeholder }) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <input
                      id={key} name={key}
                      value={form[key]} onChange={changeForm}
                      placeholder={placeholder || label}
                    />
                  </div>
                ))}

                {/* Gender dropdown */}
                <div className="field">
                  <label htmlFor="gender">Gender</label>
                  <select id="gender" name="gender" value={form.gender} onChange={changeForm}>
                    {GENDER_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {EMPLOYEE_FIELDS.slice(6).map(({ key, label, placeholder }) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <input
                      id={key} name={key}
                      value={form[key]} onChange={changeForm}
                      placeholder={placeholder || label}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pay Period */}
          <section id="payperiod">
            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Icon name="calendar" /></div>
                <div>
                  <div className="card-title">Pay Period</div>
                  <div className="card-subtitle">Month, year and attendance details</div>
                </div>
              </div>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label htmlFor="month">Month</label>
                  <select id="month" name="month" value={form.month} onChange={changeForm}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="year">Year</label>
                  <input id="year" name="year" type="number" value={form.year} onChange={changeForm} />
                </div>
              </div>
              <div className="form-grid">
                {PAY_PERIOD_FIELDS.map(({ key, label, type }) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <input id={key} name={key} type={type || 'text'} value={form[key]} onChange={changeForm} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Earnings & Deductions */}
          <section id="earnings">
            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Icon name="earn" /></div>
                <div>
                  <div className="card-title">Earnings</div>
                  <div className="card-subtitle">Add all earning components</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <button type="button" className="btn btn-add" onClick={addEarning}>+ Add Earning</button>
              </div>
              <div className="table-head earn-cols">
                <span>Name</span><span>Current</span><span>Arrear</span><span>YTD</span><span></span>
              </div>
              {earnings.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 12, padding: '14px 0', textAlign: 'center' }}>
                  No earnings added. Click "+ Add Earning".
                </div>
              )}
              {earnings.map((row, i) => (
                <EarningRow key={i} row={row} index={i} onChange={changeEarn} onRemove={removeEarning} />
              ))}
            </div>
          </section>




          {/* Pay Summary */}
          <section id="preview">
            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Icon name="eye" /></div>
                <div>
                  <div className="card-title">Pay Summary</div>
                  <div className="card-subtitle">Live calculation · click Preview to see the exact PDF</div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePreview}
                  style={{ marginLeft: 'auto' }}
                >
                  <Icon name="eye" /> Preview Payslip
                </button>
              </div>

              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
                Employee: <strong style={{ color: 'var(--text)' }}>{form.empName || '—'}</strong>
                &nbsp;·&nbsp;
                Period: <strong style={{ color: 'var(--text)' }}>{form.month} {form.year}</strong>
                &nbsp;·&nbsp;
                Emp No: <strong style={{ color: 'var(--text)' }}>{form.empNo || '—'}</strong>
              </div>

              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-label">Gross Earnings</div>
                  <div className="summary-value green">
                    ₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Net Pay</div>
                  <div className="summary-value blue">
                    ₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* LOP auto-calculation breakdown */}
              {(lopAmt > 0 || lopRevAmt > 0) && (
                <>
                  <div className="divider" />
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>LOP Calculation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 6 }}>
                      <span style={{ color: 'var(--text2)' }}>Daily Rate (Gross ÷ Days Payable)</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>₹{dailyRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {lopAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text2)' }}>Loss of Pay ({form.lossOfPay} day{Number(form.lossOfPay) !== 1 ? 's' : ''})</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--red)' }}>−₹{lopAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {lopRevAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text2)' }}>LOP Reversal ({form.lopReversal} day{Number(form.lopReversal) !== 1 ? 's' : ''})</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>+₹{lopRevAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', background: 'rgba(79,125,243,.08)', border: '1px solid rgba(79,125,243,.2)', borderRadius: 6 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>Net LOP Deduction</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>₹{netLop.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </>
              )}

              {earnings.filter(e => e.name).length > 0 && (
                <>
                  <div className="divider" />
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Earnings Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {earnings.filter(e => e.name).map((e, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text2)' }}>{e.name.toUpperCase()}</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>₹{Number(e.current).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}


            </div>
          </section>

          {/* Generate bar */}
          <div className="generate-bar">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handlePreview}
              style={{ fontSize: 14, padding: '13px 24px' }}
            >
              <Icon name="eye" /> Preview Payslip
            </button>
            <button
              id="generate-pdf-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ fontSize: 14, padding: '13px 28px' }}
            >
              {loading
                ? <><span className="spinner" /> Generating PDF…</>
                : <><Icon name="pdf" /> Download PDF</>}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              No server required · runs 100% in your browser
            </span>
          </div>
        </form>
      </main>

      {/* ── Preview Modal ────────────────────────────────────────────── */}
      {previewOpen && (
        <PreviewModal
          blobUrl={previewUrl}
          loading={loading}
          onClose={handleClosePreview}
          onDownload={handleDownload}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
