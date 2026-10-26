import React, { useState } from 'react';
import {
  FileX2,
  Search,
  Plus,
  Printer,
  Download,
  Trash2,
  Eye,
  Calendar,
  User,
  ShieldAlert,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  X,
} from 'lucide-react';
import { CancellationNotice, Member } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';
import { CancellationModal } from '../components/CancellationModal';
import { deleteCancellationNotice, restoreMemberToActive } from '../services/firebaseService';

interface CancellationsPageProps {
  cancellations: CancellationNotice[];
  members: Member[];
  currentUserEmail?: string;
  onRestoreMember?: (memberId: string) => Promise<boolean>;
  onRefresh?: () => void;
}

export const CancellationsPage: React.FC<CancellationsPageProps> = ({
  cancellations,
  members,
  currentUserEmail = 'admin',
  onRestoreMember,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNoticeForView, setSelectedNoticeForView] = useState<CancellationNotice | null>(null);
  const [selectedMemberForCancel, setSelectedMemberForCancel] = useState<Member | null>(null);

  // In-App Confirmations (Never use window.confirm which is blocked in iframes!)
  const [noticeToRestore, setNoticeToRestore] = useState<CancellationNotice | null>(null);
  const [noticeToDelete, setNoticeToDelete] = useState<{ id: string; num: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const totalCancelledCount = cancellations.length;
  const totalRefundedOnCancel = cancellations.reduce((sum, c) => sum + (c.refundAmount || 0), 0);
  const plan24Count = cancellations.filter((c) => (c.planMonths || 24) === 24).length;
  const plan36Count = cancellations.filter((c) => c.planMonths === 36).length;

  const filteredCancellations = cancellations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (c.noticeNumber && c.noticeNumber.toLowerCase().includes(q)) ||
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.cnic && c.cnic.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.toLowerCase().includes(q)) ||
      (c.memberNumber && c.memberNumber.toLowerCase().includes(q))
    );
  });

  const handleOpenNewNotice = (member?: Member) => {
    setSelectedNoticeForView(null);
    setSelectedMemberForCancel(member || null);
    setIsModalOpen(true);
  };

  const handleViewNotice = (notice: CancellationNotice) => {
    setSelectedNoticeForView(notice);
    setSelectedMemberForCancel(null);
    setIsModalOpen(true);
  };

  // Perform In-App Member Restoration
  const handleExecuteRestore = async () => {
    if (!noticeToRestore) return;

    // If notice has no memberId, find member by CNIC or full name
    const targetMemberId =
      noticeToRestore.memberId ||
      members.find(
        (m) =>
          (m.cnic && noticeToRestore.cnic && m.cnic.replace(/\D/g, '') === noticeToRestore.cnic.replace(/\D/g, '')) ||
          m.fullName.trim() === noticeToRestore.fullName.trim()
      )?.id;

    if (!targetMemberId) {
      setNotification({
        type: 'error',
        text: 'اس کینسلیشن نوٹس کے ساتھ کوئی ممبر میچ نہیں ہو سکا۔ برائے مہربانی ممبر لسٹ چیک کریں۔',
      });
      setNoticeToRestore(null);
      return;
    }

    try {
      setIsProcessing(true);
      let success = false;

      if (onRestoreMember) {
        success = await onRestoreMember(targetMemberId);
      } else {
        const res = await restoreMemberToActive(targetMemberId, currentUserEmail);
        success = !!res?.success;
      }

      setIsProcessing(false);
      setNoticeToRestore(null);

      if (success) {
        setNotification({
          type: 'success',
          text: `ممبر ${noticeToRestore.fullName} کو کامیابی سے Active ممبرشپ میں بحال کر دیا گیا ہے! تمام سابقہ اقساط اور رسیدیں محفوظ ہیں۔`,
        });
        if (onRefresh) onRefresh();
      } else {
        setNotification({
          type: 'error',
          text: 'ممبر بحال نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔',
        });
      }
    } catch (err: any) {
      console.error('Restore member error:', err);
      setIsProcessing(false);
      setNoticeToRestore(null);
      setNotification({
        type: 'error',
        text: err?.message || 'خرابی پیش آئی۔ ممبر بحال نہیں ہو سکا۔',
      });
    }
  };

  // Perform In-App Notice Deletion
  const handleExecuteDelete = async () => {
    if (!noticeToDelete) return;

    try {
      setIsProcessing(true);
      await deleteCancellationNotice(noticeToDelete.id, currentUserEmail);
      setIsProcessing(false);
      setNotification({
        type: 'success',
        text: `کینسلیشن نوٹس #${noticeToDelete.num} کامیابی سے حذف کر دیا گیا۔`,
      });
      setNoticeToDelete(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Delete notice error:', err);
      setIsProcessing(false);
      setNoticeToDelete(null);
      setNotification({
        type: 'error',
        text: err?.message || 'ریکارڈ حذف نہیں ہو سکا۔',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileX2 className="w-6 h-6 text-rose-600" />
            <span>منسوخی ممبرشپ رجسٹر (Cancellation Records)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            کمیٹی قواعد و ضوابط کے تحت جاری کردہ باضابطہ کینسلیشن نوٹس، ریفنڈ تفصیلات اور عدالتی سند۔
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenNewNotice()}
            className="px-4 py-2.5 bg-rose-700 hover:bg-rose-600 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ نیا کینسلیشن نوٹس (Issue Notice)</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            کل منسوخ شدہ ممبرز (Total Cancelled)
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{totalCancelledCount}</span>
            <span className="text-xs font-semibold text-slate-400">ممبرز</span>
          </div>
        </div>

        <div className="bg-white border border-rose-200 bg-rose-50/30 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
            منسوخی پر واپس کی گئی رقم (Refunded on Cancel)
          </span>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {formatPKR(totalRefundedOnCancel)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            پلان کے لحاظ سے تقسیم (Plan Breakdown)
          </span>
          <div className="text-sm font-bold text-slate-700 mt-2 flex items-center gap-4">
            <div>
              <span className="text-emerald-800">24 ماہ:</span> {plan24Count}
            </div>
            <div>
              <span className="text-purple-800">36 ماہ:</span> {plan36Count}
            </div>
          </div>
        </div>
      </div>

      {/* Search Filter & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Member Name, CNIC, Notice #, Phone..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>دکھائے گئے ریکارڈز: {filteredCancellations.length}</span>
        </div>
      </div>

      {/* Cancellations Records Table */}
      {filteredCancellations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <FileX2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 font-urdu">
            کوئی کینسلیشن نوٹس ریکارڈ موجود نہیں ہے
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            جب کسی ممبر کی ممبرشپ قواعد و ضوابط کی خلاف ورزی یا عدم ادائیگی کی بنا پر منسوخ کی جائے گی، تو ان کا نوٹس یہاں محفوظ ہوگا۔
          </p>
          <button
            onClick={() => handleOpenNewNotice()}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>پہلا کینسلیشن نوٹس جاری کریں</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600" dir="rtl">
              <thead className="text-[11px] uppercase bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3.5 px-4 text-right">نوٹس نمبر (Notice #)</th>
                  <th className="py-3.5 px-4 text-right">تاریخ</th>
                  <th className="py-3.5 px-4 text-right">ممبر کا نام و شناختی کارڈ</th>
                  <th className="py-3.5 px-4 text-right">کمیٹی پلان</th>
                  <th className="py-3.5 px-4 text-right">ادا شدہ / باقی اقساط</th>
                  <th className="py-3.5 px-4 text-right">واپس شدہ رقم</th>
                  <th className="py-3.5 px-4 text-right">موجودہ اسٹیٹس</th>
                  <th className="py-3.5 px-4 text-center">ایکشنز (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCancellations.map((item) => {
                  const linkedMember = members.find(
                    (m) =>
                      m.id === item.memberId ||
                      (m.cnic && item.cnic && m.cnic.replace(/\D/g, '') === item.cnic.replace(/\D/g, '')) ||
                      m.fullName.trim() === item.fullName.trim()
                  );
                  const isAlreadyActive = linkedMember?.status === 'Active';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-rose-700 text-right" dir="ltr">
                        {item.noticeNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-right" dir="ltr">
                        {item.noticeDate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-slate-900 font-urdu text-sm">
                          {item.salutation} {item.fullName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-urdu">
                          {item.relationType}: {item.fatherOrHusbandName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500" dir="ltr">
                          CNIC: {item.cnic}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-800">
                          {item.planMonths || 24} ماہ پلان
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          (Rs. {item.installmentAmount?.toLocaleString() || 5000}/mo)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-slate-800 font-medium">
                          ادا شدہ: <strong>{item.paidInstallmentsCount || 1}</strong>
                        </div>
                        <div className="text-rose-700 text-[10px]">
                          باقی: <strong>{item.remainingInstallmentsCount ?? 23}</strong>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700">
                        {formatPKR(item.refundAmount || 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAlreadyActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            بحال شدہ (Active)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            منسوخ (Cancelled)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Restore Button */}
                          {!isAlreadyActive && (
                            <button
                              onClick={() => setNoticeToRestore(item)}
                              className="px-2.5 py-1 text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                              title="ممبرشپ دوبارہ ایکٹو کریں (Restore Member to Active)"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span>بحال کریں</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleViewNotice(item)}
                            className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="View / Print Cancellation Paper"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setNoticeToDelete({ id: item.id, num: item.noticeNumber })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
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

      {/* IN-APP RESTORE CONFIRMATION MODAL (No window.confirm!) */}
      {noticeToRestore && (
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
                کیا آپ واقعی <strong>{noticeToRestore.fullName}</strong> کو دوبارہ <strong>Active</strong> ممبرشپ میں بحال کرنا چاہتے ہیں؟
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3 text-[11px] font-bold text-emerald-900 font-urdu text-right" dir="rtl">
                ✓ ان کا تمام سابقہ ریکارڈ (ادا شدہ رقم، اقساط، اور رسیدیں) محفوظ رہے گا اور وہ دوبارہ ایکٹو ممبر لسٹ اور قسط وصولی میں شامل ہو جائیں گے۔
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setNoticeToRestore(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                منسوخ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isProcessing}
                className="px-6 py-2.5 text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isProcessing ? 'بحال ہو رہا ہے...' : 'جی ہاں، بحال کریں (Restore)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL (No window.confirm!) */}
      {noticeToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 font-urdu">
                کینسلیشن نوٹس حذف کریں؟
              </h3>
              <p className="text-xs text-slate-600 mt-2">
                کیا آپ واقعی نوٹس <strong>#{noticeToDelete.num}</strong> کو ریکارڈ سے حذف کرنا چاہتے ہیں؟
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNoticeToDelete(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                منسوخ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isProcessing}
                className="px-6 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'حذف ہو رہا ہے...' : 'ہاں، حذف کریں (Delete)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The Cancellation Modal Component */}
      <CancellationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        members={members}
        initialMember={selectedMemberForCancel}
        existingNotice={selectedNoticeForView}
        onSuccess={() => {
          setIsModalOpen(false);
          if (onRefresh) onRefresh();
        }}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
