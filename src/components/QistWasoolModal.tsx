import React, { useState, useEffect } from 'react';
import {
  X,
  HandCoins,
  ReceiptText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  Info,
} from 'lucide-react';
import { Member, Installment, PaymentMethod, Receipt } from '../types';
import { formatPKR } from '../utils/calculations';
import { recordPayment } from '../services/firebaseService';

interface QistWasoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  installments: Installment[];
  allMembers: Member[];
  onPaymentSuccess: (receipt: Receipt) => void;
  staffName: string;
}

export const QistWasoolModal: React.FC<QistWasoolModalProps> = ({
  isOpen,
  onClose,
  member: initialMember,
  installments: initialInstallments,
  allMembers,
  onPaymentSuccess,
  staffName,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<number | string>(5000);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allocationType, setAllocationType] = useState<'current' | 'next' | 'advance'>('current');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Active member
  const activeMember = initialMember || allMembers.find((m) => m.id === selectedMemberId) || null;

  // Active installments
  const activeInstallments = (initialMember && initialInstallments.length > 0)
    ? initialInstallments
    : [];

  // Lock background body scroll when modal is open so only the form scrolls
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialMember) {
      setSelectedMemberId(initialMember.id);
    } else if (allMembers.length > 0 && !selectedMemberId) {
      setSelectedMemberId(allMembers[0].id);
    }
  }, [initialMember, allMembers]);

  // When active installments change, auto-select the first unpaid or due installment
  useEffect(() => {
    if (activeInstallments.length > 0) {
      const firstUnpaid = activeInstallments.find((i) => i.status !== 'Paid') || activeInstallments[0];
      if (firstUnpaid) {
        setSelectedInstallmentId(firstUnpaid.id);
        const rem = firstUnpaid.remainingAmount ?? firstUnpaid.amount;
        setAmountReceived(rem > 0 ? rem : 5000);
      }
    }
  }, [activeInstallments]);

  const selectedInstallment = activeInstallments.find((i) => i.id === selectedInstallmentId);
  const requiredAmount = selectedInstallment ? (selectedInstallment.remainingAmount || selectedInstallment.amount) : 5000;

  const numAmount = Number(amountReceived) || 0;

  // Partial or Advance Detection
  const isPartial = numAmount > 0 && numAmount < requiredAmount;
  const isAdvance = numAmount > requiredAmount;
  const excessAmount = isAdvance ? numAmount - requiredAmount : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!activeMember) {
      setErrorMessage('Please select a member.');
      return;
    }

    if (!selectedInstallmentId) {
      setErrorMessage('Please select an installment to collect.');
      return;
    }

    const cleanAmount = String(amountReceived).replace(/[^0-9]/g, '');
    const finalAmount = Number(cleanAmount);
    if (!cleanAmount || isNaN(finalAmount) || finalAmount <= 0) {
      setErrorMessage('برائے مہربانی وصول شدہ رقم درج کریں۔ (Please enter a valid amount greater than 0)');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await recordPayment({
        memberId: activeMember.id,
        installmentId: selectedInstallmentId,
        amountReceived: finalAmount,
        paymentMethod,
        paymentDate,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        collectedBy: staffName || 'Staff Counter',
        allocationType: isAdvance ? allocationType : 'current',
      });

      setIsSubmitting(false);
      onClose();
      onPaymentSuccess(result.receipt);
    } catch (err: any) {
      console.error('Payment error:', err);
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Payment could not be recorded. Please try again.');
    }
  };

  return (
    <div 
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header - Fixed at Top */}
        <div className="bg-[#064E3B] px-5 sm:px-7 py-4 text-white flex items-center justify-between border-b border-emerald-800 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <HandCoins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg tracking-wide text-white truncate">
                قسط وصول کریں (Qist Wasool Karein)
              </h3>
              <p className="text-xs text-amber-300 font-medium mt-0.5 truncate">
                Record Physical Installment Payment & Issue Official Receipt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-emerald-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Only the form content inside scrolls, rest is locked */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Member Selection (if opened globally) */}
          {!initialMember ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                ممبر منتخب کریں (Select Member) *
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNumber} — {m.fullName} ({m.planMonths}M Plan, Due: {formatPKR(m.dueAmount)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  ممبر کی تفصیلات (Selected Member)
                </span>
                <span className="font-extrabold text-base text-emerald-950 block">{activeMember?.fullName}</span>
                <p className="text-xs text-emerald-700 font-medium">والد کا نام: {activeMember?.fatherName || '—'}</p>
              </div>
              <div className="text-right space-y-1">
                <span className="px-3 py-1 bg-emerald-200/90 text-emerald-950 font-mono font-black text-xs rounded-lg inline-block shadow-xs">
                  {activeMember?.memberNumber}
                </span>
                <p className="text-xs text-slate-600 font-medium">
                  باقی واجب الادا: <span className="font-extrabold text-amber-800">{formatPKR(activeMember?.dueAmount)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Installment Selector & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                قسط نمبر (Installment No.)
              </label>
              <select
                value={selectedInstallmentId}
                onChange={(e) => {
                  setSelectedInstallmentId(e.target.value);
                  const inst = activeInstallments.find((i) => i.id === e.target.value);
                  if (inst) {
                    const rem = inst.remainingAmount || inst.amount;
                    setAmountReceived(rem);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
              >
                {activeInstallments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    Qist #{inst.installmentNumber} ({inst.status} - Due: {formatPKR(inst.remainingAmount || inst.amount)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                مقررہ تاریخ (Due Date: 10th)
              </label>
              <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono font-bold flex items-center justify-between shadow-xs">
                <span>{selectedInstallment ? selectedInstallment.dueDate : '2027-01-10'}</span>
                <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-sans font-bold">
                  10 تاریخ تک
                </span>
              </div>
            </div>
          </div>

          {/* Amount Received & Required */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider">
                وصول شدہ رقم (Amount Received PKR) *
              </label>
              <div className="relative">
                <input
                  id="qist-amount-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={amountReceived}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAmountReceived(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3.5 py-2.5 text-base font-black text-emerald-950 border border-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-emerald-50/50 shadow-xs focus:outline-hidden"
                  placeholder="5000"
                />
              </div>
              {/* Quick Selection Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[5000, 6000, 7000, 8000, 9000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountReceived(amt)}
                    className={`px-2 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      numAmount === amt
                        ? 'bg-amber-400 text-emerald-950 shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Rs. {amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                5,000 سے لے کر 10,000 روپے تک کوئی بھی رقم درج کی جا سکتی ہے۔
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                مطلوبہ قسط رقم (Expected Installment)
              </label>
              <div className="px-3.5 py-2.5 text-base border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-extrabold shadow-xs flex items-center">
                {formatPKR(requiredAmount)}
              </div>
            </div>
          </div>

          {/* Partial Payment Notice */}
          {isPartial && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <span>Partial Payment Detected</span>
              </div>
              <p>
                Paid: <strong>Rs. {amountReceived.toLocaleString()}</strong> | Remaining for this installment: <strong>Rs. {(requiredAmount - amountReceived).toLocaleString()}</strong>.
              </p>
              <p className="text-[11px] text-amber-700">
                Installment status will be marked as <strong>Partial</strong>.
              </p>
            </div>
          )}

          {/* Advance Payment Notice & Allocation Controls */}
          {isAdvance && (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl text-xs text-blue-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <Info className="w-4 h-4" />
                <span>Advance Payment Detected (+Rs. {excessAmount.toLocaleString()})</span>
              </div>
              <p className="text-[11px]">
                Installment #{selectedInstallment?.installmentNumber} will be marked as Paid (Rs. {requiredAmount.toLocaleString()}). How would you like to allocate the extra Rs. {excessAmount.toLocaleString()}?
              </p>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allocation"
                    value="next"
                    checked={allocationType === 'next'}
                    onChange={() => setAllocationType('next')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Apply to next installment (Qist #{((selectedInstallment?.installmentNumber || 1) + 1)})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allocation"
                    value="advance"
                    checked={allocationType === 'advance'}
                    onChange={() => setAllocationType('advance')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Keep as advance balance (Rs. {excessAmount.toLocaleString()})</span>
                </label>
              </div>
            </div>
          )}

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                ادائیگی کا طریقہ (Payment Method) *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
              >
                <option value="Cash">Cash (کاؤنٹر نقد ادائیگی)</option>
                <option value="EasyPaisa">EasyPaisa (ایزی پیسہ سلپ / ایپ)</option>
                <option value="JazzCash">JazzCash (جاز کیش سلپ / ایپ)</option>
                <option value="Other">Other Direct Handover / Bank</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                تاریخ وصولی (Payment Date) *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden text-slate-800"
              />
            </div>
          </div>

          {/* Transaction / Reference Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              حوالہ / سلپ یا ٹرانزیکشن نمبر (Reference / TID)
            </label>
            <input
              type="text"
              placeholder={paymentMethod === 'Cash' ? 'کاؤنٹر کیش سلپ یا رسید نمبر' : 'TID / Ref # (e.g. EP-9876543)'}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              تفصیل / ریمارکس (Notes / Remarks)
            </label>
            <input
              type="text"
              placeholder="مثلاً: دفتر کاؤنٹر پر وصولی، بھائی نے جمع کرائی"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
            />
          </div>

          {/* Offline manual payment reminder */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>فوری رسید جنریٹ ہوگی اور ایڈمن دستخط کے ساتھ پرنٹ کی جا سکے گی۔</span>
          </div>
        </div>

        {/* Action Buttons - Fixed & Locked at Bottom */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            منسوخ (Cancel)
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 sm:px-6 py-2.5 sm:py-3 bg-amber-400 hover:bg-amber-300 active:scale-98 disabled:bg-amber-200 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>ریکارڈنگ جاری ہے...</span>
            ) : (
              <>
                <ReceiptText className="w-4 h-4" />
                <span>قسط وصول کریں اور رسید بنائیں</span>
              </>
            )}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
