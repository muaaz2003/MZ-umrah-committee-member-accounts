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
  RefreshCw,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { Member, Installment, Payment, Receipt, Refund, UserRole } from '../types';
import { formatPKR, formatDateDisplay, computeInstallmentStatus, getTodayKarachiDate } from '../utils/calculations';
import {
  getMemberInstallments,
  getMemberPayments,
  getMemberReceipts,
  getMemberRefunds,
  recordRefund,
  rescheduleSingleMemberInstallments,
  restoreMemberToActive,
} from '../services/firebaseService';
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
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);
  const [restoreToast, setRestoreToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExecuteRestore = async () => {
    try {
      setIsRestoring(true);
      setShowRestoreConfirmModal(false);
      const res = await restoreMemberToActive(member.id, currentUserEmail);
      setIsRestoring(false);
      if (res?.success) {
        setRestoreToast({
          type: 'success',
          text: `ممبر ${member.fullName} (${member.memberNumber}) کو کامیابی سے Active ممبرشپ میں بحال کر دیا گیا۔ تمام سابقہ اقساط اور رسیدیں محفوظ ہیں۔`,
        });
        onRefreshMember(member.id);
      } else {
        setRestoreToast({
          type: 'error',
          text: 'ممبر بحال نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔',
        });
      }
    } catch (err: any) {
      console.error('Error restoring member to active:', err);
      setIsRestoring(false);
      setShowRestoreConfirmModal(false);
      setRestoreToast({
        type: 'error',
        text: err?.message || 'خرابی پیش آئی۔ ممبر بحال نہیں ہو سکا۔',
      });
    }
  };

  const handleFixMemberDates = async () => {
    try {
      setIsRescheduling(true);
      setRescheduleMsg(null);
      await rescheduleSingleMemberInstallments(member.id, '2026-10-10', currentUserEmail);
      const updatedInsts = await getMemberInstallments(member.id);
      setInstallments(updatedInsts);
      onRefreshMember(member.id);
      setRescheduleMsg({ text: 'قسطوں کی ڈیو ڈیٹس کامیابی سے 10 اکتوبر 2026 کے مطابق ٹھیک ہو گئیں۔' });
      setTimeout(() => setRescheduleMsg(null), 6000);
    } catch (err: any) {
      console.error('Failed to reschedule member:', err);
      setRescheduleMsg({ text: 'خرابی: ڈیٹس اپڈیٹ نہیں ہو سکیں۔ ' + (err?.message || ''), isError: true });
    } finally {
      setIsRescheduling(false);
    }
  };

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
  }, [member.id, member.paidAmount, member.dueAmount, member.advanceAmount, member.updatedAt]);

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
      case 'Due':
        return <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Due Today</span>;
      case 'Upcoming':
        return <span className="bg-slate-100 text-slate-600 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Upcoming</span>;
      case 'Advance':
        return <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Advance</span>;
      default:
        return <span className="bg-gray-100 text-gray-500 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">{status || 'Upcoming'}</span>;
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

            {member.status !== 'Active' && (
              <button
                onClick={() => setShowRestoreConfirmModal(true)}
                disabled={isRestoring}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-950" />
                <span>{isRestoring ? 'بحال ہو رہا ہے...' : 'ممبر بحال کریں (Restore to Active)'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Restore Toast Notification */}
      {restoreToast && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-xs no-print ${
            restoreToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {restoreToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{restoreToast.text}</span>
          </div>
          <button
            onClick={() => setRestoreToast(null)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cancelled Member Notice Banner */}
      {member.status === 'Cancelled' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs no-print">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-sm font-urdu">
                یہ ممبر فی الوقت منسوخ شدہ (Cancelled) ہیں۔
              </div>
              <div className="text-xs text-amber-800 mt-0.5 font-urdu">
                ان کا تمام سابقہ ریکارڈ (ادا شدہ رقم، اقساط، اور رسیدیں) محفوظ ہے۔ آپ ایک کلک سے ان کی ممبرشپ کو دوبارہ Active میں بحال کر سکتے ہیں۔
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRestoreConfirmModal(true)}
            disabled={isRestoring}
            className="px-4 py-2 text-xs font-bold bg-[#064E3B] text-white hover:bg-emerald-800 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            <span>{isRestoring ? 'بحال ہو رہا ہے...' : 'ابھی ممبرشپ بحال کریں (Restore Member)'}</span>
          </button>
        </div>
      )}

      {/* IN-APP RESTORE CONFIRMATION MODAL */}
      {showRestoreConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 font-urdu">
                ممبرشپ دوبارہ بحال کریں؟
              </h3>
              <p className="text-xs text-slate-600 font-urdu mt-2 leading-relaxed">
                کیا آپ واقعی <strong>{member.fullName} ({member.memberNumber})</strong> کو دوبارہ <strong>Active</strong> ممبرشپ میں بحال کرنا چاہتے ہیں؟
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3 text-[11px] font-bold text-emerald-900 font-urdu text-right" dir="rtl">
                ✓ ممبر کے تمام سابقہ ریکارڈز (کل ادا شدہ رقم: {formatPKR(member.paidAmount || 0)}، رسیدیں، اور شیڈول) جوں کے توں محفوظ رہیں گے اور آپ اگلے مہینے کی قسط وصول کر سکیں گے۔
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowRestoreConfirmModal(false)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                منسوخ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-6 py-2.5 text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isRestoring ? 'بحال ہو رہا ہے...' : 'جی ہاں، بحال کریں (Restore)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="px-6 pb-6 pt-2 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Total Committee</div>
                <div className="text-base sm:text-lg font-bold text-emerald-800">{formatPKR(member.totalCommitteeAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Monthly Qist</div>
                <div className="text-base sm:text-lg font-bold text-slate-800">{formatPKR(member.monthlyInstallment)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Paid Amount</div>
                <div className="text-base sm:text-lg font-bold text-emerald-600">{formatPKR(member.paidAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Due Balance</div>
                <div className="text-base sm:text-lg font-bold text-amber-700">{formatPKR(member.dueAmount)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Installments</div>
                <div className="text-base sm:text-lg font-bold text-gray-600">
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
                  <span>ضامن کی تفصیلات (Guarantor)</span>
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

            {/* Banner for reschedule message or misaligned due dates */}
            {rescheduleMsg && (
              <div
                className={`mx-4 mt-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  rescheduleMsg.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span>{rescheduleMsg.text}</span>
              </div>
            )}

            {userRole !== 'MEMBER' &&
              installments.some((i) => i.installmentNumber === 1 && i.dueDate.startsWith('2027')) && (
                <div className="mx-4 mt-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-medium">
                      اس ممبر کی پہلی قسط 2027 پر سیٹ ہے جب کہ کمیٹی 10 اکتوبر 2026 سے شروع ہوئی ہے۔
                    </span>
                  </div>
                  <button
                    onClick={handleFixMemberDates}
                    disabled={isRescheduling}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRescheduling ? 'animate-spin' : ''}`} />
                    <span>{isRescheduling ? 'ٹھیک ہو رہا ہے...' : 'ڈیٹس 10 اکتوبر 2026 پر سیٹ کریں'}</span>
                  </button>
                </div>
              )}

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
                      const todayStr = getTodayKarachiDate();
                      const liveStatus = computeInstallmentStatus(inst, todayStr);
                      // Match receipt ONLY if installment has actual payment received
                      const receipt = inst.paidAmount > 0
                        ? receipts.find(
                            (r) =>
                              (inst.receiptNumber && inst.receiptNumber.includes(r.receiptNumber)) ||
                              (r.installmentsCovered && r.installmentsCovered.includes(inst.installmentNumber)) ||
                              (r.installmentNumber === inst.installmentNumber && (r.installmentsCovered?.length || 0) <= 1)
                          )
                        : undefined;
                      const isToday = liveStatus === 'Partial' || (liveStatus !== 'Paid' && inst.dueDate.startsWith(todayStr.slice(0, 7)));
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
                            {getStatusBadge(liveStatus)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {inst.paidAmount > 0 && (inst.receiptNumber || receipt) ? (
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {(inst.receiptNumber ? inst.receiptNumber.split(',').map((s) => s.trim()) : [receipt?.receiptNumber]).filter(Boolean).map((rcpNum) => {
                                    const matchedRec = receipts.find((r) => r.receiptNumber === rcpNum) || receipt;
                                    return (
                                      <button
                                        key={rcpNum}
                                        type="button"
                                        onClick={() => matchedRec && onOpenReceipt(matchedRec)}
                                        className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-300/80 px-2 py-0.5 rounded font-mono font-bold text-[11px] cursor-pointer shadow-2xs transition-colors"
                                      >
                                        {rcpNum}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-400 uppercase font-semibold">
                                  Pending
                                </span>
                              )}

                              {userRole !== 'MEMBER' && liveStatus !== 'Paid' && (
                                <button
                                  type="button"
                                  onClick={() => onOpenQistWasool(member, inst)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"
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

            {/* Tab 3: Zamin / Guarantor Details */}
            {activeTab === 'nominee' && (
              <div className="p-6 max-w-lg">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3 text-xs">
                  <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>ضامن کی تفصیلات</span>
                    <span className="font-sans text-gray-400 font-normal">(Guarantor / Zamin Information)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">ضامن کا نام (Name)</span>
                      <span className="font-bold text-gray-900 text-sm">{member.nomineeName || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">رشتہ / تعلق (Relation)</span>
                      <span className="font-bold text-gray-900 text-sm">{member.nomineeRelation || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">ضامن کا CNIC</span>
                      <span className="font-mono font-medium text-gray-800">{member.nomineeCnic || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">ضامن کا موبائل</span>
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
