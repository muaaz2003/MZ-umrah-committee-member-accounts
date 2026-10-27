import React, { useState, useEffect, useRef } from 'react';
import {
  FileX2,
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  User,
  Building2,
  Calendar,
  Save,
  PenTool,
  ShieldAlert,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { Member, CancellationNotice } from '../types';
import { recordCancellationNotice } from '../services/firebaseService';
import { formatPKR, numberToWordsUrdu } from '../utils/calculations';
import mzaLogo from '../assets/images/mza-logo.png';
import mzaStamp from '../assets/images/mza-stamp.png';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  initialMember?: Member | null;
  existingNotice?: CancellationNotice | null;
  onSuccess?: (notice: CancellationNotice) => void;
  currentUserEmail?: string;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  members,
  initialMember = null,
  existingNotice = null,
  onSuccess,
  currentUserEmail = 'admin',
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [salutation, setSalutation] = useState<'محترم جناب' | 'محترمہ'>('محترم جناب');
  const [fullName, setFullName] = useState<string>('');
  const [relationType, setRelationType] = useState<'ولد' | 'زوجہ' | 'بنت'>('ولد');
  const [fatherOrHusbandName, setFatherOrHusbandName] = useState<string>('');
  const [cnic, setCnic] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [noticeNumber, setNoticeNumber] = useState<string>('');
  const [noticeDate, setNoticeDate] = useState<string>('');
  const [subject, setSubject] = useState<string>('عمرہ کمیٹی کی ممبرشپ کی منسوخی');
  const [planMonths, setPlanMonths] = useState<number>(24);
  const [installmentAmount, setInstallmentAmount] = useState<number>(5000);
  const [firstInstallmentPaidAmount, setFirstInstallmentPaidAmount] = useState<number>(5000);
  const [paidInstallmentsCount, setPaidInstallmentsCount] = useState<number>(1);
  const [remainingInstallmentsCount, setRemainingInstallmentsCount] = useState<number>(23);
  const [refundAmount, setRefundAmount] = useState<number>(5000);
  const [refundAmountWords, setRefundAmountWords] = useState<string>('پانچ ہزار روپے');
  const [issuedBy, setIssuedBy] = useState<string>('انتظامیہ عمرہ کمیٹی');
  const [updateMemberStatus, setUpdateMemberStatus] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const printNoticeRef = useRef<HTMLDivElement>(null);

  // Initialize or Autofill
  useEffect(() => {
    if (!isOpen) return;

    if (existingNotice) {
      setSelectedMemberId(existingNotice.memberId || '');
      setNoticeNumber(existingNotice.noticeNumber || '');
      setNoticeDate(existingNotice.noticeDate || new Date().toISOString().split('T')[0]);
      setSalutation(existingNotice.salutation || 'محترم جناب');
      setFullName(existingNotice.fullName || '');
      setRelationType(existingNotice.relationType || 'ولد');
      setFatherOrHusbandName(existingNotice.fatherOrHusbandName || '');
      setCnic(existingNotice.cnic || '');
      setAddress(existingNotice.address || '');
      setMobile(existingNotice.mobile || '');
      setSubject(existingNotice.subject || 'عمرہ کمیٹی کی ممبرشپ کی منسوخی');
      setPlanMonths(existingNotice.planMonths || 24);
      setInstallmentAmount(existingNotice.installmentAmount || 5000);
      setFirstInstallmentPaidAmount(existingNotice.firstInstallmentPaidAmount || 5000);
      setPaidInstallmentsCount(existingNotice.paidInstallmentsCount || 1);
      setRemainingInstallmentsCount(existingNotice.remainingInstallmentsCount || 23);
      setRefundAmount(existingNotice.refundAmount || 5000);
      setRefundAmountWords(existingNotice.refundAmountInWordsUrdu || numberToWordsUrdu(existingNotice.refundAmount || 5000));
      setIssuedBy(existingNotice.issuedBy || 'انتظامیہ عمرہ کمیٹی');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    setNoticeDate(todayStr);

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setNoticeNumber(`MZA-CAN-${randomSuffix}`);

    if (initialMember) {
      applyMemberData(initialMember);
    } else {
      resetFields();
    }
  }, [isOpen, initialMember, existingNotice]);

  const resetFields = () => {
    setSelectedMemberId('');
    setSalutation('محترم جناب');
    setFullName('');
    setRelationType('ولد');
    setFatherOrHusbandName('');
    setCnic('');
    setAddress('');
    setMobile('');
    setPlanMonths(24);
    setInstallmentAmount(5000);
    setFirstInstallmentPaidAmount(5000);
    setPaidInstallmentsCount(1);
    setRemainingInstallmentsCount(23);
    setRefundAmount(5000);
    setRefundAmountWords(numberToWordsUrdu(5000));
    setIssuedBy('انتظامیہ عمرہ کمیٹی');
  };

  const applyMemberData = (m: Member) => {
    setSelectedMemberId(m.id);
    setFullName(m.fullName);
    setFatherOrHusbandName(m.fatherName || '');
    setCnic(m.cnic || '');
    setAddress(m.address || '');
    setMobile(m.mobile || '');

    // Gender / Relation detection
    const isFemale = /(بیگم|خاتون|بی بی|صاحبہ|فاطمہ|عائشہ|مریم|رقیہ|زینب|آمنہ|رضوانہ|کلثوم|سلمی|نسیم)/i.test(m.fullName);
    if (isFemale) {
      setSalutation('محترمہ');
      setRelationType('زوجہ');
    } else {
      setSalutation('محترم جناب');
      setRelationType('ولد');
    }

    const totalPlan = m.planMonths || 24;
    setPlanMonths(totalPlan);
    const monthlyAmt = m.monthlyInstallment || 5000;
    setInstallmentAmount(monthlyAmt);
    setFirstInstallmentPaidAmount(monthlyAmt);

    const calculatedPaidCount = monthlyAmt > 0 ? Math.floor((m.paidAmount || 0) / monthlyAmt) : 1;
    const paidCount = calculatedPaidCount > 0 ? calculatedPaidCount : 1;
    setPaidInstallmentsCount(paidCount);
    const remCount = Math.max(0, totalPlan - paidCount);
    setRemainingInstallmentsCount(remCount);

    const refund = m.paidAmount && m.paidAmount > 0 ? m.paidAmount : monthlyAmt;
    setRefundAmount(refund);
    setRefundAmountWords(numberToWordsUrdu(refund));
  };

  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const memId = e.target.value;
    setSelectedMemberId(memId);
    if (!memId) {
      resetFields();
      return;
    }
    const found = members.find((m) => m.id === memId);
    if (found) {
      applyMemberData(found);
    }
  };

  const handleRefundAmountChange = (val: number) => {
    setRefundAmount(val);
    setRefundAmountWords(numberToWordsUrdu(val));
  };

  const handlePlanMonthsChange = (months: number) => {
    setPlanMonths(months);
    setRemainingInstallmentsCount(Math.max(0, months - paidInstallmentsCount));
  };

  const handlePaidInstallmentsChange = (paid: number) => {
    setPaidInstallmentsCount(paid);
    setRemainingInstallmentsCount(Math.max(0, planMonths - paid));
  };

  // Save to Firestore
  const handleSaveNotice = async () => {
    if (!fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'برائے مہربانی ممبر کا نام درج کریں۔' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const noticeData = {
        noticeNumber: noticeNumber.trim() || `MZA-CAN-${Date.now().toString().slice(-4)}`,
        memberId: selectedMemberId || undefined,
        memberNumber: members.find((m) => m.id === selectedMemberId)?.memberNumber,
        salutation,
        fullName: fullName.trim(),
        relationType,
        fatherOrHusbandName: fatherOrHusbandName.trim(),
        cnic: cnic.trim(),
        address: address.trim(),
        mobile: mobile.trim(),
        noticeDate: noticeDate || new Date().toISOString().split('T')[0],
        subject: subject.trim(),
        planMonths,
        installmentAmount,
        firstInstallmentPaidAmount,
        paidInstallmentsCount,
        remainingInstallmentsCount,
        refundAmount,
        refundAmountInWordsUrdu: refundAmountWords.trim(),
        issuedBy: issuedBy.trim(),
        status: 'Issued' as const,
      };

      const savedNotice = await recordCancellationNotice(noticeData, updateMemberStatus, currentUserEmail);

      setIsSubmitting(false);
      setStatusMessage({ type: 'success', text: 'کینسلیشن نوٹس کامیابی سے محفوظ اور ریکارڈ ہو گیا۔' });

      if (onSuccess && savedNotice) {
        onSuccess(savedNotice);
      }
    } catch (err: any) {
      console.error('Error saving cancellation notice:', err);
      setIsSubmitting(false);
      setStatusMessage({ type: 'error', text: err?.message || 'نوٹس محفوظ نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔' });
    }
  };

  // PDF Export
  // PDF Export (Same as screen, zero text or layout shifts)
  const handleDownloadPdf = async () => {
    if (!printNoticeRef.current) return;
    setIsDownloadingPdf(true);
    setStatusMessage(null);

    try {
      const element = printNoticeRef.current;
      const targetWidth = element.offsetWidth > 0 ? element.offsetWidth : 760;

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        scrollY: 0,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: async (clonedDoc, clonedEl) => {
          clonedEl.style.width = `${targetWidth}px`;
          clonedEl.style.maxWidth = `${targetWidth}px`;
          clonedEl.style.minWidth = `${targetWidth}px`;
          clonedEl.style.boxSizing = 'border-box';
          clonedEl.style.margin = '0 auto';

          // Inject fonts
          const fontStyle = clonedDoc.createElement('style');
          fontStyle.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .pdf-cloned-control-replacement {
              box-sizing: border-box !important;
              letter-spacing: 0 !important;
              word-break: break-word !important;
            }
          `;
          clonedDoc.head.appendChild(fontStyle);

          if (clonedDoc.fonts) {
            try {
              await clonedDoc.fonts.ready;
            } catch {
              // Font ready fallback
            }
          }

          // Replace form controls with exact static styled elements
          // This completely prevents browser input/select rendering shifts in html2canvas
          const clonedControls = clonedEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
          const sourceControls = element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');

          for (let i = 0; i < clonedControls.length; i++) {
            const clonedControl = clonedControls[i];
            const sourceControl = sourceControls[i];
            if (!clonedControl || !sourceControl) continue;

            const computed = window.getComputedStyle(sourceControl);
            const isSelect = sourceControl.tagName.toLowerCase() === 'select';
            const isTextarea = sourceControl.tagName.toLowerCase() === 'textarea';

            let displayValue = '';
            if (isSelect) {
              const sel = sourceControl as HTMLSelectElement;
              displayValue = sel.options[sel.selectedIndex]?.text || sel.value || '';
            } else {
              displayValue = (sourceControl as HTMLInputElement | HTMLTextAreaElement).value ?? '';
            }

            const replacement = clonedDoc.createElement(isTextarea ? 'div' : 'span');
            replacement.className = `${sourceControl.className} pdf-cloned-control-replacement`;
            replacement.textContent = displayValue;

            // Preserve dimensions and display model exactly
            replacement.style.boxSizing = 'border-box';
            replacement.style.display = isTextarea ? 'block' : 'inline-block';
            replacement.style.verticalAlign = computed.verticalAlign;

            const measuredWidth = sourceControl.offsetWidth > 0 ? `${sourceControl.offsetWidth}px` : computed.width;
            replacement.style.width = measuredWidth;
            replacement.style.minWidth = computed.minWidth;
            replacement.style.maxWidth = computed.maxWidth;

            const measuredHeight = sourceControl.offsetHeight > 0 ? `${sourceControl.offsetHeight}px` : computed.height;
            replacement.style.height = measuredHeight;
            replacement.style.minHeight = computed.minHeight;
            replacement.style.lineHeight = computed.lineHeight;

            // Match exact padding and borders
            replacement.style.padding = computed.padding;
            replacement.style.paddingTop = computed.paddingTop;
            replacement.style.paddingBottom = computed.paddingBottom;
            replacement.style.paddingLeft = computed.paddingLeft;
            replacement.style.paddingRight = computed.paddingRight;
            replacement.style.margin = computed.margin;
            replacement.style.border = computed.border;
            replacement.style.borderBottom = computed.borderBottom;
            replacement.style.borderTop = computed.borderTop;
            replacement.style.borderLeft = computed.borderLeft;
            replacement.style.borderRight = computed.borderRight;
            replacement.style.borderRadius = computed.borderRadius;
            replacement.style.backgroundColor = computed.backgroundColor;
            replacement.style.color = computed.color;
            replacement.style.fontFamily = computed.fontFamily;
            replacement.style.fontSize = computed.fontSize;
            replacement.style.fontWeight = computed.fontWeight;
            replacement.style.textAlign = computed.textAlign;
            replacement.style.direction = computed.direction;
            replacement.style.whiteSpace = isTextarea ? 'pre-wrap' : 'nowrap';
            replacement.style.overflow = 'hidden';

            if (clonedControl.parentNode) {
              clonedControl.parentNode.replaceChild(replacement, clonedControl);
            }
          }
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const cleanName = (fullName || 'Member').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
      pdf.save(`Cancellation-Notice-${noticeNumber}-${cleanName}.pdf`);

      setIsDownloadingPdf(false);
      setStatusMessage({ type: 'success', text: 'پی ڈی ایف کامیابی سے ڈاؤنلوڈ ہو گئی۔' });
    } catch (err) {
      console.error('PDF generation error:', err);
      setIsDownloadingPdf(false);
      setStatusMessage({ type: 'error', text: 'پی ڈی ایف جنریٹ کرنے میں غلطی ہوئی۔ برائے مہربانی دوبارہ کوشش کریں۔' });
    }
  };

  // Native Print
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl my-auto overflow-hidden flex flex-col h-[94vh] max-h-[96vh]">
        {/* Top Control Bar */}
        <div className="w-full bg-[#064E3B] text-white px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0 border-b border-emerald-950 shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={resetFields}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white border border-white/15 flex items-center justify-center font-bold shrink-0 transition-colors cursor-pointer"
              title="Reset / Clear all fields"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <img
              src={mzaLogo}
              alt="MZA Umrah Logo"
              className="h-8 sm:h-9 w-auto object-contain shrink-0 drop-shadow-sm"
              draggable={false}
            />
            <div className="min-w-0 flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-base font-bold text-white tracking-tight truncate">
                کینسلیشن نوٹس (Cancellation Notice)
              </h2>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider bg-rose-700 border border-rose-600 px-2 py-0.5 rounded-md text-white font-bold shrink-0 hidden xs:inline-block">
                Official Notice
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-2.5 sm:px-3 py-1.5 bg-rose-700 hover:bg-rose-600 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:scale-98 text-emerald-100 border border-emerald-700/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print Notice"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Save in Database */}
            <button
              type="button"
              onClick={handleSaveNotice}
              disabled={isSubmitting}
              className="px-3 sm:px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 active:scale-98 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Record'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-5 py-2 text-xs font-semibold flex items-center justify-between shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border-b border-emerald-200'
                : 'bg-rose-100 text-rose-900 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold underline cursor-pointer ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form Quick Fill Panel (Pinned Bar) */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs flex-1">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Select Member:</span>
            </span>
            <select
              value={selectedMemberId}
              onChange={handleMemberSelect}
              className="px-2.5 py-1 text-xs font-bold border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose Registered Member --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberNumber} - {m.fullName} ({m.planMonths || 24}M - Paid: {formatPKR(m.paidAmount || 0)})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Notice #:</span>
              <input
                type="text"
                value={noticeNumber}
                onChange={(e) => setNoticeNumber(e.target.value)}
                className="w-28 px-2 py-0.5 border border-slate-300 rounded font-mono text-xs font-bold text-rose-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Date:</span>
              <input
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                className="px-2 py-0.5 border border-slate-300 rounded text-xs font-semibold"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={updateMemberStatus}
              onChange={(e) => setUpdateMemberStatus(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="font-semibold text-rose-800">
              Update member status to Cancelled in Register
            </span>
          </label>
        </div>

        {/* Viewport for the Cancellation Notice Paper */}
        <div className="w-full flex-1 overflow-y-auto overscroll-contain p-2 sm:p-5 md:p-6 bg-slate-200/80 flex justify-center items-start">
          {/* THE OFFICIAL CANCELLATION PAPER (MATCHES REFERENCE PDF) */}
          <div
            ref={printNoticeRef}
            id="cancellation-paper-container"
            className="w-full max-w-[760px] mx-auto bg-white border border-slate-300 shadow-2xl p-6 sm:p-10 md:p-12 text-slate-900 leading-normal relative font-sans print:shadow-none print:border-none print:m-0 print:p-8"
            style={{ minHeight: '1050px' }}
            dir="rtl"
          >
            {/* Scoped CSS strictly limited to this Cancellation Notice form */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');
              
              #cancellation-paper-container .cancellation-urdu-main-heading {
                font-family: 'Noto Naskh Arabic', 'Amiri', 'Noto Sans Arabic', serif !important;
                line-height: 1.6 !important;
                display: block !important;
                text-align: center !important;
                letter-spacing: 0 !important;
              }

              #cancellation-paper-container input,
              #cancellation-paper-container select,
              #cancellation-paper-container textarea {
                box-sizing: border-box !important;
                vertical-align: middle !important;
              }

              #cancellation-paper-container .cancellation-field-input {
                padding: 6px 12px;
                line-height: 1.8;
                min-height: 38px !important;
              }

              #cancellation-paper-container .cancellation-field-input.py-0 {
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                line-height: 2.7 !important;
              }

              #cancellation-paper-container .leading-\[2\.7\],
              #cancellation-paper-container .cancellation-field-input.leading-\[2\.7\] {
                line-height: 2.7 !important;
              }

              #cancellation-paper-container .cancellation-field-textarea {
                padding: 8px 12px !important;
                line-height: 1.9 !important;
                min-height: 56px !important;
              }

              #cancellation-paper-container .cancellation-inline-field {
                padding: 4px 10px !important;
                min-height: 34px !important;
                line-height: 1.8 !important;
                vertical-align: middle !important;
                display: inline-block !important;
                margin: 0 4px !important;
              }
            `}</style>

            {/* Optional Header Branding Logo Bar */}
            <div className="flex items-center justify-between border-b-2 border-emerald-900/60 pb-3 mb-5">
              <div className="flex items-center gap-3">
                <img
                  src={mzaLogo}
                  alt="MZA Umrah Logo"
                  className="h-14 sm:h-16 w-auto object-contain shrink-0 drop-shadow-sm"
                  draggable={false}
                />
                <div className="text-right">
                  <div className="text-base sm:text-lg font-black text-[#064E3B] font-sans">
                    M.Z.A UMRAH COMMITTEE
                  </div>
                  <div className="text-[11px] text-emerald-800 font-bold font-urdu">
                    زیر سرپرستی: ایم زیڈ اے ویلفیئر پاکستان (رجسٹرڈ 2019)
                  </div>
                </div>
              </div>
              <div className="text-left" dir="ltr">
                <div className="text-[11px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                  Ref: {noticeNumber || 'MZA-CAN-001'}
                </div>
              </div>
            </div>

            {/* Title (Centered Urdu heading with small bracket text below and generous line height) */}
            <div className="text-center pt-5 sm:pt-7 pb-2 mb-4">
              <h1 className="text-xl sm:text-2xl font-black text-rose-700 tracking-wide cancellation-urdu-main-heading text-center mx-auto">
                کینسلیشن نوٹس
              </h1>
              <div className="text-xs sm:text-[13px] font-semibold font-sans text-rose-700 tracking-normal mt-1 leading-[2.5] text-center" dir="ltr">
                (Cancellation Notice)
              </div>
            </div>

            {/* Subject and Date Row (Spacious layout, no clipping, proper padding) */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 sm:py-4 px-1 my-3 text-xs sm:text-sm font-bold">
              <div className="flex items-center gap-2.5">
                <span className="text-rose-700 font-urdu text-sm sm:text-base shrink-0">موضوع:</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="cancellation-field-input border-b-2 border-slate-400 font-urdu font-black text-rose-800 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 w-64 sm:w-80 bg-slate-50/70 rounded-xs py-0 leading-[2.7]"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-slate-700 font-urdu text-sm sm:text-base shrink-0">مورخہ:</span>
                <input
                  type="text"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="cancellation-field-input border-b-2 border-slate-400 font-mono font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 w-36 bg-slate-50/70 rounded-xs text-center"
                />
              </div>
            </div>

            {/* Recipient Details Block (Generous padding, clear visibility, no overlap) */}
            <div className="space-y-4 my-6 text-xs sm:text-sm font-semibold text-slate-800">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <select
                  value={salutation}
                  onChange={(e) => setSalutation(e.target.value as any)}
                  className="cancellation-field-input font-urdu font-black text-slate-900 border-b-2 border-slate-400 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600 cursor-pointer py-0 leading-[2.7]"
                >
                  <option value="محترم جناب">محترم جناب</option>
                  <option value="محترمہ">محترمہ</option>
                </select>
                <span className="font-urdu text-slate-800 font-bold px-0.5">:</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="محمد رضوان شفیع صاحب"
                  className="cancellation-field-input font-urdu font-black text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-rose-600 flex-1 min-w-[200px] bg-slate-50/70 rounded-xs py-0 leading-[2.7]"
                />

                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as any)}
                  className="cancellation-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600 cursor-pointer mr-1 py-0 leading-[2.7]"
                >
                  <option value="ولد">ولد :</option>
                  <option value="زوجہ">زوجہ :</option>
                  <option value="بنت">بنت :</option>
                </select>
                <input
                  type="text"
                  value={fatherOrHusbandName}
                  onChange={(e) => setFatherOrHusbandName(e.target.value)}
                  placeholder="محمد شفیع صاحب"
                  className="cancellation-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 focus:outline-hidden focus:border-rose-600 flex-1 min-w-[180px] bg-slate-50/70 rounded-xs py-0 leading-[2.7]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-urdu font-bold text-slate-800 min-w-[125px] shrink-0">شناختی کارڈ نمبر:</span>
                <input
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="42401-0513794-9"
                  dir="ltr"
                  className="cancellation-field-input font-mono font-bold text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-rose-600 w-56 bg-slate-50/70 rounded-xs text-left"
                />
                {mobile && (
                  <span className="text-xs font-mono text-slate-500 mr-2" dir="ltr">
                    (Mob: {mobile})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-start gap-2 sm:gap-3">
                <span className="font-urdu font-bold text-slate-800 min-w-[125px] pt-2 shrink-0">رہائشی پتہ:</span>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مکان نمبر 580 سیکٹر نمبر 11 محلہ الخضرا سوسائٹی اورنگی ٹاؤن کراچی۔"
                  className="cancellation-field-textarea font-urdu font-bold text-slate-800 border-b-2 border-slate-400 focus:outline-hidden focus:border-rose-600 flex-1 min-w-[280px] bg-slate-50/70 rounded-xs resize-none"
                />
              </div>
            </div>

            {/* Salutation Greeting */}
            <div className="my-5 font-urdu font-bold text-sm sm:text-base text-slate-900">
              <span>{salutation}، السلام علیکم ورحمۃ اللہ وبرکاتہ</span>
            </div>

            {/* Body Paragraph 1 (Direct from PDF) */}
            <div className="my-6 font-urdu text-sm sm:text-base leading-[2.5] text-slate-900 text-justify">
              <span>آپ کو مطلع کیا جاتا ہے کہ آپ نے عمرہ کمیٹی میں </span>
              <input
                type="text"
                inputMode="numeric"
                value={planMonths}
                onChange={(e) => handlePlanMonthsChange(Number(e.target.value) || 0)}
                className="cancellation-inline-field w-16 border-b-2 border-slate-400 font-mono font-bold text-slate-900 text-center bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600"
              />
              <span> قسطوں پر مشتمل شرکت کے لیے رجسٹریشن کروائی تھی۔ آپ نے پہلی قسط کی رقم </span>
              <input
                type="text"
                inputMode="numeric"
                value={firstInstallmentPaidAmount}
                onChange={(e) => setFirstInstallmentPaidAmount(Number(e.target.value) || 0)}
                className="cancellation-inline-field w-24 border-b-2 border-slate-400 font-mono font-bold text-slate-900 text-center bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600"
              />
              <span> روپے جمع کروائی، مگر اس کے بعد باقی </span>
              <input
                type="text"
                inputMode="numeric"
                value={remainingInstallmentsCount}
                onChange={(e) => setRemainingInstallmentsCount(Number(e.target.value) || 0)}
                className="cancellation-inline-field w-16 border-b-2 border-slate-400 font-mono font-bold text-slate-900 text-center bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600"
              />
              <span> قسطیں مقررہ وقت پر ادا نہیں کی گئیں۔</span>
            </div>

            {/* Body Paragraph 2 (Direct from PDF) */}
            <div className="my-6 font-urdu text-sm sm:text-base leading-[2.5] text-slate-900 text-justify">
              <span>چونکہ مقررہ وقت گزرنے کے باوجود ادائیگی نہیں کی گئی، اس لیے کمیٹی قواعد و ضوابط کے تحت آپ کی ممبرشپ منسوخ کی جاتی ہے۔ اس سلسلے میں آپ کو جمع شدہ رقم </span>
              <input
                type="text"
                value={refundAmountWords}
                onChange={(e) => setRefundAmountWords(e.target.value)}
                placeholder="پانچ ہزار روپے"
                className="cancellation-inline-field border-b-2 border-slate-400 font-urdu font-bold text-slate-900 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600 min-w-[150px] text-center"
              />
              <span> (Rs. </span>
              <input
                type="text"
                inputMode="numeric"
                value={refundAmount}
                onChange={(e) => handleRefundAmountChange(Number(e.target.value) || 0)}
                className="cancellation-inline-field w-28 border-b-2 border-slate-400 font-mono font-bold text-slate-900 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-rose-600 text-center"
              />
              <span>) بطور ریفنڈ واپس کی جا چکی ہے۔</span>
            </div>

            {/* Body Paragraph 3 (Direct from PDF with red highlight on Cancellation Notes) */}
            <div className="my-6 font-urdu text-sm sm:text-base leading-[2.5] text-slate-900 text-justify">
              <span>یہ </span>
              <span className="text-rose-700 font-black px-1.5 underline decoration-rose-500 underline-offset-4">
                کینسلیشن نوٹس
              </span>
              <span> اس بات کی تصدیق ہے کہ اب آپ عمرہ کمیٹی کی ممبرشپ میں شامل نہیں ہیں اور اس کمیٹی کے کسی بھی فائدے یا ذمہ داری کے حقدار نہیں رہے۔</span>
            </div>

            {/* Closing & Signatures Area (Matches PDF stamp & signature layout) */}
            <div className="mt-10 pt-4 border-t border-slate-200">
              <div className="text-center font-urdu font-bold text-sm sm:text-base text-slate-800 mb-6">
                آپ کے شکریہ کے ساتھ،
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative">
                {/* Right / Left Side (RTL): Admin & Stamp */}
                <div className="text-right space-y-1 relative">
                  <div className="font-urdu font-bold text-sm text-slate-900">
                    والسلام ({issuedBy})
                  </div>
                  <div className="text-xs text-slate-600 font-urdu">
                    صدر عمرہ کمیٹی: <strong>حافظ عبد الشکور مدنی</strong>
                  </div>
                  <div className="pt-8">
                    <div className="w-48 border-b-2 border-slate-800"></div>
                    <div className="text-xs font-urdu font-bold text-slate-700 mt-1">
                      دستخط صدر عمرہ کمیٹی
                    </div>
                  </div>

                  {/* Stamp Graphic positioned like in the PDF */}
                  <div className="absolute -top-3 right-24 pointer-events-none opacity-90">
                    <img
                      src={mzaStamp}
                      alt="Cancellation Stamp"
                      className="w-28 sm:w-32 h-auto object-contain rotate-[-6deg]"
                    />
                  </div>
                </div>

                {/* Member Signature Area */}
                <div className="text-left space-y-1 sm:self-end" dir="ltr">
                  <div className="w-48 border-b-2 border-slate-800 pt-10"></div>
                  <div className="text-xs font-urdu font-bold text-slate-700 mt-1 text-right" dir="rtl">
                    دستخط ممبر (Member Signature)
                  </div>
                </div>
              </div>

              {/* Official Seal text at bottom */}
              <div className="text-center text-[10px] text-slate-400 font-urdu mt-8 pt-4 border-t border-slate-100">
                ایم زیڈ اے عمرہ کمیٹی پاکستان • باقاعدہ تصدیق شدہ کینسلیشن پیپر
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
