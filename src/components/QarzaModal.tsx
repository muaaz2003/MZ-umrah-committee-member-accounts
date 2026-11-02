import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HandCoins,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Member, QarzaHasanaAgreement } from '../types';
import { recordQarzaAgreement } from '../services/firebaseService';
import mzaLogo from '../assets/images/mza-logo.png';
import mzaStamp from '../assets/images/mza-stamp.png';

interface QarzaModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onSuccess?: (agreement: QarzaHasanaAgreement) => void;
  currentUserEmail?: string;
  initialAgreement?: QarzaHasanaAgreement | null;
  targetMember?: Member | null;
}

export const QarzaModal: React.FC<QarzaModalProps> = ({
  isOpen,
  onClose,
  members,
  onSuccess,
  currentUserEmail = 'admin',
  initialAgreement,
  targetMember,
}) => {
  const printAgreementRef = useRef<HTMLDivElement>(null);

  // Form State
  const [agreementNumber, setAgreementNumber] = useState('');
  const [agreementDate, setAgreementDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // Borrower / Member Details
  const [salutation, setSalutation] = useState<'محترم جناب' | 'محترمہ'>('محترم جناب');
  const [fullName, setFullName] = useState('');
  const [relationType, setRelationType] = useState<'ولد' | 'زوجہ' | 'بنت'>('ولد');
  const [fatherOrHusbandName, setFatherOrHusbandName] = useState('');
  const [cnic, setCnic] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');

  // Loan Financial Details
  const [loanAmount, setLoanAmount] = useState<number>(20000);
  const [loanAmountWords, setLoanAmountWords] = useState<string>('بیس ہزار روپے');
  const [monthlyReturnAmount, setMonthlyReturnAmount] = useState<number>(10000);
  const [monthlyReturnAmountWords, setMonthlyReturnAmountWords] = useState<string>('دس ہزار روپے');
  const [repaymentDurationMonths, setRepaymentDurationMonths] = useState<number>(2);

  // Guarantor Details (ضامن کی تفصیلات)
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorRelationType, setGuarantorRelationType] = useState<'ولد' | 'زوجہ' | 'بنت'>('ولد');
  const [guarantorFatherName, setGuarantorFatherName] = useState('');
  const [guarantorCnic, setGuarantorCnic] = useState('');
  const [guarantorMobile, setGuarantorMobile] = useState('');

  // Signatory
  const [issuedBy, setIssuedBy] = useState('ایم زیڈ اے عمرہ کمیٹی');
  const [signatoryName, setSignatoryName] = useState('حافظ عبد الشکور مدنی');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reset or Populate
  const resetFields = () => {
    const today = new Date().toISOString().split('T')[0];
    const randSuffix = Math.floor(100 + Math.random() * 900);
    setAgreementNumber(`MZA-QARZ-${randSuffix}`);
    setAgreementDate(today);
    setSelectedMemberId('');
    setSalutation('محترم جناب');
    setFullName('');
    setRelationType('ولد');
    setFatherOrHusbandName('');
    setCnic('');
    setMobile('');
    setAddress('');
    setLoanAmount(20000);
    setLoanAmountWords('بیس ہزار روپے');
    setMonthlyReturnAmount(10000);
    setMonthlyReturnAmountWords('دس ہزار روپے');
    setRepaymentDurationMonths(2);
    setGuarantorName('');
    setGuarantorRelationType('ولد');
    setGuarantorFatherName('');
    setGuarantorCnic('');
    setGuarantorMobile('');
    setIssuedBy('ایم زیڈ اے عمرہ کمیٹی');
    setSignatoryName('حافظ عبد الشکور مدنی');
    setStatusMessage(null);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialAgreement) {
        setAgreementNumber(initialAgreement.agreementNumber || '');
        setAgreementDate(initialAgreement.agreementDate || new Date().toISOString().split('T')[0]);
        setSelectedMemberId(initialAgreement.memberId || '');
        setSalutation(initialAgreement.salutation || 'محترم جناب');
        setFullName(initialAgreement.fullName || '');
        setRelationType(initialAgreement.relationType || 'ولد');
        setFatherOrHusbandName(initialAgreement.fatherOrHusbandName || '');
        setCnic(initialAgreement.cnic || '');
        setMobile(initialAgreement.mobile || '');
        setAddress(initialAgreement.address || '');
        setLoanAmount(initialAgreement.loanAmount || 20000);
        setLoanAmountWords(initialAgreement.loanAmountWordsUrdu || 'بیس ہزار روپے');
        setMonthlyReturnAmount(initialAgreement.monthlyReturnAmount || 10000);
        setMonthlyReturnAmountWords(initialAgreement.monthlyReturnAmountWordsUrdu || 'دس ہزار روپے');
        setRepaymentDurationMonths(initialAgreement.repaymentDurationMonths || 2);
        setGuarantorName(initialAgreement.guarantorName || '');
        setGuarantorRelationType(initialAgreement.guarantorRelationType || 'ولد');
        setGuarantorFatherName(initialAgreement.guarantorFatherName || '');
        setGuarantorCnic(initialAgreement.guarantorCnic || '');
        setGuarantorMobile(initialAgreement.guarantorMobile || '');
        setIssuedBy(initialAgreement.issuedBy || 'ایم زیڈ اے عمرہ کمیٹی');
        setSignatoryName(initialAgreement.signatoryName || 'حافظ عبد الشکور مدنی');
      } else if (targetMember) {
        resetFields();
        applyMemberData(targetMember);
      } else {
        resetFields();
      }
    }
  }, [isOpen, initialAgreement, targetMember]);

  const applyMemberData = (m: Member) => {
    setSelectedMemberId(m.id);
    setFullName(m.fullName);
    setFatherOrHusbandName(m.fatherName || '');
    setCnic(m.cnic || '');
    setMobile(m.mobile || '');
    setAddress(m.address || '');

    const isFemale = /(بیگم|خاتون|بی بی|صاحبہ|فاطمہ|عائشہ|مریم|رقیہ|زینب|آمنہ|رضوانہ|کلثوم|سلمی|نسیم)/i.test(m.fullName);
    if (isFemale) {
      setSalutation('محترمہ');
      setRelationType('زوجہ');
    } else {
      setSalutation('محترم جناب');
      setRelationType('ولد');
    }

    // Pre-fill nominee as initial guarantor if available
    if (m.nomineeName) {
      setGuarantorName(m.nomineeName);
      setGuarantorCnic(m.nomineeCnic || '');
      setGuarantorMobile(m.nomineeMobile || '');
    }
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

  // Save to Firestore
  const handleSaveAgreement = async () => {
    if (!fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'برائے مہربانی ممبر کا نام درج کریں۔' });
      return;
    }
    if (!guarantorName.trim()) {
      setStatusMessage({ type: 'error', text: 'برائے مہربانی ضامن کا نام درج کریں۔' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const agreementData = {
        agreementNumber: agreementNumber.trim() || `MZA-QARZ-${Date.now().toString().slice(-4)}`,
        memberId: selectedMemberId || undefined,
        memberNumber: members.find((m) => m.id === selectedMemberId)?.memberNumber,
        salutation,
        fullName: fullName.trim(),
        relationType,
        fatherOrHusbandName: fatherOrHusbandName.trim(),
        cnic: cnic.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        agreementDate: agreementDate || new Date().toISOString().split('T')[0],
        loanAmount,
        loanAmountWordsUrdu: loanAmountWords.trim(),
        monthlyReturnAmount,
        monthlyReturnAmountWordsUrdu: monthlyReturnAmountWords.trim(),
        repaymentDurationMonths,
        paidReturnAmount: initialAgreement?.paidReturnAmount || 0,
        remainingReturnAmount: initialAgreement ? initialAgreement.remainingReturnAmount : loanAmount,
        status: (initialAgreement?.status || 'Active') as 'Active' | 'Repaid' | 'Defaulted',
        guarantorName: guarantorName.trim(),
        guarantorRelationType,
        guarantorFatherName: guarantorFatherName.trim(),
        guarantorCnic: guarantorCnic.trim(),
        guarantorMobile: guarantorMobile.trim(),
        issuedBy: issuedBy.trim(),
        signatoryName: signatoryName.trim(),
      };

      const saved = await recordQarzaAgreement(agreementData, currentUserEmail);
      setIsSubmitting(false);
      setStatusMessage({ type: 'success', text: 'عہد نامہ قرضِ حسنہ کامیابی سے محفوظ اور ریکارڈ ہو گیا۔' });

      if (onSuccess && saved) {
        onSuccess(saved);
      }
    } catch (err: any) {
      console.error('Error saving Qarza agreement:', err);
      setIsSubmitting(false);
      setStatusMessage({ type: 'error', text: err?.message || 'عہد نامہ محفوظ نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔' });
    }
  };

  // PDF Export using off-screen staging for 100% full-document capture
  const handleDownloadPdf = async () => {
    if (!printAgreementRef.current) return;
    setIsDownloadingPdf(true);
    setStatusMessage(null);

    let stagingContainer: HTMLDivElement | null = null;

    try {
      const element = printAgreementRef.current;
      const A4_LAYOUT_WIDTH = 800;

      // Off-screen staging container
      stagingContainer = document.createElement('div');
      stagingContainer.id = 'qarza-pdf-staging-root';
      stagingContainer.style.position = 'fixed';
      stagingContainer.style.top = '0';
      stagingContainer.style.left = '0';
      stagingContainer.style.width = `${A4_LAYOUT_WIDTH}px`;
      stagingContainer.style.maxWidth = `${A4_LAYOUT_WIDTH}px`;
      stagingContainer.style.minWidth = `${A4_LAYOUT_WIDTH}px`;
      stagingContainer.style.backgroundColor = '#ffffff';
      stagingContainer.style.zIndex = '-9999';
      stagingContainer.style.opacity = '1';
      stagingContainer.style.pointerEvents = 'none';
      stagingContainer.style.overflow = 'visible';
      stagingContainer.style.boxSizing = 'border-box';

      // Clone element
      const clone = element.cloneNode(true) as HTMLElement;
      clone.id = 'qarza-paper-container';
      clone.style.width = `${A4_LAYOUT_WIDTH}px`;
      clone.style.minWidth = `${A4_LAYOUT_WIDTH}px`;
      clone.style.maxWidth = `${A4_LAYOUT_WIDTH}px`;
      clone.style.height = 'auto';
      clone.style.minHeight = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.margin = '0 auto';
      clone.style.padding = '36px 44px';
      clone.style.boxSizing = 'border-box';
      clone.style.boxShadow = 'none';
      clone.style.border = '1px solid #cbd5e1';
      clone.style.backgroundColor = '#ffffff';

      // Fonts & baseline CSS
      const fontStyle = document.createElement('style');
      fontStyle.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .pdf-cloned-control-replacement {
          box-sizing: border-box !important;
          letter-spacing: 0px !important;
          word-break: break-word !important;
        }
        .qarza-urdu-main-heading {
          font-family: 'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif !important;
          letter-spacing: 0px !important;
          word-spacing: normal !important;
          font-feature-settings: "liga" 1, "calt" 1 !important;
          line-height: 1.6 !important;
          direction: rtl !important;
          text-align: center !important;
        }
      `;
      stagingContainer.appendChild(fontStyle);

      // Replace inputs with styled static spans/divs
      const sourceControls = element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
      const cloneControls = clone.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');

      for (let i = 0; i < cloneControls.length; i++) {
        const sourceControl = sourceControls[i];
        const cloneControl = cloneControls[i];
        if (!sourceControl || !cloneControl) continue;

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

        const replacement = document.createElement(isTextarea ? 'div' : 'span');
        replacement.className = `${sourceControl.className} pdf-cloned-control-replacement`;
        if (displayValue && displayValue.trim()) {
          replacement.textContent = displayValue;
        } else {
          replacement.innerHTML = '&nbsp;';
        }

        replacement.style.boxSizing = 'border-box';
        replacement.style.display = isTextarea ? 'block' : 'inline-block';
        replacement.style.verticalAlign = 'middle';

        if (isTextarea) {
          replacement.style.width = '100%';
          replacement.style.minHeight = '56px';
        } else if (sourceControl.classList.contains('flex-1')) {
          replacement.style.flex = '1 1 auto';
        }

        replacement.style.lineHeight = computed.lineHeight;
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

        if (cloneControl.parentNode) {
          cloneControl.parentNode.replaceChild(replacement, cloneControl);
        }
      }

      // Explicitly format heading in clone
      const cloneH1 = clone.querySelector('.qarza-urdu-main-heading') as HTMLElement;
      if (cloneH1) {
        cloneH1.style.fontFamily = "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif";
        cloneH1.style.letterSpacing = '0px';
        cloneH1.style.wordSpacing = 'normal';
        cloneH1.style.lineHeight = '1.6';
        cloneH1.style.direction = 'rtl';
        cloneH1.style.textAlign = 'center';
      }

      stagingContainer.appendChild(clone);
      document.body.appendChild(stagingContainer);

      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      await new Promise((resolve) => setTimeout(resolve, 80));

      const fullContentHeight = Math.ceil(
        Math.max(clone.getBoundingClientRect().height, clone.scrollHeight, clone.offsetHeight)
      );

      const canvas = await html2canvas(clone, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: A4_LAYOUT_WIDTH,
        height: fullContentHeight,
        windowWidth: 1200,
        windowHeight: fullContentHeight + 300,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      const margin = 6;
      const printW = pageWidth - margin * 2; // 198 mm
      const printH = pageHeight - margin * 2; // 285 mm

      const scale = Math.min(printW / canvas.width, printH / canvas.height);
      const renderW = canvas.width * scale;
      const renderH = canvas.height * scale;

      const xOffset = margin + (printW - renderW) / 2;
      const yOffset = margin + (printH - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH, undefined, 'FAST');
      const safeAgreementNum = (agreementNumber || 'MZA-QARZ').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanName = (fullName || 'Member').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_').slice(0, 30);
      pdf.save(`Qarza-e-Hasana-${safeAgreementNum}-${cleanName}.pdf`);

      setIsDownloadingPdf(false);
      setStatusMessage({ type: 'success', text: 'عہد نامہ پی ڈی ایف کامیابی سے ڈاؤنلوڈ ہو گیا۔ پورا صفحہ مکمل طور پر شامل ہے۔' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setIsDownloadingPdf(false);
      setStatusMessage({ type: 'error', text: err?.message ? `پی ڈی ایف جنریٹ کرنے میں غلطی ہوئی: ${err.message}` : 'پی ڈی ایف جنریٹ کرنے میں غلطی ہوئی۔ برائے مہربانی دوبارہ کوشش کریں۔' });
    } finally {
      if (stagingContainer && stagingContainer.parentNode) {
        document.body.removeChild(stagingContainer);
      }
    }
  };

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
                عہد نامہ برائے قرضِ حسنہ (Agreement for Qarza-e-Hasana)
              </h2>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider bg-emerald-700 border border-emerald-600 px-2 py-0.5 rounded-md text-white font-bold shrink-0 hidden xs:inline-block">
                Interest-Free Loan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-900 hover:bg-emerald-850 active:scale-98 text-emerald-100 border border-emerald-700/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print Agreement"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Save in Database */}
            <button
              type="button"
              onClick={handleSaveAgreement}
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
        <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs flex-1">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Select Member:</span>
            </span>
            <select
              value={selectedMemberId}
              onChange={handleMemberSelect}
              className="px-2.5 py-1 text-xs font-bold border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 focus:ring-2 focus:ring-emerald-500 max-w-xs"
            >
              <option value="">-- Choose Registered Member --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberNumber} - {m.fullName} ({m.planMonths || 24}M)
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Agreement #:</span>
              <input
                type="text"
                value={agreementNumber}
                onChange={(e) => setAgreementNumber(e.target.value)}
                className="w-32 px-2 py-0.5 border border-slate-300 rounded font-mono text-xs font-bold text-emerald-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Date:</span>
              <input
                type="date"
                value={agreementDate}
                onChange={(e) => setAgreementDate(e.target.value)}
                className="px-2 py-0.5 border border-slate-300 rounded text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Viewport for the Qarza-e-Hasana Agreement Paper */}
        <div className="w-full flex-1 overflow-y-auto overscroll-contain p-2 sm:p-5 md:p-6 bg-slate-200/80 flex justify-center items-start">
          {/* THE OFFICIAL AGREEMENT PAPER */}
          <div
            ref={printAgreementRef}
            id="qarza-paper-container"
            className="w-full max-w-[760px] mx-auto bg-white border border-slate-300 shadow-2xl p-4 sm:p-8 md:p-12 text-slate-900 leading-normal relative font-sans print:shadow-none print:border-none print:m-0 print:p-8 min-h-auto sm:min-h-[1050px]"
            dir="rtl"
          >
            {/* Scoped CSS strictly limited to this Agreement form */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');
              
              #qarza-paper-container .qarza-urdu-main-heading,
              .qarza-urdu-main-heading {
                font-family: 'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif !important;
                line-height: 1.6 !important;
                display: block !important;
                text-align: center !important;
                letter-spacing: 0px !important;
                word-spacing: normal !important;
                font-feature-settings: "liga" 1, "calt" 1 !important;
                direction: rtl !important;
              }

              #qarza-paper-container input,
              #qarza-paper-container select,
              #qarza-paper-container textarea {
                box-sizing: border-box !important;
                vertical-align: middle !important;
              }

              #qarza-paper-container .qarza-field-input {
                padding: 4px 10px;
                line-height: 2.2;
                min-height: 34px !important;
              }

              #qarza-paper-container .qarza-field-textarea {
                padding: 6px 10px !important;
                line-height: 1.8 !important;
                min-height: 48px !important;
              }

              #qarza-paper-container .qarza-inline-field {
                padding: 2px 8px !important;
                min-height: 30px !important;
                line-height: 1.8 !important;
                vertical-align: middle !important;
                display: inline-block !important;
                margin: 0 4px !important;
              }
            `}</style>

            {/* Header Branding Logo Bar */}
            <div className="flex items-center justify-between border-b-2 border-emerald-900/60 pb-3 mb-4">
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
                <div className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Ref: {agreementNumber || 'MZA-QARZ-001'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  Date: {agreementDate}
                </div>
              </div>
            </div>

            {/* Title (Centered Urdu heading with small bracket text below) */}
            <div className="text-center pt-2 sm:pt-4 pb-2 mb-3">
              <h1
                className="text-xl sm:text-2xl font-bold text-[#064E3B] tracking-normal qarza-urdu-main-heading text-center mx-auto"
                style={{
                  fontFamily: "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif",
                  letterSpacing: '0px',
                  lineHeight: '1.6',
                  direction: 'rtl',
                }}
              >
                عہد نامہ برائے قرضِ حسنہ
              </h1>
              <div className="text-xs sm:text-[13px] font-semibold font-sans text-emerald-800 tracking-normal mt-0.5 leading-[2.2] text-center" dir="ltr">
                Agreement for Qarza-e-Hasana (Interest-Free Loan)
              </div>
            </div>

            {/* Official Salutation Greeting */}
            <div className="my-3 font-urdu font-bold text-sm sm:text-base text-slate-900">
              <div className="flex items-center gap-1.5 mb-1">
                <select
                  value={salutation}
                  onChange={(e) => setSalutation(e.target.value as any)}
                  className="qarza-field-input font-urdu font-bold text-slate-900 border-b-2 border-slate-400 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-emerald-600 cursor-pointer py-0 text-sm"
                >
                  <option value="محترم جناب">محترم ممبر جناب</option>
                  <option value="محترمہ">محترمہ ممبر صاحبہ</option>
                </select>
                <span>!</span>
              </div>
              <div className="text-emerald-900">السلام علیکم ورحمۃ اللہ وبرکاتہ</div>
            </div>

            {/* Official Approval & Disbursement Body Paragraph (Direct from Reference) */}
            <div className="my-3.5 font-urdu text-sm sm:text-[15px] leading-[2.4] text-slate-900 text-justify">
              <span>آپ کی درخواست اور سابقہ ریکارڈ کی منظوری کے بعد عمرہ کمیٹی آپ کو اپنے طے شدہ ضابطہ و اصول کے مطابق </span>
              <strong className="text-emerald-950 font-black">
                <input
                  type="text"
                  inputMode="numeric"
                  value={loanAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setLoanAmount(val);
                  }}
                  className="qarza-inline-field w-24 border-b-2 border-emerald-600 font-mono font-black text-emerald-950 text-center bg-emerald-50/60 rounded-xs focus:outline-hidden"
                />
                <span> روپے ({loanAmountWords}) </span>
              </strong>
              <span>بطور قرضِ حسنہ فراہم کر رہی ہے۔</span>
            </div>

            {/* Repayment Rule Paragraph (Direct from Reference) */}
            <div className="my-3.5 font-urdu text-sm sm:text-[15px] leading-[2.4] text-slate-900 text-justify">
              <span>آپ اس بات کے پابند ہوں گے کہ ہر ماہ </span>
              <strong className="text-emerald-950 font-black">
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthlyReturnAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setMonthlyReturnAmount(val);
                  }}
                  className="qarza-inline-field w-24 border-b-2 border-emerald-600 font-mono font-black text-emerald-950 text-center bg-emerald-50/60 rounded-xs focus:outline-hidden"
                />
                <span> روپے ({monthlyReturnAmountWords}) </span>
              </strong>
              <span>باقاعدگی سے کمیٹی کو واپس کریں، یہاں تک کہ قرض کی مکمل رقم ادا ہو جائے۔</span>
            </div>

            {/* Section 1: اقرار و عہد (Borrower Acknowledgment) */}
            <div className="mt-5 pt-3 border-t border-slate-200">
              <div className="font-urdu font-black text-sm sm:text-base text-emerald-950 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                <span>اقرار و عہد</span>
              </div>

              <div className="font-urdu text-xs sm:text-sm leading-[2.5] text-slate-900 text-justify">
                <span>میں، </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="محمد رضوان شفیع صاحب"
                  className="qarza-field-input font-urdu font-black text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-emerald-600 min-w-[160px] sm:min-w-[200px] bg-slate-50/70 rounded-xs"
                />
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as any)}
                  className="qarza-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-emerald-600 cursor-pointer mx-1"
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
                  className="qarza-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 focus:outline-hidden focus:border-emerald-600 min-w-[150px] sm:min-w-[180px] bg-slate-50/70 rounded-xs"
                />
                <span>، اقرار کرتا/کرتی ہوں کہ میں نے عمرہ کمیٹی سے </span>
                <strong className="text-emerald-950 font-black">20,000 روپے</strong>
                <span> بطور قرضِ حسنہ وصول کیے ہیں اور کمیٹی کے طے شدہ اصول کے مطابق ہر ماہ </span>
                <strong className="text-emerald-950 font-black">10,000 روپے</strong>
                <span> واپس کرنے کا پابند ہوں۔</span>
              </div>

              <div className="font-urdu text-xs sm:text-sm leading-[2.3] text-slate-800 mt-2 text-justify">
                <span>میں نے اس عہد نامے کی تمام شرائط پڑھ اور سمجھ لی ہیں اور اپنی رضامندی سے انہیں قبول کرتے ہوئے دستخط کرتا/کرتی ہوں۔</span>
              </div>

              {/* Borrower CNIC, Mobile & Address metadata row */}
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-[13px] font-semibold text-slate-800 mt-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-urdu font-bold text-slate-700">شناختی کارڈ:</span>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    placeholder="42401-0513794-9"
                    dir="ltr"
                    className="qarza-field-input font-mono font-bold text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-emerald-600 w-40 sm:w-44 bg-slate-50/70 rounded-xs text-left"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-urdu font-bold text-slate-700">موبائل:</span>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="0300-1234567"
                    dir="ltr"
                    className="qarza-field-input font-mono font-bold text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-emerald-600 w-36 bg-slate-50/70 rounded-xs text-left"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: ضمانت (Guarantor Declaration) */}
            <div className="mt-5 pt-3 border-t border-slate-200">
              <div className="font-urdu font-black text-sm sm:text-base text-emerald-950 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                <span>ضمانت (Guarantor)</span>
              </div>

              <div className="font-urdu text-xs sm:text-sm leading-[2.5] text-slate-900 text-justify">
                <span>میں، </span>
                <input
                  type="text"
                  value={guarantorName}
                  onChange={(e) => setGuarantorName(e.target.value)}
                  placeholder="محمد اکرم صاحب (ضامن)"
                  className="qarza-field-input font-urdu font-black text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-amber-600 min-w-[160px] sm:min-w-[200px] bg-slate-50/70 rounded-xs"
                />
                <select
                  value={guarantorRelationType}
                  onChange={(e) => setGuarantorRelationType(e.target.value as any)}
                  className="qarza-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 bg-slate-50/70 rounded-xs focus:outline-hidden focus:border-amber-600 cursor-pointer mx-1"
                >
                  <option value="ولد">ولد :</option>
                  <option value="زوجہ">زوجہ :</option>
                  <option value="بنت">بنت :</option>
                </select>
                <input
                  type="text"
                  value={guarantorFatherName}
                  onChange={(e) => setGuarantorFatherName(e.target.value)}
                  placeholder="عبد الرحیم صاحب"
                  className="qarza-field-input font-urdu font-bold text-slate-800 border-b-2 border-slate-400 focus:outline-hidden focus:border-amber-600 min-w-[150px] sm:min-w-[180px] bg-slate-50/70 rounded-xs"
                />
                <span>، مذکورہ قرض کے لیے بطور ضامن ذمہ داری قبول کرتا/کرتی ہوں اور قرض لینے والے کی واپسی کی ذمہ داری کی ضمانت دیتا/دیتی ہوں۔</span>
              </div>

              {/* ضامن کی تفصیلات (Guarantor Details Block) */}
              <div className="mt-3 bg-slate-50/80 border border-slate-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm">
                <div className="font-urdu font-bold text-slate-800 mb-2.5 underline decoration-amber-500 underline-offset-4">
                  ضامن کی تفصیلات:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-800 font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="font-urdu text-slate-600 min-w-[50px]">نام:</span>
                    <span className="font-bold font-urdu text-slate-900 flex-1">{guarantorName || '________________________'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-urdu text-slate-600 min-w-[50px]">ولدیت:</span>
                    <span className="font-bold font-urdu text-slate-900 flex-1">{guarantorFatherName || '________________________'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-urdu text-slate-600 min-w-[110px]">شناختی کارڈ نمبر:</span>
                    <input
                      type="text"
                      value={guarantorCnic}
                      onChange={(e) => setGuarantorCnic(e.target.value)}
                      placeholder="42401-1234567-1"
                      dir="ltr"
                      className="qarza-field-input font-mono font-bold text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-amber-600 w-40 sm:w-48 bg-white rounded-xs text-left"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-urdu text-slate-600 min-w-[75px]">موبائل نمبر:</span>
                    <input
                      type="text"
                      value={guarantorMobile}
                      onChange={(e) => setGuarantorMobile(e.target.value)}
                      placeholder="0300-7654321"
                      dir="ltr"
                      className="qarza-field-input font-mono font-bold text-slate-900 border-b-2 border-slate-400 focus:outline-hidden focus:border-amber-600 w-36 sm:w-44 bg-white rounded-xs text-left"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Closing & Signatures Area (Borrower, Guarantor, President + Stamp) */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end relative">
                {/* 1. Borrower Signature */}
                <div className="text-right space-y-1">
                  <div className="w-44 border-b-2 border-slate-800 pt-8"></div>
                  <div className="text-xs font-urdu font-bold text-slate-800 mt-1">
                    دستخط قرض دار / ممبر
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans" dir="ltr">
                    (Borrower Signature)
                  </div>
                </div>

                {/* 2. Guarantor Signature */}
                <div className="text-center space-y-1">
                  <div className="w-44 border-b-2 border-slate-800 pt-8 mx-auto"></div>
                  <div className="text-xs font-urdu font-bold text-slate-800 mt-1">
                    دستخط ضامن (Guarantor)
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans" dir="ltr">
                    (Guarantor Signature)
                  </div>
                </div>

                {/* 3. President & Official Stamp */}
                <div className="text-left space-y-1 relative" dir="ltr">
                  {/* Stamp Graphic positioned like in reference */}
                  <div className="absolute -top-6 right-8 pointer-events-none opacity-90">
                    <img
                      src={mzaStamp}
                      alt="Official Stamp"
                      className="w-24 sm:w-28 h-auto object-contain rotate-[-6deg]"
                    />
                  </div>
                  <div className="w-44 border-b-2 border-slate-800 pt-8 ml-auto"></div>
                  <div className="text-xs font-urdu font-bold text-slate-900 mt-1 text-right" dir="rtl">
                    دستخط صدر عمرہ کمیٹی
                  </div>
                  <div className="text-[10px] text-slate-600 font-urdu text-right" dir="rtl">
                    صدر عمرہ کمیٹی: <strong>{signatoryName}</strong>
                  </div>
                </div>
              </div>

              {/* Official Seal text at bottom */}
              <div className="text-center text-[10px] text-slate-400 font-urdu mt-6 pt-3 border-t border-slate-100">
                ایم زیڈ اے عمرہ کمیٹی پاکستان • باقاعدہ تصدیق شدہ عہد نامہ برائے قرضِ حسنہ
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
