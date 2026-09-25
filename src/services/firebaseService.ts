import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  Member,
  Installment,
  Payment,
  Receipt,
  Refund,
  CommitteeSettings,
  AuditLog,
  PaymentMethod,
  UserRole,
} from '../types';
import {
  calculateFinancialSummary,
  generateInstallmentSchedule,
  PLAN_A_TOTAL,
  PLAN_B_TOTAL,
  DEFAULT_MONTHLY_INSTALLMENT,
} from '../utils/calculations';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const DEFAULT_SETTINGS: CommitteeSettings = {
  committeeName: 'MZ Umrah Committee',
  supervisedBy: 'M.Z.A Welfare Pakistan',
  establishedYear: '2019',
  phone: '+92 300 8765432',
  email: 'mza.welfare.pk@gmail.com',
  website: 'https://mza-welfare.org',
  address: 'Suite #402, Business Arcade, Main Shahrah-e-Faisal, Karachi, Pakistan',
  membershipPrefix: 'MZ-#',
  receiptPrefix: 'MZ-RCP-',
  defaultMonthlyInstallment: 5000,
  defaultDueDay: 10,
  registrationFee: 1000,
  currency: 'PKR',
  receiptFooter: 'Supervised by Abdul Shakoor Madni (M.Z.A Welfare Pakistan). Established 2019. May Allah accept your holy pilgrimage.',
  reminderText: 'Dear Member, please deposit your monthly Umrah committee installment before the 10th of this month.',
  signatoryName: 'Abdul Shakoor Madni (Admin)',
  adminPassword: 'madni123',
};

// -------------------------------------------------------------
// SETTINGS SERVICE & CLOUD ADMIN PASSWORD
// -------------------------------------------------------------
export async function getSettings(): Promise<CommitteeSettings> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CommitteeSettings;
      if (data.adminPassword) {
        localStorage.setItem('mz_admin_custom_password', data.adminPassword);
      }
      return { id: snap.id, ...DEFAULT_SETTINGS, ...data };
    }
    // Set default settings
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateSettings(settings: Partial<CommitteeSettings>, userEmail: string = 'admin'): Promise<void> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    if (settings.adminPassword) {
      localStorage.setItem('mz_admin_custom_password', settings.adminPassword);
    }
    await logAudit(userEmail, 'SUPER ADMIN', 'UPDATE_SETTINGS', 'Settings', 'general', 'Updated committee general settings');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getAdminPassword(): Promise<string> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CommitteeSettings;
      if (data.adminPassword) {
        localStorage.setItem('mz_admin_custom_password', data.adminPassword);
        return data.adminPassword;
      }
    }
    const cached = localStorage.getItem('mz_admin_custom_password');
    return cached || 'madni123';
  } catch (error) {
    console.warn('Could not fetch cloud admin password, using local cache:', error);
    return localStorage.getItem('mz_admin_custom_password') || 'madni123';
  }
}

