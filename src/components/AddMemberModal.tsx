import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Calendar,
  Phone,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Member, MemberStatus } from '../types';
import { getNextMembershipNumber, createMember } from '../services/firebaseService';
import { DEFAULT_MONTHLY_INSTALLMENT, PLAN_A_TOTAL, PLAN_B_TOTAL, formatPKR } from '../utils/calculations';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberCreated: (member: Member) => void;
  currentUserEmail: string;
  existingMembers?: Member[];
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onMemberCreated,
  currentUserEmail,
  existingMembers = [],
}) => {
  const [memberNumber, setMemberNumber] = useState('MZ-#001');
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState('2027-01-01');
  const [planMonths, setPlanMonths] = useState<24 | 36>(24);
  const [monthlyInstallment, setMonthlyInstallment] = useState<number | string>(5000);
  const [registrationFee, setRegistrationFee] = useState<number | string>(1000);
  const [registrationFeeStatus, setRegistrationFeeStatus] = useState<'Paid' | 'Unpaid'>('Paid');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeCnic, setNomineeCnic] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MemberStatus>('Active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Instant local calculation of next membership number to avoid click delay
  useEffect(() => {
    if (isOpen) {
      if (existingMembers && existingMembers.length > 0) {
        let maxNumber = 1;
        for (const m of existingMembers) {
          const match = m.memberNumber?.match(/MZ-#(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= maxNumber) maxNumber = num + 1;
          }
        }
        setMemberNumber(`MZ-#${String(maxNumber).padStart(3, '0')}`);
      } else {
        getNextMembershipNumber().then((num) => setMemberNumber(num));
      }
    }
  }, [isOpen, existingMembers]);

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

  if (!isOpen) return null;

  const cleanNum = Number(String(monthlyInstallment).replace(/[^0-9]/g, ''));
  const validMonthly = isNaN(cleanNum) || cleanNum < 5000 ? 5000 : Math.min(10000, cleanNum);
  const totalAmount = planMonths * validMonthly;

  const quickAmounts = [5000, 6000, 7000, 8000, 9000, 10000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('برائے مہربانی ممبر کا پورا نام درج کریں۔ (Please enter member full name)');
      return;
    }
    if (!mobile.trim()) {
      setErrorMessage('برائے مہربانی موبائل نمبر درج کریں۔ (Please enter member mobile number)');
      return;
    }

    const cleanMonthly = String(monthlyInstallment).replace(/[^0-9]/g, '');
    const finalMonthly = Number(cleanMonthly);
    if (!cleanMonthly || isNaN(finalMonthly) || finalMonthly < 5000 || finalMonthly > 10000) {
      setErrorMessage('ماہانہ قسط کی رقم 5,000 سے 10,000 روپے کے درمیان ہونی چاہیے (5,000 سے 10,000 تک ممبر کی مرضی ہے)۔');
      return;
    }

    try {
      setIsSubmitting(true);
      const newMember = await createMember(
        {
          memberNumber,
          fullName: fullName.trim(),
          fatherName: fatherName.trim(),
          cnic: cnic.trim(),
          mobile: mobile.trim(),
          whatsapp: whatsapp.trim() || mobile.trim(),
          address: address.trim(),
          joiningDate,
          planMonths,
          monthlyInstallment: finalMonthly,
          totalCommitteeAmount: planMonths * finalMonthly,
          registrationFee: Number(registrationFee) || 0,
          registrationFeeStatus,
          nomineeName: nomineeName.trim(),
          nomineeRelation: nomineeRelation.trim(),
          nomineeCnic: nomineeCnic.trim(),
          nomineeMobile: nomineeMobile.trim(),
          status,
          notes: notes.trim(),
        },
        currentUserEmail
      );

      setIsSubmitting(false);
      onClose();
      onMemberCreated(newMember);
    } catch (err: any) {
      console.error('Error creating member:', err);
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Could not register member. Please try again.');
    }
  };

  return (
    <div 
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] my-0 sm:my-auto">
        {/* Header - Fixed & Sticky on Mobile so it is NEVER cut off */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0 shadow-md border-b border-emerald-800/60">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base tracking-wide text-white truncate">
                نئی ممبرشپ رجسٹریشن (Member Registration)
              </h3>
              <p className="text-[10px] sm:text-xs text-amber-300 font-medium truncate">
                5,000 تا 10,000 روپے ماہانہ قسط • خودکار اقساط شیڈول
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-emerald-800/80 transition-colors shrink-0 ml-2 cursor-pointer active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container - Only the inner body scrolls, header and footer are pinned */}
        <form 
          id="add-member-form" 
          noValidate 
          onSubmit={handleSubmit} 
          className="flex-1 flex flex-col overflow-hidden min-h-0"
        >
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 sm:space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Membership & Plan Selection */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                1. کمیٹی پلان اور ممبرشپ (Plan & Installment Calculation)
              </h4>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md">
                آغاز: 01 جنوری 2027 (مقررہ تاریخ: ہر ماہ کی 10)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ممبرشپ نمبر (Membership No.)
                </label>
                <input
                  type="text"
                  required
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  کمیٹی پلان منتخب کریں (24 یا 36 ماہ) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanMonths(24)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center flex flex-col items-center justify-center cursor-pointer ${
                      planMonths === 24
                        ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-600/30'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>24 ماہ پلان (2 سال)</span>
                    <span className="text-[10px] opacity-80 mt-0.5">24 Months Plan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlanMonths(36)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center flex flex-col items-center justify-center cursor-pointer ${
                      planMonths === 36
                        ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-600/30'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>36 ماہ پلان (3 سال)</span>
                    <span className="text-[10px] opacity-80 mt-0.5">36 Months Plan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly Installment: Min 5,000 to Max 10,000 */}
            <div className="space-y-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  ماہانہ قسط کی رقم (Monthly Installment: Rs. 5,000 — 10,000) *
                </label>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  {formatPKR(validMonthly)} / ماہ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      PKR
                    </span>
                    <input
                      id="monthly-installment-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={monthlyInstallment}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setMonthlyInstallment(val);
                      }}
                      onBlur={() => {
                        const num = Number(monthlyInstallment);
                        if (!monthlyInstallment || isNaN(num) || num < 5000) {
                          setMonthlyInstallment(5000);
                        } else if (num > 10000) {
                          setMonthlyInstallment(10000);
                        }
                      }}
                      className="w-full pl-12 pr-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                      placeholder="5000"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">
                    ممبر 5,000 سے لے کر 10,000 روپے تک اپنی مرضی سے کوئی بھی رقم منتخب کر سکتے ہیں۔
                  </p>
                </div>

                {/* Quick Selection Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMonthlyInstallment(amt)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        Number(monthlyInstallment) === amt
                          ? 'bg-amber-400 text-emerald-950 shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Real-time Dynamic Calculation Preview Card */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                  کل کمیٹی رقم (Total Committee Calculation)
                </span>
                <span className="text-xl font-black text-amber-400 tracking-tight">
                  {formatPKR(totalAmount)}
                </span>
                <p className="text-[11px] text-emerald-200 mt-0.5">
                  حساب: {planMonths} اقساط × {formatPKR(validMonthly)} ماہانہ
                </p>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-800 pt-2 sm:pt-0 sm:pl-4 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                  کمیٹی شیڈول و مقررہ تاریخ
                </span>
                <p className="text-xs font-bold text-white">
                  01 جنوری 2027 سے آغاز
                </p>
                <p className="text-[11px] text-amber-300 font-semibold">
                  ہر ماہ کی 10 تاریخ تک ادائیگی لازم ہے (ورنہ Overdue)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  تاریخ شمولیت (Joining Date) *
                </label>
                <input
                  type="date"
                  required
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  رجسٹریشن فیس (Registration Fee)
                </label>
                <input
                  type="number"
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  فیس ادائیگی کی کیفیت
                </label>
                <select
                  value={registrationFeeStatus}
                  onChange={(e) => setRegistrationFeeStatus(e.target.value as 'Paid' | 'Unpaid')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                >
                  <option value="Paid">Paid (ادا شدہ)</option>
                  <option value="Unpaid">Unpaid (غیر ادا شدہ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Personal Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              2. Member Personal Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hafiz Muhammad Usman"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Father's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Rafiq"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CNIC (National ID)
                </label>
                <input
                  type="text"
                  placeholder="42101-XXXXXXX-X"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0300-1234567"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Member Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MemberStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="Flat/House, Street, Area, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              3. Nominee / Next of Kin
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominee Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Abdul Rehman"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  placeholder="Brother / Son / Spouse / Father"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominee CNIC
                </label>
                <input
                  type="text"
                  placeholder="42101-XXXXXXX-X"
                  value={nomineeCnic}
                  onChange={(e) => setNomineeCnic(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominee Mobile
                </label>
                <input
                  type="text"
                  placeholder="03XX-XXXXXXX"
                  value={nomineeMobile}
                  onChange={(e) => setNomineeMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Committee Notes
            </label>
            <textarea
              rows={2}
              placeholder="Any special remarks or references..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          </div>

          {/* Action Buttons - Fixed & Locked at Bottom */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Registering & Generating Schedule...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Register Member ({planMonths} Installments)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
