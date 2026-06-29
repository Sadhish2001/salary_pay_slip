# AAHA Solutions Payslip Generator

React + Node.js + MySQL project to generate a payslip PDF in the same text-table style as the uploaded sample, with the company name changed to **AAHA SOLUTIONS**.

## Setup

### 1. MySQL
```sql
SOURCE database/schema.sql;
```
Or open `database/schema.sql` in MySQL Workbench and run it.

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Edit `.env` with your MySQL password.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL, fill the employee/account/pay fields, then click **Save & Generate PDF**.

## API
- `POST /api/payslips` - save payslip data
- `GET /api/payslips` - list payslips
- `GET /api/payslips/:id/pdf` - download PDF

## Notes
The sample values are prefilled from the uploaded example so you can test immediately. Change employee name, account number, bank, PAN, earnings, deductions, etc. from the React form.
