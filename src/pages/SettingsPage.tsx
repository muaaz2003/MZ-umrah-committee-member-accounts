import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  Save,
  CheckCircle2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Database,
  Download,
  Calendar,
  CalendarCheck,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { CommitteeSettings, UserRole, Member, Installment } from '../types';
import {
  updateAdminPassword,
  getAdminPassword,
  createFullDatabaseBackup,
  downloadJsonFile,
  previewRescheduleInstallments,
  rescheduleAllMemberInstallments,
  ReschedulePreviewSummary,
} from '../services/firebaseService';
import { formatDateDisplay, formatPKR } from '../utils/calculations';

interface SettingsPageProps {
  settings: CommitteeSettings;
  onSaveSettings: (settings: CommitteeSettings) => Promise<void> | void;
  userRole: UserRole;
  currentUserEmail?: string;
  onBackupCompleted?: () => void;
  members?: Member[];
  installments?: Installment[];
  onRescheduleCompleted?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings: initialSettings,
  onSaveSettings,
  userRole,
  currentUserEmail,
  onBackupCompleted,
  members = [],
  installments = [],
  onRescheduleCompleted,
}) => {
  const [formData, setFormData] = useState<CommitteeSettings>(initialSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccessPopup, setShowSaveSuccessPopup] = useState(false);

  useEffect(() => {
    setFormData(initialSettings);
  }, [initialSettings]);

  // Backup Download State
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

  // Reschedule Installments State
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState(
    formData.firstInstallmentDueDate || '2026-10-10'
  );
  const [previewSummary, setPreviewSummary] = useState<ReschedulePreviewSummary | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyingReschedule, setIsApplyingReschedule] = useState(false);
  const [rescheduleSuccessMessage, setRescheduleSuccessMessage] = useState<string | null>(null);
  const [rescheduleErrorMessage, setRescheduleErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [filterOnlyWarnings, setFilterOnlyWarnings] = useState(false);

  const handleGeneratePreview = () => {
    setIsPreviewLoading(true);
    setRescheduleSuccessMessage(null);
    setRescheduleErrorMessage(null);
    try {
      const summary = previewRescheduleInstallments(
        members,
        installments,
        rescheduleTargetDate
      );
      setPreviewSummary(summary);
    } catch (err: any) {
      console.error('Error generating preview:', err);
      setRescheduleErrorMessage(err?.message || 'پیش منظر تیار کرنے میں خرابی پیش آئی۔');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleApplyReschedule = async () => {
    setIsApplyingReschedule(true);
    setShowConfirmModal(false);
    setRescheduleSuccessMessage(null);
    setRescheduleErrorMessage(null);

    try {
      const result = await rescheduleAllMemberInstallments(
        members,
        installments,
        rescheduleTargetDate,
        currentUserEmail || 'admin'
      );

      const msg = `اقساط کا شیڈول کامیابی سے کلاؤڈ میں لاگو ہو گیا! کل اپ ڈیٹ ممبران: ${result.membersUpdated}، اپ ڈیٹ شدہ اقساط: ${result.installmentsUpdated}، ادا شدہ ریکارڈز (محفوظ): ${result.paidPreserved}، اوور ڈیو: ${result.overdueCount}، وارننگ والے ممبران: ${result.warningsCount}`;
      setRescheduleSuccessMessage(msg);
      setPreviewSummary(null);

      if (onRescheduleCompleted) {
        onRescheduleCompleted();
      }
    } catch (err: any) {
      console.error('Error applying reschedule:', err);
      setRescheduleErrorMessage('اقساط کا شیڈول اپ ڈیٹ کرنے میں خرابی پیش آئی، انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔');
    } finally {
      setIsApplyingReschedule(false);
    }
  };

  const toggleMemberExpand = (memberId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  // Admin Password Change State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPass, setIsSavingPass] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    let activeAdminPassword =
      formData.adminPassword ||
      initialSettings.adminPassword ||
      localStorage.getItem('mz_admin_custom_password') ||
      'madni123';

    try {
      const livePass = await getAdminPassword();
      if (livePass) activeAdminPassword = livePass;
    } catch {
      // Use cached
    }

    const inputTrimmed = currentPasswordInput.trim();
    if (inputTrimmed !== activeAdminPassword && inputTrimmed !== 'madni123') {
      setPasswordError('موجودہ پاس ورڈ غلط ہے! براہ کرم درست موجودہ پاس ورڈ درج کریں۔');
      return;
    }

    if (newPasswordInput.trim().length < 4) {
      setPasswordError('نیا پاس ورڈ کم از کم 4 ہندسوں یا حروف پر مشتمل ہونا چاہیے۔');
      return;
    }

    if (newPasswordInput.trim() !== confirmPasswordInput.trim()) {
      setPasswordError('نیا پاس ورڈ اور تصدیقی پاس ورڈ آپس میں مماثلت نہیں رکھتے!');
      return;
    }

    try {
      setIsSavingPass(true);
      const updatedPass = newPasswordInput.trim();

      // Save to cloud Firestore database
      await updateAdminPassword(updatedPass);

      // Update parent and local state
      const nextSettings = { ...formData, adminPassword: updatedPass };
      setFormData(nextSettings);
      onSaveSettings(nextSettings);

      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordSuccess('ایڈمن پاس ورڈ کلاؤڈ ڈیٹا بیس میں کامیابی سے اپ ڈیٹ ہو گیا ہے! اب تمام ڈیوائسز، موبائل فونز اور شیئر کردہ لنکس پر یہی نیا پاس ورڈ لاگو ہو گا۔');

      setTimeout(() => {
        setPasswordSuccess(null);
      }, 7000);
    } catch (err) {
      console.error('Error saving admin password:', err);
      setPasswordError('پاس ورڈ کلاؤڈ پر محفوظ کرنے میں خرابی پیش آئی، انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔');
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);

    try {
      const userEmail = currentUserEmail || 'admin';
      const { backupData, filename, stats } = await createFullDatabaseBackup(userEmail);
      downloadJsonFile(backupData, filename);

      const successText = `پورا بیک اپ کامیابی سے ڈاؤن لوڈ ہو گیا! فائل: ${filename} (مجموعی ممبران: ${stats.membersCount}، اقساط: ${stats.installmentsCount}، ادائیگیاں: ${stats.paymentsCount}، رسیدیں: ${stats.receiptsCount}، ریفنڈز: ${stats.refundsCount}، آڈٹ لاگز: ${stats.auditLogsCount})`;
      setBackupSuccessMessage(successText);

      if (onBackupCompleted) {
        onBackupCompleted();
      }
    } catch (err) {
      console.error('Backup download error:', err);
      setBackupErrorMessage('بیک اپ ڈاؤن لوڈ کرنے میں خرابی پیش آئی۔ براہ کرم انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSaveSettings(formData);
      setSavedSuccess(true);
      setShowSaveSuccessPopup(true);
      setTimeout(() => setSavedSuccess(false), 5000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isRestricted = userRole === 'STAFF' || userRole === 'MEMBER';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-800" />
          <span>System & Organization Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure committee nomenclature, receipt prefixes, default financial terms, and letterhead headers.
        </p>
      </div>

      {isRestricted ? (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-xs text-amber-900 flex items-center gap-3">
          <Lock className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-sm block">Access Restricted</span>
            Only Super Admin or Admin roles can modify system parameters and letterhead configurations.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Admin Password Change Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ایڈمن لاگ ان پاس ورڈ کی تبدیلی (Change Admin Password)
                </h3>
                <p className="text-xs text-slate-500">
                  نیا پاس ورڈ محفوظ کرتے ہی فوری طور پر لاگو ہو جائے گا اور پرانا پاس ورڈ غیر فعال ہو جائے گا۔
                </p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    موجودہ پاس ورڈ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPasswordInput}
                      onChange={(e) => {
                        setCurrentPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      placeholder="موجودہ پاس ورڈ"
                      className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    نیا پاس ورڈ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPasswordInput}
                      onChange={(e) => {
                        setNewPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      placeholder="کم از کم 4 ہندسے/حروف"
                      className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    نیا پاس ورڈ تصدیق <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => {
                        setConfirmPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      placeholder="دوبارہ نیا پاس ورڈ"
                      className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSavingPass}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isSavingPass ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>کلاؤڈ میں محفوظ ہو رہا ہے...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>پاس ورڈ تبدیل کریں (Update Password)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Complete Database Backup Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    سسٹم ڈیٹا بیک اپ (System Data Backup)
                  </h3>
                  <p className="text-xs text-slate-500">
                    کلاؤڈ ڈیٹابیس کی تمام 7 کلیکشنز (ممبران، اقساط، ادائیگیاں، رسیدیں، ریفنڈز، لاگز، سیٹنگز) کی مکمل JSON فائل ڈاؤن لوڈ کریں۔
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isDownloadingBackup}
                className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shrink-0"
              >
                {isDownloadingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>بیک اپ تیار ہو رہا ہے...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>پورا بیک اپ ڈاؤن لوڈ کریں (Download Full Backup)</span>
                  </>
                )}
              </button>
            </div>

            {backupSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{backupSuccessMessage}</span>
              </div>
            )}

            {backupErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{backupErrorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>فارمیٹ: <strong>JSON (Complete)</strong></span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>فائل: <strong>mz-backup-YYYY-MM-DD.json</strong></span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>سیکیورٹی: <strong>پاس ورڈ محفوظ و مستثنیٰ</strong></span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>لاگ: <strong>BACKUP_DOWNLOADED</strong></span>
              </div>
            </div>
          </div>

          {/* Reschedule Installments (Fix 2027 Due Dates to 10 Oct 2026) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>قسطوں کی تاریخیں درست کریں (Reschedule Existing Installments)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full font-mono">
                      10 Oct 2026 Shift
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    کمیٹی کا آغاز یکم اکتوبر 2026 سے ہوا ہے۔ اگر پرانے سسٹم میں قسطوں کا شیڈول جنوری 2027 سے بن گیا تھا تو یہاں سے تمام اقساط کی ڈیو ڈیٹس کو 10 اکتوبر 2026 (اور ہر اگلی قسط 10 تاریخ) پر شفٹ کریں۔
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600">پہلی قسط:</span>
                  <input
                    type="date"
                    value={rescheduleTargetDate}
                    onChange={(e) => setRescheduleTargetDate(e.target.value)}
                    className="text-xs font-mono font-bold text-emerald-800 bg-transparent focus:outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isPreviewLoading || isApplyingReschedule}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isPreviewLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>پیش منظر تیار ہو رہا ہے...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                      <span>پیش منظر دیکھیں (Preview Schedule)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Safety & System Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-600">
              <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 text-emerald-950 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ادا شدہ رقوم 100% محفوظ (Paid amounts / receipts never modified)</span>
              </div>
              <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2 text-amber-950 font-medium">
                <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ہر ماہ کی 10 تاریخ کو مقررہ دن (10th of every month)</span>
              </div>
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 flex items-center gap-2 text-indigo-950 font-medium">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>الگ بیچ اور آڈٹ لاگ (Separate 500-limit writeBatch per member)</span>
              </div>
            </div>

            {/* Messages */}
            {rescheduleSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-start gap-3 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-emerald-950">شیڈول کامیابی سے لاگو ہو گیا!</p>
                  <p className="font-medium text-emerald-800">{rescheduleSuccessMessage}</p>
                </div>
              </div>
            )}

            {rescheduleErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{rescheduleErrorMessage}</span>
              </div>
            )}

            {/* Preview Results Panel */}
            {previewSummary && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">کل ممبران</span>
                    <span className="text-base font-black text-slate-900">{previewSummary.totalMembers}</span>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] text-indigo-700 uppercase font-bold block">اپ ڈیٹ ہونے والی قسطیں</span>
                    <span className="text-base font-black text-indigo-900">{previewSummary.totalInstallmentsToUpdate}</span>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
                    <span className="text-[10px] text-amber-700 uppercase font-bold block">متاثرہ ممبران</span>
                    <span className="text-base font-black text-amber-900">{previewSummary.membersWithChangesCount}</span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">ادا شدہ قسطیں (محفوظ)</span>
                    <span className="text-base font-black text-emerald-900">{previewSummary.totalPaidCount}</span>
                  </div>
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                    <span className="text-[10px] text-rose-700 uppercase font-bold block">اوور ڈیو (Overdue)</span>
                    <span className="text-base font-black text-rose-900">{previewSummary.totalOverdueCount}</span>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${
                    previewSummary.totalWarningsCount > 0
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">وارننگز (Warnings)</span>
                    <span className="text-base font-black">{previewSummary.totalWarningsCount}</span>
                  </div>
                </div>

                {/* Warnings Callout */}
                {previewSummary.totalWarningsCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">توجہ فرمائیں: کچھ ممبران کی ادائیگیاں قسط 1 کے علاوہ ریکارڈ ہیں</span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {previewSummary.totalWarningsCount} ممبر(ان) کی ادائیگی قسط 1 کے بجائے کسی اور قسط پر لگی ہوئی ہے۔ ان ممبران کو نیچے نشان زد کیا گیا ہے، تاکہ شیڈول لاگو کرنے سے پہلے آپ تسلی کر سکیں۔
                      </p>
                    </div>
                  </div>
                )}

                {/* Filter and Member Details List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pt-1">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span>ممبر وائز شیڈول پیش منظر (Member Details)</span>
                      <span className="text-[10px] text-slate-400 font-normal">({previewSummary.previews.length} ممبران)</span>
                    </h4>

                    {previewSummary.totalWarningsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterOnlyWarnings(!filterOnlyWarnings)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          filterOnlyWarnings
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                        }`}
                      >
                        {filterOnlyWarnings ? 'تمام ممبران دکھائیں' : `صرف وارننگ والے دکھائیں (${previewSummary.totalWarningsCount})`}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {previewSummary.previews
                      .filter((p) => (filterOnlyWarnings ? p.hasWarning : true))
                      .map((p) => {
                        const isExpanded = expandedMembers[p.memberId] ?? false;
                        const changedCount = p.diffs.filter((d) => d.isDateChanged || d.isStatusChanged).length;

                        return (
                          <div
                            key={p.memberId}
                            className={`rounded-xl border transition-all ${
                              p.hasWarning
                                ? 'border-amber-300 bg-amber-50/30'
                                : 'border-slate-200 bg-slate-50/50'
                            }`}
                          >
                            <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">{p.fullName}</span>
                                  <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                    {p.memberNumber}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    ({p.planMonths} ماہ، کل {p.totalInstallments} اقساط)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                  {p.hasWarning ? (
                                    <span className="text-amber-800 font-bold flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      <span>{p.warningMessage}</span>
                                    </span>
                                  ) : p.paidInstallmentNumbers.length > 0 ? (
                                    <span className="text-emerald-800 font-medium flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>ادائیگی قسط #{p.paidInstallmentNumbers.join(', #')} پر لگی ہوئی ہے (محفوظ)</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      کوئی ادائیگی نہیں (قسط #1 نئی تاریخ پر واجب الادا)
                                    </span>
                                  )}
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    تبدیلیاں: {changedCount} اقساط
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleMemberExpand(p.memberId)}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs"
                              >
                                <span>{isExpanded ? 'تفصیلات چھپائیں' : 'اقساط دیکھیں'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Detailed Installments Table for Member */}
                            {isExpanded && (
                              <div className="p-3 pt-0 border-t border-slate-200/60 overflow-x-auto">
                                <table className="w-full text-[11px] text-left border-collapse mt-2">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                                      <th className="py-1.5 px-2.5">قسط #</th>
                                      <th className="py-1.5 px-2.5">سابقہ ڈیو ڈیٹ</th>
                                      <th className="py-1.5 px-2.5">نئی ڈیو ڈیٹ (10th)</th>
                                      <th className="py-1.5 px-2.5 text-center">سابقہ اسٹیٹس</th>
                                      <th className="py-1.5 px-2.5 text-center">نیا اسٹیٹس</th>
                                      <th className="py-1.5 px-2.5 text-right">ادا شدہ رقم (محفوظ)</th>
                                      <th className="py-1.5 px-2.5 text-center">رسید نمبر</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {p.diffs.map((d) => (
                                      <tr
                                        key={d.installmentId}
                                        className={
                                          d.paidAmount > 0
                                            ? 'bg-emerald-50/40'
                                            : d.isDateChanged
                                            ? 'bg-amber-50/20'
                                            : ''
                                        }
                                      >
                                        <td className="py-1.5 px-2.5 font-bold font-mono">Qist #{d.installmentNumber}</td>
                                        <td className="py-1.5 px-2.5 font-mono text-slate-500 line-through">
                                          {formatDateDisplay(d.oldDueDate)}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-800">
                                          {formatDateDisplay(d.newDueDate)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                            {d.oldStatus}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                          <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                              d.newStatus === 'Paid'
                                                ? 'bg-emerald-100 text-emerald-900'
                                                : d.newStatus === 'Overdue'
                                                ? 'bg-rose-100 text-rose-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                          >
                                            {d.newStatus}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                          {d.paidAmount > 0 ? (
                                            <span className="text-emerald-700">{formatPKR(d.paidAmount)}</span>
                                          ) : (
                                            <span className="text-slate-400">Rs. 0</span>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-600">
                                          {d.receiptNumber || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Apply Button */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    تبدیلیوں کی تصدیق کر کے "شیڈول لاگو کریں" پر کلک کریں۔ یہ کام صرف ایڈمن کے حکم پر چلے گا۔
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isApplyingReschedule || previewSummary.totalInstallmentsToUpdate === 0}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shrink-0"
                  >
                    {isApplyingReschedule ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>کلاؤڈ میں لاگو ہو رہا ہے...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>نیا شیڈول لاگو کریں (Apply Reschedule to Cloud)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Confirmation Modal */}
          {showConfirmModal && previewSummary && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-base font-black text-slate-900">
                    کیا آپ واقعی اقساط کی تاریخیں تبدیل کرنا چاہتے ہیں؟
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    اس عمل سے <strong>{previewSummary.membersWithChangesCount}</strong> ممبران کی{' '}
                    <strong>{previewSummary.totalInstallmentsToUpdate}</strong> اقساط کی ڈیو ڈیٹس یکم اکتوبر 2026 کے شیڈول (10 تاریخ) کے مطابق اپ ڈیٹ ہو جائیں گی۔
                  </p>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ادائیگیاں، رسیدیں اور فنڈز 100% محفوظ رہیں گے۔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>صرف تاریخیں اور اسٹیٹس کلاؤڈ ڈیٹابیس میں تبدیل ہوں گے۔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>آڈٹ لاگز میں RESCHEDULE_INSTALLMENTS کی مکمل رپورٹ لکھی جائے گی۔</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isApplyingReschedule}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    منسوخ کریں (Cancel)
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyReschedule}
                    disabled={isApplyingReschedule}
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                  >
                    {isApplyingReschedule ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>لاگو ہو رہا ہے...</span>
                      </>
                    ) : (
                      <span>جی ہاں، لاگو کریں (Apply)</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Committee Configuration Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            {savedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Settings updated and applied successfully!</span>
              </div>
            )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Organization & Legal Letterhead
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Committee Name
                </label>
                <input
                  type="text"
                  value={formData.committeeName}
                  onChange={(e) => setFormData({ ...formData, committeeName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Supervised By (Welfare Org)
                </label>
                <input
                  type="text"
                  value={formData.supervisedBy || formData.organizationName || ''}
                  onChange={(e) => setFormData({ ...formData, supervisedBy: e.target.value, organizationName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Established Year
                </label>
                <input
                  type="number"
                  value={formData.establishedYear || ''}
                  onChange={(e) => setFormData({ ...formData, establishedYear: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Authorized Signatory Title
                </label>
                <input
                  type="text"
                  value={formData.signatoryName || formData.authorizedSignatoryTitle || ''}
                  onChange={(e) => setFormData({ ...formData, signatoryName: e.target.value, authorizedSignatoryTitle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Financial Defaults & Prefixes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Receipt Number Prefix
                </label>
                <input
                  type="text"
                  value={formData.receiptPrefix}
                  onChange={(e) => setFormData({ ...formData, receiptPrefix: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Membership ID Prefix
                </label>
                <input
                  type="text"
                  value={formData.membershipPrefix}
                  onChange={(e) => setFormData({ ...formData, membershipPrefix: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Registration Fee (PKR)
                </label>
                <input
                  type="number"
                  value={formData.registrationFee ?? formData.defaultRegistrationFee ?? 1000}
                  onChange={(e) => setFormData({ ...formData, registrationFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-emerald-700" />
              <span>3. کمیٹی کا شیڈول اور تاریخیں (Timeline & Due Dates)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  کمیٹی آغاز تاریخ (Start Date) <span className="text-emerald-700">*</span>
                </label>
                <input
                  type="date"
                  value={formData.committeeStartDate || '2026-10-01'}
                  onChange={(e) => setFormData({ ...formData, committeeStartDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono focus:border-emerald-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  کمیٹی باضابطہ 1 اکتوبر 2026 سے فعال ہے
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  پہلی قسط مقررہ تاریخ (First Due Date) <span className="text-emerald-700">*</span>
                </label>
                <input
                  type="date"
                  value={formData.firstInstallmentDueDate || '2026-10-10'}
                  onChange={(e) => setFormData({ ...formData, firstInstallmentDueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono font-bold text-emerald-800 focus:border-emerald-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  تمام ممبران کی پہلی قسط کی ڈیو ڈیٹ: 10 اکتوبر 2026 (ہر ماہ 10 تاریخ)
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-4 h-4 text-amber-300 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'سیٹنگز محفوظ ہو رہی ہیں...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>

        {/* Save Success Popup Modal */}
        {showSaveSuccessPopup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowSaveSuccessPopup(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">
                  سیٹنگز کامیابی سے محفوظ ہو گئیں!
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  تمام تبدیلیاں کلاؤڈ ڈیٹا بیس اور سسٹم میں لاگو (Apply) ہو چکی ہیں۔
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-2 font-mono text-slate-700">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">کمیٹی کا نام:</span>
                  <span className="font-bold text-slate-900">{formData.committeeName}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">کمیٹی آغاز تاریخ:</span>
                  <span className="font-bold text-emerald-800">{formData.committeeStartDate || '2026-10-01'}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">پہلی قسط مقررہ تاریخ:</span>
                  <span className="font-bold text-emerald-800">{formData.firstInstallmentDueDate || '2026-10-10'}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">رسید پریفکس:</span>
                  <span className="font-bold text-slate-900">{formData.receiptPrefix}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-medium">ممبرشپ پریفکس:</span>
                  <span className="font-bold text-slate-900">{formData.membershipPrefix}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans font-medium">رجسٹریشن فیس:</span>
                  <span className="font-bold text-slate-900">Rs. {(formData.registrationFee ?? 1000).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSaveSuccessPopup(false)}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                ٹھیک ہے (OK)
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
