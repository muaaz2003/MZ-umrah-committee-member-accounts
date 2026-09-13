import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  Phone,
  MapPin,
  CreditCard,
  Receipt as ReceiptIcon,
  Printer,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Member, Installment, Receipt } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';
import { getMemberInstallments, getMemberReceipts } from '../services/firebaseService';

interface MemberPortalPageProps {
  member: Member;
  onOpenReceipt: (receipt: Receipt) => void;
  onLogoutToAdmin: () => void;
}

export const MemberPortalPage: React.FC<MemberPortalPageProps> = ({
  member,
  onOpenReceipt,
  onLogoutToAdmin,
}) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [insts, recs] = await Promise.all([
          getMemberInstallments(member.id),
          getMemberReceipts(member.id),
        ]);
        setInstallments(insts);
        setReceipts(recs);
      } catch (err) {
        console.error('Error loading member portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [member.id]);

  const progressPercent = member.totalCommitteeAmount > 0
    ? Math.min(100, Math.round((member.paidAmount / member.totalCommitteeAmount) * 1000) / 10)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Notice for Member Security */}
      <div className="bg-emerald-900 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>
            Logged in as Member: <strong>{member.fullName}</strong> ({member.memberNumber}) • Restricted to Personal Ledger
          </span>
        </div>
        <button
          onClick={onLogoutToAdmin}
          className="text-amber-300 hover:text-white font-bold underline"
        >
          Exit Member Portal
        </button>
      </div>

      {/* Member Profile Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-amber-400 text-emerald-950 font-mono font-black text-sm rounded-md">
                  {member.memberNumber}
                </span>
                <span className="text-xs px-2.5 py-1 bg-emerald-800 text-emerald-200 rounded-md">
                  {member.planMonths} Months Umrah Committee
                </span>
              </div>
              <h1 className="text-2xl font-black text-white">{member.fullName}</h1>
              <p className="text-xs text-emerald-200 mt-0.5">
                Father: {member.fatherName || '—'} • CNIC: {member.cnic || '—'}
              </p>
            </div>

            <div className="text-xs text-emerald-100 space-y-1 sm:text-right">
              <div className="flex items-center sm:justify-end gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>{member.mobile}</span>
              </div>
              <div className="flex items-center sm:justify-end gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Joined: {formatDateDisplay(member.joiningDate)}</span>
              </div>
              <div className="flex items-center sm:justify-end gap-1.5 text-emerald-200">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{member.address || 'Karachi, Pakistan'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Stat Strip */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Committee Amount
              </span>
              <span className="text-base font-black text-slate-900">
                {formatPKR(member.totalCommitteeAmount)}
              </span>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Total Paid Amount
              </span>
              <span className="text-base font-black text-emerald-800">
                {formatPKR(member.paidAmount)}
              </span>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Remaining Due Amount
              </span>
              <span className="text-base font-black text-amber-900">
                {formatPKR(member.dueAmount)}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Monthly Installment
              </span>
              <span className="text-base font-black text-slate-800">
                {formatPKR(member.monthlyInstallment)} / Month
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-600">Committee Installment Completion</span>
              <span className="font-extrabold text-emerald-800">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Installment Schedule & Receipts */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-800" />
              <span>Personal Installment Schedule ({installments.length} Months)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Qist #</th>
                    <th className="py-2.5 px-3">Fixed Due Date</th>
                    <th className="py-2.5 px-3 text-right">Standard Amount</th>
                    <th className="py-2.5 px-3">Paid Date</th>
                    <th className="py-2.5 px-3 text-right">Paid Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {installments.map((inst) => {
                    const receipt = receipts.find((r) => r.installmentNumber === inst.installmentNumber);
                    return (
                      <tr key={inst.id} className={inst.status === 'Paid' ? 'bg-emerald-50/20' : ''}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          Qist #{inst.installmentNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {formatDateDisplay(inst.dueDate)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {formatPKR(inst.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {inst.paidDate ? formatDateDisplay(inst.paidDate) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-800">
                          {inst.paidAmount > 0 ? formatPKR(inst.paidAmount) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inst.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inst.status === 'Partial'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {inst.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {receipt ? (
                            <button
                              onClick={() => onOpenReceipt(receipt)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"
                            >
                              <ReceiptIcon className="w-3 h-3" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
