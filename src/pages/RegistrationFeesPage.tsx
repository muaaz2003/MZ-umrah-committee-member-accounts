import React, { useState } from 'react';
import {
  BadgeDollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Member } from '../types';
import { formatPKR } from '../utils/calculations';
import { updateMemberRegistrationFeeStatus } from '../services/firebaseService';

interface RegistrationFeesPageProps {
  members: Member[];
  onRefresh: () => void;
}

export const RegistrationFeesPage: React.FC<RegistrationFeesPageProps> = ({
  members,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'Paid' | 'Unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalMembers = members.length;
  const paidCount = members.filter((m) => m.registrationFeeStatus === 'Paid').length;
  const unpaidCount = totalMembers - paidCount;
  const totalCollected = members
    .filter((m) => m.registrationFeeStatus === 'Paid')
    .reduce((sum, m) => sum + (m.registrationFee || 1000), 0);

  const filtered = members.filter((m) => {
    if (filter !== 'all' && m.registrationFeeStatus !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.mobile.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleToggleStatus = async (member: Member) => {
    const nextStatus = member.registrationFeeStatus === 'Paid' ? 'Unpaid' : 'Paid';
    try {
      setUpdatingId(member.id);
      await updateMemberRegistrationFeeStatus(member.id, nextStatus);
      onRefresh();
    } catch (err) {
      console.error('Error toggling registration fee:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-emerald-800" />
            <span>Registration Fees Ledger (Separate Accounting)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            One-time Rs. 1,000 joining administrative fee, kept strictly distinct from monthly committee installment capital.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-xl text-xs">
            <span className="font-semibold block text-[10px] uppercase text-emerald-700">Total Fees Collected</span>
            <span className="text-base font-extrabold">{formatPKR(totalCollected)}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Members</span>
          <div className="text-xl font-black text-slate-900 mt-1">{totalMembers}</div>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
          <span className="text-xs font-bold text-emerald-800 uppercase">Paid Registration</span>
          <div className="text-xl font-black text-emerald-900 mt-1">{paidCount}</div>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
          <span className="text-xs font-bold text-amber-800 uppercase">Pending / Unpaid</span>
          <div className="text-xl font-black text-amber-900 mt-1">{unpaidCount}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search member name, MZ-#..., mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg border ${
              filter === 'all' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            All ({totalMembers})
          </button>
          <button
            onClick={() => setFilter('Paid')}
            className={`px-3 py-1.5 rounded-lg border ${
              filter === 'Paid' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Paid ({paidCount})
          </button>
          <button
            onClick={() => setFilter('Unpaid')}
            className={`px-3 py-1.5 rounded-lg border ${
              filter === 'Unpaid' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Unpaid ({unpaidCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Member #</th>
              <th className="py-3 px-4">Full Name</th>
              <th className="py-3 px-4">Mobile</th>
              <th className="py-3 px-4">Plan</th>
              <th className="py-3 px-4 text-right">Fee Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Toggle Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                  {m.memberNumber}
                </td>
                <td className="py-3 px-4 font-bold text-slate-900">
                  {m.fullName}
                </td>
                <td className="py-3 px-4 text-slate-600 font-mono">
                  {m.mobile}
                </td>
                <td className="py-3 px-4 text-slate-700">
                  {m.planMonths} Months
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">
                  Rs. {m.registrationFee || 1000}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    m.registrationFeeStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {m.registrationFeeStatus}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    disabled={updatingId === m.id}
                    onClick={() => handleToggleStatus(m)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 transition-colors"
                  >
                    {updatingId === m.id ? 'Updating...' : `Mark as ${m.registrationFeeStatus === 'Paid' ? 'Unpaid' : 'Paid'}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
