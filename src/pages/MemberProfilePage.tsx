import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  CreditCard,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Receipt as ReceiptIcon,
  RotateCcw,
  HandCoins,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Member, Installment, Payment, Receipt, Refund, UserRole } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';
import { getMemberInstallments, getMemberPayments, getMemberReceipts, getMemberRefunds, recordRefund } from '../services/firebaseService';
import { RefundFormModal } from '../components/RefundFormModal';

interface MemberProfilePageProps {
  member: Member;
  onBack: () => void;
  onOpenQistWasool: (member: Member, installment?: Installment) => void;
  onOpenReceipt: (receipt: Receipt) => void;
  userRole: UserRole;
  currentUserEmail: string;
  onRefreshMember: (memberId: string) => void;
}

export const MemberProfilePage: React.FC<MemberProfilePageProps> = ({
  member,
  onBack,
  onOpenQistWasool,
  onOpenReceipt,
  userRole,
  currentUserEmail,
  onRefreshMember,
}) => {
  const [activeTab, setActiveTab] = useState<'installments' | 'payments' | 'refunds' | 'nominee'>('installments');
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [instData, payData, recData, refData] = await Promise.all([
          getMemberInstallments(member.id),
          getMemberPayments(member.id),
          getMemberReceipts(member.id),
          getMemberRefunds(member.id),
        ]);
        setInstallments(instData);
        setPayments(payData);
        setReceipts(recData);
        setRefunds(refData);
      } catch (err) {
        console.error('Error loading member profile data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [member.id]);

  const progressPercent = member.totalCommitteeAmount > 0
    ? Math.min(100, Math.round((member.paidAmount / member.totalCommitteeAmount) * 1000) / 10)
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <span className="bg-green-100 text-green-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Paid</span>;
      case 'Partial':
        return <span className="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Partial</span>;
      case 'Overdue':
        return <span className="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Overdue</span>;
      case 'Advance':
        return <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Advance</span>;
      default:
        return <span className="bg-gray-100 text-gray-500 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-emerald-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Members</span>
        </button>

        {userRole !== 'MEMBER' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Ledger</span>
            </button>

            {member.status === 'Active' && userRole !== 'STAFF' && (
              <button
                onClick={() => setShowRefundModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Record Refund (فارم واپسی)</span>
              </button>
            )}

            {member.status === 'Active' && (
              <button
                onClick={() => onOpenQistWasool(member)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-emerald-950 bg-amber-500 hover:bg-amber-400 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all uppercase tracking-wider"
              >
                <HandCoins className="w-4 h-4" />
                <span>Qist Wasool Karein</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Responsive Grid with Quick Panel on Right */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Column: Member Card & Tab Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Membership Card - Exact Professional Polish Archetype */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#064E3B] p-6 text-white flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-1">
                  Membership Card
                </div>
                <h2 className="text-2xl font-bold">{member.fullName}</h2>
                <p className="text-sm text-emerald-100/70">
                  Father: {member.fatherName || '—'} • ID: {member.memberNumber}
                </p>
              </div>
              <div className="text-right">
                <div className="bg-amber-500 text-amber-950 text-[10px] font-bold px-3 py-1 rounded-full uppercase mb-2 inline-block">
                  {member.planMonths} Month Plan
                </div>
                <div className="text-2xl font-mono font-bold tracking-tighter text-white">
                  {member.memberNumber}
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Joining Date</div>
                <div className="font-medium text-sm text-gray-700">{formatDateDisplay(member.joiningDate)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Mobile Number</div>
                <div className="font-medium text-sm text-gray-700">{member.mobile}</div>
              </div>
              <div className="col-span-2 space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Address</div>
                <div className="font-medium text-sm text-gray-700 line-clamp-1">
                  {member.address || 'Flat 402, Al-Madina Heights, Block 2, Karachi.'}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Total Amount</div>
                <div className="text-lg font-bold text-emerald-800">{formatPKR(member.totalCommitteeAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Paid Amount</div>
                <div className="text-lg font-bold text-emerald-600">{formatPKR(member.paidAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Due Balance</div>
                <div className="text-lg font-bold text-amber-700">{formatPKR(member.dueAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Installments</div>
                <div className="text-lg font-bold text-gray-600">
                  {installments.filter((i) => i.status === 'Paid').length.toString().padStart(2, '0')} / {member.planMonths}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Progress</span>
                <span className="text-xs font-bold text-emerald-700">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Payment History / Tabs Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Header Tabs */}
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('installments')}
                  className={`flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                    activeTab === 'installments'
                      ? 'border-emerald-600 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <span className="w-2 h-4 bg-emerald-600 rounded-xs"></span>
                  <span>Payment History ({installments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('payments')}
                  className={`flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                    activeTab === 'payments'
                      ? 'border-emerald-600 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <ReceiptIcon className="w-4 h-4" />
                  <span>Receipts ({receipts.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('nominee')}
                  className={`flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                    activeTab === 'nominee'
                      ? 'border-emerald-600 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>کفیل / ضامن (Kafeel Info)</span>
                </button>

                {refunds.length > 0 && (
                  <button
                    onClick={() => setActiveTab('refunds')}
                    className={`flex items-center gap-2 pb-1 border-b-2 transition-colors ${
                      activeTab === 'refunds'
                        ? 'border-rose-600 text-rose-800'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Refunds ({refunds.length})</span>
                  </button>
                )}
              </div>

              <div className="text-[10px] text-gray-400 font-bold uppercase">
                {activeTab === 'installments' ? 'Monthly Schedule' : 'Official Archive'}
              </div>
            </div>

            {/* Tab 1: Installment Schedule Table */}
            {activeTab === 'installments' && (
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="p-3 rounded-l-lg">#</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Paid Date</th>
                      <th className="p-3 text-right">Paid</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right rounded-r-lg">Receipt / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {installments.map((inst) => {
                      const receipt = receipts.find((r) => r.installmentNumber === inst.installmentNumber);
                      const isToday = inst.status === 'Partial' || (inst.status === 'Unpaid' && inst.dueDate.startsWith(new Date().toISOString().slice(0, 7)));
                      return (
                        <tr
                          key={inst.id}
                          className={`group hover:bg-gray-50/60 transition-colors ${
                            isToday ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="p-3 font-medium text-gray-900">
                            {inst.installmentNumber.toString().padStart(2, '0')}
                          </td>
                          <td className={`p-3 text-gray-600 ${isToday ? 'font-bold underline underline-offset-2 decoration-amber-300' : ''}`}>
                            {formatDateDisplay(inst.dueDate)}
                          </td>
                          <td className="p-3 text-right text-gray-700 font-bold">
                            {inst.amount.toLocaleString()}
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {inst.paidDate ? formatDateDisplay(inst.paidDate) : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {inst.paidAmount > 0 ? inst.paidAmount.toLocaleString() : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {getStatusBadge(inst.status)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {receipt ? (
                                <button
                                  onClick={() => onOpenReceipt(receipt)}
                                  className="text-emerald-600 font-semibold cursor-pointer underline underline-offset-4 text-xs hover:text-emerald-700"
                                >
                                  {receipt.receiptNumber}
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded text-gray-400 uppercase font-bold cursor-not-allowed"
                                >
                                  Pending
                                </button>
                              )}

                              {userRole !== 'MEMBER' && inst.status !== 'Paid' && (
                                <button
                                  onClick={() => onOpenQistWasool(member, inst)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded text-[10px] font-bold uppercase transition-colors"
                                >
                                  Wasool
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Receipts & Payment History */}
            {activeTab === 'payments' && (
              <div className="p-6 space-y-4">
                {receipts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    No payment receipts issued yet for this member.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {receipts.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-xs text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                              {rec.receiptNumber}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {formatDateDisplay(rec.paymentDate)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 mb-1">
                            Umrah Qist #{rec.installmentNumber}
                          </div>
                          <div className="text-xs text-gray-600 flex items-center justify-between">
                            <span>Amount Paid:</span>
                            <span className="font-extrabold text-emerald-800 text-sm">{formatPKR(rec.amount)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Method: <strong className="text-gray-700">{rec.paymentMethod}</strong> (Physical)
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-mono">
                            ID: {rec.id.substring(0, 10)}...
                          </span>
                          <button
                            onClick={() => onOpenReceipt(rec)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <ReceiptIcon className="w-3.5 h-3.5" />
                            <span>View / Print Receipt</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Kafeel / Guarantor Details */}
            {activeTab === 'nominee' && (
              <div className="p-6 max-w-lg">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3 text-xs">
                  <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>کفیل / ضامن کی تفصیلات</span>
                    <span className="font-sans text-gray-400 font-normal">(Kafeel / Guarantor Information)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">کفیل کا نام (Name)</span>
                      <span className="font-bold text-gray-900 text-sm">{member.nomineeName || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">رشتہ / تعلق (Relation)</span>
                      <span className="font-bold text-gray-900 text-sm">{member.nomineeRelation || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">کفیل کا CNIC</span>
                      <span className="font-mono font-medium text-gray-800">{member.nomineeCnic || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">کفیل کا موبائل</span>
                      <span className="font-medium text-gray-800">{member.nomineeMobile || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Refund History */}
            {activeTab === 'refunds' && (
              <div className="p-6 space-y-3">
                {refunds.map((ref) => (
                  <div key={ref.id} className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-rose-900">
                      <span>Refund Voucher #{ref.refundVoucherNumber || ref.id}</span>
                      <span className="text-sm font-extrabold">{formatPKR(ref.refundAmount)}</span>
                    </div>
                    <p className="text-gray-600">Reason: {ref.reason}</p>
                    <div className="text-[11px] text-gray-500 flex justify-between pt-1">
                      <span>Approved By: {ref.approvedBy}</span>
                      <span>Date: {formatDateDisplay(ref.refundDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Quick Panel - Exact Professional Polish Component */}
        <div className="w-full xl:w-72 space-y-6 shrink-0">
          {/* Collection Quick Panel */}
          <div className="bg-amber-600 text-white rounded-2xl p-6 shadow-lg shadow-amber-600/20">
            <div className="text-sm opacity-80 mb-2">Ready to record?</div>
            <h3 className="text-xl font-bold mb-4">Collection Quick Panel</h3>
            <button
              onClick={() => onOpenQistWasool(member)}
              className="w-full bg-white text-amber-700 hover:bg-amber-50 py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 mb-4 transition-all cursor-pointer active:scale-98"
            >
              <span>💵</span> QIST WASOOL KAREIN
            </button>
            <div className="text-[10px] opacity-70 leading-relaxed italic">
              Manual collection only. No online transaction supported. System generates receipt automatically.
            </div>
          </div>

          {/* Member's Today Summary Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Member Summary</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Plan Duration</span>
                <span className="font-bold text-gray-800">{member.planMonths} Months</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Total Committee</span>
                <span className="font-bold text-emerald-700">{formatPKR(member.totalCommitteeAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Collected</span>
                <span className="font-bold text-amber-600">{formatPKR(member.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Due Balance</span>
                <span className="font-bold text-gray-800">{formatPKR(member.dueAmount)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[10px] font-bold text-gray-600 uppercase border border-gray-200 transition-colors"
              >
                View Reports
              </button>
              <button
                onClick={() => setActiveTab('installments')}
                className="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[10px] font-bold text-gray-600 uppercase border border-gray-200 transition-colors"
              >
                All Due
              </button>
            </div>
          </div>

          {/* QR Fast Access Box */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl h-32 text-gray-400 text-center px-4 bg-white/40">
            <p className="text-[10px] font-medium uppercase tracking-wider">
              Scan Member Card<br />QR for Fast Access
            </p>
          </div>
        </div>
      </div>

      {/* Official Refund Form Modal (Replica of matter.JPG) */}
      <RefundFormModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        member={member}
        currentUserEmail={currentUserEmail}
        onRefundSuccess={(newRefund) => {
          setRefunds((prev) => [newRefund, ...prev]);
          setShowRefundModal(false);
          onRefreshMember(member.id);
        }}
      />
    </div>
  );
};