export async function updateAdminPassword(newPassword: string, userEmail: string = 'admin'): Promise<void> {
  const path = 'settings';
  const trimmed = newPassword.trim();
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, { adminPassword: trimmed, updatedAt: new Date().toISOString() }, { merge: true });
    localStorage.setItem('mz_admin_custom_password', trimmed);
    await logAudit(userEmail, 'SUPER ADMIN', 'UPDATE_PASSWORD', 'Settings', 'general', 'Admin password updated in cloud database');
  } catch (error) {
    localStorage.setItem('mz_admin_custom_password', trimmed);
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -------------------------------------------------------------
// AUDIT LOG SERVICE
// -------------------------------------------------------------
export async function logAudit(
  user: string,
  userRole: UserRole,
  action: string,
  recordType: string,
  recordId: string,
  details: string
): Promise<void> {
  const path = 'auditLogs';
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const logEntry: AuditLog = {
      id: logId,
      user,
      userRole,
      action,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString(),
      recordType,
      recordId,
      details,
      createdAt: now.toISOString(),
    };
    await setDoc(doc(db, path, logId), logEntry);
  } catch (error) {
    console.warn('Could not record audit log: ', error);
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLog) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// -------------------------------------------------------------
// MEMBERS SERVICE
// -------------------------------------------------------------
export async function getMembers(): Promise<Member[]> {
  const path = 'members';
  try {
    const snap = await getDocs(collection(db, path));
    const members = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Member) }));
    return members.sort((a, b) => (a.memberNumber > b.memberNumber ? 1 : -1));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getMemberById(memberId: string): Promise<Member | null> {
  const path = `members/${memberId}`;
  try {
    const snap = await getDoc(doc(db, 'members', memberId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Member) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getNextMembershipNumber(): Promise<string> {
  try {
    const members = await getMembers();
    let maxNumber = 1;
    for (const m of members) {
      // Expect format "MZ-#001", "MZ-#002", etc.
      const match = m.memberNumber?.match(/MZ-#(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= maxNumber) maxNumber = num + 1;
      }
    }
    return `MZ-#${String(maxNumber).padStart(3, '0')}`;
  } catch {
    return `MZ-#001`;
  }
}

export async function createMember(
  data: Omit<Member, 'id' | 'paidAmount' | 'dueAmount' | 'advanceAmount' | 'createdAt' | 'updatedAt'>,
  userEmail: string = 'admin'
): Promise<Member> {
  const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const planMonths = data.planMonths === 36 ? 36 : 24;
  const monthly = Math.max(5000, Math.min(10000, Number(data.monthlyInstallment) || 5000));
  const totalAmount = data.totalCommitteeAmount || (planMonths * monthly);
  const joiningDate = data.joiningDate || '2027-01-01';

  const newMember: Member = {
    ...data,
    id: memberId,
    planMonths,
    monthlyInstallment: monthly,
    totalCommitteeAmount: totalAmount,
    joiningDate,
    paidAmount: 0,
    dueAmount: totalAmount,
    advanceAmount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(db);

  // 1. Add member document
  const memberRef = doc(db, 'members', memberId);
  batch.set(memberRef, newMember);

  // 2. Generate and batch add all 24 or 36 installments starting from 2027-01-01 on 10th
  const schedule = generateInstallmentSchedule(
    memberId,
    newMember.memberNumber,
    newMember.planMonths,
    newMember.monthlyInstallment,
    newMember.joiningDate,
    10
  );

  for (const item of schedule) {
    const instId = `inst_${memberId}_${item.installmentNumber}`;
    const instRef = doc(db, 'installments', instId);
    batch.set(instRef, { ...item, id: instId });
  }

  try {
    await batch.commit();
    await logAudit(
      userEmail,
      'ADMIN',
      'CREATE_MEMBER',
      'Member',
      memberId,
      `Registered member ${newMember.fullName} (${newMember.memberNumber}) with ${newMember.planMonths}-month plan`
    );
    return newMember;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'members+installments');
  }
}

export async function updateMember(
  memberId: string,
  data: Partial<Member>,
  userEmail: string = 'admin'
): Promise<void> {
  const path = `members/${memberId}`;
  try {
    const memberRef = doc(db, 'members', memberId);
    await updateDoc(memberRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(userEmail, 'ADMIN', 'UPDATE_MEMBER', 'Member', memberId, `Updated member profile details`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMemberCompletely(
  memberId: string,
  userEmail: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const path = `members/${memberId}`;
  try {
    // 1. Fetch existing member data for informative audit logging
    const memberDocRef = doc(db, 'members', memberId);
    const snap = await getDoc(memberDocRef);
    const memberData = snap.exists() ? (snap.data() as Member) : null;
    const memberName = memberData?.fullName || memberId;
    const memberNum = memberData?.memberNumber || '';

    // 2. Batch delete all associated records (installments, payments, receipts, refunds)
    const batch = writeBatch(db);

    const [instSnap, paySnap, recSnap, refSnap] = await Promise.all([
      getDocs(query(collection(db, 'installments'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'payments'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'receipts'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'refunds'), where('memberId', '==', memberId))),
    ]);

    instSnap.forEach((d) => batch.delete(d.ref));
    paySnap.forEach((d) => batch.delete(d.ref));
    recSnap.forEach((d) => batch.delete(d.ref));
    refSnap.forEach((d) => batch.delete(d.ref));

    // Delete the member document itself
    batch.delete(memberDocRef);

    await batch.commit();

    // 3. Log audit event
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'DELETE_MEMBER',
      'Member',
      memberId,
      `Permanently deleted member ${memberName} (${memberNum}) and all related records.`
    );

    return {
      success: true,
      message: `ممبر ${memberName} اور ان کے تمام ریکارڈز کامیابی سے حذف کر دیے گئے۔`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function archiveMember(
  memberId: string,
  reason: string,
  userEmail: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const path = `members/${memberId}`;
  try {
    const member = await getMemberById(memberId);
    if (!member) return { success: false, message: 'Member not found' };

    // Soft delete / archive protection: preserve records
    await updateDoc(doc(db, 'members', memberId), {
      status: 'Archived',
      notes: member.notes ? `${member.notes} | Archived: ${reason}` : `Archived: ${reason}`,
      updatedAt: new Date().toISOString(),
    });

    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'ARCHIVE_MEMBER',
      'Member',
      memberId,
      `Archived member ${member.fullName} (${member.memberNumber}). Reason: ${reason}`
    );
    return { success: true, message: 'Member safely archived.' };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleRegistrationFee(
  memberId: string,
  status: 'Paid' | 'Unpaid',
  userEmail: string = 'admin'
): Promise<void> {
  const path = `members/${memberId}`;
  try {
    await updateDoc(doc(db, 'members', memberId), {
      registrationFeeStatus: status,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(
      userEmail,
      'STAFF',
      'UPDATE_REG_FEE',
      'Member',
      memberId,
      `Changed registration fee status to ${status}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -------------------------------------------------------------
// INSTALLMENTS SERVICE
// -------------------------------------------------------------
export async function getInstallmentsForMember(memberId: string): Promise<Installment[]> {
  const path = 'installments';
  try {
    const q = query(collection(db, path), where('memberId', '==', memberId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Installment) }));
    return list.sort((a, b) => a.installmentNumber - b.installmentNumber);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getAllInstallments(): Promise<Installment[]> {
  const path = 'installments';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Installment) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// -------------------------------------------------------------
// PAYMENTS & RECEIPTS SERVICE ("QIST WASOOL KAREIN")
// -------------------------------------------------------------
export async function getNextReceiptNumber(): Promise<string> {
  try {
    const snap = await getDocs(collection(db, 'receipts'));
    let maxNumber = 1;
    for (const d of snap.docs) {
      const r = d.data() as Receipt;
      const match = r.receiptNumber?.match(/MZ-RCP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= maxNumber) maxNumber = num + 1;
      }
    }
    return `MZ-RCP-${String(maxNumber).padStart(4, '0')}`;
  } catch {
    return `MZ-RCP-0001`;
  }
}

export interface RecordPaymentPayload {
  memberId: string;
  installmentId: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  paymentDate: string; // YYYY-MM-DD
  referenceNumber?: string;
  notes?: string;
  collectedBy: string;
  allocationType?: 'current' | 'next' | 'advance';
}

export async function recordPayment(payload: RecordPaymentPayload): Promise<{
  payment: Payment;
  receipt: Receipt;
  installment: Installment;
  member: Member;
}> {
  const member = await getMemberById(payload.memberId);
  if (!member) throw new Error('Member not found');

  const installments = await getInstallmentsForMember(payload.memberId);
  const targetInstallment = installments.find((i) => i.id === payload.installmentId);
  if (!targetInstallment) throw new Error('Installment not found');

  const receiptNumber = await getNextReceiptNumber();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const receiptId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Accounting logic:
  const previousPaidAmount = member.paidAmount || 0;
  const currentPayment = payload.amountReceived;
  const installmentRemainingBefore = targetInstallment.remainingAmount ?? (targetInstallment.amount - targetInstallment.paidAmount);

  let newPaidForInstallment = targetInstallment.paidAmount + currentPayment;
  let newRemainingForInstallment = 0;
  let newStatus: Installment['status'] = 'Paid';
  let excessAmount = 0;

  if (currentPayment < installmentRemainingBefore) {
    // Partial payment
    newRemainingForInstallment = installmentRemainingBefore - currentPayment;
    newPaidForInstallment = targetInstallment.paidAmount + currentPayment;
    newStatus = 'Partial';
  } else if (currentPayment === installmentRemainingBefore) {
    // Exact payment
    newRemainingForInstallment = 0;
    newPaidForInstallment = targetInstallment.amount;
    newStatus = 'Paid';
  } else {
    // Overpayment / advance
    excessAmount = currentPayment - installmentRemainingBefore;
    newRemainingForInstallment = 0;
    newPaidForInstallment = targetInstallment.amount;
    newStatus = 'Paid';
  }

  const batch = writeBatch(db);

  // 1. Create Payment Record
  const paymentRecord: Payment = {
    id: paymentId,
    memberId: member.id,
    memberNumber: member.memberNumber,
    memberName: member.fullName,
    installmentId: targetInstallment.id,
    installmentNumber: targetInstallment.installmentNumber,
    receiptId,
    receiptNumber,
    amountReceived: currentPayment,
    paymentMethod: payload.paymentMethod,
    paymentDate: payload.paymentDate,
    referenceNumber: payload.referenceNumber || '',
    notes: payload.notes || '',
    collectedBy: payload.collectedBy,
    allocationType: payload.allocationType || 'current',
    createdAt: now,
  };
  batch.set(doc(db, 'payments', paymentId), paymentRecord);

  // 2. Update Target Installment
  const updatedTargetInstallment: Installment = {
    ...targetInstallment,
    paidAmount: newPaidForInstallment,
    remainingAmount: newRemainingForInstallment,
    status: newStatus,
    paidDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    receiptNumber,
    receiptId,
    notes: payload.notes || targetInstallment.notes || '',
  };
  batch.set(doc(db, 'installments', targetInstallment.id), updatedTargetInstallment);

  // 3. Handle Excess Amount (Advance vs Next Installment)
  let updatedAdvance = member.advanceAmount || 0;
  if (excessAmount > 0) {
    if (payload.allocationType === 'next') {
      // Find the next unpaid installment
      const nextInst = installments.find(
        (i) => i.installmentNumber === targetInstallment.installmentNumber + 1
      );
      if (nextInst) {
        const nextRemaining = nextInst.remainingAmount;
        const applyToNext = Math.min(excessAmount, nextRemaining);
        const nextRem = nextRemaining - applyToNext;
        const nextStat = nextRem === 0 ? 'Paid' : 'Partial';

        batch.update(doc(db, 'installments', nextInst.id), {
          paidAmount: nextInst.paidAmount + applyToNext,
          remainingAmount: nextRem,
          status: nextStat,
          paidDate: payload.paymentDate,
          paymentMethod: payload.paymentMethod,
          receiptNumber,
        });

        const leftover = excessAmount - applyToNext;
        if (leftover > 0) {
          updatedAdvance += leftover;
        }
      } else {
        updatedAdvance += excessAmount;
      }
    } else {
      // Keep as advance
      updatedAdvance += excessAmount;
    }
  }

  // 4. Update Member's Financial Totals
  const totalPaidAfter = previousPaidAmount + currentPayment;
  const calc = calculateFinancialSummary(member.totalCommitteeAmount, totalPaidAfter, updatedAdvance);

  let newMemberStatus = member.status;
  if (totalPaidAfter >= member.totalCommitteeAmount) {
    newMemberStatus = 'Completed';
  }

  const updatedMember: Member = {
    ...member,
    paidAmount: calc.paidAmount,
    dueAmount: calc.dueAmount,
    advanceAmount: calc.advanceAmount,
    status: newMemberStatus,
    updatedAt: now,
  };
  batch.set(doc(db, 'members', member.id), updatedMember);

  // 5. Create Receipt Record
  const receiptRecord: Receipt = {
    id: receiptId,
    receiptNumber,
    memberId: member.id,
    memberNumber: member.memberNumber,
    memberName: member.fullName,
    fatherName: member.fatherName,
    mobile: member.mobile,
    address: member.address,
    planMonths: member.planMonths,
    paymentId,
    installmentNumber: targetInstallment.installmentNumber,
    dueDate: targetInstallment.dueDate,
    amount: currentPayment,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    previousPaidAmount,
    currentPayment,
    remainingBalance: calc.dueAmount,
    advanceAmount: calc.advanceAmount,
    totalCommitteeAmount: member.totalCommitteeAmount,
    totalPaidAmount: calc.paidAmount,
    totalDueAmount: calc.dueAmount,
    registrationFeeStatus: member.registrationFeeStatus,
    notes: payload.notes || '',
    generatedBy: payload.collectedBy,
    verificationStatus: 'Verified',
    createdAt: now,
  };
  batch.set(doc(db, 'receipts', receiptId), receiptRecord);

  try {
    await batch.commit();

    await logAudit(
      payload.collectedBy,
      'STAFF',
      'RECORD_PAYMENT',
      'Payment',
      paymentId,
      `Collected ${currentPayment} PKR from ${member.fullName} (${member.memberNumber}) for Installment #${targetInstallment.installmentNumber} via ${payload.paymentMethod}. Generated receipt ${receiptNumber}.`
    );

    return {
      payment: paymentRecord,
      receipt: receiptRecord,
      installment: updatedTargetInstallment,
      member: updatedMember,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments+receipts+atomic');
  }
}

export interface RecordManualPaymentPayload {
  memberName: string;
  fatherName?: string;
  mobile?: string;
  memberNumber?: string;
  installmentDescription?: string;
  installmentNumber?: number;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  collectedBy: string;
}

export async function recordManualPayment(payload: RecordManualPaymentPayload): Promise<{
  payment: Payment;
  receipt: Receipt;
}> {
  const receiptNumber = await getNextReceiptNumber();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const receiptId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const instNum = payload.installmentNumber || 1;

  const memberNumber = payload.memberNumber || `MZ-M-${Date.now().toString().slice(-4)}`;

  const paymentRecord: Payment = {
    id: paymentId,
    memberId: `manual_${Date.now()}`,
    memberNumber,
    memberName: payload.memberName,
    installmentId: `manual_inst_${Date.now()}`,
    installmentNumber: instNum,
    receiptId,
    receiptNumber,
    amountReceived: payload.amountReceived,
    paymentMethod: payload.paymentMethod,
    paymentDate: payload.paymentDate,
    referenceNumber: payload.referenceNumber || '',
    notes: payload.notes || payload.installmentDescription || 'دستی وصولی',
    collectedBy: payload.collectedBy,
    allocationType: 'current',
    createdAt: now,
  };

  const receiptRecord: Receipt = {
    id: receiptId,
    receiptNumber,
    memberId: `manual_${Date.now()}`,
    memberNumber,
    memberName: payload.memberName,
    fatherName: payload.fatherName || '—',
    mobile: payload.mobile || '—',
    address: 'دستی اندراج / Manual Entry',
    planMonths: 20,
    paymentId,
    installmentNumber: instNum,
    dueDate: payload.paymentDate,
    amount: payload.amountReceived,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    previousPaidAmount: 0,
    currentPayment: payload.amountReceived,
    remainingBalance: 0,
    advanceAmount: 0,
    totalCommitteeAmount: payload.amountReceived,
    totalPaidAmount: payload.amountReceived,
    totalDueAmount: 0,
    registrationFeeStatus: 'Paid',
    notes: payload.notes || payload.installmentDescription || '',
    generatedBy: payload.collectedBy,
    verificationStatus: 'Verified',
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'payments', paymentId), paymentRecord);
  batch.set(doc(db, 'receipts', receiptId), receiptRecord);

  try {
    await batch.commit();

    await logAudit(
      payload.collectedBy,
      'STAFF',
      'RECORD_PAYMENT',
      'Payment',
      paymentId,
      `Manual Payment collected: ${payload.amountReceived} PKR from ${payload.memberName} via ${payload.paymentMethod}. Generated receipt ${receiptNumber}.`
    );

    return {
      payment: paymentRecord,
      receipt: receiptRecord,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments+receipts+manual');
    throw error;
  }
}

export async function getPayments(): Promise<Payment[]> {
  const path = 'payments';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Payment) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getReceipts(): Promise<Receipt[]> {
  const path = 'receipts';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Receipt) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  const path = `receipts/${receiptId}`;
  try {
    const snap = await getDoc(doc(db, 'receipts', receiptId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Receipt) };
    }
    // Also try searching by receiptNumber if user pasted "MZ-RCP-0001"
    const q = query(collection(db, 'receipts'), where('receiptNumber', '==', receiptId));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const d = querySnap.docs[0];
      return { id: d.id, ...(d.data() as Receipt) };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// -------------------------------------------------------------
// REFUND MANAGEMENT SERVICE
// -------------------------------------------------------------
export async function recordRefund(
  data: Omit<Refund, 'id' | 'createdAt'>,
  userEmail: string = 'admin'
): Promise<Refund> {
  const member = await getMemberById(data.memberId);
  if (!member) throw new Error('Member not found');

  const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const refundRecord: Refund = {
    ...data,
    id: refundId,
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'refunds', refundId), refundRecord);

  // Update member record with status Refunded or cancelled
  batch.update(doc(db, 'members', member.id), {
    status: 'Refunded',
    notes: member.notes ? `${member.notes} | Refunded Rs. ${data.refundAmount}` : `Refunded Rs. ${data.refundAmount}`,
    updatedAt: now,
  });

  try {
    await batch.commit();
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'RECORD_REFUND',
      'Refund',
      refundId,
      `Recorded refund of ${data.refundAmount} PKR for ${member.fullName} (${member.memberNumber}). Reason: ${data.reason}`
    );
    return refundRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'refunds');
  }
}

export async function getRefunds(): Promise<Refund[]> {
  const path = 'refunds';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Refund) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// -------------------------------------------------------------
// SEED REALISTIC DEMO DATA (IF DATABASE IS FRESH)
// -------------------------------------------------------------
export async function seedInitialDemoDataIfEmpty(): Promise<void> {
  try {
    const membersSnap = await getDocs(collection(db, 'members'));
    if (!membersSnap.empty) {
      // Database already has members, do not overwrite
      return;
    }

    console.log('Seeding initial realistic Umrah committee demo records...');

    // 1. Ensure settings exist
    await setDoc(doc(db, 'settings', 'general'), DEFAULT_SETTINGS);

    // 2. Member 1: Hafiz Muhammad Usman (MZ-#002, 24 Months, Rs. 120,000, 9 installments paid)
    const mem1Id = 'mem_demo_002';
    const mem1Schedule = generateInstallmentSchedule(
      mem1Id,
      'MZ-#002',
      24,
      5000,
      '2024-09-05',
      15
    );

    let mem1Paid = 0;
    const batch1 = writeBatch(db);

    // Pay first 9 installments
    for (let i = 0; i < mem1Schedule.length; i++) {
      const inst = mem1Schedule[i];
      const instId = `inst_${mem1Id}_${inst.installmentNumber}`;
      if (inst.installmentNumber <= 9) {
        inst.paidAmount = 5000;
        inst.remainingAmount = 0;
        inst.status = 'Paid';
        inst.paidDate = `202${inst.installmentNumber > 4 ? '5' : '4'}-0${((inst.installmentNumber + 8) % 12) + 1}-10`;
        inst.paymentMethod = i % 2 === 0 ? 'Cash' : 'EasyPaisa';
        inst.receiptNumber = `MZ-RCP-000${inst.installmentNumber}`;
        mem1Paid += 5000;
      } else if (inst.installmentNumber === 10) {
        inst.status = 'Due';
      }
      batch1.set(doc(db, 'installments', instId), { ...inst, id: instId });
    }

    const mem1Data: Member = {
      id: mem1Id,
      memberNumber: 'MZ-#002',
      fullName: 'Hafiz Muhammad Usman',
      fatherName: 'Muhammad Rafiq',
      cnic: '42101-7890123-1',
      mobile: '0300-8765432',
      whatsapp: '0300-8765432',
      address: 'Flat 402, Al-Madina Heights, Block 2, Clifton, Karachi.',
      joiningDate: '2024-09-05',
      planMonths: 24,
      monthlyInstallment: 5000,
      totalCommitteeAmount: 120000,
      paidAmount: mem1Paid, // 45,000
      dueAmount: 120000 - mem1Paid, // 75,000
      advanceAmount: 0,
      registrationFee: 1000,
      registrationFeeStatus: 'Paid',
      nomineeName: 'Abdul Rehman',
      nomineeRelation: 'Brother',
      nomineeCnic: '42101-1234567-3',
      nomineeMobile: '0312-3456789',
      status: 'Active',
      notes: 'Umrah committee group leader. Regular and punctual depositor.',
      createdAt: '2024-09-05T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
    batch1.set(doc(db, 'members', mem1Id), mem1Data);

    // Create a sample receipt for Usman
    const rcp1: Receipt = {
      id: 'rcp_demo_009',
      receiptNumber: 'MZ-RCP-0009',
      memberId: mem1Id,
      memberNumber: 'MZ-#002',
      memberName: 'Hafiz Muhammad Usman',
      fatherName: 'Muhammad Rafiq',
      mobile: '0300-8765432',
      address: 'Flat 402, Al-Madina Heights, Block 2, Clifton, Karachi.',
      planMonths: 24,
      paymentId: 'pay_demo_009',
      installmentNumber: 9,
      dueDate: '2025-05-15',
      amount: 5000,
      paymentDate: '2025-05-10',
      paymentMethod: 'EasyPaisa',
      previousPaidAmount: 40000,
      currentPayment: 5000,
      remainingBalance: 75000,
      advanceAmount: 0,
      totalCommitteeAmount: 120000,
      totalPaidAmount: 45000,
      totalDueAmount: 75000,
      registrationFeeStatus: 'Paid',
      notes: 'May Allah accept your Umrah intention',
      generatedBy: 'Admin Office',
      verificationStatus: 'Verified',
      createdAt: '2025-05-10T12:30:00.000Z',
    };
    batch1.set(doc(db, 'receipts', 'rcp_demo_009'), rcp1);

    const pay1: Payment = {
      id: 'pay_demo_009',
      memberId: mem1Id,
      memberNumber: 'MZ-#002',
      memberName: 'Hafiz Muhammad Usman',
      installmentId: `inst_${mem1Id}_9`,
      installmentNumber: 9,
      receiptId: 'rcp_demo_009',
      receiptNumber: 'MZ-RCP-0009',
      amountReceived: 5000,
      paymentMethod: 'EasyPaisa',
      paymentDate: '2025-05-10',
      referenceNumber: 'EP-982374102',
      notes: 'Physical transaction verified via counter',
      collectedBy: 'Admin Office',
      allocationType: 'current',
      createdAt: '2025-05-10T12:30:00.000Z',
    };
    batch1.set(doc(db, 'payments', 'pay_demo_009'), pay1);

    await batch1.commit();

    // 3. Member 2: Munawara Begaum (MZ-#003, 24 Months)
    const mem2Id = 'mem_demo_003';
    const mem2Schedule = generateInstallmentSchedule(
      mem2Id,
      'MZ-#003',
      24,
      5000,
      '2024-10-15',
      15
    );
    let mem2Paid = 0;
    const batch2 = writeBatch(db);

    for (let i = 0; i < mem2Schedule.length; i++) {
      const inst = mem2Schedule[i];
      const instId = `inst_${mem2Id}_${inst.installmentNumber}`;
      if (inst.installmentNumber <= 7) {
        inst.paidAmount = 5000;
        inst.remainingAmount = 0;
        inst.status = 'Paid';
        inst.paidDate = `2025-0${inst.installmentNumber}-12`;
        inst.paymentMethod = 'JazzCash';
        inst.receiptNumber = `MZ-RCP-00${10 + inst.installmentNumber}`;
        mem2Paid += 5000;
      } else if (inst.installmentNumber === 8) {
        inst.paidAmount = 3000;
        inst.remainingAmount = 2000;
        inst.status = 'Partial';
        inst.paidDate = '2025-05-14';
        inst.paymentMethod = 'Cash';
        mem2Paid += 3000;
      } else {
        inst.status = 'Upcoming';
      }
      batch2.set(doc(db, 'installments', instId), { ...inst, id: instId });
    }

    const mem2Data: Member = {
      id: mem2Id,
      memberNumber: 'MZ-#003',
      fullName: 'Munawara Begaum',
      fatherName: 'Late Sheikh Abdul Hameed',
      cnic: '42201-9876543-2',
      mobile: '0321-7654321',
      whatsapp: '0321-7654321',
      address: 'House B-22, Gulshan-e-Iqbal, Block 7, Karachi.',
      joiningDate: '2024-10-15',
      planMonths: 24,
      monthlyInstallment: 5000,
      totalCommitteeAmount: 120000,
      paidAmount: mem2Paid, // 38,000
      dueAmount: 120000 - mem2Paid, // 82,000
      advanceAmount: 0,
      registrationFee: 1000,
      registrationFeeStatus: 'Paid',
      nomineeName: 'Bilal Hameed',
      nomineeRelation: 'Son',
      nomineeCnic: '42201-1122334-5',
      nomineeMobile: '0333-9988776',
      status: 'Active',
      notes: 'Installment #8 paid partially (Rs. 3,000 paid, Rs. 2,000 remaining).',
      createdAt: '2024-10-15T11:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
    batch2.set(doc(db, 'members', mem2Id), mem2Data);

    // 4. Member 3: Tariq Mehmood (MZ-#004, 36 Months, 180,000)
    const mem3Id = 'mem_demo_004';
    const mem3Schedule = generateInstallmentSchedule(
      mem3Id,
      'MZ-#004',
      36,
      5000,
      '2025-01-10',
      15
    );
    let mem3Paid = 0;
    for (let i = 0; i < mem3Schedule.length; i++) {
      const inst = mem3Schedule[i];
      const instId = `inst_${mem3Id}_${inst.installmentNumber}`;
      if (inst.installmentNumber <= 4) {
        inst.paidAmount = 5000;
        inst.remainingAmount = 0;
        inst.status = 'Paid';
        inst.paidDate = `2025-0${inst.installmentNumber}-15`;
        inst.paymentMethod = 'Cash';
        inst.receiptNumber = `MZ-RCP-00${20 + inst.installmentNumber}`;
        mem3Paid += 5000;
      } else {
        inst.status = inst.installmentNumber === 5 ? 'Due' : 'Upcoming';
      }
      batch2.set(doc(db, 'installments', instId), { ...inst, id: instId });
    }

    const mem3Data: Member = {
      id: mem3Id,
      memberNumber: 'MZ-#004',
      fullName: 'Tariq Mehmood',
      fatherName: 'Ghulam Rasool',
      cnic: '42301-4455667-9',
      mobile: '0345-1239876',
      whatsapp: '0345-1239876',
      address: 'Shop 14, Bismillah Plaza, Tariq Road, Karachi.',
      joiningDate: '2025-01-10',
      planMonths: 36,
      monthlyInstallment: 5000,
      totalCommitteeAmount: 180000,
      paidAmount: mem3Paid, // 20,000
      dueAmount: 180000 - mem3Paid, // 160,000
      advanceAmount: 0,
      registrationFee: 1000,
      registrationFeeStatus: 'Paid',
      nomineeName: 'Zainab Tariq',
      nomineeRelation: 'Daughter',
      nomineeCnic: '42301-5566778-2',
      nomineeMobile: '0345-9871234',
      status: 'Active',
      notes: '36-month Umrah committee plan.',
      createdAt: '2025-01-10T09:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
    batch2.set(doc(db, 'members', mem3Id), mem3Data);

    await batch2.commit();
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Error seeding demo data:', err);
  }
}

// -------------------------------------------------------------
// EXPORTED COMPATIBILITY ALIASES & MEMBER-SPECIFIC QUERIES
// -------------------------------------------------------------
export const getAllMembers = getMembers;
export const getAllPayments = getPayments;
export const getAllReceipts = getReceipts;
export const getAllRefunds = getRefunds;
export const getAllAuditLogs = getAuditLogs;
export const getMemberInstallments = getInstallmentsForMember;
export const saveSettings = updateSettings;
export const updateMemberRegistrationFeeStatus = toggleRegistrationFee;

export async function getMemberPayments(memberId: string): Promise<Payment[]> {
  try {
    const q = query(collection(db, 'payments'), where('memberId', '==', memberId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Payment) }));
    return list.sort((a, b) => (a.paymentDate > b.paymentDate ? -1 : 1));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payments');
  }
}

export async function getMemberReceipts(memberId: string): Promise<Receipt[]> {
  try {
    const q = query(collection(db, 'receipts'), where('memberId', '==', memberId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Receipt) }));
    return list.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'receipts');
  }
}

export async function getMemberRefunds(memberId: string): Promise<Refund[]> {
  try {
    const q = query(collection(db, 'refunds'), where('memberId', '==', memberId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Refund) }));
    return list.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'refunds');
  }
}
