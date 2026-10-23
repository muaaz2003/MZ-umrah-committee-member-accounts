import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  HandCoins,
  ReceiptText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  Users,
  ChevronDown,
  Check,
  Info,
  Sparkles,
  Edit2,
} from 'lucide-react';
import { Member, Installment, PaymentMethod, Receipt } from '../types';
import { formatPKR, calculateInstallmentDueDate } from '../utils/calculations';
import { recordPayment, recordManualPayment, deleteReceiptAndRevertPayment } from '../services/firebaseService';
import mzaLogo from '../assets/images/mza-logo.png';

interface QistWasoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  installments: Installment[];
  allMembers: Member[];
  allInstallments?: Installment[];
  onPaymentSuccess: (receipt: Receipt) => void;
  staffName: string;
  editingReceipt?: Receipt | null;
}

export const QistWasoolModal: React.FC<QistWasoolModalProps> = ({
  isOpen,
  onClose,
  member: initialMember,
  installments: initialInstallments,
  allMembers,
  allInstallments = [],
  onPaymentSuccess,
  staffName,
  editingReceipt,
}) => {
  // Combobox input & menu state (Country-style select & manual write)
  const [nameInput, setNameInput] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Installment selection for registered member
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');

  // Optional manual details (when manual name is typed)
  const [manualFather, setManualFather] = useState<string>('');
  const [manualMobile, setManualMobile] = useState<string>('');
  const [manualInstallmentDesc, setManualInstallmentDesc] = useState<string>('عمرہ کمیٹی قسط');
  const [manualRef, setManualRef] = useState<string>('');

  // Payment details
  const [amountReceived, setAmountReceived] = useState<number | string>(5000);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allocationType, setAllocationType] = useState<'current' | 'next' | 'advance'>('current');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  // Synchronize initial member selection and editingReceipt
  useEffect(() => {
    if (isOpen) {
      if (editingReceipt) {
        // When editing an existing receipt
        const targetMember = initialMember || allMembers.find((m) => m.id === editingReceipt.memberId) || null;
        if (targetMember) {
          setSelectedMember(targetMember);
          setNameInput(targetMember.fullName);
          setManualFather(targetMember.fatherName || '');
          setManualMobile(targetMember.mobile || '');
        } else {
          setSelectedMember(null);
          setNameInput(editingReceipt.memberName || '');
          setManualFather(editingReceipt.fatherName || '');
          setManualMobile(editingReceipt.mobile || '');
          setManualInstallmentDesc(editingReceipt.installmentDescription || 'عمرہ کمیٹی قسط');
        }

        setAmountReceived(editingReceipt.amount || 5000);
        setPaymentDate(editingReceipt.paymentDate || new Date().toISOString().split('T')[0]);
        setPaymentMethod(editingReceipt.paymentMethod || 'Cash');
        setReferenceNumber(editingReceipt.referenceNumber || editingReceipt.transactionRef || '');
        setNotes(editingReceipt.notes || '');

        if (editingReceipt.installmentNumber && allInstallments && allInstallments.length > 0) {
          const matchInst = allInstallments.find(
            (i) => i.memberId === editingReceipt.memberId && i.installmentNumber === editingReceipt.installmentNumber
          );
          if (matchInst) {
            setSelectedInstallmentId(matchInst.id);
          }
        }
      } else if (initialMember) {
        setSelectedMember(initialMember);
        setNameInput(initialMember.fullName);
        setManualFather(initialMember.fatherName || '');
        setManualMobile(initialMember.mobile || '');
        const monthly = initialMember.monthlyInstallment || 5000;
        setAmountReceived(monthly);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('Cash');
        setReferenceNumber('');
        setNotes('');
      } else {
        setSelectedMember(null);
        setNameInput('');
        setManualFather('');
        setManualMobile('');
        setAmountReceived(5000);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('Cash');
        setReferenceNumber('');
        setNotes('');
      }
      setIsMenuOpen(false);
      setErrorMessage('');
    }
  }, [isOpen, initialMember, editingReceipt, allMembers, allInstallments]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter registered members by typed input
  const filteredMembers = useMemo(() => {
    const q = nameInput.trim().toLowerCase();
    if (!q) return allMembers;
    return allMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        (m.fatherName && m.fatherName.toLowerCase().includes(q)) ||
        (m.mobile && m.mobile.includes(q))
    );
  }, [nameInput, allMembers]);

  // Active installments resolution for selected registered member
  const activeInstallments = useMemo(() => {
    if (!selectedMember) return [];
    if (allInstallments && allInstallments.length > 0) {
      const filtered = allInstallments.filter((i) => i.memberId === selectedMember.id);
      if (filtered.length > 0) return filtered;
    }
    if (initialMember && initialMember.id === selectedMember.id && initialInstallments.length > 0) {
      return initialInstallments;
    }
    // Fallback schedule for registered member
    const totalMonths = selectedMember.planMonths || 24;
    const monthlyAmt = selectedMember.monthlyInstallment || 5000;
    return Array.from({ length: totalMonths }, (_, idx) => ({
      id: `fallback_${selectedMember.id}_${idx + 1}`,
      memberId: selectedMember.id,
      installmentNumber: idx + 1,
      amount: monthlyAmt,
      paidAmount: 0,
      remainingAmount: monthlyAmt,
      dueDate: calculateInstallmentDueDate(selectedMember.firstInstallmentDueDate || '2026-10-10', idx + 1, 10),
      status: 'Due' as const,
      paymentId: '',
      receiptId: '',
      createdAt: new Date().toISOString(),
    }));
  }, [selectedMember, allInstallments, initialMember, initialInstallments]);

  // When active installments change, auto-select the first unpaid or due installment (ONLY when NOT editing receipt)
  useEffect(() => {
    if (editingReceipt) return;
    if (activeInstallments.length > 0) {
      const isUnpaid = (i: Installment) => {
        const rem = i.remainingAmount !== undefined ? i.remainingAmount : (i.amount - (i.paidAmount || 0));
        return rem > 0 && i.status !== 'Paid';
      };
      const firstUnpaid = activeInstallments.find(isUnpaid) || activeInstallments[0];
      if (firstUnpaid) {
        setSelectedInstallmentId(firstUnpaid.id);
        const rem = firstUnpaid.remainingAmount !== undefined ? firstUnpaid.remainingAmount : (firstUnpaid.amount - (firstUnpaid.paidAmount || 0));
        const defaultAmt = rem > 0 ? rem : (selectedMember?.monthlyInstallment || firstUnpaid.amount || 5000);
        setAmountReceived(defaultAmt);
      }
    }
  }, [activeInstallments, selectedMember, editingReceipt]);

  // Input change handler
  const handleNameChange = (val: string) => {
    setNameInput(val);
    setIsMenuOpen(true);
    // Check if input exactly matches a registered member name or number
    const exact = allMembers.find(
      (m) =>
        m.fullName.trim().toLowerCase() === val.trim().toLowerCase() ||
        m.memberNumber.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (exact) {
      setSelectedMember(exact);
      setManualFather(exact.fatherName || '');
      setManualMobile(exact.mobile || '');
      const monthly = exact.monthlyInstallment || 5000;
      setAmountReceived(monthly);
    } else {
      setSelectedMember(null);
    }
  };

  // Member selection from corner menu dropdown
  const handleSelectMember = (m: Member) => {
    setSelectedMember(m);
    setNameInput(m.fullName);
    setManualFather(m.fatherName || '');
    setManualMobile(m.mobile || '');
    setIsMenuOpen(false);
    const monthly = m.monthlyInstallment || 5000;
    setAmountReceived(monthly);
  };

  const selectedInstallment = activeInstallments.find((i) => i.id === selectedInstallmentId);
  const requiredAmount = selectedInstallment
    ? (selectedInstallment.remainingAmount !== undefined ? selectedInstallment.remainingAmount : (selectedInstallment.amount - (selectedInstallment.paidAmount || 0)))
    : (selectedMember?.monthlyInstallment || 5000);

  const numAmount = Number(amountReceived) || 0;

  // Partial or Advance Detection (Registered mode)
  const isPartial = Boolean(selectedMember) && numAmount > 0 && numAmount < requiredAmount;
  const isAdvance = Boolean(selectedMember) && numAmount > requiredAmount;
  const excessAmount = isAdvance ? numAmount - requiredAmount : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!nameInput.trim()) {
      setErrorMessage('برائے مہربانی ممبر کا نام لکھیں یا مینو سے منتخب کریں۔ (Please enter or select a member name)');
      return;
    }

    const cleanAmount = String(amountReceived).replace(/[^0-9]/g, '');
    const finalAmount = Number(cleanAmount);
    if (!cleanAmount || isNaN(finalAmount) || finalAmount <= 0) {
      setErrorMessage('برائے مہربانی وصول شدہ رقم درج کریں۔ رقم صفر (0) سے زیادہ ہونی چاہیے۔ (Please enter an amount greater than 0)');
      return;
    }

    // If editing an existing receipt, cleanly delete/revert the previous receipt and payment first so it doesn't double count
    if (editingReceipt) {
      try {
        setIsSubmitting(true);
        await deleteReceiptAndRevertPayment(editingReceipt.id, staffName || 'Staff Counter');
      } catch (err: any) {
        console.error('Failed to revert previous receipt before re-issuing:', err);
        setIsSubmitting(false);
        setErrorMessage('پرانی رسید منسوخ کرنے کے دوران خرابی پیش آئی۔ دوبارہ کوشش کریں۔');
        return;
      }
    }

    // Manual Entry (when not a registered member)
    if (!selectedMember) {
      try {
        setIsSubmitting(true);
        const result = await recordManualPayment({
          memberName: nameInput.trim(),
          fatherName: manualFather.trim(),
          mobile: manualMobile.trim(),
          memberNumber: manualRef.trim() || undefined,
          installmentDescription: manualInstallmentDesc.trim() || 'عمرہ کمیٹی قسط',
          amountReceived: finalAmount,
          paymentMethod,
          paymentDate,
          referenceNumber: referenceNumber.trim(),
          notes: notes.trim(),
          collectedBy: staffName || 'Staff Counter',
        });

        setIsSubmitting(false);
        onClose();
        if (result?.receipt) {
          onPaymentSuccess(result.receipt);
        }
      } catch (err: any) {
        console.error('Manual payment error:', err);
        setIsSubmitting(false);
        setErrorMessage(err.message || 'Payment could not be recorded. Please try again.');
      }
      return;
    }

    // Registered member submission
    if (!selectedInstallmentId) {
      setErrorMessage('برائے مہربانی قسط نمبر منتخب کریں۔ (Please select an installment to collect)');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await recordPayment({
        memberId: selectedMember.id,
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
      if (result?.receipt) {
        onPaymentSuccess(result.receipt);
      }
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
        <div className="bg-[#064E3B] px-4 sm:px-6 py-3.5 text-white flex items-center justify-between border-b border-emerald-800 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <img
              src={mzaLogo}
              alt="MZA Umrah Committee Logo"
              className="h-12 sm:h-14 w-auto object-contain shrink-0 drop-shadow-sm"
              draggable={false}
            />
            <div className="min-w-0 flex flex-col justify-center">
              <h3 className="font-black text-base sm:text-lg tracking-wide text-white truncate font-sans">
                {editingReceipt ? 'Edit Receipt & Re-issue' : 'Qist Wasool Karein'}
              </h3>
              <p className="text-xs text-amber-300 font-medium truncate font-sans">
                {editingReceipt
                  ? `Receipt #${editingReceipt.receiptNumber} Correction`
                  : 'MZA Umrah Committee Pakistan — Official Receipt Entry'}
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
          {editingReceipt && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-1.5 bg-amber-200 text-amber-900 rounded-lg font-bold shrink-0">
                  <Edit2 className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    رسید #{editingReceipt.receiptNumber} میں ترمیم ہو رہی ہے
                  </p>
                  <p className="text-[11px] text-amber-700 truncate">
                    معلومات درست کر کے محفوظ کریں۔ محفوظ کرنے پر پرانی رسید منسوخ ہو کر نئی رسید جاری ہوگی۔
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold bg-white px-2 py-1 rounded border border-amber-200 text-amber-800 text-[11px] shrink-0 ml-2">
                سابقہ: {formatPKR(editingReceipt.amount)}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unified Combobox: Text input with corner menu icon (like country selector) */}
          <div ref={comboboxRef} className="relative space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                ممبر کا نام (Member Name) *
              </label>
              <div className="flex items-center gap-1.5">
                {selectedMember ? (
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>رجسٹرڈ ممبر ({selectedMember.memberNumber})</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg">
                    دستی نام (Manual Input)
                  </span>
                )}
              </div>
            </div>

            {/* Input with embedded corner menu button */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className={`w-4 h-4 ${selectedMember ? 'text-emerald-700' : 'text-slate-400'}`} />
              </div>

              <input
                type="text"
                required
                placeholder="ممبر نام لکھیں"
                value={nameInput}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setIsMenuOpen(true)}
                className={`w-full pl-9 pr-28 py-2.5 text-sm font-semibold border rounded-xl shadow-xs transition-all outline-hidden ${
                  selectedMember
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/25 text-emerald-950'
                    : 'border-slate-300 focus:ring-2 focus:ring-emerald-600 bg-white text-slate-900'
                }`}
              />

              {/* Corner Action Area: Clear button + Registered Members Menu Button (like country selector) */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
                {nameInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput('');
                      setSelectedMember(null);
                      setManualFather('');
                      setManualMobile('');
                      setIsMenuOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="صاف کریں (Clear)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Corner Menu Button */}
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className={`h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                    isMenuOpen
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border-slate-200'
                  }`}
                  title="رجسٹرڈ ممبرز کی فہرست کھولیں"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-700 group-hover:text-emerald-900" />
                  <span className="text-[11px]">ممبرز</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown Menu showing all registered members */}
              {isMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-64 sm:max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 bg-slate-50/95 flex items-center justify-between text-xs font-bold text-slate-600 sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-700" />
                      <span>رجسٹرڈ ممبران ({filteredMembers.length} / {allMembers.length})</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      انتخاب کے لیے کلک کریں
                    </span>
                  </div>

                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((m) => {
                      const isSelected = selectedMember?.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMember(m)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-emerald-50 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-emerald-50 font-bold' : ''
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 truncate">
                                {m.fullName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-900 font-mono font-bold rounded shrink-0">
                                {m.memberNumber}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {m.fatherName ? `ولد: ${m.fatherName}` : ''} {m.mobile ? `• ${m.mobile}` : ''} • پلان: {m.planMonths} ماہ
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block">واجب الادا</span>
                            <span className="text-xs font-bold text-amber-800 font-mono">
                              {formatPKR(m.dueAmount)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-xs text-slate-600 font-semibold">"{nameInput}" کے نام سے کوئی رجسٹرڈ ممبر نہیں ملا۔</p>
                      <p className="text-[11px] text-emerald-700 mt-1">
                        آپ اس نام کے ساتھ بطور **دستی ادائیگی (Manual Payment)** فارم جمع کر سکتے ہیں۔
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conditional Detail: If Registered Member is Selected */}
          {selectedMember && (
            <>
              {/* Selected Member Details Card */}
              <div className="p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex items-center justify-between shadow-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    منتخب ممبر کی تفصیلات
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-emerald-950 block truncate">
                    {selectedMember.fullName}
                  </span>
                  <p className="text-xs text-emerald-700 font-medium">
                    والد: {selectedMember.fatherName || '—'} • فون: {selectedMember.mobile || '—'}
                  </p>
                </div>
                <div className="text-right space-y-1 shrink-0">
                  <span className="px-2.5 py-0.5 bg-emerald-200/90 text-emerald-950 font-mono font-black text-xs rounded-lg inline-block shadow-xs">
                    {selectedMember.memberNumber}
                  </span>
                  <p className="text-xs text-slate-600 font-medium">
                    باقی واجب الادا: <span className="font-extrabold text-amber-800">{formatPKR(selectedMember.dueAmount)}</span>
                  </p>
                </div>
              </div>

              {/* Installment Selector & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    قسط نمبر (Installment No.) *
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
                    {activeInstallments.map((inst) => {
                      const isCoveredByEditing = editingReceipt && (
                        inst.installmentNumber === editingReceipt.installmentNumber ||
                        (editingReceipt.installmentsCovered && editingReceipt.installmentsCovered.includes(inst.installmentNumber))
                      );
                      const rem = inst.remainingAmount !== undefined ? inst.remainingAmount : (inst.amount - (inst.paidAmount || 0));
                      const statusLabel = isCoveredByEditing ? 'Being Edited' : inst.status;
                      const dueLabel = isCoveredByEditing ? formatPKR(editingReceipt.amount || inst.amount) : formatPKR(rem || inst.amount);
                      return (
                        <option key={inst.id} value={inst.id}>
                          Qist #{inst.installmentNumber} ({statusLabel} - Due: {dueLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    مقررہ تاریخ (Due Date: 10th)
                  </label>
                  <div className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono font-bold flex items-center justify-between shadow-xs">
                    <span>{selectedInstallment ? selectedInstallment.dueDate : (selectedMember?.firstInstallmentDueDate || '2026-10-10')}</span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-sans font-bold">
                      10 تاریخ تک
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

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
              {/* Quick Selection Chips based on member's monthly installment */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(() => {
                  const monthly = selectedMember?.monthlyInstallment || 5000;
                  const chips = [
                    { label: `1 قسط (${formatPKR(monthly)})`, val: monthly },
                    { label: `2 قسطیں (${formatPKR(monthly * 2)})`, val: monthly * 2 },
                    { label: `3 قسطیں (${formatPKR(monthly * 3)})`, val: monthly * 3 },
                    { label: `4 قسطیں (${formatPKR(monthly * 4)})`, val: monthly * 4 },
                    { label: `5 قسطیں (${formatPKR(monthly * 5)})`, val: monthly * 5 },
                    { label: `6 قسطیں (${formatPKR(monthly * 6)})`, val: monthly * 6 },
                  ];
                  return chips.map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setAmountReceived(chip.val)}
                      className={`flex-1 min-w-[90px] py-1.5 px-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center border ${
                        numAmount === chip.val
                          ? 'bg-amber-400 text-emerald-950 border-amber-500 shadow-xs font-black'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ));
                })()}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                ایک ساتھ 2، 3 یا 4 اقساط جمع کرنے پر خودکار اگلی اقساط ادا ہوں گی اور ایک ہی رسید بنے گی۔
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

          {/* Multi-Installment Allocation Live Preview */}
          {(() => {
            if (!selectedMember || numAmount <= requiredAmount) return null;
            const unpaid = activeInstallments.filter((i) => {
              const rem = i.remainingAmount !== undefined ? i.remainingAmount : (i.amount - (i.paidAmount || 0));
              return rem > 0 && i.status !== 'Paid';
            });
            const coveredList: { num: number; amt: number }[] = [];
            let tempAmt = numAmount;
            for (const inst of unpaid) {
              if (tempAmt <= 0) break;
              const needed = inst.remainingAmount !== undefined ? inst.remainingAmount : (inst.amount - (inst.paidAmount || 0));
              const alloc = Math.min(tempAmt, needed);
              coveredList.push({ num: inst.installmentNumber, amt: alloc });
              tempAmt -= alloc;
            }

            if (coveredList.length <= 1 && tempAmt === 0) return null;

            return (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>متعدد اقساط کی خودکار وصولی (Automatic Multi-Month Allocation)</span>
                </div>
                <p className="font-semibold text-emerald-900">
                  یہ رقم ({formatPKR(numAmount)}) درج ذیل اقساط کے کھاتے میں خودکار درج ہوگی اور کل رقم کی ایک مشترکہ رسید جاری ہوگی:
                </p>
                <div className="font-mono text-emerald-900 bg-white/90 p-2.5 rounded-lg border border-emerald-200 font-bold text-xs space-y-1">
                  <div>
                    قسط #{coveredList.map((c) => c.num).join('، #')}
                    {tempAmt > 0 ? ` + اضافی پیشگی رقم: ${formatPKR(tempAmt)}` : ''}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-sans font-medium">
                    (کل {coveredList.length} اقساط ادا ہوں گی • کل رقم: {formatPKR(numAmount)})
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Partial Payment Notice */}
          {isPartial && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <span>Partial Payment Detected</span>
              </div>
              <p>
                Paid: <strong>Rs. {Number(amountReceived).toLocaleString()}</strong> | Remaining for this installment: <strong>Rs. {(requiredAmount - Number(amountReceived)).toLocaleString()}</strong>.
              </p>
              <p className="text-[11px] text-amber-700">
                Installment status will be marked as <strong>Partial</strong>.
              </p>
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

          {/* Reference / TID (Only shown when NOT Cash) & Notes / Remarks */}
          <div className={`grid grid-cols-1 ${paymentMethod !== 'Cash' ? 'sm:grid-cols-2' : ''} gap-3.5`}>
            {paymentMethod !== 'Cash' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ٹرانزیکشن حوالہ نمبر (Transaction ID / Reference)
                </label>
                <input
                  type="text"
                  placeholder="TID / Ref # (e.g. EP-9876543, TRX-12345)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 bg-white shadow-xs focus:outline-hidden"
                />
              </div>
            )}

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
              <span>
                {editingReceipt ? 'درستگی اور نئی رسید جاری ہو رہی ہے...' : 'ریکارڈنگ جاری ہے...'}
              </span>
            ) : (
              <>
                <ReceiptText className="w-4 h-4" />
                <span>
                  {editingReceipt ? 'رسید درست کریں اور نئی رسید بنائیں' : 'قسط وصول کریں اور رسید بنائیں'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
