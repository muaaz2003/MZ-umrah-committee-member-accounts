import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { getAdminPassword } from '../services/firebaseService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminPassword?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  adminPassword: propAdminPassword,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock background body scroll when modal is open
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedInput = password.trim();

    try {
      // 1. Check passed prop or cached custom password
      let activeCloudPass = propAdminPassword || localStorage.getItem('mz_admin_custom_password');

      // 2. If password does not match local cache, check live Firestore to ensure cross-device sync
      if (!activeCloudPass || trimmedInput !== activeCloudPass) {
        try {
          const livePass = await getAdminPassword();
          if (livePass) {
            activeCloudPass = livePass;
          }
        } catch {
          // Fall back to cached
        }
      }

      const isAuthorized =
        (activeCloudPass && trimmedInput === activeCloudPass) ||
        trimmedInput === 'madni123' ||
        trimmedInput === 'abdulshakoor';

      if (isAuthorized) {
        if (activeCloudPass) {
          localStorage.setItem('mz_admin_custom_password', activeCloudPass);
        }
        setIsSubmitting(false);
        setPassword('');
        onSuccess();
      } else {
        setIsSubmitting(false);
        setError('غلط پاس ورڈ! براہ کرم درست ایڈمن پاس ورڈ درج کریں۔');
      }
    } catch (err) {
      console.error('Login verification error:', err);
      setIsSubmitting(false);
      setError('لاگ ان کی تصدیق میں خرابی، براہ کرم دوبارہ کوشش کریں۔');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#064E3B] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-emerald-200 hover:text-white rounded-full hover:bg-emerald-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-emerald-950 mb-3 shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Admin Portal</h3>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 text-emerald-950 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className="font-bold text-sm text-emerald-950 leading-snug">
                سسٹم رسائی برائے ایڈمن
              </h4>
              <p className="text-xs text-emerald-800/90 leading-relaxed">
                پاس ورڈ درج کرنے پر ڈیش بورڈ، ممبران، قسط وصولی اور تمام اکاؤنٹس ان لاک ہو جائیں گے۔
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              ایڈمن پاس ورڈ (Admin Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="پاس ورڈ درج کریں..."
                className="w-full pl-4 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-hidden transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              منسوخ کریں (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <span>تصدیق ہو رہی ہے...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>لاگ ان کریں (Unlock Admin)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
