import React, { useState } from 'react';
import {
  ClockAlert,
  AlertTriangle,
  Search,
  HandCoins,
  Calendar,
  Phone,
  User,
  Filter,
} from 'lucide-react';
import { Installment, Member } from '../types';
import { formatPKR, formatDateDisplay, isInstallmentOverdue } from '../utils/calculations';

interface DueInstallmentsPageProps {
  installments: Installment[];
  members: Member[];
  onOpenQistWasool: (member: Member, installment: Installment) => void;
  onSelectMember: (memberId: string) => void;
  onlyOverdue?: boolean;
}

export const DueInstallmentsPage: React.FC<DueInstallmentsPageProps> = ({
  installments,
  members,
  onOpenQistWasool,
  onSelectMember,
  onlyOverdue = false,
}) => {
  const [filterBucket, setFilterBucket] = useState<'all' | 'today' | '1-7' | '8-30' | '30+'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date().getTime();

  // Filter installments that are not paid
  const dueList = installments.filter((i) => {
    if (i.status === 'Paid') return false;
    if (onlyOverdue && !isInstallmentOverdue(i)) return false;

    // Days calculation
    const dueTime = new Date(i.dueDate).getTime();
    const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));

    if (filterBucket === 'today') {
      if (i.dueDate !== todayStr) return false;
    } else if (filterBucket === '1-7') {
      if (diffDays < 1 || diffDays > 7) return false;
    } else if (filterBucket === '8-30') {
      if (diffDays < 8 || diffDays > 30) return false;
    } else if (filterBucket === '30+') {
      if (diffDays <= 30) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const m = members.find((mem) => mem.id === i.memberId);
      if (!m) return false;
      const match =
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.mobile.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          {onlyOverdue ? (
            <>
              <AlertTriangle className="w-6 h-6 text-rose-600" />
              <span>Overdue Installments Tracker</span>
            </>
          ) : (
            <>
              <ClockAlert className="w-6 h-6 text-amber-600" />
              <span>Due & Pending Installments</span>
            </>
          )}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {onlyOverdue
            ? 'Members with installments past their scheduled due date. Prompt physical collection.'
            : 'Fixed monthly installment schedule (due on the 15th of each month).'}
        </p>
      </div>

      {/* Filter Tabs matching Section 7 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search due list by member name, MZ-#..., mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden p-0.5 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setFilterBucket('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterBucket === 'all' ? 'bg-white text-emerald-900 shadow-xs font-bold' : 'text-slate-500'
            }`}
          >
            All Pending
          </button>
          <button
            onClick={() => setFilterBucket('today')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterBucket === 'today' ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-slate-500'
            }`}
          >
            Due Today
          </button>
          <button
            onClick={() => setFilterBucket('1-7')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterBucket === '1-7' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-500'
            }`}
          >
            1–7 Days Late
          </button>
          <button
            onClick={() => setFilterBucket('8-30')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterBucket === '8-30' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-500'
            }`}
          >
            8–30 Days Late
          </button>
          <button
            onClick={() => setFilterBucket('30+')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterBucket === '30+' ? 'bg-white text-rose-900 shadow-xs font-extrabold' : 'text-slate-500'
            }`}
          >
            30+ Days Late
          </button>
        </div>
      </div>

      {/* Due Installments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Mobile</th>
              <th className="py-3 px-4">Installment #</th>
              <th className="py-3 px-4">Scheduled Due Date</th>
              <th className="py-3 px-4">Days Overdue</th>
              <th className="py-3 px-4 text-right">Remaining Due</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {dueList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No due or overdue installments matching criteria.
                </td>
              </tr>
            ) : (
              dueList.map((inst) => {
                const member = members.find((m) => m.id === inst.memberId);
                const dueTime = new Date(inst.dueDate).getTime();
                const daysLate = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));
                const isLate = daysLate > 0;

                return (
                  <tr
                    key={inst.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      daysLate > 30
                        ? 'bg-rose-50/40'
                        : isLate
                        ? 'bg-amber-50/20'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      {member ? (
                        <button
                          onClick={() => onSelectMember(member.id)}
                          className="text-left group"
                        >
                          <span className="font-bold text-slate-900 group-hover:text-emerald-700 block">
                            {member.fullName}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-800">
                            {member.memberNumber} ({member.planMonths}M Plan)
                          </span>
                        </button>
                      ) : (
                        <span className="font-mono text-slate-400">ID: {inst.memberId}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {member?.mobile || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      Qist #{inst.installmentNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatDateDisplay(inst.dueDate)}
                    </td>
                    <td className="py-3 px-4">
                      {daysLate > 0 ? (
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          daysLate > 30
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : daysLate > 7
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {daysLate} Days Late
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Due soon</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-amber-900 text-sm">
                      {formatPKR(inst.remainingAmount || inst.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inst.status === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : inst.status === 'Partial'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {member && (
                        <button
                          onClick={() => onOpenQistWasool(member, inst)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs mx-auto"
                        >
                          <HandCoins className="w-3.5 h-3.5 text-amber-300" />
                          <span>Qist Wasool</span>
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
