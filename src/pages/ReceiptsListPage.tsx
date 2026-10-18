import React, { useState } from 'react';
import {
  Receipt as ReceiptIcon,
  Search,
  ShieldCheck,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Save,
} from 'lucide-react';
import { Receipt, PaymentMethod } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface ReceiptsListPageProps {
  receipts: Receipt[];
  onOpenReceipt: (receipt: Receipt, isDuplicate?: boolean) => void;
  onDeleteReceipt?: (receipt: Receipt) => Promise<void> | void;
  onEditReceipt?: (receipt: Receipt) => void;
}

export const ReceiptsListPage: React.FC<ReceiptsListPageProps> = ({
  receipts,
  onOpenReceipt,
  onDeleteReceipt,
  onEditReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Surety Modal State
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = receipts.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.receiptNumber.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.memberNumber.toLowerCase().includes(q) ||
      r.mobile.toLowerCase().includes(q) ||
      r.paymentMethod.toLowerCase().includes(q)
    );
  });

  const handleConfirmDelete = async () => {
    if (!receiptToDelete || !onDeleteReceipt) return;
    try {
      setIsDeleting(true);
      await onDeleteReceipt(receiptToDelete);
      setReceiptToDelete(null);
    } catch (err) {
      console.error('Delete receipt error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ReceiptIcon className="w-6 h-6 text-emerald-800" />
            <span>Official Umrah Committee Receipts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            تمام جاری شدہ رسیدات کا تصدیق شدہ رجسٹر — غلط اندراج کی صورت میں رسید ایڈٹ یا مکمل ڈیلیٹ کرنے کی سہولت۔
          </p>
        </div>

        <div className="text-xs font-bold bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200">
          Total Issued Receipts: {receipts.length}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt number (e.g. MZA-RCP-0001), member name, member #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Receipt #</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Member Name</th>
              <th className="py-3 px-4">Membership #</th>
              <th className="py-3 px-4">Installment</th>
              <th className="py-3 px-4 text-right">Amount Received</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No payment receipts found matching search.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const instLabel = r.installmentDescription ||
                  (r.installmentsCovered && r.installmentsCovered.length > 1
                    ? `Qist #${r.installmentsCovered.join(', #')}`
                    : `Qist #${r.installmentNumber}`);

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                      {r.receiptNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatDateDisplay(r.paymentDate)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {r.memberName}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-800">
                      {r.memberNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {instLabel} ({r.planMonths}M Plan)
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                      {formatPKR(r.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {r.paymentMethod}
                        </span>
                        {r.paymentMethod !== 'Cash' && (r.referenceNumber || r.transactionRef) && (
                          <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                            Ref: {r.referenceNumber || r.transactionRef}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenReceipt(r, true)}
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="رسید دیکھیں یا پرنٹ کریں (View Receipt)"
                        >
                          <ReceiptIcon className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>

                        {onEditReceipt && (
                          <button
                            onClick={() => onEditReceipt(r)}
                            className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-400 rounded-lg text-slate-700 hover:text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="قسط وصولی فارم میں رسید درست کریں (Edit in Qist Wasooli Form)"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                            <span>Edit</span>
                          </button>
                        )}

                        {onDeleteReceipt && (
                          <button
                            onClick={() => setReceiptToDelete(r)}
                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="رسید اور ادائیگی مکمل ڈیلیٹ کریں (Delete Receipt & Revert Record)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Surety Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                کیا آپ واقعی یہ رسید ڈیلیٹ کرنا چاہتے ہیں؟
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                رسید <strong>#{receiptToDelete.receiptNumber}</strong> (مبلغ <strong>{formatPKR(receiptToDelete.amount)}</strong> - ممبر: <strong>{receiptToDelete.memberName}</strong>) کو سسٹم سے ڈیلیٹ کر دیا جائے گا۔
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 text-right space-y-1 font-sans">
              <p className="font-bold">⚠️ یقینی اثرات (Transaction Reversal):</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-800">
                <li>ممبر کے کھاتے سے یہ رقم ریورس ہو جائے گی۔</li>
                <li>متعلقہ قسط کا اسٹیٹس دوبارہ غیر ادا شدہ (Due) ہو جائے گا۔</li>
                <li>ادائیگی کا واؤچر مکمل طور پر خارج کر دیا جائے گا۔</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiptToDelete(null)}
                disabled={isDeleting}
                className="w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                منسوخ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>ڈیلیٹ ہو رہا ہے...</span>
                  </>
                ) : (
                  <span>جی ہاں، ڈیلیٹ کریں</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
