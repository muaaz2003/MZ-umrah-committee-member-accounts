import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  PieChart,
  Calendar,
  CreditCard,
  Users,
} from 'lucide-react';
import { Member, Payment, FinancialSummary, Installment } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface ReportsPageProps {
  members: Member[];
  payments: Payment[];
  summary: FinancialSummary;
  installments: Installment[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  members,
  payments,
  summary,
  installments,
}) => {
  const [selectedReport, setSelectedReport] = useState<
    'collection' | 'members' | 'due' | 'plans' | 'methods'
  >('collection');

  // Plan A vs Plan B
  const plan24Members = members.filter((m) => m.planMonths === 24);
  const plan36Members = members.filter((m) => m.planMonths === 36);

  const plan24Total = plan24Members.reduce((sum, m) => sum + m.totalCommitteeAmount, 0);
  const plan24Paid = plan24Members.reduce((sum, m) => sum + m.paidAmount, 0);
  const plan24Due = plan24Members.reduce((sum, m) => sum + m.dueAmount, 0);

  const plan36Total = plan36Members.reduce((sum, m) => sum + m.totalCommitteeAmount, 0);
  const plan36Paid = plan36Members.reduce((sum, m) => sum + m.paidAmount, 0);
  const plan36Due = plan36Members.reduce((sum, m) => sum + m.dueAmount, 0);

  // Methods
  const cashTotal = payments.filter((p) => p.paymentMethod === 'Cash').reduce((s, p) => s + p.amount, 0);
  const epTotal = payments.filter((p) => p.paymentMethod === 'EasyPaisa').reduce((s, p) => s + p.amount, 0);
  const jcTotal = payments.filter((p) => p.paymentMethod === 'JazzCash').reduce((s, p) => s + p.amount, 0);

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (selectedReport === 'collection') {
      csvContent += 'Receipt/Payment Date,Member Name,Membership No,Installment No,Amount Received,Payment Method,Reference TID,Collected By\n';
      payments.forEach((p) => {
        csvContent += `"${p.paymentDate}","${p.memberName}","${p.memberNumber}","${p.installmentNumber}","${p.amount}","${p.paymentMethod}","${p.referenceNumber || ''}","${p.collectedBy || ''}"\n`;
      });
    } else {
      csvContent += 'Membership No,Full Name,Father Name,Mobile,Plan Months,Total Amount,Paid Amount,Due Amount,Advance Amount,Status\n';
      members.forEach((m) => {
        csvContent += `"${m.memberNumber}","${m.fullName}","${m.fatherName}","${m.mobile}","${m.planMonths}","${m.totalCommitteeAmount}","${m.paidAmount}","${m.dueAmount}","${m.advanceAmount}","${m.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MZ_Umrah_${selectedReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-800" />
            <span>Committee Accounting Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consolidated financial auditing, collection analysis, plan comparisons, and exportable statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap gap-2 no-print border-b border-slate-200 pb-3">
        <button
          onClick={() => setSelectedReport('collection')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            selectedReport === 'collection'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Payment & Collection Report
        </button>

        <button
          onClick={() => setSelectedReport('members')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            selectedReport === 'members'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Member Ledger Summary
        </button>

        <button
          onClick={() => setSelectedReport('plans')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            selectedReport === 'plans'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Plan A (24M) vs Plan B (36M)
        </button>

        <button
          onClick={() => setSelectedReport('methods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            selectedReport === 'methods'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Payment Method Breakdown
        </button>
      </div>

      {/* Report Content */}
      {selectedReport === 'collection' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Installment Collection Audit Statement</h3>
              <p className="text-xs text-slate-500">Every manual payment recorded via "Qist Wasool Karein"</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Collected</span>
              <div className="text-lg font-black text-emerald-800">{formatPKR(summary.totalPaidAmount)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Installment</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">TID / Slip</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Collected By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatDateDisplay(p.paymentDate)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.memberName} ({p.memberNumber})</td>
                    <td className="py-2.5 px-3">Qist #{p.installmentNumber}</td>
                    <td className="py-2.5 px-3">{p.paymentMethod}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.referenceNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-800">{formatPKR(p.amount)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{p.collectedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedReport === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan A (24 Months) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-emerald-950">PLAN A: 24 Months Committee</h3>
                <p className="text-xs text-slate-500">Rs. 5,000 × 24 Months = Rs. 120,000</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-black text-xs rounded-full">
                {plan24Members.length} Members
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Plan Value:</span>
                <span className="font-extrabold text-slate-900">{formatPKR(plan24Total)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Collected (Paid):</span>
                <span className="font-extrabold text-emerald-800">{formatPKR(plan24Paid)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Remaining Due:</span>
                <span className="font-extrabold text-amber-900">{formatPKR(plan24Due)}</span>
              </div>
            </div>
          </div>

          {/* Plan B (36 Months) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-emerald-950">PLAN B: 36 Months Committee</h3>
                <p className="text-xs text-slate-500">Rs. 5,000 × 36 Months = Rs. 180,000</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-full">
                {plan36Members.length} Members
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Plan Value:</span>
                <span className="font-extrabold text-slate-900">{formatPKR(plan36Total)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Collected (Paid):</span>
                <span className="font-extrabold text-emerald-800">{formatPKR(plan36Paid)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Remaining Due:</span>
                <span className="font-extrabold text-amber-900">{formatPKR(plan36Due)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'methods' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Physical Payment Method Comparison</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Cash at Counter</span>
              <div className="text-lg font-black text-slate-900 mt-1">{formatPKR(cashTotal)}</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 uppercase">EasyPaisa Slips</span>
              <div className="text-lg font-black text-emerald-900 mt-1">{formatPKR(epTotal)}</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <span className="text-xs font-bold text-amber-800 uppercase">JazzCash Slips</span>
              <div className="text-lg font-black text-amber-900 mt-1">{formatPKR(jcTotal)}</div>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Complete Member Ledger Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-right">Due</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{m.memberNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{m.fullName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.mobile}</td>
                    <td className="py-2.5 px-3">{m.planMonths}M</td>
                    <td className="py-2.5 px-3 text-right font-bold">{formatPKR(m.totalCommitteeAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-800">{formatPKR(m.paidAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-900">{formatPKR(m.dueAmount)}</td>
                    <td className="py-2.5 px-3 text-center">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
