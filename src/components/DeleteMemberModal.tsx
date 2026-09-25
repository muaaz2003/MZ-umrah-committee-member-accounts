import React from 'react';
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import { Member } from '../types';

interface DeleteMemberModalProps {
  isOpen: boolean;
  member: Member | null;
  onClose: () => void;
  onConfirmDelete: (memberId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteMemberModal: React.FC<DeleteMemberModalProps> = ({
  isOpen,
  member,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  if (!isOpen || !member) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
      onClick={(e) => {
        if (!isDeleting && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-rose-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Compact Header */}
        <div className="bg-rose-600 px-4 py-2.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-100" />
            <span className="font-bold text-xs sm:text-sm">حذف ممبر (Delete Member)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-rose-100 hover:text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - Compact & Direct */}
        <div className="p-4 space-y-3 text-center">
          <div className="w-10 h-10 mx-auto bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900" dir="rtl">
              کیا آپ واقعی اس ممبر کو ڈیلیٹ کرنا چاہتے ہیں؟
            </h4>
            <p className="text-[11px] text-rose-600 font-medium" dir="rtl">
              ڈیلیٹ کرنے پر اس ممبر کی تمام معلومات اور قسطیں ختم ہو جائیں گی۔
            </p>
          </div>

          {/* Member Name and Number Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
            <span className="font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px]">
              {member.memberNumber}
            </span>
            <span className="font-bold text-slate-800 truncate ml-2">
              {member.fullName}
            </span>
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            نہیں (No)
          </button>

          <button
            type="button"
            onClick={() => onConfirmDelete(member.id)}
            disabled={isDeleting}
            className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-rose-400"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>ڈیلیٹ...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>ہاں، ڈیلیٹ (Yes)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
