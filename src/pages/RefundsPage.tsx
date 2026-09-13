import React, { useState } from 'react';
import {
  RotateCcw,
  Search,
  Plus,
  FileText,
  Printer,
  Download,
} from 'lucide-react';
import { Refund, Member } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';
import { RefundFormModal } from '../components/RefundFormModal';

interface RefundsPageProps {
  refunds: Refund[];
  members: Member[];
  currentUserEmail?: string;
  onRefresh?: () => void;
}

export const RefundsPage: React.FC<RefundsPageProps> = ({
  refunds,
  members,
  currentUserEmail = 'admin',
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedMemberForRefund, setSelectedMemberForRefund] = useState<Member | null>(null);

  const totalRefunded = refunds.reduce((sum, r) => sum + r.refundAmount, 0);

  const filtered = refunds.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const m = members.find((mem) => mem.id === r.memberId);
    return (
      (r.refundVoucherNumber && r.refundVoucherNumber.toLowerCase().includes(q)) ||
      r.reason.toLowerCase().includes(q) ||
      (m && (m.fullName.toLowerCase().includes(q) || m.memberNumber.toLowerCase().includes(q)))
    );
  });

  const handleOpenNewRefund = () => {
    setSelectedMemberForRefund(null);
    setIsRefundModalOpen(true);
  };

  const handleOpenMemberRefund = (member: Member) => {
    setSelectedMemberForRefund(member);
    setIsRefundModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-600" />
            <span>Refund Vouchers & Cancellation Register</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official record of returned contributions with full Refund Form, Wadah undertaking, and PDF export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2 rounded-xl text-xs">
            <span className="font-semibold block text-[10px] uppercase text-rose-600">Total Refunded Amount</span>
            <span className="text-base font-extrabold">{formatPKR(totalRefunded)}</span>
          </div>

          <button
            onClick={handleOpenNewRefund}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>فارم واپسی رقم (Refund Form)</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by voucher #, member name, membership #..."
          className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-rose-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Voucher #</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Qist / Description</th>
              <th className="py-3 px-4 text-right">Refund Amount</th>
              <th className="py-3 px-4">Approved By</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No refund records found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const member = members.find((m) => m.id === r.memberId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-rose-900">
                      {r.refundVoucherNumber || r.id.substring(0, 10)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatDateDisplay(r.refundDate)}
                    </td>
                    <td className="py-3 px-4">
                      {member ? (
                        <div>
                          <span className="font-bold text-slate-900 block">{member.fullName}</span>
                          <span className="text-[10px] font-mono text-emerald-800">{member.memberNumber}</span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900 block">{r.memberName || 'Member'}</span>
                          <span className="text-[10px] text-slate-400">ID: {r.memberId}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {r.installmentsDescription || r.reason}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-800 text-sm">
                      {formatPKR(r.refundAmount)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.approvedBy}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          if (member) {
                            handleOpenMemberRefund(member);
                          } else {
                            setIsRefundModalOpen(true);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>PDF Form</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Official Refund Form Modal */}
      <RefundFormModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        member={selectedMemberForRefund}
        currentUserEmail={currentUserEmail}
        onRefundSuccess={() => {
          setIsRefundModalOpen(false);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
