import React from 'react';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  HandCoins,
  ReceiptText,
  Edit,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Member } from '../types';
import { formatPKR } from '../utils/calculations';

interface MemberCardProps {
  member: Member;
  onOpenQistWasool: (member: Member) => void;
  onViewProfile: (memberId: string) => void;
  onEditMember?: (member: Member) => void;
  userRole?: string;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  onOpenQistWasool,
  onViewProfile,
  onEditMember,
  userRole,
}) => {
  const isCompleted = member.status === 'Completed' || member.paidAmount >= member.totalCommitteeAmount;
  const progressPercent = member.totalCommitteeAmount > 0
    ? Math.min(100, Math.round((member.paidAmount / member.totalCommitteeAmount) * 1000) / 10)
    : 0;

  const getStatusBadge = () => {
    switch (member.status) {
      case 'Active':
        return <span className="bg-green-100 text-green-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Active</span>;
      case 'Completed':
        return <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Completed</span>;
      case 'Refunded':
        return <span className="bg-purple-100 text-purple-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Refunded</span>;
      case 'Cancelled':
        return <span className="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Cancelled</span>;
      case 'Archived':
        return <span className="bg-gray-100 text-gray-600 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Archived</span>;
      default:
        return <span className="bg-gray-100 text-gray-600 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">{member.status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
      {/* Top Header Card */}
      <div className="p-5 bg-[#064E3B] text-white relative">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Membership Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold tracking-tighter text-white">
              {member.memberNumber}
            </span>
            <span className="bg-amber-500 text-amber-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
              {member.planMonths}M Plan
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Member Name and Father Name */}
        <div className="flex items-center gap-3">
          {member.memberPhoto ? (
            <img
              src={member.memberPhoto}
              alt={member.fullName}
              className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-emerald-800/80 border border-emerald-700/60 flex items-center justify-center shrink-0 text-amber-300 font-bold text-sm shadow-xs">
              {member.fullName ? member.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white tracking-wide truncate">
              {member.fullName}
            </h3>
            <p className="text-xs text-emerald-100/70 font-medium mt-0.5 truncate">
              Father: {member.fatherName || '—'}
            </p>
          </div>
        </div>

        {/* Contact info and joined date */}
        <div className="mt-3 pt-3 border-t border-emerald-800/60 grid grid-cols-2 gap-2 text-xs text-emerald-100/80">
          <div className="flex items-center gap-1.5 truncate" title={member.mobile}>
            <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{member.mobile}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-200 truncate">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Joined: {member.joiningDate}</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 text-emerald-300/80 truncate text-[11px]" title={member.address}>
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{member.address || 'Karachi, Pakistan'}</span>
          </div>
        </div>
      </div>

      {/* Financial Summary Section */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              TOTAL COMMITTEE
            </span>
            <span className="text-sm font-bold text-emerald-800">
              {formatPKR(member.totalCommitteeAmount)}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              PAID AMOUNT
            </span>
            <span className="text-sm font-bold text-emerald-600">
              {formatPKR(member.paidAmount)}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              DUE BALANCE
            </span>
            <span className="text-sm font-bold text-amber-700">
              {formatPKR(member.dueAmount)}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              ADVANCE / MONTHLY
            </span>
            <span className="text-sm font-bold text-gray-700">
              {member.advanceAmount > 0 ? formatPKR(member.advanceAmount) : formatPKR(member.monthlyInstallment)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Progress</span>
            <span className="text-xs font-bold text-emerald-700">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Registration fee note if unpaid */}
        {member.registrationFeeStatus === 'Unpaid' && (
          <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Registration Fee (Rs. {member.registrationFee || 1000}) Unpaid</span>
          </div>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="p-4 bg-gray-50/70 border-t border-gray-100 space-y-2">
        {/* Prominent "QIST WASOOL KAREIN" button */}
        {userRole !== 'MEMBER' && !isCompleted && member.status === 'Active' && (
          <button
            onClick={() => onOpenQistWasool(member)}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <HandCoins className="w-4 h-4" />
            <span>QIST WASOOL KAREIN</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onViewProfile(member.id)}
            className="w-full py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            <ReceiptText className="w-3.5 h-3.5 text-emerald-700" />
            <span>View Ledger</span>
          </button>

          {userRole !== 'MEMBER' && onEditMember && (
            <button
              onClick={() => onEditMember(member)}
              className="w-full py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Edit className="w-3.5 h-3.5 text-gray-500" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
