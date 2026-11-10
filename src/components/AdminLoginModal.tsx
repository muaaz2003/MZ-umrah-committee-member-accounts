import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  CheckCircle2,
  Mail,
  KeyRound,
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SUPER_ADMIN_EMAIL = 'hafizmadni2003@gmail.com';

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock background body scroll when modal is open and reset fields
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPassword('');
      setEmail(SUPER_ADMIN_EMAIL);
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

  // Single Super Admin Email & Password Sign In
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('براہ کرم ایڈمن ای میل درج کریں۔ (Email required)');
      setIsSubmitting(false);
      return;
    }

    if (!cleanPassword) {
      setError('براہ کرم ایڈمن پاس ورڈ درج کریں۔ (Password required)');
      setIsSubmitting(false);
      return;
    }

    try {
      // Standard Firebase Auth sign in strictly with the super admin email and password
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);

      setIsSubmitting(false);
      setPassword('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Firebase Auth Login result:', err?.code);
      setIsSubmitting(false);

      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('ای میل یا پاس ورڈ درست نہیں ہے! برائے مہربانی درست پاس ورڈ درج کریں۔ (Incorrect credentials)');
      } else if (code === 'auth/invalid-email') {
        setError('ای میل کا فارمیٹ درست نہیں ہے۔');
      } else if (code === 'auth/too-many-requests') {
        setError('متعدد غلط کوششیں کی گئیں، سیکیورٹی کی خاطر کچھ دیر بعد دوبارہ کوشش کریں۔ (Too many attempts. Try later)');
      } else {
        setError(err?.message || 'لاگ ان کی تصدیق میں خرابی، براہ کرم دوبارہ کوشش کریں۔');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#064E3B] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-emerald-200 hover:text-white rounded-full hover:bg-emerald-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 bg-amber-500 rounded-2xl flex items-center justify-center text-emerald-950 mb-3 shadow-md">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Super Admin Portal</h3>
          <p className="text-xs text-emerald-200/90 mt-0.5 font-urdu" dir="rtl">
            فائر بیس میں رجسٹرڈ ایڈمن ای میل اور پاس ورڈ کے ذریعے محفوظ لاگ ان
          </p>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-7 space-y-4">
          {/* Security Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-emerald-950 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 flex-1">
              <h4 className="font-bold text-xs text-emerald-950">
                صرف مجاز سپر ایڈمن (Single Super Admin)
              </h4>
              <p className="text-[11px] text-emerald-800/90 font-urdu leading-relaxed" dir="rtl">
                سسٹم کلاؤڈ سیکیورٹی رولز کے تحت محفوظ ہے۔ صرف فائر بیس کا تصدیق شدہ سپر ایڈمن ہی لاگ ان کر سکتا ہے۔
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Super Admin Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  سپر ایڈمن ای میل (Admin Email) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Firebase Authorized
                </span>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="hafizmadni2003@gmail.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                ایڈمن پاس ورڈ (Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="فائر بیس میں سیٹ کردہ پاس ورڈ درج کریں..."
                  className="w-full pl-9 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-hidden transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}
            </div>

            {/* Submit Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                منسوخ کریں (Cancel)
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !password.trim() || !email.trim()}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <span>تصدیق ہو رہی ہے...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>لاگ ان کریں (Sign In)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
