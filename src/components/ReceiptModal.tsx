import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  Phone,
  MapPin,
  FileCheck,
  ExternalLink,
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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (receipt) {
      // Verification link: current origin + query param or path
      const verificationUrl = `${window.location.origin}/?verify=${receipt.id}`;
      QRCode.toDataURL(verificationUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [receipt]);

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

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*MZ UMRAH COMMITTEE - PAYMENT RECEIPT*\n` +
      `*Receipt No:* ${receipt.receiptNumber}\n` +
      `*Member:* ${receipt.memberName} (${receipt.memberNumber})\n` +
      `*Installment #:* Qist ${receipt.installmentNumber}\n` +
      `*Amount Received:* Rs. ${receipt.amount.toLocaleString()}\n` +
      `*Payment Method:* ${receipt.paymentMethod}\n` +
      `*Payment Date:* ${formatDateDisplay(receipt.paymentDate)}\n` +
      `*Total Committee:* Rs. ${receipt.totalCommitteeAmount.toLocaleString()}\n` +
      `*Total Paid:* Rs. ${receipt.totalPaidAmount.toLocaleString()}\n` +
      `*Remaining Due:* Rs. ${receipt.totalDueAmount.toLocaleString()}\n\n` +
      `*Online Verification Link:* ${window.location.origin}/?verify=${receipt.id}\n\n` +
      `_Supervised by M.Z.A Welfare Pakistan (Est. 2019)_`;

    const encoded = encodeURIComponent(text);
    const phone = receipt.mobile.replace(/[^0-9]/g, '');
    const waUrl = phone.length >= 10
      ? `https://wa.me/92${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank');
  };

  const handleCopyLink = () => {
    const verificationUrl = `${window.location.origin}/?verify=${receipt.id}`;
    navigator.clipboard.writeText(verificationUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
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

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="Print A4 Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="Share via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all"
            >
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-slate-50 print:bg-white print:p-0">
          <div className="printable-receipt-card bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto text-slate-900 font-sans print:border-none print:shadow-none">
            
            {/* Header / Islamic Branding */}
            <div className="text-center border-b-2 border-emerald-900/80 pb-5">
              <div className="text-xs font-semibold text-amber-700 tracking-wider font-serif">
                بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
              </div>

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

            {/* Receipt Meta & Verification QR Row */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-200">
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500">Receipt No: </span>
                  <span className="font-mono font-extrabold text-sm text-emerald-900">
                    {receipt.receiptNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Receipt Date: </span>
                  <span className="font-semibold">{formatDateDisplay(receipt.createdAt || receipt.paymentDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment Date: </span>
                  <span className="font-semibold">{formatDateDisplay(receipt.paymentDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment Mode: </span>
                  <span className="font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                    {receipt.paymentMethod} (Manual Handover)
                  </span>
                </div>
              </div>

              {/* QR Code with Official Verification Tag */}
              <div className="flex flex-col items-center text-center">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Receipt QR Code" className="w-24 h-24 border border-slate-200 p-1 rounded-md" />
                ) : (
                  <div className="w-24 h-24 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                    QR Code
                  </div>
                )}
                <span className="text-[9px] font-bold text-emerald-800 tracking-wider uppercase mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Scan to Verify
                </span>
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
