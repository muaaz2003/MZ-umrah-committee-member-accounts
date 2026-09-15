import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Upload,
  Trash2,
  FileCheck2,
  ShieldCheck,
  Share2,
  Loader2,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
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
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeCnic, setNomineeCnic] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MemberStatus>('Active');
  const [memberPhoto, setMemberPhoto] = useState<string>('');
  const [memberAgreement, setMemberAgreement] = useState(true);
  const [guarantorAgreement, setGuarantorAgreement] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [shareNotification, setShareNotification] = useState<string | null>(null);
  const printableFormRef = useRef<HTMLDivElement | null>(null);

  // Generate PDF and Share via Web Share API or Fallback to WhatsApp
  const handleShareWhatsAppPDF = async () => {
    if (!fullName.trim() && !mobile.trim() && !cnic.trim()) {
      setErrorMessage('براہ کرم پی ڈی ایف شیئر کرنے سے پہلے کم از کم ممبر کا نام یا رابطہ درج فرمائیں۔');
      return;
    }

    try {
      setIsSharingPdf(true);
      setErrorMessage('');
      setShareNotification('پی ڈی ایف تیار ہو رہی ہے، برائے مہربانی چند لمحے انتظار فرمائیں...');

      if (document.fonts) {
        await document.fonts.ready;
      }

      if (!printableFormRef.current) {
        throw new Error('Printable form element not found');
      }

      const element = printableFormRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      const margin = 5;
      const printW = pageWidth - margin * 2; // 200 mm
      const printH = pageHeight - margin * 2; // 287 mm

      const scale = Math.min(printW / canvas.width, printH / canvas.height);
      const renderW = canvas.width * scale;
      const renderH = canvas.height * scale;
      const xOffset = margin + (printW - renderW) / 2;
      const yOffset = margin + (printH - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH, undefined, 'FAST');

      const pdfBlob = pdf.output('blob');
      const safeName = (fullName.trim() || 'Member').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
      const safeNum = (memberNumber || 'MZ').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `${safeNum}_${safeName}_Registration_Form.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Native Web Share API Check & Execution
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] }) &&
        navigator.share
      ) {
        await navigator.share({
          files: [pdfFile],
          title: 'Member Form',
          text: 'السلام علیکم! یہ ممبر رجسٹریشن فارم کی پی ڈی ایف فائل ہے۔',
        });
        setShareNotification('فائل کامیابی کے ساتھ شیئر کر دی گئی ہے۔');
      } else {
        // Fallback Mechanism (for Unsupported Desktop Browsers):
        // 1. Auto-download PDF
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        // 2. Open WhatsApp Web or wa.me
        const targetPhone = (whatsapp || mobile || '').replace(/[^0-9]/g, '');
        const waText = encodeURIComponent('السلام علیکم! یہ ممبر رجسٹریشن فارم کی پی ڈی ایف فائل ہے۔');
        const waUrl = targetPhone.length >= 10
          ? `https://wa.me/92${targetPhone.startsWith('0') ? targetPhone.slice(1) : targetPhone}?text=${waText}`
          : `https://web.whatsapp.com/send?text=${waText}`;

        window.open(waUrl, '_blank');

        setShareNotification(
          'پی ڈی ایف فائل ڈاؤن لوڈ کر لی گئی ہے۔ براؤزر میں ڈائریکٹ شیئر سپورٹ نہ ہونے کے باعث واٹس ایپ کھول دیا گیا ہے، براہ کرم ڈاؤن لوڈ شدہ پی ڈی ایف فائل اٹیچ کر کے بھیجیں۔'
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setShareNotification(null);
      } else {
        console.error('Error sharing PDF:', err);
        setErrorMessage('پی ڈی ایف شیئر کرنے میں مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔');
      }
    } finally {
      setIsSharingPdf(false);
    }
  };

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

  const quickAmounts = [5000, 8000, 10000];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('تصویر کا سائز 5MB سے کم ہونا چاہیے۔ (Photo size must be under 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMemberPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('تصویر کا سائز 5MB سے کم ہونا چاہیے۔ (Photo size must be under 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMemberPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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

    if (!memberAgreement) {
      setErrorMessage('برائے مہربانی ممبر کے عہد نامہ کی توثیق کریں۔ (Please accept the member undertaking)');
      return;
    }

    if (!guarantorAgreement) {
      setErrorMessage('برائے مہربانی کفیل / ضامن کے عہد نامہ کی توثیق کریں۔ (Please accept the guarantor undertaking)');
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
          registrationFeeStatus: (Number(registrationFee) > 0 ? 'Paid' : 'Unpaid'),
          nomineeName: nomineeName.trim(),
          nomineeRelation: nomineeRelation.trim(),
          nomineeCnic: nomineeCnic.trim(),
          nomineeMobile: nomineeMobile.trim(),
          status,
          notes: notes.trim(),
          memberPhoto: memberPhoto || undefined,
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
        {/* Header - Centered Large Heading with no sub-paragraph */}
        <div className="relative bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-4 sm:px-6 py-4 text-white flex items-center justify-center shrink-0 shadow-md border-b border-emerald-800/60">
          <div className="text-center px-8" dir="rtl">
            <h3 className="font-black text-base sm:text-xl md:text-2xl tracking-wide text-white flex items-center justify-center flex-wrap gap-2">
              <span>نئی ممبر رجسٹریشن فارم</span>{' '}
              <bdi dir="ltr" className="text-amber-300 font-bold text-sm sm:text-lg font-sans">(New Member Registration Form)</bdi>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 sm:left-4 p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-emerald-800/80 transition-colors shrink-0 cursor-pointer active:scale-95"
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
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2 text-right font-urdu" dir="rtl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {shareNotification && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-semibold text-emerald-950 flex items-center justify-between gap-2 text-right shadow-2xs font-urdu" dir="rtl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>{shareNotification}</span>
              </div>
              <button
                type="button"
                onClick={() => setShareNotification(null)}
                className="text-emerald-800 hover:text-emerald-950 font-bold px-2 py-0.5 cursor-pointer text-sm"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section 1: Member Photo & Committee Plan Selection */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            {/* Section 1 Main Heading */}
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-2.5 mb-1" dir="rtl">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 tracking-wide flex items-center gap-2">
                <span className="w-2.5 h-5 bg-emerald-700 rounded-full inline-block"></span>
                <span>1. کمیٹی پلان اور فیس کی تفصیلات</span>{' '}
                <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Committee Plan & Fee Details)</bdi>
              </h4>
            </div>

            {/* Upload Picture Component */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-500 transition-all shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2 text-right" dir="rtl">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>تصویر اپلوڈ کریں</span>{' '}
                  <bdi dir="ltr" className="text-slate-500 font-sans text-[11px] font-semibold">(Upload Member Photo)</bdi>
                </label>
                {memberPhoto && (
                  <button
                    type="button"
                    onClick={() => setMemberPhoto('')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تصویر ہٹائیں (Remove Photo)</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 cursor-pointer transition-all group"
                dir="rtl"
              >
                {/* Avatar Preview */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border-2 border-emerald-200 overflow-hidden shrink-0 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  {memberPhoto ? (
                    <img
                      src={memberPhoto}
                      alt="Member Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-emerald-700">
                      <Camera className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-right">
                  {memberPhoto ? (
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تصویر کامیابی سے منتخب ہوچکی ہے</span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        تصویر تبدیل کرنے کے لیے یہاں کلک کریں۔
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950 group-hover:text-emerald-700 transition-colors">
                        ممبر کی تصویر اپلوڈ کرنے کے لیے کلک کریں
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        فائل کو ڈریگ اینڈ ڈراپ بھی کر سکتے ہیں (JPG, PNG - زیادہ سے زیادہ 5MB)
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-800 group-hover:bg-emerald-900 text-white rounded-xl shadow-2xs transition-all">
                    <Upload className="w-3.5 h-3.5 text-amber-300" />
                    <span>{memberPhoto ? 'تبدیل کریں' : 'براؤز کریں'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">ممبرشپ نمبر *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Membership No.)</bdi>
                </label>
                <input
                  type="text"
                  required
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs"
                  dir="ltr"
                  placeholder="MZ-001"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">کمیٹی پلان منتخب کریں (24 یا 36 ماہ) *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Select Committee Plan)</bdi>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanMonths(24)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center justify-center cursor-pointer ${
                      planMonths === 24
                        ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-600/30'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>24 ماہ پلان (2 سال)</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-sans">24 Months Plan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlanMonths(36)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center justify-center cursor-pointer ${
                      planMonths === 36
                        ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-600/30'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>36 ماہ پلان (3 سال)</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-sans">36 Months Plan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly Installment: 5,000 / 8,000 / 10,000 */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-right" dir="rtl">
                <label className="block text-xs font-bold text-slate-800 tracking-wide">
                  <span className="text-slate-900">ماہانہ قسط کی رقم منتخب کریں *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Select Monthly Installment: 5K, 8K, 10K)</bdi>
                </label>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200" dir="ltr">
                  {formatPKR(validMonthly)} / Month
                </span>
              </div>

              {/* 3 Prominent Selection Options: 5,000, 8,000, 10,000 */}
              <div className="grid grid-cols-3 gap-2.5">
                {[5000, 8000, 10000].map((amt) => {
                  const isSelected = Number(monthlyInstallment) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMonthlyInstallment(amt)}
                      className={`py-2.5 px-2 rounded-xl font-bold transition-all border text-center flex flex-col items-center justify-center cursor-pointer relative ${
                        isSelected
                          ? 'bg-emerald-900 text-white border-emerald-900 shadow-md ring-2 ring-amber-400'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 hover:border-emerald-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-emerald-950 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                          منتخب
                        </span>
                      )}
                      <span className={`text-xs sm:text-sm font-black font-mono ${isSelected ? 'text-amber-300' : 'text-slate-900'}`}>
                        Rs. {amt.toLocaleString()}
                      </span>
                      <span className={`text-[10px] sm:text-[11px] font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {amt === 5000 ? '5 ہزار ماہانہ' : amt === 8000 ? '8 ہزار ماہانہ' : '10 ہزار ماہانہ'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom amount input field */}
              <div className="flex items-center gap-2.5 pt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
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
                    className="w-full pl-12 pr-3.5 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs"
                    placeholder="یا رقم خود درج کریں (5,000 تا 10,000)"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium shrink-0 text-right" dir="rtl">
                  (5,000 تا 10,000 کے درمیان)
                </span>
              </div>
            </div>

            {/* Real-time Dynamic Calculation Banner Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Banner Left Box: Total Committee Amount */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-emerald-900 border border-emerald-800 text-white flex flex-col justify-between space-y-2 text-right shadow-xs" dir="rtl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300">
                    <span>کل کمیٹی رقم</span>{' '}
                    <bdi dir="ltr" className="text-[11px] font-sans text-amber-200 font-semibold">(Total Committee Amount)</bdi>
                  </span>
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-400/30 font-mono" dir="ltr">
                    {planMonths} Months
                  </span>
                </div>
                <div className="my-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight" dir="ltr">
                    {formatPKR(totalAmount)}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200 font-medium">
                  <span>حساب: {planMonths} اقساط × {formatPKR(validMonthly)} ماہانہ</span>{' '}
                  <bdi dir="ltr" className="text-[10px] text-emerald-300 font-sans">({planMonths} installments)</bdi>
                </p>
              </div>

              {/* Banner Right Box: Schedule & Due Date */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-950 border border-emerald-800 text-white flex flex-col justify-between space-y-2 text-right shadow-xs" dir="rtl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-200">
                    <span>کمیٹی شیڈول و مقررہ تاریخ</span>{' '}
                    <bdi dir="ltr" className="text-[11px] font-sans text-emerald-300 font-semibold">(Schedule & Due Date)</bdi>
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-700 font-mono" dir="ltr">
                    10th Monthly
                  </span>
                </div>
                <div className="my-0.5 space-y-0.5">
                  <p className="text-sm font-bold text-amber-300">
                    <span>ہر ماہ کی 10 تاریخ تک ادائیگی لازمی ہے</span>{' '}
                    <bdi dir="ltr" className="text-xs font-normal text-amber-200 font-sans">(Due by 10th)</bdi>
                  </p>
                </div>
                <p className="text-[10px] text-emerald-300/80 font-medium">
                  10 تاریخ کے بعد قسط واجب الادا (Overdue) شمار ہوگی
                </p>
              </div>
            </div>

            {/* Dates & Fees Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">تاریخ شمولیت *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Joining Date)</bdi>
                </label>
                <input
                  type="date"
                  required
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">رجسٹریشن فیس</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Registration Fee)</bdi>
                </label>
                <input
                  type="number"
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs"
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Personal Information */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-2.5 mb-1" dir="rtl">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 tracking-wide flex items-center gap-2">
                <span className="w-2.5 h-5 bg-emerald-700 rounded-full inline-block"></span>
                <span>2. ممبر کی ذاتی معلومات</span>{' '}
                <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Member Personal Details)</bdi>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">مکمل نام *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Full Name)</bdi>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: حافظ محمد عثمان (e.g. Hafiz Muhammad Usman)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="auto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">والد کا نام</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Father's Name)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: محمد رفیق (e.g. Muhammad Rafiq)"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="auto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">قومی شناختی کارڈ نمبر</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(CNIC / National ID)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="42101-XXXXXXX-X"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">موبائل نمبر *</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Mobile Number)</bdi>
                </label>
                <input
                  type="text"
                  required
                  placeholder="0300-1234567"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">واٹس ایپ نمبر</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(WhatsApp Number)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">ممبرشپ کی کیفیت</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Member Status)</bdi>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MemberStatus)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs"
                  dir="rtl"
                >
                  <option value="Active">فعال (Active)</option>
                  <option value="Completed">مکمل شدہ (Completed)</option>
                  <option value="Cancelled">منسوخ شدہ (Cancelled)</option>
                  <option value="Refunded">رقم واپس (Refunded)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">رہائشی پتہ</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Residential Address)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="مکان/فلیٹ نمبر، گلی، علاقہ، شہر (House/Flat, Street, Area, City)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="auto"
                />
              </div>
            </div>
          </div>

          {/* Member Undertaking Section (عہد نامہ برائے ممبر) */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 p-4 sm:p-5 rounded-2xl space-y-3 text-right shadow-2xs" dir="rtl">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-emerald-200/80 pb-2.5">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>عہد نامہ برائے ممبر</span>{' '}
                <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Member Undertaking)</bdi>
              </h4>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-lg border border-emerald-200">
                اقرار نامہ ممبر
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium bg-white/90 p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
              ”میں اقرار کرتاہوں کہ اس فارم کو بغور پڑھااوراس فارم  میں جوکچھ تحریرکی ہے سب کچھ درست ہے ، ان شاء اللہ ہرماہ کی واجب الادارقم پابندی سے اداکرونگا،اور اس کمیٹی کامقصدکوپوراکرتے ہوئے شکایت کا موقع نہیں دونگا۔“
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
              <input
                type="checkbox"
                required
                checked={memberAgreement}
                onChange={(e) => setMemberAgreement(e.target.checked)}
                className="w-4 h-4 text-emerald-700 border-slate-300 rounded focus:ring-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-emerald-900">
                <span>میں ممبر کی حیثیت سے اس عہد نامے کا اقرار اور تصدیق کرتا ہوں</span>{' '}
                <bdi dir="ltr" className="text-[10px] text-slate-500 font-sans font-normal">(I accept and confirm this undertaking)</bdi>
              </span>
            </label>
          </div>

          {/* Section 3: Kafeel Details (کفیل کی تفصیلات) */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-2.5 mb-1" dir="rtl">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 tracking-wide flex items-center gap-2">
                <span className="w-2.5 h-5 bg-emerald-700 rounded-full inline-block"></span>
                <span>3. کفیل کی تفصیلات</span>{' '}
                <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Kafeel / Guarantor Details)</bdi>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">کفیل کا نام</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Kafeel Name)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: عبدالرحمٰن (e.g. Abdul Rehman)"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="auto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">رشتہ / تعلق</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Relationship with Member)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="بھائی / بیٹا / شوہر / والد (Brother / Son / Father)"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="auto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">کفیل کا شناختی کارڈ</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Kafeel CNIC)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="42101-XXXXXXX-X"
                  value={nomineeCnic}
                  onChange={(e) => setNomineeCnic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 tracking-wide mb-1.5 text-right" dir="rtl">
                  <span className="text-slate-900">کفیل کا موبائل نمبر</span>{' '}
                  <bdi dir="ltr" className="font-sans text-[11px] text-slate-500 font-semibold">(Kafeel Mobile)</bdi>
                </label>
                <input
                  type="text"
                  placeholder="03XX-XXXXXXX"
                  value={nomineeMobile}
                  onChange={(e) => setNomineeMobile(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Guarantor / Kafeel Undertaking (عہد نامہ برائے ضامن / کفیل) */}
            <div className="bg-amber-50/80 border border-amber-200/90 p-4 rounded-2xl space-y-3 text-right mt-3 shadow-2xs" dir="rtl">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-amber-200/80 pb-2.5">
                <h4 className="text-base sm:text-lg font-black text-amber-950 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
                  <span>عہد نامہ برائے ضامن / کفیل</span>{' '}
                  <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Guarantor / Kafeel Undertaking)</bdi>
                </h4>
                <span className="text-xs font-bold text-amber-900 bg-amber-100/90 px-3 py-1 rounded-lg border border-amber-200">
                  ضمانت نامہ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-900 leading-relaxed font-medium bg-white/90 p-3.5 rounded-xl border border-amber-100 shadow-2xs">
                ”میں اقرار کرتا  /کرتی ہوں کہ ممبرکوبحیثیت رشتہ دار جانتا/جانتی ہوں ،اورمکمل طور پر ممبرکی ضمانت لیتا/لیتی ہوں کہ انشاءاللہ ممبر  کسی بھی قسم کی کوئی شکایت کاموقع نہیں دیگا/دیگی“
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  required
                  checked={guarantorAgreement}
                  onChange={(e) => setGuarantorAgreement(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  <span>میں بحیثیت کفیل / ضامن اس عہد نامے اور ضمانت کی مکمل توثیق کرتا / کرتی ہوں</span>{' '}
                  <bdi dir="ltr" className="text-[10px] text-slate-500 font-sans font-normal">(Guarantor confirmation)</bdi>
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="pt-2">
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-2 mb-2" dir="rtl">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 tracking-wide flex items-center gap-2">
                <span className="w-2.5 h-5 bg-emerald-700 rounded-full inline-block"></span>
                <span>4. کمیٹی کے اندرونی نوٹس و ہدایات</span>{' '}
                <bdi dir="ltr" className="text-slate-500 font-sans text-xs font-semibold">(Internal Notes)</bdi>
              </h4>
            </div>
            <textarea
              rows={2}
              placeholder="کوئی خاص نوٹ، حوالہ یا ہدایات درج کریں... (Special remarks or references)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-hidden transition-all shadow-2xs font-medium"
              dir="auto"
            />
          </div>

          </div>

          {/* Action Buttons - Fixed & Locked at Bottom */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs" dir="rtl">
            {/* WhatsApp Share PDF Button */}
            <button
              type="button"
              id="whatsapp-share-pdf-btn"
              onClick={handleShareWhatsAppPDF}
              disabled={isSharingPdf || isSubmitting}
              style={{ backgroundColor: '#25D366' }}
              className="px-4 sm:px-5 py-2.5 hover:opacity-95 active:scale-98 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer font-urdu shrink-0"
              dir="rtl"
            >
              {isSharingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                  <span>پی ڈی ایف تیار ہو رہی ہے...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 shrink-0 text-white" />
                  <span>واٹس ایپ پر فائل شیئر کریں</span>{' '}
                  <span dir="ltr" className="font-sans text-[10px] font-extrabold uppercase tracking-wide opacity-95">
                    (SHARE PDF VIA WHATSAPP)
                  </span>
                </>
              )}
            </button>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={isSubmitting || isSharingPdf}
                className="px-5 sm:px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:scale-98 disabled:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer font-urdu"
              >
                {isSubmitting ? (
                  <span>رجسٹریشن جاری ہے... (Registering...)</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>نیا ممبر رجسٹر کریں ({planMonths} ماہ اقساط)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer font-urdu"
              >
                منسوخ (Cancel)
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Hidden Off-Screen Container for capturing high-definition printable PDF */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '820px',
          zIndex: -100,
          backgroundColor: '#ffffff',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div
          ref={printableFormRef}
          id="printable-member-registration-form"
          className="p-8 bg-white text-slate-900 font-sans border-2 border-emerald-900"
          style={{ width: '820px', minHeight: '1100px' }}
          dir="rtl"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-emerald-900 pb-4 mb-4 flex items-center justify-between">
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-emerald-700 rounded-full inline-block"></span>
                <h1 className="text-2xl font-black text-emerald-950 font-urdu">
                  ایم زیڈ عمرہ کمیٹی پاکستان
                </h1>
              </div>
              <p className="text-xs text-emerald-800 font-bold font-urdu">
                زیر سرپرستی: ایم زیڈ اے ویلفیئر ٹرسٹ (رجسٹرڈ) • قائم کردہ 2019
              </p>
              <p className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider mt-0.5">
                MZ UMRAH COMMITTEE PAKISTAN • OFFICIAL MEMBER REGISTRATION FORM
              </p>
            </div>

            <div className="text-left flex flex-col items-end">
              <div className="bg-emerald-950 text-amber-300 px-3.5 py-1.5 rounded-lg text-sm font-mono font-black border border-emerald-800">
                {memberNumber || 'MZ-#001'}
              </div>
              <div className="text-[11px] text-slate-600 font-semibold mt-1 font-mono">
                تاریخ شمولیت: {joiningDate || new Date().toISOString().split('T')[0]}
              </div>
            </div>
          </div>

          {/* Member Photo & Primary Information */}
          <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <div className="col-span-1 flex flex-col items-center justify-center">
              {memberPhoto ? (
                <img
                  src={memberPhoto}
                  alt="Member"
                  className="w-24 h-28 object-cover rounded-lg border-2 border-emerald-900 shadow-xs"
                />
              ) : (
                <div className="w-24 h-28 border-2 border-dashed border-emerald-400 bg-white rounded-lg flex flex-col items-center justify-center text-emerald-800 p-2 text-center">
                  <Camera className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[9px] font-bold font-urdu leading-tight">پاسپورٹ سائز تصویر برائے ممبر</span>
                </div>
              )}
            </div>

            <div className="col-span-3 grid grid-cols-2 gap-3 text-right">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">مکمل نام (Full Name)</span>
                <span className="text-sm font-black text-slate-900 font-urdu">{fullName || '—'}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">ولدیت (Father Name)</span>
                <span className="text-sm font-bold text-slate-800 font-urdu">{fatherName || '—'}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">قومی شناختی کارڈ (CNIC)</span>
                <span className="text-xs font-mono font-bold text-slate-900">{cnic || '—'}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">موبائل / واٹس ایپ (Phone)</span>
                <span className="text-xs font-mono font-bold text-slate-900">{mobile || whatsapp || '—'}</span>
              </div>
            </div>
          </div>

          {/* Committee Plan Details */}
          <div className="mb-4 text-right">
            <div className="bg-emerald-900 text-white px-3 py-1.5 rounded-t-lg text-xs font-black font-urdu flex items-center justify-between">
              <span>کمیٹی پلان اور فیس کی تفصیلات</span>
              <span dir="ltr" className="font-sans text-[10px] font-semibold">(Committee Plan & Fee Details)</span>
            </div>
            <table className="w-full border border-slate-300 text-xs text-right border-collapse">
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-700 w-1/4">کمیٹی پلان کی مدت:</td>
                  <td className="p-2.5 font-bold text-emerald-950 w-1/4 font-mono">{planMonths} Months ({planMonths === 24 ? '2 سال' : '3 سال'})</td>
                  <td className="p-2.5 font-bold text-slate-700 w-1/4">ماہانہ قسط:</td>
                  <td className="p-2.5 font-bold text-emerald-900 w-1/4 font-mono">Rs. {validMonthly.toLocaleString()}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2.5 font-bold text-slate-700">کل متوقع رقم:</td>
                  <td className="p-2.5 font-bold text-emerald-950 font-mono">Rs. {totalAmount.toLocaleString()}</td>
                  <td className="p-2.5 font-bold text-slate-700">رجسٹریشن فیس:</td>
                  <td className="p-2.5 font-bold text-emerald-900 font-mono">Rs. {Number(registrationFee || 1000).toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-700">رہائشی پتہ:</td>
                  <td colSpan={3} className="p-2.5 text-slate-900 font-medium font-urdu">{address || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kafeel / Guarantor Details */}
          <div className="mb-4 text-right">
            <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-lg text-xs font-black font-urdu flex items-center justify-between">
              <span>کفیل / ضامن کی تفصیلات</span>
              <span dir="ltr" className="font-sans text-[10px] font-semibold">(Guarantor / Kafeel Details)</span>
            </div>
            <table className="w-full border border-slate-300 text-xs text-right border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2.5 font-bold text-slate-700 w-1/4">کفیل کا نام:</td>
                  <td className="p-2.5 font-bold text-slate-900 w-1/4 font-urdu">{nomineeName || '—'}</td>
                  <td className="p-2.5 font-bold text-slate-700 w-1/4">رشتہ / تعلق:</td>
                  <td className="p-2.5 font-bold text-slate-900 w-1/4 font-urdu">{nomineeRelation || '—'}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-700">شناختی کارڈ:</td>
                  <td className="p-2.5 font-mono font-bold text-slate-900">{nomineeCnic || '—'}</td>
                  <td className="p-2.5 font-bold text-slate-700">موبائل نمبر:</td>
                  <td className="p-2.5 font-mono font-bold text-slate-900">{nomineeMobile || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Undertakings */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-right font-urdu text-[11px]">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <h5 className="font-black text-emerald-950 mb-1">عہد نامہ برائے ممبر:</h5>
              <p className="text-emerald-900 leading-relaxed text-[10px]">
                ”میں اقرار کرتاہوں کہ اس فارم کو بغور پڑھااوراس فارم میں جوکچھ تحریرکی ہے سب کچھ درست ہے ، ان شاء اللہ ہرماہ کی واجب الادارقم پابندی سے اداکرونگا،اور اس کمیٹی کامقصدکوپوراکرتے ہوئے شکایت کا موقع نہیں دونگا۔“
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <h5 className="font-black text-amber-950 mb-1">عہد نامہ برائے ضامن / کفیل:</h5>
              <p className="text-amber-900 leading-relaxed text-[10px]">
                ”میں اقرار کرتا /کرتی ہوں کہ ممبرکوبحیثیت رشتہ دار جانتا/جانتی ہوں ،اورمکمل طور پر ممبرکی ضمانت لیتا/لیتی ہوں کہ انشاءاللہ ممبر کسی بھی قسم کی کوئی شکایت کاموقع نہیں دیگا/دیگی“
              </p>
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div className="border-t-2 border-slate-300 pt-5 mt-2 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1"></div>
              <span className="text-xs font-bold text-slate-800 font-urdu block">دستخط ممبر</span>
              <span className="text-[10px] text-slate-400 font-sans">(Member Signature)</span>
            </div>
            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1"></div>
              <span className="text-xs font-bold text-slate-800 font-urdu block">دستخط کفیل / ضامن</span>
              <span className="text-[10px] text-slate-400 font-sans">(Guarantor Signature)</span>
            </div>
            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1 flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 font-urdu">
                  مہر و دستخط نگرانِ اعلیٰ
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800 font-urdu block">عبد الشکور مدنی</span>
              <span className="text-[10px] text-emerald-700 font-sans font-bold">+92 300 8765432</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-500 font-urdu">
            ایم زیڈ عمرہ کمیٹی پاکستان • باضابطہ کمپیوٹرائزڈ ممبر فارم • جملہ حقوق بحق کمیٹی محفوظ ہیں۔
          </div>
        </div>
      </div>
    </div>
  );
};
