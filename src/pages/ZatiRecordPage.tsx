import React, { useState, useMemo } from 'react';
import {
  Search,
  User,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Printer,
  Calendar,
  Phone,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
  Download,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Member, Installment, Receipt } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface ZatiRecordPageProps {
  members: Member[];
  installments: Installment[];
  receipts: Receipt[];
  onOpenReceipt: (receipt: Receipt) => void;
  onOpenAdminLogin: () => void;
  isAdminLoggedIn: boolean;
}

export const ZatiRecordPage: React.FC<ZatiRecordPageProps> = ({
  members,
  installments,
  receipts,
  onOpenReceipt,
  onOpenAdminLogin,
  isAdminLoggedIn,
}) => {
  const [inputName, setInputName] = useState('');
  const [inputCnic, setInputCnic] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);

  // Normalization helper
  const cleanCnic = (val: string) => val.replace(/[^0-9]/g, '').trim();
  const cleanName = (val: string) => val.toLowerCase().replace(/\s+/g, ' ').trim();

  // Handle Search Submission
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = cleanName(inputName);
    const trimmedCnic = cleanCnic(inputCnic);

    if (!trimmedName || !trimmedCnic) {
      setHasSearched(true);
      setMatchedMember(null);
      return;
    }

    // STRICT MATCHING: Both Name and CNIC must match a registered member
    const found = members.find((m) => {
      const memberCnic = cleanCnic(m.cnic);
      const memberName = cleanName(m.fullName);

      // CNIC exact match on digits
      const cnicMatches = memberCnic === trimmedCnic;

      // Name matches exactly or contains full parts
      const nameMatches =
        memberName === trimmedName ||
        memberName.includes(trimmedName) ||
        trimmedName.includes(memberName);

      return cnicMatches && nameMatches;
    });

    setMatchedMember(found || null);
    setHasSearched(true);
  };

  const handleClear = () => {
    setInputName('');
    setInputCnic('');
    setHasSearched(false);
    setMatchedMember(null);
  };

  // Quick fill helper for testing/demo
  const handleQuickDemo = (demoMember: Member) => {
    setInputName(demoMember.fullName);
    setInputCnic(demoMember.cnic);
    setMatchedMember(demoMember);
    setHasSearched(true);
  };

  // Matched Member's installments sorted by installmentNumber 1 to 24 or 36
  const memberInstallments = useMemo(() => {
    if (!matchedMember) return [];
    return installments
      .filter((i) => i.memberId === matchedMember.id)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
  }, [matchedMember, installments]);

  // Matched Member's receipts
  const memberReceipts = useMemo(() => {
    if (!matchedMember) return [];
    return receipts
      .filter((r) => r.memberId === matchedMember.id)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [matchedMember, receipts]);

  // Completion calculation
  const progressPercent = matchedMember && matchedMember.totalCommitteeAmount > 0
    ? Math.min(100, Math.round((matchedMember.paidAmount / matchedMember.totalCommitteeAmount) * 1000) / 10)
    : 0;

  const paidCount = memberInstallments.filter((i) => i.status === 'Paid').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Welcome & Announcement Header */}
      <div className="bg-[#064E3B] rounded-3xl p-6 sm:p-10 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5" dir="rtl">
              <span className="text-xs font-bold px-3 py-1 bg-amber-400 text-emerald-950 rounded-full flex items-center gap-1.5 shadow-2xs font-sans">
                <span className="font-urdu">عوامی ممبر پورٹل</span>
                <span dir="ltr" className="text-[10px] font-extrabold font-sans uppercase tracking-wider">(PUBLIC PORTAL)</span>
              </span>
              <span className="text-xs text-emerald-200/90 font-medium font-urdu">ایم زیڈ عمرہ کمیٹی پاکستان</span>
            </div>

            {!isAdminLoggedIn ? (
              <button
                onClick={onOpenAdminLogin}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Login</span>
              </button>
            ) : (
              <div className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-medium border border-amber-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Session Active</span>
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white font-sans">
            MZ Umrah Committee Performance & Financial Records
          </h1>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-300 font-urdu" dir="rtl">
            اپنا ذاتی ریکارڈ تلاش کریں
          </h2>
        </div>
      </div>

      {/* 2-Input Search Form Box */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="border-b border-gray-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3" dir="rtl">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 font-urdu">
              <Search className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>تصدیق برائے ذاتی کھاتہ</span>
              <span dir="ltr" className="text-xs font-semibold text-gray-500 font-sans">(Personal Ledger Verification)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1 font-urdu">
              سیکیورٹی کی خاطر ریکارڈ صرف اسی وقت ظاہر ہوگا جب نام اور CNIC دونوں بالکل میچ ہوں گے۔
            </p>
          </div>
          {hasSearched && (
            <button
              onClick={handleClear}
              className="text-xs text-gray-500 hover:text-emerald-800 flex items-center gap-1 cursor-pointer font-medium font-urdu self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>دوبارہ تلاش کریں</span>
              <span dir="ltr" className="text-[11px] font-sans font-semibold">(Reset)</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Input 1: Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 text-right font-urdu" dir="rtl">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-gray-900 font-black">مکمل نام</span>
                  <span dir="ltr" className="font-sans text-[11px] font-bold text-gray-600">(FULL NAME)</span>
                  <span className="text-rose-500 font-bold text-sm">*</span>
                </span>
              </label>
              <div className="relative" dir="rtl">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="مثلاً: حافظ محمد عثمان / Hafiz Muhammad Usman"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-hidden transition-all text-right font-urdu"
                  dir="rtl"
                />
              </div>
              <span className="text-[11px] text-gray-500 mt-1.5 block text-right font-urdu" dir="rtl">
                کمیٹی فارم کے مطابق انگریزی یا اردو میں نام درج کریں۔
              </span>
            </div>

            {/* Input 2: CNIC */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 text-right font-urdu" dir="rtl">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-gray-900 font-black">شناختی کارڈ نمبر</span>
                  <span dir="ltr" className="font-sans text-[11px] font-bold text-gray-600">(CNIC)</span>
                  <span className="text-rose-500 font-bold text-sm">*</span>
                </span>
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="42101-1234567-1 یا 4210112345671"
                  value={inputCnic}
                  onChange={(e) => setInputCnic(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-hidden transition-all text-left"
                  dir="ltr"
                />
              </div>
              <span className="text-[11px] text-gray-500 mt-1.5 block text-right font-urdu" dir="rtl">
                13 ہندسوں کا قومی شناختی کارڈ نمبر (ڈیش کے ساتھ یا بغیر)
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4" dir="rtl">
            <button
              type="submit"
              dir="rtl"
              className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 font-urdu"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>ریکارڈ تلاش کریں</span>
              <span dir="ltr" className="font-sans text-[11px] font-black tracking-wide">(SEARCH RECORD)</span>
            </button>

            {/* Quick Demo Sample Pills without "مثال برائے ٹیسٹ:" span in RTL */}
            {members.length > 0 && !matchedMember && (
              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5 justify-end" dir="rtl">
                {members.slice(0, 3).map((demoMember) => (
                  <button
                    key={demoMember.id}
                    type="button"
                    onClick={() => handleQuickDemo(demoMember)}
                    className="px-3 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-gray-200 font-urdu"
                  >
                    {demoMember.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* MATCH NOT FOUND ALERT (When searched but name or cnic didn't match) */}
      {hasSearched && !matchedMember && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 sm:p-8 text-rose-900 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950">
                معذرت! درج کردہ معلومات کا کوئی ریکارڈ نہیں ملا
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                نام اور شناختی کارڈ (CNIC) دونوں کا میچ ہونا لازمی ہے۔
              </p>
            </div>
          </div>

          <div className="text-xs text-rose-800/90 leading-relaxed bg-white/70 p-4 rounded-xl border border-rose-100">
            <ul className="list-disc list-inside space-y-1.5">
              <li>براہ کرم چیک کریں کہ نام کے ہجے (Spelling) بالکل وہی ہیں جو کمیٹی کے ریکارڈ میں درج ہیں۔</li>
              <li>شناختی کارڈ نمبر (13 ہندسے) کی جانچ پڑتال کریں۔</li>
              <li>اگر آپ نے حال ہی میں کمیٹی میں شمولیت اختیار کی ہے یا تفصیلات تبدیل ہوئی ہیں تو برائے مہربانی ایڈمن <strong>عبد الشکور مدنی</strong> (+92 300 8765432) سے رابطہ فرمائیں۔</li>
            </ul>
          </div>
        </div>
      )}

      {/* VERIFIED MEMBER RECORD DISPLAY (SHOWN ONLY WHEN BOTH NAME & CNIC MATCH) */}
      {matchedMember && (
        <div className="space-y-6">
          {/* Official Verification Header Ribbon */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" dir="rtl">
            <div className="flex items-center gap-2.5 text-xs text-emerald-900 font-semibold font-urdu">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                تصدیق شدہ ذاتی کھاتہ: <strong>{matchedMember.fullName}</strong> ({matchedMember.memberNumber}) • جملہ معلومات محفوظ ہیں
              </span>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-300 shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer no-print self-start sm:self-auto font-urdu"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700" />
              <span>پاس بک پرنٹ کریں</span>
              <span dir="ltr" className="font-sans text-[11px] font-semibold text-emerald-800">(Print Statement)</span>
            </button>
          </div>

          {/* Member Profile Card */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#064E3B] text-white p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-3 py-0.5 bg-amber-500 text-emerald-950 font-mono font-bold text-xs rounded-md">
                      {matchedMember.memberNumber}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 bg-white/10 text-emerald-100 rounded-md border border-white/20">
                      {matchedMember.planMonths} ماہ کا عمرہ پلان ({matchedMember.planMonths === 24 ? '120,000 روپے' : '180,000 روپے'})
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-600 text-white rounded-md font-bold">
                      {matchedMember.status} Member
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">{matchedMember.fullName}</h2>
                  <p className="text-xs text-emerald-200 mt-1">
                    ولدیت: {matchedMember.fatherName || '—'} • شناختی کارڈ: {matchedMember.cnic}
                  </p>
                </div>

                <div className="text-xs text-emerald-100 space-y-1.5 md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-emerald-800">
                  <div className="flex items-center md:justify-end gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>موبائل: {matchedMember.mobile}</span>
                  </div>
                  <div className="flex items-center md:justify-end gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>شمولیت: {formatDateDisplay(matchedMember.joiningDate)}</span>
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    ایڈمن: عبد الشکور مدنی (MZ Umrah)
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Strip (4 Cards) */}
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    کل کمیٹی رقم
                  </span>
                  <div className="text-base sm:text-lg font-black text-gray-900 mt-1">
                    {formatPKR(matchedMember.totalCommitteeAmount)}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {matchedMember.planMonths} اقساط @ Rs. 5,000
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    کل ادا شدہ رقم
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-1">
                    {formatPKR(matchedMember.paidAmount)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
                    {paidCount} اقساط ادا شدہ ({progressPercent}%)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    باقیہ واجب الادا رقم
                  </span>
                  <div className="text-base sm:text-lg font-black text-amber-700 mt-1">
                    {formatPKR(matchedMember.dueAmount)}
                  </div>
                  <span className="text-[10px] text-amber-700 mt-0.5 block">
                    باقی اقساط: {matchedMember.planMonths - paidCount}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs" dir="rtl">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <span>ایڈوانس رقم</span>
                    <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-500">(Advance)</span>
                  </span>
                  <div className="text-base sm:text-lg font-black text-blue-700 mt-1">
                    {formatPKR(matchedMember.advanceAmount)}
                  </div>
                  <span className="text-[10px] text-blue-700 mt-0.5 block">
                    اگلی قسط کیلئے محفوظ
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 pt-4 border-t border-gray-200/80" dir="rtl">
                <div className="flex justify-between text-xs text-gray-600 font-semibold mb-1.5 font-urdu">
                  <span className="flex items-center gap-1">
                    <span>کمیٹی مکمل ہونے کا تناسب</span>
                    <span dir="ltr" className="font-sans text-[10px] text-gray-500 font-semibold">(Progress)</span>
                  </span>
                  <span className="text-emerald-800 font-bold">{progressPercent}% مکمل</span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#064E3B] h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Complete Tenure / Full Year Installment Schedule */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6" dir="rtl">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 font-urdu">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                  <span>مکمل سالانہ اقساط کا شیڈول (تمام {matchedMember.planMonths} اقساط)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 font-urdu">
                  پلان کی پہلی قسط سے آخری قسط تک تمام واجبات اور ادائیگیوں کی تفصیلی فہرست
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-urdu">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg">
                  {paidCount} ادا شدہ
                </span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg">
                  {matchedMember.planMonths - paidCount} باقی
                </span>
              </div>
            </div>

            {memberInstallments.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 font-urdu">
                اقساط کا ریکارڈ لوڈ ہو رہا ہے...
              </div>
            ) : (
              <div className="overflow-x-auto" dir="rtl">
                <table className="w-full text-xs text-right border-collapse font-urdu">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">قسط #</th>
                      <th className="py-3 px-4">
                        <span>مقررہ تاریخ</span> <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-400">(Due Date)</span>
                      </th>
                      <th className="py-3 px-4">
                        <span>رقم</span> <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-400">(Amount)</span>
                      </th>
                      <th className="py-3 px-4">
                        <span>حالت</span> <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-400">(Status)</span>
                      </th>
                      <th className="py-3 px-4">ادائیگی کی تاریخ</th>
                      <th className="py-3 px-4">
                        <span>طریقہ کار</span> <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-400">(Method)</span>
                      </th>
                      <th className="py-3 px-4 text-left">
                        <span>رسید</span> <span dir="ltr" className="font-sans text-[9px] font-semibold text-gray-400">(Receipt)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memberInstallments.map((inst) => {
                      const isPaid = inst.status === 'Paid';
                      const isLate = inst.status === 'Late' || inst.status === 'Overdue';
                      const isDue = inst.status === 'Due';

                      return (
                        <tr
                          key={inst.id}
                          className={`hover:bg-gray-50/70 transition-colors ${
                            isPaid ? 'bg-emerald-50/20' : isLate ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            قسط #{inst.installmentNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-gray-700">
                            {formatDateDisplay(inst.dueDate)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-gray-900 font-mono">
                            {formatPKR(inst.amount)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isLate
                                  ? 'bg-rose-100 text-rose-800'
                                  : isDue
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isPaid ? (
                                <>
                                  <span>ادا شدہ</span>
                                  <span dir="ltr" className="font-sans text-[9px] font-bold">(Paid)</span>
                                </>
                              ) : isLate ? (
                                <>
                                  <span>تاخیر</span>
                                  <span dir="ltr" className="font-sans text-[9px] font-bold">(Overdue)</span>
                                </>
                              ) : isDue ? (
                                <>
                                  <span>واجب الادا</span>
                                  <span dir="ltr" className="font-sans text-[9px] font-bold">(Due)</span>
                                </>
                              ) : (
                                <>
                                  <span>آئندہ</span>
                                  <span dir="ltr" className="font-sans text-[9px] font-bold">(Upcoming)</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {inst.paidDate ? formatDateDisplay(inst.paidDate) : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {inst.paymentMethod ? (
                              <span className="font-semibold text-gray-800">
                                {inst.paymentMethod}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-left">
                            {isPaid && (
                              <button
                                onClick={() => {
                                  const matchingRec = receipts.find(
                                    (r) =>
                                      r.memberId === matchedMember.id &&
                                      r.installmentNumber === inst.installmentNumber
                                  );
                                  if (matchingRec) {
                                    onOpenReceipt(matchingRec);
                                  }
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-urdu"
                              >
                                <ReceiptIcon className="w-3 h-3" />
                                <span>رسید دیکھیں</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Official Issued Receipts List */}
          {memberReceipts.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8" dir="rtl">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4 font-urdu">
                <ReceiptIcon className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>جاری شدہ باضابطہ رسیدیں</span>
                <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {memberReceipts.length}
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {memberReceipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 bg-gray-50/50 hover:bg-white transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                          {rec.receiptNumber}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatDateDisplay(rec.paymentDate)}
                        </span>
                      </div>
                      <div className="text-base font-black text-emerald-800">
                        {formatPKR(rec.amount)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        قسط #{rec.installmentNumber} • بذریعہ {rec.paymentMethod}
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenReceipt(rec)}
                      className="mt-3 w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ReceiptIcon className="w-3.5 h-3.5 text-amber-300" />
                      <span>اصل رسید و کیو آر دیکھیں</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helpline Footer */}
          <div className="p-6 bg-emerald-950 text-emerald-100 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div>
              <div className="font-bold text-white text-sm">
                ایم زیڈ عمرہ کمیٹی پاکستان (MZ Umrah Committee)
              </div>
              <div className="text-emerald-300/80 mt-0.5">
                نگران اعلیٰ و ایڈمن: عبد الشکور مدنی • رابطہ: +92 300 8765432
              </div>
            </div>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold border border-white/20 transition-colors cursor-pointer"
            >
              دیگر ممبر کا ریکارڈ تلاش کریں
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
