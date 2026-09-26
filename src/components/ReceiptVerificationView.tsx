import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Calendar,
  CreditCard,
  User,
  ArrowLeft,
} from 'lucide-react';
import { Receipt } from '../types';
import { getReceiptById } from '../services/firebaseService';
import { formatPKR, formatDateDisplay } from '../utils/calculations';
import { IslamicBackground } from './IslamicBackground';

interface ReceiptVerificationViewProps {
  receiptId: string;
  onBackToApp: () => void;
}

export const ReceiptVerificationView: React.FC<ReceiptVerificationViewProps> = ({
  receiptId,
  onBackToApp,
}) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadReceipt() {
      try {
        setLoading(true);
        const data = await getReceiptById(receiptId);
        if (data) {
          setReceipt(data);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error verifying receipt:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadReceipt();
  }, [receiptId]);

  return (
    <div className="relative min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <IslamicBackground />
      <div className="relative z-10 max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-950 px-6 py-6 text-white text-center">
          <div className="w-14 h-14 bg-emerald-800 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-3xl">🕋</span>
          </div>
          <h2 className="text-xl font-black tracking-wide">MZ UMRAH COMMITTEE</h2>
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider">
            Official Receipt Verification Portal
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium">Verifying receipt in committee ledger...</p>
            </div>
          ) : notFound || !receipt ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Receipt Not Verified</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  No registered receipt found with ID: <span className="font-mono font-bold text-slate-700">{receiptId}</span>. Please verify with the committee office.
                </p>
              </div>
              <button
                onClick={onBackToApp}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Application</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Verified Badge */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-emerald-950">Receipt Verified Genuine</h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Authenticated against Cloud Firestore Ledger
                  </p>
                </div>
              </div>

              {/* Verified Details Grid */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Receipt Number</span>
                  <span className="font-mono font-extrabold text-emerald-900 text-sm">
                    {receipt.receiptNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Member Name</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {receipt.memberName}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Membership Number</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {receipt.memberNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Installment Number</span>
                  <span className="font-bold text-slate-800">
                    Qist #{receipt.installmentNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Amount Received</span>
                  <span className="font-black text-base text-emerald-900">
                    {formatPKR(receipt.amount)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Payment Date</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateDisplay(receipt.paymentDate)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-bold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800">
                    {receipt.paymentMethod} (Physical Handover)
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Verification Status</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    {receipt.verificationStatus || 'Verified'}
                  </span>
                </div>
              </div>

              {/* Organization signature */}
              <div className="text-center text-[11px] text-slate-500 pt-2">
                <p className="font-semibold text-slate-700">M.Z.A Welfare Pakistan</p>
                <p>Established 2019 • Karachi, Pakistan</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onBackToApp}
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Committee System</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
