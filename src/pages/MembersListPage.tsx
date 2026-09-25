import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  Calendar,
  ReceiptText,
  HandCoins,
  CheckCircle2,
  Edit,
  Trash2,
} from 'lucide-react';
import { Member, UserRole } from '../types';
import { MemberCard } from '../components/MemberCard';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface MembersListPageProps {
  members: Member[];
  onOpenAddMember: () => void;
  onOpenEditMember?: (member: Member) => void;
  onOpenDeleteMember?: (member: Member) => void;
  onOpenQistWasool: (member: Member) => void;
  onSelectMember: (memberId: string) => void;
  userRole: UserRole;
  initialPlanFilter?: 24 | 36;
}

export const MembersListPage: React.FC<MembersListPageProps> = ({
  members,
  onOpenAddMember,
  onOpenEditMember,
  onOpenDeleteMember,
  onOpenQistWasool,
  onSelectMember,
  userRole,
  initialPlanFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | '24' | '36'>(
    initialPlanFilter ? (initialPlanFilter.toString() as '24' | '36') : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Completed' | 'Refunded' | 'Cancelled'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filter members
  const filtered = members.filter((m) => {
    // Plan
    if (planFilter !== 'all' && m.planMonths !== Number(planFilter)) return false;
    // Status
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.mobile.toLowerCase().includes(q) ||
        m.cnic.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#064E3B] rounded-xs"></span>
            <span>
              {planFilter === '24'
                ? '24 Month Committee Members (Rs. 120,000)'
                : planFilter === '36'
                ? '36 Month Committee Members (Rs. 180,000)'
                : 'All Committee Members'}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Total {filtered.length} member accounts registered under Umrah committee ledger.
          </p>
        </div>

        {userRole !== 'MEMBER' && userRole !== 'STAFF' && (
          <button
            onClick={onOpenAddMember}
            className="px-4 py-2.5 bg-[#064E3B] hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>Add New Member</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, MZ-#002, mobile, CNIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>

        {/* Plan Filter */}
        <div className="flex items-center gap-2">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">All Plans (24M & 36M)</option>
            <option value="24">24 Months (Plan A - 120k)</option>
            <option value="36">36 Months (Plan B - 180k)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Refunded">Refunded</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Grid vs Table View Mode */}
          <div className="hidden sm:flex items-center border border-gray-200 rounded-xl overflow-hidden p-0.5 bg-gray-50">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content: Cards or Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs">
          No members found matching your search or filter criteria.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onOpenQistWasool={() => onOpenQistWasool(member)}
              onViewProfile={() => onSelectMember(member.id)}
              onEditMember={onOpenEditMember}
              onDeleteMember={onOpenDeleteMember}
              userRole={userRole}
            />
          ))}
        </div>
      ) : (
        /* Accounting Table View */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Member #</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Due Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                    {m.memberNumber}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block">{m.fullName}</span>
                    <span className="text-[11px] text-slate-500">Father: {m.fatherName || '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono">
                    {m.mobile}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">
                      {m.planMonths} Months
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-800">
                    {formatPKR(m.totalCommitteeAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-800">
                    {formatPKR(m.paidAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-900">
                    {formatPKR(m.dueAmount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {userRole !== 'MEMBER' && m.status === 'Active' && (
                        <button
                          onClick={() => onOpenQistWasool(m)}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <HandCoins className="w-3 h-3 text-amber-300" />
                          <span>Wasool</span>
                        </button>
                      )}
                      <button
                        onClick={() => onSelectMember(m.id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        Ledger
                      </button>
                      {userRole !== 'MEMBER' && onOpenEditMember && (
                        <button
                          onClick={() => onOpenEditMember(m)}
                          className="px-2 py-1 bg-white hover:bg-emerald-50 border border-emerald-300 rounded text-[11px] font-semibold text-emerald-700 flex items-center gap-1 cursor-pointer"
                          title="Edit Member (نام وغیرہ تبدیل کریں)"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                      {userRole !== 'MEMBER' && onOpenDeleteMember && (
                        <button
                          onClick={() => onOpenDeleteMember(m)}
                          className="px-2 py-1 bg-white hover:bg-rose-50 border border-rose-300 rounded text-[11px] font-semibold text-rose-700 flex items-center gap-1 cursor-pointer"
                          title="Delete Member (حذف کریں)"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
