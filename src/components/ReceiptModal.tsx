import React, { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  X,
  Share2,
  CheckCircle2,
  Building2,
  Calendar,
  Phone,
  MapPin,
  FileCheck,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Receipt } from '../types';
import { formatPKR, formatDateDisplay } from '../utils/calculations';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: Receipt | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Lock background body scroll when receipt modal is open
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

  if (!isOpen || !receipt) return null;

  const handleShareWhatsAppPDF = async () => {
    if (!receipt || !receiptRef.current) return;
    setIsGeneratingPdf(true);
    setNotificationMessage(null);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 780,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      const margin = 8;
      const printW = pageWidth - margin * 2; // 194 mm
      const printH = pageHeight - margin * 2; // 281 mm

      const scale = Math.min(printW / canvas.width, printH / canvas.height);
      const renderW = canvas.width * scale;
      const renderH = canvas.height * scale;
      const xOffset = margin + (printW - renderW) / 2;
      const yOffset = margin + (printH - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH, undefined, 'FAST');

      const pdfBlob = pdf.output('blob');
      const safeName = (receipt.memberName || 'Member').trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
      const safeReceiptNo = (receipt.receiptNumber || 'MZ-REC').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `${safeReceiptNo}_${safeName}_Receipt.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Clean and format member's mobile phone for WhatsApp
      const rawPhone = (receipt.mobile || '').replace(/[^0-9]/g, '');
      let cleanPhone = rawPhone;
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '92' + cleanPhone.slice(1);
      } else if (!cleanPhone.startsWith('92') && cleanPhone.length === 10) {
        cleanPhone = '92' + cleanPhone;
      }

      const waCaption = `السلام علیکم! محترم ممبر ${receipt.memberName}، یہ آپ کی ایم زیڈ عمرہ کمیٹی قسط رسید #${receipt.receiptNumber} (قسط #${receipt.installmentNumber} - مبلغ ${formatPKR(receipt.amount)}) کی تصدیق شدہ پی ڈی ایف رسید ہے۔`;
      const waEncoded = encodeURIComponent(waCaption);

      // Check if Web Share API supports direct file sharing (Mobile browsers)
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] }) &&
        navigator.share
      ) {
        await navigator.share({
          files: [pdfFile],
          title: `Receipt #${receipt.receiptNumber}`,
          text: waCaption,
        });
        setNotificationMessage('رسید کامیابی کے ساتھ شیئر کر دی گئی ہے۔');
      } else {
        // Fallback for desktop & browsers without direct file sharing:
        // 1. Download PDF file directly
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        // 2. Open WhatsApp Web / wa.me directly to member's phone number
        const waUrl = cleanPhone.length >= 10
          ? `https://wa.me/${cleanPhone}?text=${waEncoded}`
          : `https://web.whatsapp.com/send?text=${waEncoded}`;

        window.open(waUrl, '_blank');

        setNotificationMessage(
          'پی ڈی ایف رسید ڈاؤن لوڈ کر لی گئی ہے اور ممبر کا واٹس ایپ کھل گیا ہے۔ براہ کرم ڈاؤن لوڈ شدہ رسید فائل اٹیچ کر کے بھیج دیں۔'
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setNotificationMessage(null);
      } else {
        console.error('Error generating/sharing receipt PDF:', err);
        setNotificationMessage('پی ڈی ایف شیئر کرنے میں مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide">
              Official Umrah Committee Receipt — {receipt.receiptNumber}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="receipt-whatsapp-share-btn"
              onClick={handleShareWhatsAppPDF}
              disabled={isGeneratingPdf}
              style={{ backgroundColor: '#25D366' }}
              className="px-3.5 sm:px-4 py-2 hover:opacity-95 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer font-urdu"
              title="Generate PDF & Share to Member via WhatsApp"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                  <span>پی ڈی ایف تیار ہو رہی ہے...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 shrink-0 text-white" />
                  <span className="text-xs sm:text-sm">واٹس ایپ پر رسید بھیجیں</span>
                  <span className="font-sans text-[10px] font-extrabold uppercase tracking-wide opacity-90 hidden sm:inline" dir="ltr">
                    (PDF SHARE)
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {notificationMessage && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-950 flex items-center justify-between gap-2 font-urdu" dir="rtl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{notificationMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationMessage(null)}
              className="text-emerald-800 hover:text-emerald-950 font-bold px-2 py-0.5 cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-slate-50 print:bg-white print:p-0">
          <div ref={receiptRef} className="printable-receipt-card bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto text-slate-900 font-sans print:border-none print:shadow-none">
            
            {/* Header / Branding */}
            <div className="text-center border-b-2 border-emerald-900/80 pb-5">
              <div className="flex items-center justify-center gap-3 my-2">
                <div className="w-11 h-11 rounded-xl bg-emerald-900 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                  🕋
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-emerald-950 font-serif">
                    MZ UMRAH COMMITTEE
                  </h1>
                  <p className="text-xs font-bold text-amber-700 tracking-wider uppercase">
                    Established 2019 • Supervised by: M.Z.A Welfare Pakistan
                  </p>
                </div>
              </div>

              <div className="inline-block bg-emerald-900 text-white font-bold text-xs px-4 py-1 rounded-full uppercase tracking-wider mt-1">
                Receipt For Umrah Committee Installment
              </div>
            </div>

            {/* Receipt Meta Row */}
            <div className="py-4 border-b border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Receipt No: </span>
                  <span className="font-mono font-extrabold text-sm text-emerald-900">
                    {receipt.receiptNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Receipt Date: </span>
                  <span className="font-semibold text-slate-800">{formatDateDisplay(receipt.createdAt || receipt.paymentDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Payment Date: </span>
                  <span className="font-semibold text-slate-800">{formatDateDisplay(receipt.paymentDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Payment Mode: </span>
                  <span className="font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-800 inline-block mt-0.5">
                    {receipt.paymentMethod} (Manual Handover)
                  </span>
                </div>
              </div>
            </div>

            {/* Member Information Table */}
            <div className="py-4 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Member Information
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <span className="text-slate-500">Member Name: </span>
                  <span className="font-bold text-slate-900">{receipt.memberName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Membership No: </span>
                  <span className="font-mono font-bold text-emerald-800">{receipt.memberNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">Father's Name: </span>
                  <span className="font-semibold">{receipt.fatherName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mobile Number: </span>
                  <span className="font-semibold">{receipt.mobile}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Address: </span>
                  <span className="font-medium text-slate-800">{receipt.address || 'Karachi, Pakistan'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Committee Plan: </span>
                  <span className="font-bold text-emerald-900">{receipt.planMonths} Months Plan</span>
                </div>
                <div>
                  <span className="text-slate-500">Registration Fee: </span>
                  <span className="font-bold text-emerald-700">{receipt.registrationFeeStatus}</span>
                </div>
              </div>
            </div>

            {/* Installment Payment Details Table */}
            <div className="py-4 border-b border-slate-200">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 uppercase font-bold text-[11px]">
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Installment #</th>
                    <th className="py-2 px-3">Fixed Due Date</th>
                    <th className="py-2 px-3 text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-white">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      Umrah Committee Monthly Installment
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-800">
                      Qist #{receipt.installmentNumber}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">
                      {formatDateDisplay(receipt.dueDate)}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-sm text-emerald-900">
                      {formatPKR(receipt.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Professional Accounting Financial Summary */}
            <div className="py-4 border-b border-slate-200 grid grid-cols-2 gap-6">
              {/* Left Note / Remarks */}
              <div className="text-xs space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                  Remarks & Instructions
                </span>
                <p className="text-slate-600 italic">
                  {receipt.notes ? `"${receipt.notes}"` : 'Thank you for your timely payment. May Allah reward your blessed intention for Umrah.'}
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Issued By: <strong>{receipt.generatedBy || 'Admin Counter'}</strong>
                </p>
              </div>

              {/* Right Financial Balance Card */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Committee Value:</span>
                  <span className="font-bold">{formatPKR(receipt.totalCommitteeAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Previous Amount Paid:</span>
                  <span className="font-semibold">{formatPKR(receipt.previousPaidAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 bg-emerald-50/70 px-2 rounded font-bold text-emerald-950">
                  <span>Current Payment:</span>
                  <span>{formatPKR(receipt.amount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Paid to Date:</span>
                  <span className="font-extrabold text-emerald-800">{formatPKR(receipt.totalPaidAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Advance Balance:</span>
                  <span className="font-semibold text-blue-700">{formatPKR(receipt.advanceAmount)}</span>
                </div>
                <div className="flex justify-between py-1 pt-1.5 font-black text-sm text-amber-900">
                  <span>Remaining Due Amount:</span>
                  <span>{formatPKR(receipt.totalDueAmount)}</span>
                </div>
              </div>
            </div>

            {/* Signature & Committee Stamp Section */}
            <div className="pt-8 pb-3 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-dashed border-slate-400 mb-2"></div>
                <span className="font-semibold text-slate-700">Member Signature</span>
                <span className="text-[10px] text-slate-400">Depositor Signature</span>
              </div>

              <div className="flex flex-col items-center justify-end relative">
                {/* Visual Official Stamp */}
                <div className="absolute -top-6 w-24 h-24 rounded-full border-2 border-emerald-800/40 text-emerald-800/40 flex flex-col items-center justify-center text-[9px] font-extrabold uppercase rotate-[-12deg] pointer-events-none select-none">
                  <span>MZ UMRAH</span>
                  <span className="text-[8px]">OFFICIAL</span>
                  <span>SEAL</span>
                </div>
                <div className="w-40 border-b border-dashed border-slate-400 mb-2"></div>
                <span className="font-bold text-emerald-950">Abdul Shakoor Madni</span>
                <span className="text-[10px] text-slate-500">Authorized Admin • MZ Umrah Committee</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
              MZ Umrah Committee Management System • This is a computer generated verifiable receipt • Verification ID: {receipt.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
