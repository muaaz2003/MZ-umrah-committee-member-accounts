import React, { useState } from 'react';
import {
  HandCoins,
  Search,
  Filter,
  Calendar,
  CreditCard,
  Printer,
  Receipt as ReceiptIcon,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { Payment, Receipt, PaymentMethod } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface QistWasooliPageProps {
  payments: Payment[];
  receipts: Receipt[];
  onOpenQistWasool: () => void;
  onOpenReceipt: (receipt: Receipt) => void;
}

export const QistWasooliPage: React.FC<QistWasooliPageProps> = ({
  payments,
  receipts,
  onOpenQistWasool,
  onOpenReceipt,
}) => {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const filtered = payments.filter((p) => {
    // Payment method filter
    if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;

    // Date filter
    if (dateFilter === 'today') {
      if (p.paymentDate !== todayStr) return false;
    } else if (dateFilter === 'yesterday') {
      if (p.paymentDate !== yesterday) return false;
    } else if (dateFilter === 'month') {
      const currentMonth = todayStr.substring(0, 7);
      if (!p.paymentDate.startsWith(currentMonth)) return false;
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        p.memberName.toLowerCase().includes(q) ||
        p.memberNumber.toLowerCase().includes(q) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Aggregated Stats
  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);
  const cashAmount = filtered.filter((p) => p.paymentMethod === 'Cash').reduce((sum, p) => sum + p.amount, 0);
  const easyPaisaAmount = filtered.filter((p) => p.paymentMethod === 'EasyPaisa').reduce((sum, p) => sum + p.amount, 0);
  const jazzCashAmount = filtered.filter((p) => p.paymentMethod === 'JazzCash').reduce((sum, p) => sum + p.amount, 0);
  const otherAmount = filtered.filter((p) => p.paymentMethod === 'Other').reduce((sum, p) => sum + p.amount, 0);
  const count = filtered.length;
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

  return (
    <div className="space-y-6 sm:space-y-7 pb-8">
      {/* Page Header with improved padding & margins */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold shadow-xs">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                قسط وصولی رجسٹر (Qist Wasooli Ledger)
              </h1>
              <p className="text-xs text-slate-500">
                Track and audit all physical monthly installment collections (Cash, EasyPaisa, JazzCash).
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onOpenQistWasool}
          className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
        >
          <HandCoins className="w-4 h-4" />
          <span>قسط وصول کریں (Qist Wasool Karein)</span>
        </button>
      </div>

      {/* Summary Statistics Breakdown with improved padding */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Collection
          </span>
          <span className="text-lg sm:text-xl font-black text-emerald-900 my-1 block">
            {formatPKR(totalAmount)}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">{count} transactions</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Cash Collection
          </span>
          <span className="text-lg sm:text-xl font-black text-slate-900 my-1 block">
            {formatPKR(cashAmount)}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">Physical Counter</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            EasyPaisa
          </span>
          <span className="text-lg sm:text-xl font-black text-emerald-800 my-1 block">
            {formatPKR(easyPaisaAmount)}
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold">Manual Slip / TID</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
            JazzCash
          </span>
          <span className="text-lg sm:text-xl font-black text-amber-900 my-1 block">
            {formatPKR(jazzCashAmount)}
          </span>
          <span className="text-[10px] text-amber-700 font-semibold">Manual Slip / TID</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Other Handover
          </span>
          <span className="text-lg sm:text-xl font-black text-slate-800 my-1 block">
            {formatPKR(otherAmount)}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">Direct Deposit</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Average Amount
          </span>
          <span className="text-lg sm:text-xl font-black text-slate-900 my-1 block">
            {formatPKR(avgAmount)}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">Per transaction</span>
        </div>
      </div>

      {/* Filter and Date Bar with enhanced spacing */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by member name, MZ-#..., reference TID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date tabs */}
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden p-1 bg-slate-50 text-xs font-semibold">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'all' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'today' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'yesterday' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dateFilter === 'month' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="EasyPaisa">EasyPaisa</option>
            <option value="JazzCash">JazzCash</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Collection Ledger Table with improved padding */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-4 px-5">Date</th>
              <th className="py-4 px-5">Member</th>
              <th className="py-4 px-5">Installment</th>
              <th className="py-4 px-5">Method</th>
              <th className="py-4 px-5">Reference / TID</th>
              <th className="py-4 px-5 text-right">Amount Received</th>
              <th className="py-4 px-5">Collected By</th>
              <th className="py-4 px-5 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-400">
                  No payment records found matching selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const receipt = receipts.find((r) => r.id === p.receiptId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-700">
                      {formatDateDisplay(p.paymentDate)}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-bold text-slate-900 block">{p.memberName}</span>
                      <span className="text-[10px] font-mono text-emerald-800 font-semibold">{p.memberNumber}</span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-800">
                      Qist #{p.installmentNumber}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-block ${
                        p.paymentMethod === 'Cash'
                          ? 'bg-slate-100 text-slate-800'
                          : p.paymentMethod === 'EasyPaisa'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.paymentMethod === 'JazzCash'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-500">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-black text-emerald-900 text-sm">
                      {formatPKR(p.amount)}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 text-[11px]">
                      {p.collectedBy || 'Staff'}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {receipt && (
                        <button
                          onClick={() => onOpenReceipt(receipt)}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          <ReceiptIcon className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
