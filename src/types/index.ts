export type MemberStatus = 'Active' | 'Completed' | 'Cancelled' | 'Refunded' | 'Archived';
export type CommitteePlan = '24 Months' | '36 Months';
export type InstallmentStatus = 'Upcoming' | 'Due' | 'Paid' | 'Partial' | 'Advance' | 'Late' | 'Overdue';
export type PaymentMethod = 'Cash' | 'EasyPaisa' | 'JazzCash' | 'Other';
export type UserRole = 'SUPER ADMIN' | 'ADMIN' | 'STAFF' | 'MEMBER';

export interface Member {
  id: string;
  memberNumber: string; // e.g. "MZ-#001"
  fullName: string;
  fatherName: string;
  cnic: string;
  mobile: string;
  whatsapp: string;
  address: string;
  joiningDate: string; // YYYY-MM-DD
  planMonths: 24 | 36;
  monthlyInstallment: number; // default 5000
  totalCommitteeAmount: number; // 120,000 or 180,000
  paidAmount: number;
  dueAmount: number;
  advanceAmount: number;
  registrationFee: number;
  registrationFeeStatus: 'Paid' | 'Unpaid';
  nomineeName: string;
  nomineeRelation: string;
  nomineeCnic: string;
  nomineeMobile: string;
  status: MemberStatus;
  notes: string;
  memberPhoto?: string;
  linkedUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  memberId: string;
  memberNumber: string;
  installmentNumber: number; // 1 to 24 or 36
  dueDate: string; // YYYY-MM-DD
  amount: number; // e.g. 5000
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  receiptId?: string;
  notes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  installmentId: string;
  installmentNumber: number;
  receiptId: string;
  receiptNumber: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber: string;
  notes: string;
  collectedBy: string;
  allocationType: 'current' | 'next' | 'advance';
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string; // e.g. MZ-RCP-0001
  memberId: string;
  memberNumber: string;
  memberName: string;
  fatherName: string;
  mobile: string;
  address: string;
  planMonths: number;
  paymentId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  previousPaidAmount: number;
  currentPayment: number;
  remainingBalance: number;
  advanceAmount: number;
  totalCommitteeAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  registrationFeeStatus: 'Paid' | 'Unpaid';
  notes: string;
  generatedBy: string;
  verificationStatus: 'Verified' | 'Pending';
  createdAt: string;
}

export interface Refund {
  id: string;
  memberId: string;
  memberNumber?: string;
  memberName?: string;
  fatherName?: string;
  cnic?: string;
  phone?: string;
  groupNumber?: string;
  address?: string;
  area?: string;
  refundAmount: number;
  refundAmountInWordsEnglish?: string;
  refundAmountInWordsUrdu?: string;
  installmentsDescription?: string;
  memberFeedback?: string;
  refundDate?: string;
  reason: string;
  approvedBy: string;
  adminSignature?: string;
  memberSignature?: string;
  notes?: string;
  refundVoucherNumber?: string;
  createdAt: string;
}

export interface FinancialSummary {
  totalCommitteeAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  totalAdvanceAmount: number;
  totalRefundsAmount: number;
  netFundBalance: number;
  registrationFeesCollected: number;
  todayCollection: number;
  thisMonthCollection: number;
  collectionRate: number;
  totalMembers: number;
  activeMembers: number;
  completedMembers: number;
  plan24Count: number;
  plan36Count: number;
  plan24Total: number;
  plan24Paid: number;
  plan24Due: number;
  plan36Total: number;
  plan36Paid: number;
  plan36Due: number;
  totalCommitteeFund: number;
  cashCollected: number;
  easyPaisaCollected: number;
  jazzCashCollected: number;
  bankCollected: number;
  advanceCollected: number;
  refundsPaid: number;
}

export interface CommitteeSettings {
  id?: string;
  committeeName: string;
  supervisedBy: string;
  establishedYear: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  membershipPrefix: string;
  receiptPrefix: string;
  defaultMonthlyInstallment: number;
  defaultDueDay: number;
  registrationFee: number;
  currency: string;
  receiptFooter: string;
  reminderText: string;
  signatoryName: string;
  adminPassword?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  userRole: UserRole;
  action: string;
  date: string;
  time: string;
  recordType: string;
  recordId: string;
  details: string;
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  memberId?: string; // If role is MEMBER, links to Member.id
}
