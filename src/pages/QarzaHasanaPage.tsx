import React, { useState } from 'react';
import {
  HandCoins,
  Search,
  Plus,
  Printer,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  UserCheck,
  X,
  CreditCard,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { QarzaHasanaAgreement, Member } from '../types';
import { formatPKR } from '../utils/calculations';
import { QarzaModal } from '../components/QarzaModal';
import {
  deleteQarzaAgreement,
  recordQarzaRepayment,
  markQarzaAsDefaulted,
} from '../services/firebaseService';

const getRemainingAmount = (a: QarzaHasanaAgreement): number =>
  a.remainingReturnAmount !== undefined
    ? Math.max(0, Number(a.remainingReturnAmount) || 0)
    : Math.max(0, (Number(a.loanAmount) || 0) - (Number(a.paidReturnAmount) || 0));

interface QarzaHasanaPageProps {
  agreements: QarzaHasanaAgreement[];
  members: Member[];
  currentUserEmail?: string;
  onRefresh?: () => void;
}

export const QarzaHasanaPage: React.FC<QarzaHasanaPageProps> = ({
  agreements,
  members,
  currentUserEmail = 'admin',
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Repaid' | 'Defaulted'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgreementForView, setSelectedAgreementForView] = useState<QarzaHasanaAgreement | null>(null);
  const [selectedMemberForLoan, setSelectedMemberForLoan] = useState<Member | null>(null);

  // In-App Confirmations & Actions
  const [agreementToDelete, setAgreementToDelete] = useState<{ id: string; num: string } | null>(null);
  const [agreementToDefault, setAgreementToDefault] = useState<QarzaHasanaAgreement | null>(null);
  const [defaultReason, setDefaultReason] = useState<string>('');
  const [agreementForRepayment, setAgreementForRepayment] = useState<QarzaHasanaAgreement | null>(null);
  const [repaymentAmountInput, setRepaymentAmountInput] = useState<number>(10000);
  const [repaymentNotes, setRepaymentNotes] = useState<string>('');
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Computed Financial Aggregates
  const totalAgreementsCount = agreements.length;
  const totalDisbursedAmount = agreements.reduce((sum, a) => sum + (a.loanAmount || 20000), 0);
  const totalRepaidAmount = agreements.reduce((sum, a) => sum + (a.paidReturnAmount || 0), 0);
  const totalOutstandingBalance = Math.max(0, totalDisbursedAmount - totalRepaidAmount);
  const activeCount = agreements.filter((a) => a.status === 'Active').length;
  const repaidCount = agreements.filter((a) => a.status === 'Repaid').length;
  const defaultedCount = agreements.filter((a) => a.status === 'Defaulted').length;

  const filteredAgreements = agreements.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (a.agreementNumber && a.agreementNumber.toLowerCase().includes(q)) ||
      (a.fullName && a.fullName.toLowerCase().includes(q)) ||
      (a.cnic && a.cnic.toLowerCase().includes(q)) ||
      (a.mobile && a.mobile.toLowerCase().includes(q)) ||
      (a.guarantorName && a.guarantorName.toLowerCase().includes(q)) ||
      (a.guarantorCnic && a.guarantorCnic.toLowerCase().includes(q))
    );
  });

  const handleOpenNewAgreement = (member?: Member) => {
    setSelectedAgreementForView(null);
    setSelectedMemberForLoan(member || null);
    setIsModalOpen(true);
  };

  const handleViewAgreement = (agreement: QarzaHasanaAgreement) => {
    setSelectedAgreementForView(agreement);
    setSelectedMemberForLoan(null);
    setIsModalOpen(true);
  };

  // Delete Loan Agreement Record
  const handleExecuteDelete = async () => {
    if (!agreementToDelete) return;

    try {
      setIsProcessing(true);
      await deleteQarzaAgreement(agreementToDelete.id, currentUserEmail);
      setIsProcessing(false);
      setNotification({
        type: 'success',
        text: `عہد نامہ قرضِ حسنہ #${agreementToDelete.num} کامیابی سے حذف کر دیا گیا۔`,
      });
      setAgreementToDelete(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Delete agreement error:', err);
      setIsProcessing(false);
      setAgreementToDelete(null);
      setNotification({
        type: 'error',
        text: err?.message || 'ریکارڈ حذف نہیں ہو سکا۔',
      });
    }
  };

  // Record Installment Return (e.g. Rs. 10,000)
  const handleExecuteRepayment = async () => {
    if (!agreementForRepayment) return;
    const remaining = getRemainingAmount(agreementForRepayment);
    const amt = Number(repaymentAmountInput);

    if (!Number.isFinite(amt) || amt <= 0) {
      setRepaymentError('برائے مہربانی صفر سے زیادہ درست واپسی رقم درج کریں۔');
      return;
    }
    if (amt > remaining) {
      setRepaymentError(
        `واپسی رقم باقی واجب الادا رقم (${formatPKR(remaining)}) سے زیادہ نہیں ہو سکتی۔`
      );
      return;
    }

    try {
      setIsProcessing(true);
      setRepaymentError(null);
      await recordQarzaRepayment(
        agreementForRepayment.id,
        amt,
        currentUserEmail,
        repaymentNotes.trim() || undefined
      );
      setIsProcessing(false);
      setNotification({
        type: 'success',
        text: `قرض واپسی رقم ${formatPKR(amt)} کامیابی سے وصول اور ریکارڈ کر لی گئی۔`,
      });
      setAgreementForRepayment(null);
      setRepaymentAmountInput(10000);
      setRepaymentNotes('');
      setRepaymentError(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Record repayment error:', err);
      setIsProcessing(false);
      setRepaymentError(err?.message || 'واپسی رقم ریکارڈ کرنے میں خرابی پیش آئی۔');
    }
  };

  // Mark Loan as Defaulted
  const handleExecuteMarkDefaulted = async () => {
    if (!agreementToDefault) return;
    try {
      setIsProcessing(true);
      await markQarzaAsDefaulted(
        agreementToDefault.id,
        currentUserEmail,
        defaultReason.trim() || undefined
      );
      setIsProcessing(false);
      setNotification({
        type: 'success',
        text: `قرضِ حسنہ #${agreementToDefault.agreementNumber} کو نادہندہ (Defaulted) قرار دے کر آڈٹ لاگ میں محفوظ کر لیا گیا۔`,
      });
      setAgreementToDefault(null);
      setDefaultReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Mark defaulted error:', err);
      setIsProcessing(false);
      setAgreementToDefault(null);
      setDefaultReason('');
      setNotification({
        type: 'error',
        text: err?.message || 'اسٹیٹس اپڈیٹ کرنے میں خرابی پیش آئی۔',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-emerald-800" />
            <span>قرضِ حسنہ رجسٹر (Qarza-e-Hasana Record System)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            عمرہ کمیٹی کے تحت ممبران کو 20,000 روپے بلا سود قرضِ حسنہ کی فراہمی، ماہانہ 10,000 روپے واپسی، اور ضامن ریکارڈز۔
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenNewAgreement()}
            className="px-4 py-2.5 bg-[#064E3B] hover:bg-emerald-850 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ نیا عہد نامہ قرضِ حسنہ (Issue Loan)</span>
          </button>
        </div>
      </div>

      {/* In-App Notification Banner */}
      {notification && (
        <div
          className={`px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Loans */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            کل جاری شدہ قرضے (Total Loans Issued)
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{totalAgreementsCount}</span>
            <span className="text-xs font-semibold text-slate-400">معاہدات</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span className="text-emerald-800 font-bold">{activeCount} فعال</span>
            <span>•</span>
            <span className="text-purple-800 font-bold">{repaidCount} مکمل ادا شدہ</span>
          </div>
        </div>

        {/* Card 2: Total Disbursed */}
        <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
            کل جاری کردہ رقم (Disbursed Amount)
          </span>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {formatPKR(totalDisbursedAmount)}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
            Rs. 20,000 فی ممبر بلا سود
          </span>
        </div>

        {/* Card 3: Total Recovered / Repaid */}
        <div className="bg-white border border-blue-200 bg-blue-50/20 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
            کل وصول شدہ واپسی (Returned / Recovered)
          </span>
          <div className="text-2xl font-black text-blue-900 mt-1">
            {formatPKR(totalRepaidAmount)}
          </div>
          <span className="text-[10px] text-blue-700 font-semibold block mt-1">
            Rs. 10,000 ماہانہ اقساط
          </span>
        </div>

        {/* Card 4: Outstanding Balance */}
        <div className="bg-white border border-amber-200 bg-amber-50/30 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            باقی واجب الادا قرض (Outstanding Balance)
          </span>
          <div className="text-2xl font-black text-amber-900 mt-1">
            {formatPKR(totalOutstandingBalance)}
          </div>
          <span className="text-[10px] text-amber-700 font-semibold block mt-1">
            کمیٹی کی طرف ممبران پر واجب واپسی
          </span>
        </div>
      </div>

      {/* Search Filter & Status Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Member, Guarantor, CNIC, Agreement #..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden p-0.5 bg-slate-50 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-emerald-950 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              تمام ({agreements.length})
            </button>
            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'Active' ? 'bg-white text-emerald-950 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              فعال / زیرِ واپسی ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('Repaid')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'Repaid' ? 'bg-white text-emerald-950 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              مکمل ادا شدہ ({repaidCount})
            </button>
            <button
              onClick={() => setStatusFilter('Defaulted')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'Defaulted' ? 'bg-white text-rose-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              نادہندہ ({defaultedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Qarza Records Table */}
      {filteredAgreements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
            <HandCoins className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 font-urdu">
            کوئی قرضِ حسنہ معاہدہ ریکارڈ موجود نہیں ہے
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            جب کسی ممبر کو 20,000 روپے قرضِ حسنہ جاری کیا جائے گا، تو ان کا باضابطہ تصدیق شدہ معاہدہ یہاں محفوظ ہوگا۔
          </p>
          <button
            onClick={() => handleOpenNewAgreement()}
            className="px-4 py-2 bg-[#064E3B] hover:bg-emerald-850 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>پہلا عہد نامہ قرضِ حسنہ جاری کریں</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600" dir="rtl">
              <thead className="text-[11px] uppercase bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-4 px-5 text-right">معاہدہ نمبر (Agreement #)</th>
                  <th className="py-4 px-5 text-right">تاریخ</th>
                  <th className="py-4 px-5 text-right">قرض دار ممبر و شناختی کارڈ</th>
                  <th className="py-4 px-5 text-right">قرض رقم</th>
                  <th className="py-4 px-5 text-right">ماہانہ واپسی</th>
                  <th className="py-4 px-5 text-right">ادا شدہ / باقی واپسی</th>
                  <th className="py-4 px-5 text-right">ضامن (Guarantor)</th>
                  <th className="py-4 px-5 text-right">اسٹیٹس</th>
                  <th className="py-4 px-5 text-center">ایکشنز (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAgreements.map((item) => {
                  const isFullyRepaid = item.status === 'Repaid' || (item.remainingReturnAmount !== undefined && item.remainingReturnAmount <= 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-emerald-800 text-right" dir="ltr">
                        {item.agreementNumber}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-600 text-right" dir="ltr">
                        {item.agreementDate}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {item.salutation} {item.fullName}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 font-medium">
                          {item.relationType}: {item.fatherOrHusbandName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1" dir="ltr">
                          CNIC: {item.cnic}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-black text-emerald-950 text-sm">
                        {formatPKR(item.loanAmount || 20000)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="font-bold text-slate-800">
                          {formatPKR(item.monthlyReturnAmount || 10000)}/ماہ
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          مدت: {item.repaymentDurationMonths || 2} ماہ
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="text-emerald-800 font-bold">
                          واپس: {formatPKR(item.paidReturnAmount || 0)}
                        </div>
                        <div className={`text-[11px] font-bold mt-0.5 ${
                          (item.remainingReturnAmount || 0) > 0 ? 'text-amber-800' : 'text-slate-400'
                        }`}>
                          باقی: {formatPKR(item.remainingReturnAmount !== undefined ? item.remainingReturnAmount : Math.max(0, (item.loanAmount || 20000) - (item.paidReturnAmount || 0)))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="font-bold text-slate-900 text-xs">
                          {item.guarantorName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-urdu mt-0.5">
                          {item.guarantorRelationType}: {item.guarantorFatherName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5" dir="ltr">
                          {item.guarantorCnic} {item.guarantorMobile ? `• ${item.guarantorMobile}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {isFullyRepaid ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-block">
                            مکمل ادا شدہ (Repaid)
                          </span>
                        ) : item.status === 'Defaulted' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-block">
                            نادہندہ (Defaulted)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-block">
                            زیرِ ادائیگی (Active)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Record Repayment Button */}
                          {!isFullyRepaid && (
                            <button
                              onClick={() => {
                                const rem = getRemainingAmount(item);
                                const monthly = Number(item.monthlyReturnAmount) || 10000;
                                setAgreementForRepayment(item);
                                setRepaymentAmountInput(Math.min(monthly, rem));
                                setRepaymentNotes('');
                                setRepaymentError(null);
                              }}
                              className="px-2.5 py-1 text-emerald-900 hover:text-white bg-emerald-100 hover:bg-emerald-800 border border-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                              title="قرض کی واپسی رقم درج کریں (Record Return Payment)"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>واپسی وصول</span>
                            </button>
                          )}

                          {/* Mark as Defaulted Button */}
                          {!isFullyRepaid && item.status !== 'Defaulted' && (
                            <button
                              onClick={() => {
                                setAgreementToDefault(item);
                                setDefaultReason('');
                              }}
                              className="px-2 py-1 text-rose-800 hover:text-white bg-rose-50 hover:bg-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="نادہندہ قرار دیں (Mark as Defaulted)"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Mark as Defaulted</span>
                            </button>
                          )}

                          {/* View / Print Agreement */}
                          <button
                            onClick={() => handleViewAgreement(item)}
                            className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="عہد نامہ دیکھیں اور پرنٹ کریں (View / Print Agreement)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete Agreement */}
                          <button
                            onClick={() => setAgreementToDelete({ id: item.id, num: item.agreementNumber })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف کریں (Delete Record)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IN-APP REPAYMENT RECORDING MODAL */}
      {agreementForRepayment && (() => {
        const remaining = getRemainingAmount(agreementForRepayment);
        const monthly = Number(agreementForRepayment.monthlyReturnAmount) || 10000;
        const suggestedFull = Math.min(monthly, remaining);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 text-right space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" dir="rtl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      قرضِ حسنہ واپسی قسط وصولی
                    </h3>
                    <div className="text-[11px] font-mono text-emerald-800">
                      Ref: {agreementForRepayment.agreementNumber}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAgreementForRepayment(null);
                    setRepaymentError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {repaymentError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{repaymentError}</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-urdu">قرض دار ممبر:</span>
                  <span className="font-bold text-slate-900 font-urdu">{agreementForRepayment.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-urdu">کل قرض رقم:</span>
                  <span className="font-bold text-slate-900">{formatPKR(agreementForRepayment.loanAmount || 20000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-urdu">سابقہ ادا شدہ واپسی:</span>
                  <span className="font-bold text-emerald-800">{formatPKR(agreementForRepayment.paidReturnAmount || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-amber-800 font-bold font-urdu">باقی واجب الادا رقم:</span>
                  <span className="font-black text-amber-900">
                    {formatPKR(remaining)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-slate-800 font-urdu block">
                  واپسی رقم درج کریں (زیادہ سے زیادہ باقی: {formatPKR(remaining)}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={remaining}
                  value={repaymentAmountInput}
                  onChange={(e) => {
                    setRepaymentAmountInput(Number(e.target.value) || 0);
                    if (repaymentError) setRepaymentError(null);
                  }}
                  className="w-full px-3 py-2 border-2 border-emerald-500 rounded-xl font-mono text-base font-black text-emerald-950 focus:outline-hidden"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {remaining >= 5000 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRepaymentAmountInput(5000);
                        setRepaymentError(null);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md cursor-pointer"
                    >
                      Rs. 5,000
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRepaymentAmountInput(suggestedFull);
                      setRepaymentError(null);
                    }}
                    className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded-md cursor-pointer"
                  >
                    {formatPKR(suggestedFull)} ({suggestedFull === remaining ? 'پوری باقی رقم' : 'ماہانہ قسط'})
                  </button>
                  {remaining > suggestedFull && (
                    <button
                      type="button"
                      onClick={() => {
                        setRepaymentAmountInput(remaining);
                        setRepaymentError(null);
                      }}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded-md cursor-pointer"
                    >
                      پوری باقی رقم ({formatPKR(remaining)})
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-slate-700 font-urdu block">
                  تفصیل / نوٹ (اختیاری):
                </label>
                <input
                  type="text"
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  placeholder="مثلاً: قسط نمبر 1 بذریعہ کیش وصول..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-urdu"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteRepayment}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-[#064E3B] hover:bg-emerald-850 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'ریکارڈ ہو رہا ہے...' : 'واپسی رقم محفوظ کریں'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgreementForRepayment(null);
                    setRepaymentError(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  کینسل
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* IN-APP MARK AS DEFAULTED MODAL */}
      {agreementToDefault && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 text-right space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-black text-slate-900 font-urdu">
                قرضِ حسنہ کو نادہندہ (Defaulted) قرار دیں؟
              </h3>
              <p className="text-xs text-slate-600 font-mono">
                {agreementToDefault.agreementNumber} • {agreementToDefault.fullName}
              </p>
              <p className="text-[11px] text-rose-700 font-bold pt-1 font-urdu">
                باقی واجب الادا رقم: {formatPKR(getRemainingAmount(agreementToDefault))}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 font-urdu block">
                وجہ / نوٹ (اختیاری):
              </label>
              <input
                type="text"
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
                placeholder="مثلاً: مقررہ مدت میں واپسی نہ کرنے پر..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-urdu"
              />
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAgreementToDefault(null);
                  setDefaultReason('');
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                کینسل (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExecuteMarkDefaulted}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'اپڈیٹ ہو رہا ہے...' : 'ہاں، نادہندہ قرار دیں'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL */}
      {agreementToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 font-urdu">
                کیا آپ واقعی یہ عہد نامہ حذف کرنا چاہتے ہیں؟
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Agreement #{agreementToDelete.num}
              </p>
              <p className="text-[11px] text-rose-600 font-medium pt-1 font-urdu">
                یہ ریکارڈ ڈیٹا بیس سے مستقل طور پر ڈیلیٹ ہو جائے گا۔
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAgreementToDelete(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                کینسل (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'ڈیلیٹ ہو رہا ہے...' : 'ہاں، ڈیلیٹ کریں'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QarzaModal for Issuing or Viewing Agreement */}
      <QarzaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAgreementForView(null);
          setSelectedMemberForLoan(null);
        }}
        members={members}
        existingAgreements={agreements}
        initialAgreement={selectedAgreementForView}
        targetMember={selectedMemberForLoan}
        currentUserEmail={currentUserEmail}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
