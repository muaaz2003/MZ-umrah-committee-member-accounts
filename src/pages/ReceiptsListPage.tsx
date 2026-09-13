import React, { useState } from 'react';
import {
  Receipt as ReceiptIcon,
  Search,
  Printer,
  Share2,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { Receipt } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface ReceiptsListPageProps {
  receipts: Receipt[];
  onOpenReceipt: (receipt: Receipt) => void;
  onVerifyReceipt: (receiptId: string) => void;
}

export const ReceiptsListPage: React.FC<ReceiptsListPageProps> = ({
  receipts,
  onOpenReceipt,
  onVerifyReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = receipts.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.receiptNumber.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.memberNumber.toLowerCase().includes(q) ||
      r.mobile.toLowerCase().includes(q) ||
      r.paymentMethod.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ReceiptIcon className="w-6 h-6 text-emerald-800" />
            <span>Official Umrah Committee Receipts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audited register of issued receipts with verifiable QR codes and physical transaction logs.
          </p>
        </div>

        <div className="text-xs font-bold bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200">
          Total Issued Receipts: {receipts.length}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt number (e.g. MZ-RCP-2026-0001), member name, member #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Receipt #</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Member Name</th>
              <th className="py-3 px-4">Membership #</th>
              <th className="py-3 px-4">Installment</th>
              <th className="py-3 px-4 text-right">Amount Received</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No payment receipts found matching search.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                    {r.receiptNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {formatDateDisplay(r.paymentDate)}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {r.memberName}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-800">
                    {r.memberNumber}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    Qist #{r.installmentNumber} ({r.planMonths}M Plan)
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                    {formatPKR(r.amount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {r.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>{r.verificationStatus || 'Verified'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenReceipt(r)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <ReceiptIcon className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                      <button
                        onClick={() => onVerifyReceipt(r.id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 transition-colors"
                        title="Open verification page"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Verify</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
