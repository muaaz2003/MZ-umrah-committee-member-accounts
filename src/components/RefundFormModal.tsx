import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Eraser,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Phone,
  MapPin,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { Member, Refund } from '../types';
import { recordRefund } from '../services/firebaseService';
import {
  formatPKR,
  numberToWordsEnglish,
  numberToWordsUrdu,
} from '../utils/calculations';

interface RefundFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: Member | null;
  currentUserEmail?: string;
  onRefundSuccess?: (refund: Refund) => void;
}

export const RefundFormModal: React.FC<RefundFormModalProps> = ({
  isOpen,
  onClose,
  member,
  currentUserEmail = 'admin',
  onRefundSuccess,
}) => {
  // All inputs start empty as explicitly required by user
  const [voucherNumber, setVoucherNumber] = useState('');
  const [refundDate, setRefundDate] = useState('');

  // Member Identification (Empty by default)
  const [memberName, setMemberName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');

  // Salutation & Financials
  const [salutationName, setSalutationName] = useState('');
  const [salutationFather, setSalutationFather] = useState('');
  const [totalCollectedAmount, setTotalCollectedAmount] = useState('');
  const [amountInWordsEnglish, setAmountInWordsEnglish] = useState('');
  const [amountInWordsUrdu, setAmountInWordsUrdu] = useState('');
  const [receivedFigure, setReceivedFigure] = useState('');
  const [receivedWords, setReceivedWords] = useState('');

  // Refund description & reason
  const [qistDescription, setQistDescription] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Undertaking & Member Feedback
  const [memberFeedback, setMemberFeedback] = useState('');

  // Committee Summary
  const [registrationDate, setRegistrationDate] = useState('');
  const [committeePeriod, setCommitteePeriod] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [totalReceivedFigure, setTotalReceivedFigure] = useState('');
  const [totalRefundFigure, setTotalRefundFigure] = useState('');

  // Signatures
  const [issueDate, setIssueDate] = useState('');
  const [adminSignature, setAdminSignature] = useState('');
  const [memberSignature, setMemberSignature] = useState('');
  const [activeSignTarget, setActiveSignTarget] = useState<'admin' | 'member' | null>(null);

  // Status & Loaders
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfPageMode, setPdfPageMode] = useState<'single' | 'multi'>('single');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form paper capture ref
  const formPrintRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-fill words helper when amount changes
  const handleAmountChange = (val: string) => {
    setTotalCollectedAmount(val);
    setReceivedFigure(val);
    setTotalRefundFigure(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      setAmountInWordsEnglish(numberToWordsEnglish(num));
      setAmountInWordsUrdu(numberToWordsUrdu(num));
      setReceivedWords(numberToWordsUrdu(num));
    }
  };

  // Optional: Quick fill from member details for admin convenience
  const handleAutofillFromMember = () => {
    if (!member) return;
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()}`;
    const autoVoucher = `MZ-REF-${Date.now().toString().slice(-4)}`;

    setVoucherNumber(autoVoucher);
    setRefundDate(formattedDate);
    setMemberName(member.fullName || '');
    setFatherName(member.fatherName || '');
    setCnic(member.cnic || '');
    setMemberNumber(member.memberNumber || '');
    setGroupNumber(member.groupNumber || `#GRP-${member.memberNumber.replace(/\D/g, '')}`);
    setPhone(member.mobile || '');
    setAddress(member.address || '');
    setArea('کراچی / Karachi');

    setSalutationName(member.fullName || '');
    setSalutationFather(member.fatherName || '');

    const amt = member.paidAmount > 0 ? String(member.paidAmount) : '120000';
    handleAmountChange(amt);

    setQistDescription(`قسط نمبر 1 تا ${member.planMonths || 24} (مکمل امانت شدہ رقم کی واپسی)`);
    setRefundReason('Member request / Committee plan cancellation voucher');
    setMemberFeedback('انتظامیہ کے احسن سلوک اور بروقت امانت کی واپسی پر مکمل مطمئن ہوں۔');

    setRegistrationDate(member.createdAt ? member.createdAt.split('T')[0] : '01-Jan-2027');
    setCommitteePeriod(`${member.planMonths || 24} ماہ (Months)`);
    setMonthlyInstallment(String(member.monthlyInstallment || 5000));
    setTotalReceivedFigure(amt);
    setTotalRefundFigure(amt);
    setIssueDate(formattedDate);
    setAdminSignature('Abdul Shakoor Madni (Admin)');
  };

  // Clear all fields
  const handleClearAll = () => {
    setVoucherNumber('');
    setRefundDate('');
    setMemberName('');
    setFatherName('');
    setCnic('');
    setMemberNumber('');
    setGroupNumber('');
    setPhone('');
    setAddress('');
    setArea('');
    setSalutationName('');
    setSalutationFather('');
    setTotalCollectedAmount('');
    setAmountInWordsEnglish('');
    setAmountInWordsUrdu('');
    setReceivedFigure('');
    setReceivedWords('');
    setQistDescription('');
    setRefundReason('');
    setMemberFeedback('');
    setRegistrationDate('');
    setCommitteePeriod('');
    setMonthlyInstallment('');
    setTotalReceivedFigure('');
    setTotalRefundFigure('');
    setIssueDate('');
    setAdminSignature('');
    setMemberSignature('');
  };

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#064E3B';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (activeSignTarget === 'admin') {
      setAdminSignature(dataUrl);
    } else if (activeSignTarget === 'member') {
      setMemberSignature(dataUrl);
    }
    setActiveSignTarget(null);
  };

  // Download PDF Form using html2canvas-pro & jsPDF
  const handleDownloadPDF = async () => {
    if (!formPrintRef.current) return;
    try {
      setIsDownloadingPdf(true);
      setStatusMessage({ type: 'success', text: 'Generating high-definition PDF voucher...' });

      const element = formPrintRef.current;

      // Ensure all custom fonts (especially Noto Nastaliq Urdu) are fully loaded
      if (document.fonts) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1080, // Emulate crisp desktop layout during capture so mobile won't compress voucher
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('mza-official-refund-form');
          if (clonedElement) {
            // Fix width to standard document proportions
            clonedElement.style.width = '820px';
            clonedElement.style.maxWidth = '820px';
            clonedElement.style.minWidth = '820px';
            clonedElement.style.margin = '0 auto';
            clonedElement.style.boxShadow = 'none';

            // Explicitly sync all filled input and textarea values so they appear accurately in the canvas
            const origInputs = element.querySelectorAll('input, textarea');
            const cloneInputs = clonedElement.querySelectorAll('input, textarea');

            origInputs.forEach((orig, idx) => {
              const cloneEl = cloneInputs[idx] as HTMLInputElement | HTMLTextAreaElement;
              if (!cloneEl) return;
              const val = (orig as HTMLInputElement | HTMLTextAreaElement).value || '';
              cloneEl.setAttribute('value', val);
              cloneEl.value = val;
              if (cloneEl.tagName.toLowerCase() === 'textarea') {
                cloneEl.textContent = val;
              }
              // Guarantee solid contrast and opacity for crisp print
              cloneEl.style.color = '#022c22';
              cloneEl.style.opacity = '1';
            });
          }
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      if (pdfPageMode === 'single') {
        // SINGLE PAGE A4 FIT (All sections, signatures, stamp & addresses fit on 1 official voucher sheet)
        const margin = 5;
        const printW = pageWidth - margin * 2; // 200 mm
        const printH = pageHeight - margin * 2; // 287 mm

        const scale = Math.min(printW / canvas.width, printH / canvas.height);
        const renderW = canvas.width * scale;
        const renderH = canvas.height * scale;
        const xOffset = margin + (printW - renderW) / 2;
        const yOffset = margin + (printH - renderH) / 2;

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH, undefined, 'FAST');
      } else {
        // MULTI-PAGE SLICING (Full size across multiple pages without any cutoff)
        const margin = 6;
        const renderW = pageWidth - margin * 2;
        const renderH = (canvas.height * renderW) / canvas.width;
        const pageUsableH = pageHeight - margin * 2;

        let heightLeft = renderH;
        let position = margin;

        pdf.addImage(imgData, 'JPEG', margin, position, renderW, renderH, undefined, 'FAST');
        heightLeft -= pageUsableH;

        while (heightLeft > 5) {
          position -= pageUsableH;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, renderW, renderH, undefined, 'FAST');
          heightLeft -= pageUsableH;
        }
      }

      const cleanVoucher = (voucherNumber || memberNumber || memberName || 'Voucher').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `MZA-Refund-Voucher-${cleanVoucher}.pdf`;
      pdf.save(filename);

      setStatusMessage({ type: 'success', text: `PDF Downloaded: ${filename} (${pdfPageMode === 'single' ? 'Single A4 Page' : 'Multi-Page'})` });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setStatusMessage({ type: 'error', text: 'PDF generate nahi ho saka. Baraye mehrbani dubara koshish karein.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Save Record into Firestore
  const handleSaveRecord = async () => {
    if (!member && !memberName) {
      setStatusMessage({ type: 'error', text: 'Baraye mehrbani Member Name ya Member darj karein.' });
      return;
    }

    const numAmt = Number(totalCollectedAmount) || Number(totalRefundFigure) || (member ? member.paidAmount : 0);
    if (numAmt <= 0) {
      setStatusMessage({ type: 'error', text: 'Baraye mehrbani Refund Amount darj karein.' });
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const targetMemberId = member ? member.id : `member_${Date.now()}`;
      const voucher = voucherNumber.trim() || `MZ-REF-${Date.now().toString().slice(-4)}`;

      const createdRefund = await recordRefund({
        memberId: targetMemberId,
        memberNumber: memberNumber || (member ? member.memberNumber : 'MZ-REF'),
        memberName: memberName || (member ? member.fullName : 'Valued Member'),
        fatherName: fatherName || (member ? member.fatherName : ''),
        cnic: cnic || (member ? member.cnic : ''),
        phone: phone || (member ? member.mobile : ''),
        groupNumber: groupNumber || '',
        address: address || '',
        area: area || '',
        refundAmount: numAmt,
        refundAmountInWordsEnglish: amountInWordsEnglish || '',
        refundAmountInWordsUrdu: amountInWordsUrdu || '',
        installmentsDescription: qistDescription || '',
        memberFeedback: memberFeedback || '',
        refundDate: refundDate || new Date().toISOString().split('T')[0],
        reason: refundReason || `Refund Voucher #${voucher} - ${qistDescription || 'Official Refund'}`,
        approvedBy: currentUserEmail || 'Admin',
        adminSignature: adminSignature.length > 50 ? 'Signed Digitally' : adminSignature,
        memberSignature: memberSignature.length > 50 ? 'Signed Digitally' : memberSignature,
        notes: `Refund Form #${voucher}. Details: ${qistDescription}. Member Feedback: ${memberFeedback}`,
        refundVoucherNumber: voucher,
      }, currentUserEmail);

      setStatusMessage({ type: 'success', text: 'Refund record kamyabi se database me save ho gaya!' });
      if (onRefundSuccess) {
        onRefundSuccess(createdRefund);
      }
    } catch (err: any) {
      console.error('Error saving refund record:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Record save karne me masla pesh aya.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndDownload = async () => {
    await handleSaveRecord();
    await handleDownloadPDF();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-hidden">
      <div className="relative bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl my-auto overflow-hidden flex flex-col h-[94vh] max-h-[96vh]">
        
        {/* Top Control Bar aligned with App's Theme */}
        <div className="bg-[#064E3B] text-white px-3.5 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0 border-b border-emerald-900 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 text-emerald-200 border border-white/15 flex items-center justify-center font-bold shrink-0">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2 truncate">
                <span>فارم واپسی رقم (Refund Voucher)</span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider bg-emerald-800/80 px-2 py-0.5 rounded-md text-emerald-200 font-semibold">
                  Official Portal
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-100/70 truncate hidden sm:block">
                Professional Form with Urdu Nastaliq Typography & PDF Export.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Single vs Multi-Page Toggle */}
            <div className="flex items-center bg-emerald-950/70 p-0.5 sm:p-1 rounded-xl border border-emerald-800 text-[10px] sm:text-xs">
              <button
                type="button"
                onClick={() => setPdfPageMode('single')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  pdfPageMode === 'single'
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
                title="Scale to fit the complete voucher onto 1 A4 page"
              >
                1-Page A4
              </button>
              <button
                type="button"
                onClick={() => setPdfPageMode('multi')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  pdfPageMode === 'multi'
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
                title="Continuous pages without page scaling"
              >
                Multi-Page
              </button>
            </div>

            {member && (
              <button
                type="button"
                onClick={handleAutofillFromMember}
                className="px-2.5 sm:px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-700/60 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Fill inputs with current member details"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Auto-fill</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              className="px-2 sm:px-2.5 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Clear all fields"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex px-2.5 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 border border-emerald-800 rounded-xl text-xs font-semibold items-center gap-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPDF}
              className="px-3 sm:px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveRecord}
              className="hidden md:flex px-3 sm:px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold flex items-center justify-between shrink-0 ${
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

        {/* Form Container (Scrollable canvas viewport) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-4 md:p-6 bg-slate-200/75 flex justify-center">
          
          {/* PROFESSIONAL REFUND FORM CARD */}
          <div
            ref={formPrintRef}
            id="mza-official-refund-form"
            className="w-full max-w-[860px] my-2 sm:my-4 mx-auto bg-white border border-slate-300 rounded-2xl shadow-xl p-3.5 sm:p-6 md:p-8 text-slate-900 leading-normal relative font-sans print:shadow-none print:border-none print:m-0 print:p-8"
          >
            {/* Top Ornamental Header Band */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-emerald-800/80 pb-3 sm:pb-4 mb-4 gap-3">
              {/* Left Brand Identity */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#064E3B] text-amber-400 flex items-center justify-center font-bold shadow-md shadow-emerald-950/10 shrink-0">
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h1 className="text-base sm:text-xl md:text-2xl font-black text-[#064E3B] tracking-tight uppercase">
                    M.Z.A UMRAH COMMITTEE
                  </h1>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-600">
                    Under the supervision of M.Z.A Welfare Pakistan
                  </p>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-0.5 inline-block">
                    Established in 2019 • Regd. Welfare Trust
                  </span>
                </div>
              </div>

              {/* Right Metadata Block: Receipt No & Refund Date */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 bg-slate-50 border border-slate-200 p-2 sm:p-2.5 rounded-xl text-xs shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-slate-700 text-[11px] sm:text-xs">Voucher #:</span>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    placeholder="#MZ-REF-0079"
                    className="w-24 sm:w-28 px-1.5 sm:px-2 py-0.5 font-mono font-bold text-xs text-rose-700 border border-slate-300 rounded-md bg-white focus:outline-hidden focus:border-emerald-600 text-right"
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-slate-700 text-[11px] sm:text-xs">Date:</span>
                  <input
                    type="text"
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    placeholder="DD-MMM-YYYY"
                    className="w-24 sm:w-28 px-1.5 sm:px-2 py-0.5 font-semibold text-xs border border-slate-300 rounded-md bg-white focus:outline-hidden focus:border-emerald-600 text-right"
                  />
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-center my-4 py-2 px-4 bg-gradient-to-r from-emerald-900 via-[#064E3B] to-emerald-900 text-white rounded-xl shadow-xs">
              <h2 className="text-lg sm:text-xl font-bold font-nastaliq text-amber-300 tracking-wide" dir="rtl">
                فارم واپسی رقم (برائے ممبر)
              </h2>
              <p className="text-[11px] font-semibold text-emerald-100 tracking-widest uppercase mt-0.5">
                Official Committee Refund Voucher & Settlement Accord
              </p>
            </div>

            {/* SECTION 1: کوائف برائے ممبر (Member Bio-Data & Info) */}
            <div className="mt-3.5 sm:mt-4 bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2.5">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Section 01 • Member Identification
                </span>
                <span className="text-sm sm:text-base font-bold font-nastaliq text-[#064E3B]" dir="rtl">
                  ( کوائف برائے ممبر )
                </span>
              </div>

              {/* Grid of Inputs with Urdu Nastaliq & English Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                {/* 1. نام ممبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    نام ممبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Member Name)</span>
                  </label>
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => {
                      setMemberName(e.target.value);
                      setSalutationName(e.target.value);
                    }}
                    placeholder="ممبر کا مکمل نام..."
                    className="w-full px-2.5 py-1.5 text-slate-900 font-semibold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs sm:text-sm"
                    dir="rtl"
                  />
                </div>

                {/* 2. ولدیت */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    ولد / زوجہ: <span className="text-[10px] font-sans font-normal text-slate-500">(Father / Husband)</span>
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => {
                      setFatherName(e.target.value);
                      setSalutationFather(e.target.value);
                    }}
                    placeholder="والد یا شوہر کا نام..."
                    className="w-full px-2.5 py-1.5 text-slate-900 font-semibold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs sm:text-sm"
                    dir="rtl"
                  />
                </div>

                {/* 3. شناختی کارڈ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    شناختی کارڈ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(CNIC Number)</span>
                  </label>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    placeholder="42401-XXXXXXX-X"
                    dir="ltr"
                    className="w-full px-2.5 py-1.5 text-slate-900 font-mono font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 4. ممبر شپ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    ممبر شپ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Membership #)</span>
                  </label>
                  <input
                    type="text"
                    value={memberNumber}
                    onChange={(e) => setMemberNumber(e.target.value)}
                    placeholder="#FGN-085"
                    dir="ltr"
                    className="w-full px-2.5 py-1.5 text-rose-700 font-bold font-mono border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 5. گروپ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    گروپ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Group #)</span>
                  </label>
                  <input
                    type="text"
                    value={groupNumber}
                    onChange={(e) => setGroupNumber(e.target.value)}
                    placeholder="#FGN-078"
                    dir="ltr"
                    className="w-full px-2.5 py-1.5 text-slate-800 font-bold font-mono border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 6. فون نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    فون نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Contact / Mobile)</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300XXXXXXX"
                    dir="ltr"
                    className="w-full px-2.5 py-1.5 text-slate-900 font-mono font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 7. رہائشی پتہ */}
                <div className="sm:col-span-2">
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    مکان نمبر و رہائشی پتہ: <span className="text-[10px] font-sans font-normal text-slate-500">(Residential Address)</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="مکان نمبر، بلاک، گلی، کالونی، شہر..."
                    className="w-full px-2.5 py-1.5 text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>

                {/* 8. علاقہ */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    علاقہ / تحصیل: <span className="text-[10px] font-sans font-normal text-slate-500">(Area / Town)</span>
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="علاقہ مثلاً گلشن بہار، اورنگی..."
                    className="w-full px-2.5 py-1.5 text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: مالیاتی تفصیلات و تصدیق واپسی (Financials & Settlement) */}
            <div className="mt-3.5 sm:mt-4 border border-emerald-900/20 bg-emerald-50/40 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/15 pb-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Section 02 • Financial Details & Settlement
                </span>
                <span className="text-sm sm:text-base font-bold font-nastaliq text-[#064E3B]" dir="rtl">
                  ( مالیاتی تفصیلات و تصدیق رقم )
                </span>
              </div>

              {/* Salutation Box */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 text-xs sm:text-sm font-nastaliq text-slate-900 leading-relaxed" dir="rtl">
                <span className="font-bold text-[#064E3B]">محترم جناب:</span>
                <input
                  type="text"
                  value={salutationName}
                  onChange={(e) => setSalutationName(e.target.value)}
                  placeholder="نام محترم..."
                  className="px-2 py-0.5 border-b-2 border-emerald-800 font-bold text-rose-700 bg-white/80 rounded-md focus:outline-hidden min-w-[100px] sm:min-w-[130px] flex-1 sm:flex-initial text-right text-xs sm:text-sm"
                />
                <span className="font-bold text-[#064E3B]">ولد:</span>
                <input
                  type="text"
                  value={salutationFather}
                  onChange={(e) => setSalutationFather(e.target.value)}
                  placeholder="والد کا نام..."
                  className="px-2 py-0.5 border-b-2 border-emerald-800 font-bold text-rose-700 bg-white/80 rounded-md focus:outline-hidden min-w-[100px] sm:min-w-[130px] flex-1 sm:flex-initial text-right text-xs sm:text-sm"
                />
                <span className="font-bold text-[#064E3B]">صاحب —</span>
                <span className="font-bold text-emerald-900 mr-auto text-xs sm:text-sm">السلام علیکم ورحمۃ اللہ وبرکاتہ</span>
              </div>

              {/* Amount Statement in Figures & Words */}
              <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-emerald-200/80 shadow-xs space-y-2.5" dir="rtl">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-nastaliq text-slate-900">
                  <span className="font-bold text-[#064E3B]">آپ کی عمرہ کمیٹی میں جمع ہونے والی کل رقم:</span>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <span className="font-bold text-slate-700 text-xs">PKR</span>
                    <input
                      type="text"
                      value={totalCollectedAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 px-2 py-0.5 sm:py-1 font-mono font-black text-slate-950 border-2 border-emerald-700 rounded-lg text-center focus:outline-hidden bg-emerald-50/50 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Amount in English and Urdu Words */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" dir="ltr">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5 text-[11px] sm:text-xs">
                      Amount in Words (English):
                    </label>
                    <input
                      type="text"
                      value={amountInWordsEnglish}
                      onChange={(e) => setAmountInWordsEnglish(e.target.value)}
                      placeholder="One Hundred Twenty Thousand Rupees Only"
                      className="w-full px-2.5 py-1 font-medium border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-emerald-600 text-xs text-rose-700 font-semibold"
                    />
                  </div>
                  <div dir="rtl">
                    <label className="block text-right text-slate-700 font-bold mb-0.5 font-nastaliq-tight text-xs">
                      رقم بلحاظ الفاظ (اردو نستعلیق):
                    </label>
                    <input
                      type="text"
                      value={amountInWordsUrdu}
                      onChange={(e) => setAmountInWordsUrdu(e.target.value)}
                      placeholder="ایک لاکھ بیس ہزار روپے فقط"
                      className="w-full px-2.5 py-1 font-bold font-nastaliq border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-emerald-600 text-xs text-rose-700 text-right"
                    />
                  </div>
                </div>

                {/* Confirmation Inquiry & Member Acceptance */}
                <div className="pt-1.5 border-t border-slate-200 text-xs sm:text-sm font-nastaliq text-slate-800 space-y-1.5">
                  <p className="leading-relaxed text-xs sm:text-sm">
                    عمرہ کمیٹی کی انتظامیہ نے آپ کی امانت کی رقم آپ کو واپس کر دی ہے۔ کیا آپ مطمئن ہیں اور اس رقم کی واپسی کی تصدیق کرتے ہیں؟
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 font-nastaliq text-slate-900 bg-emerald-50/60 p-2 sm:p-2.5 rounded-lg border border-emerald-200/60 text-xs sm:text-sm">
                    <span className="font-bold text-[#064E3B]">جی ہاں! میں نے</span>
                    <input
                      type="text"
                      value={receivedFigure}
                      onChange={(e) => setReceivedFigure(e.target.value)}
                      placeholder="120,000"
                      dir="ltr"
                      className="w-20 sm:w-24 px-1.5 py-0.5 font-mono font-bold text-center border border-emerald-700 rounded-md bg-white focus:outline-hidden text-xs sm:text-sm"
                    />
                    <input
                      type="text"
                      value={receivedWords}
                      onChange={(e) => setReceivedWords(e.target.value)}
                      placeholder="ایک لاکھ بیس ہزار روپے فقط"
                      className="flex-1 min-w-[120px] px-2 py-0.5 border border-slate-300 rounded-md bg-white text-rose-700 font-bold focus:outline-hidden text-right font-nastaliq text-xs"
                    />
                    <span className="font-bold text-[#064E3B]">انتظامیہ عمرہ کمیٹی سے وصول کر لی ہے۔</span>
                  </div>
                </div>
              </div>

              {/* Refund Description / Qist Details */}
              <div className="my-2.5 sm:my-3 bg-white p-3 sm:p-3.5 rounded-xl border-2 border-emerald-600/30 shadow-xs space-y-1.5" dir="rtl">
                <div className="flex items-center justify-between">
                  <label className="block text-right font-bold text-[#064E3B] font-nastaliq text-xs sm:text-sm">
                    تفصیل برائے ریفنڈ / کونسی قسط ہے:
                  </label>
                  <span className="text-[10px] sm:text-[11px] font-sans font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md" dir="ltr">
                    (Refund Purpose / Installment Detail)
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={qistDescription}
                  onChange={(e) => setQistDescription(e.target.value)}
                  placeholder="مثلاً: قسط نمبر 1 تا 12، یا مکمل کمیٹی رقم برائے ریفنڈ / کینسلیشن..."
                  className="w-full px-3 py-2 text-slate-900 font-semibold border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 text-right font-nastaliq min-h-[48px] resize-y text-xs sm:text-sm leading-relaxed"
                />
              </div>
            </div>

            {/* SECTION 3: WADAH & UNDERTAKING TEXT IN NASTALIQ URDU */}
            <div className="mt-3.5 sm:mt-4 bg-amber-50/50 border border-amber-300/80 rounded-xl p-3 sm:p-4 space-y-2.5" dir="rtl">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-amber-900 uppercase tracking-wider font-sans" dir="ltr">
                  Section 03 • Committee Undertaking & Member Feedback
                </span>
                <span className="text-sm sm:text-base font-bold font-nastaliq text-amber-900">
                  الحمد للہ!
                </span>
              </div>

              {/* The Wadah statement in authentic Nastaliq Urdu */}
              <p className="font-nastaliq text-xs sm:text-sm md:text-base text-slate-900 leading-relaxed sm:leading-loose text-justify">
                عمرہ کمیٹی نے معزز زائرین کی امانت شدہ رقوم واپس کر دی ہیں، اور کمیٹی نے اپنی ذمہ داریوں کو بحسن و خوبی انجام دیا ہے اور زائرین کے اعتماد کو برقرار رکھا ہے۔ اس طرح کی مثبت کارروائیاں یقیناً زائرین کے لیے اطمینان اور سکون کا باعث بنتی ہیں۔ کیا آپ انتظامیہ سے مطمئن ہیں؟
              </p>

              {/* Member Feedback Field */}
              <div className="pt-0.5">
                <label className="block text-right font-bold text-slate-800 mb-1 font-nastaliq text-xs sm:text-sm">
                  برائے مہربانی اپنی رائے / اطمینان تحریر فرمائیں:
                </label>
                <input
                  type="text"
                  value={memberFeedback}
                  onChange={(e) => setMemberFeedback(e.target.value)}
                  placeholder="اپنی رائے یا تاثرات تحریر فرمائیں..."
                  className="w-full px-3 py-1.5 text-slate-900 border border-amber-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq text-xs sm:text-sm"
                />
              </div>

              {/* Notice Note in Alert Red / Gold */}
              <div className="p-2 sm:p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] sm:text-xs font-nastaliq text-red-700 leading-relaxed">
                <span className="font-bold text-red-800 text-xs sm:text-sm">نوٹ: </span>
                <span>
                  براہ کرم اس ریفنڈ فارم کو بغور پڑھ کر اس پر اپنے دستخط کریں اور اس کی فوٹو کاپی عمرہ کمیٹی کی انتظامیہ کو واپس ارسال فرمائیں۔ شکریہ!
                </span>
              </div>
            </div>

            {/* SECTION 4: SIGNATURES & OFFICIAL STAMP */}
            <div className="mt-4 pt-2 relative">
              {/* Official Seal / Stamp (Clean CSS & SVG Badge, matches App's Theme) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-80 z-10 flex flex-col items-center justify-center">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-dashed border-[#064E3B] bg-emerald-50/30 flex flex-col items-center justify-center text-center p-2 rotate-[-10deg]">
                  <span className="text-[7px] sm:text-[8px] font-black tracking-widest text-[#064E3B] uppercase">
                    M.Z.A UMRAH COMMITTEE
                  </span>
                  <div className="border-y-2 border-[#064E3B] py-0.5 my-0.5 sm:my-1 px-2.5 bg-white/70">
                    <span className="text-[10px] sm:text-xs font-black tracking-wider text-rose-700 uppercase whitespace-nowrap">
                      REFUND VERIFIED
                    </span>
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-bold text-[#064E3B] uppercase">
                    ESTD. 2019 • TRUST
                  </span>
                </div>
              </div>

              {/* Signatures Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 items-end relative z-20">
                {/* Admin Signature */}
                <div className="text-center space-y-1">
                  <div className="h-14 sm:h-16 flex items-end justify-center pb-1">
                    {adminSignature ? (
                      adminSignature.startsWith('data:image') ? (
                        <img src={adminSignature} alt="Admin Sign" className="max-h-12 sm:max-h-14 max-w-full object-contain" />
                      ) : (
                        <span className="font-serif italic font-bold text-emerald-950 text-sm sm:text-base border-b-2 border-emerald-900 px-3 py-0.5 bg-emerald-50/50 rounded-md">
                          {adminSignature}
                        </span>
                      )
                    ) : (
                      <div className="w-full border-b border-slate-400 h-6 sm:h-8"></div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-800 pt-1 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="font-nastaliq text-xs sm:text-sm">دستخط انتظامیہ:</span>
                    <button
                      type="button"
                      onClick={() => setActiveSignTarget('admin')}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer no-print font-sans"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Sign Karein</span>
                    </button>
                  </div>
                  <div className="text-[10px] sm:text-[11px] flex items-center justify-start gap-1 pt-0.5 text-slate-600">
                    <span className="font-semibold">Issue Date:</span>
                    <input
                      type="text"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      placeholder="DD-MMM-YYYY"
                      className="w-20 sm:w-24 px-1.5 py-0.5 text-[11px] sm:text-xs font-mono border border-slate-300 rounded-md bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Member Signature */}
                <div className="text-center space-y-1" dir="rtl">
                  <div className="h-14 sm:h-16 flex items-end justify-center pb-1">
                    {memberSignature ? (
                      memberSignature.startsWith('data:image') ? (
                        <img src={memberSignature} alt="Member Sign" className="max-h-12 sm:max-h-14 max-w-full object-contain" />
                      ) : (
                        <span className="font-serif italic font-bold text-emerald-950 text-sm sm:text-base border-b-2 border-emerald-900 px-3 py-0.5 bg-emerald-50/50 rounded-md">
                          {memberSignature}
                        </span>
                      )
                    ) : (
                      <div className="w-full border-b border-slate-400 h-6 sm:h-8"></div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-800 pt-1 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="font-nastaliq text-xs sm:text-sm">دستخط ممبر (Member Sign):</span>
                    <button
                      type="button"
                      onClick={() => setActiveSignTarget('member')}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer no-print font-sans"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Sign Karein</span>
                    </button>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 text-right pt-0.5 font-sans">
                    Physical pen or digital signature verification
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 5: خلاصہ کمیٹی و دفتری رابطہ (Footer Summary) */}
            <div className="mt-5 sm:mt-6 pt-3 border-t-2 border-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Left: Contact Info */}
                <div className="space-y-1 text-slate-700 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-[#064E3B] flex items-center gap-1.5 text-xs sm:text-sm">
                    <BadgeCheck className="w-4 h-4 text-emerald-700" />
                    <span>M.Z.A Umrah Committee Welfare Pakistan</span>
                  </p>
                  <p className="text-slate-600 flex items-center gap-1 pt-0.5 text-[11px]">
                    <span className="font-semibold text-slate-700">Official Portal:</span>
                    <a
                      href="https://mz-umrah.vercel.app/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 font-mono font-medium hover:underline"
                    >
                      https://mz-umrah.vercel.app/
                    </a>
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    <span className="font-semibold text-slate-700">Helpline:</span>{' '}
                    <span className="font-mono">0321-8924033</span> •{' '}
                    <span className="font-semibold text-slate-700">WhatsApp:</span>{' '}
                    <span className="font-mono">0333-2179341</span>
                  </p>
                </div>

                {/* Right: Registration & Ledger Summary */}
                <div className="space-y-1 text-[11px] sm:text-xs bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Registration Date:</span>
                    <input
                      type="text"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      placeholder="01-Jan-2027"
                      className="w-24 sm:w-28 text-right font-mono text-emerald-900 font-bold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Committee Plan:</span>
                    <input
                      type="text"
                      value={committeePeriod}
                      onChange={(e) => setCommitteePeriod(e.target.value)}
                      placeholder="24 Months / 36 Months"
                      className="w-24 sm:w-28 text-right font-semibold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Monthly Installment:</span>
                    <input
                      type="text"
                      value={monthlyInstallment}
                      onChange={(e) => setMonthlyInstallment(e.target.value)}
                      placeholder="Rs. 5,000"
                      className="w-24 sm:w-28 text-right font-semibold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-bold text-slate-800">Total Received:</span>
                    <input
                      type="text"
                      value={totalReceivedFigure}
                      onChange={(e) => setTotalReceivedFigure(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 text-right font-mono font-black text-slate-900 border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold text-rose-700">Total Refunded:</span>
                    <input
                      type="text"
                      value={totalRefundFigure}
                      onChange={(e) => setTotalRefundFigure(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 text-right font-mono font-black text-rose-700 border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Head Office Address Box */}
              <div className="mt-2.5 p-2 sm:p-2.5 bg-slate-100 rounded-xl border border-slate-200/90 text-slate-700 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-800 shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[11px] leading-relaxed">
                  <strong className="text-slate-900">Main Head Office:</strong> House No. 37, 1st Floor, Tekri Colony, Bath Island, Block 7, near Teen Talwar, Clifton, Karachi, Pakistan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="bg-white p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
            <span className="hidden sm:inline text-slate-400">Layout:</span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
              <button
                type="button"
                onClick={() => setPdfPageMode('single')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  pdfPageMode === 'single'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1-Page A4 (Fit All)
              </button>
              <button
                type="button"
                onClick={() => setPdfPageMode('multi')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  pdfPageMode === 'multi'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Multi-Page
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-center"
            >
              Close
            </button>

            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              disabled={isSaving || isDownloadingPdf}
              onClick={handleSaveAndDownload}
              className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-white bg-[#064E3B] hover:bg-emerald-800 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Save Record & Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Signature Pad Popup */}
      {activeSignTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-300">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PenTool className="w-4 h-4 text-emerald-700" />
                <span>
                  {activeSignTarget === 'admin' ? 'دستخط برائے انتظامیہ (Admin Sign)' : 'دستخط برائے ممبر (Member Sign)'}
                </span>
              </div>
              <button
                onClick={() => setActiveSignTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Screen par mouse ya finger se dastakhat karein, ya text sign karein.
            </p>

            <div className="border-2 border-dashed border-emerald-300 rounded-xl overflow-hidden bg-slate-50 relative">
              <canvas
                ref={canvasRef}
                width={340}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 cursor-crosshair touch-none"
              />
              <span className="absolute bottom-1 right-2 text-[10px] text-slate-400 pointer-events-none">
                Sign inside the box
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSignTarget === 'admin') {
                      setAdminSignature('Abdul Shakoor Madni (Admin)');
                    } else {
                      setMemberSignature(memberName || 'Member Sign');
                    }
                    setActiveSignTarget(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold"
                >
                  Text Sign
                </button>
                <button
                  type="button"
                  onClick={saveCanvasSignature}
                  className="px-4 py-1.5 text-xs bg-[#064E3B] hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
