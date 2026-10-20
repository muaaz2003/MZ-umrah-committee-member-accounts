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
  InstallmentStatus,
  MemberStatus,
} from '../types';
import {
  calculateFinancialSummary,
  generateInstallmentSchedule,
  calculateInstallmentDueDate,
  computeInstallmentStatus,
  getTodayKarachiDate,
  COMMITTEE_FIRST_DUE_DATE,
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
  committeeName: 'MZA Umrah Committee',
  committeeStartDate: '2026-10-01',
  firstInstallmentDueDate: '2026-10-10',
  supervisedBy: 'M.Z.A Welfare Pakistan',
  establishedYear: '2019',
  phone: '+92 300 8765432',
  email: 'mza.welfare.pk@gmail.com',
  website: 'https://mza-welfare.org',
  address: 'Suite #402, Business Arcade, Main Shahrah-e-Faisal, Karachi, Pakistan',
  membershipPrefix: 'MZA-#',
  receiptPrefix: 'MZA-RCP-',
  defaultMonthlyInstallment: 5000,
  defaultDueDay: 10,
  registrationFee: 1000,
  currency: 'PKR',
  receiptFooter: 'Supervised by Abdul Shakoor Madni (M.Z.A Welfare Pakistan). Established 2019. May Allah accept your holy pilgrimage.',
  reminderText: 'Dear Member, please deposit your monthly Umrah committee installment before the 10th of this month.',
  signatoryName: 'Abdul Shakoor Madni (Admin)',
  adminPassword: '1234',
};

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // ignore
      }
    }
  },
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
        safeStorage.setItem('mz_admin_custom_password', data.adminPassword);
      }
      return {
        id: snap.id,
        ...DEFAULT_SETTINGS,
        ...data,
        committeeStartDate: data.committeeStartDate || DEFAULT_SETTINGS.committeeStartDate,
        firstInstallmentDueDate: data.firstInstallmentDueDate || DEFAULT_SETTINGS.firstInstallmentDueDate,
        defaultDueDay: data.defaultDueDay || DEFAULT_SETTINGS.defaultDueDay,
      };
    }
    // Set default settings
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.warn('Could not fetch settings from Firestore, returning cached or defaults:', error);
    const cachedPass = safeStorage.getItem('mz_admin_custom_password');
    return {
      ...DEFAULT_SETTINGS,
      adminPassword: cachedPass || '1234',
    };
  }
}

export async function updateSettings(settings: Partial<CommitteeSettings>, userEmail: string = 'admin'): Promise<void> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    if (settings.adminPassword) {
      safeStorage.setItem('mz_admin_custom_password', settings.adminPassword);
    }

    // If registrationFee was updated in settings, synchronize all members automatically
    const targetFee = settings.registrationFee !== undefined ? Number(settings.registrationFee) : settings.defaultRegistrationFee !== undefined ? Number(settings.defaultRegistrationFee) : undefined;
    if (targetFee !== undefined && !isNaN(targetFee)) {
      const membersSnap = await getDocs(collection(db, 'members'));
      const batch = writeBatch(db);
      let updatedCount = 0;
      membersSnap.forEach((mDoc) => {
        batch.update(mDoc.ref, {
          registrationFee: targetFee,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });
      if (updatedCount > 0) {
        await batch.commit();
      }
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
        safeStorage.setItem('mz_admin_custom_password', data.adminPassword);
        return data.adminPassword;
      }
    }
    const cached = safeStorage.getItem('mz_admin_custom_password');
    return cached || '1234';
  } catch (error) {
    console.warn('Could not fetch cloud admin password, using local cache:', error);
    return safeStorage.getItem('mz_admin_custom_password') || '1234';
  }
}

export async function updateAdminPassword(newPassword: string, userEmail: string = 'admin'): Promise<void> {
  const path = 'settings';
  const trimmed = newPassword.trim();
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, { adminPassword: trimmed, updatedAt: new Date().toISOString() }, { merge: true });
    safeStorage.setItem('mz_admin_custom_password', trimmed);
    await logAudit(userEmail, 'SUPER ADMIN', 'UPDATE_PASSWORD', 'Settings', 'general', 'Admin password updated in cloud database');
  } catch (error) {
    safeStorage.setItem('mz_admin_custom_password', trimmed);
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
    const sorted = members.sort((a, b) => (a.memberNumber > b.memberNumber ? 1 : -1));
    if (sorted.length > 0) {
      try {
        localStorage.setItem('mz_cached_members', JSON.stringify(sorted));
      } catch {}
    }
    return sorted;
  } catch (error) {
    console.warn('Could not fetch members from Firestore, checking cache:', error);
    const cached = localStorage.getItem('mz_cached_members');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
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
      // Expect format "MZA-#001", "MZ-#001", etc.
      const match = m.memberNumber?.match(/(?:MZA|MZ)-#(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= maxNumber) maxNumber = num + 1;
      }
    }
    return `MZA-#${String(maxNumber).padStart(3, '0')}`;
  } catch {
    return `MZA-#001`;
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
  const joiningDate = data.joiningDate || '2026-10-01';
  const firstDueDate = data.firstInstallmentDueDate || '2026-10-10';

  const newMember: Member = {
    ...data,
    id: memberId,
    planMonths,
    monthlyInstallment: monthly,
    totalCommitteeAmount: totalAmount,
    joiningDate,
    firstInstallmentDueDate: firstDueDate,
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

  // 2. Generate and batch add all 24 or 36 installments starting from firstDueDate on 10th
  const schedule = generateInstallmentSchedule(
    memberId,
    newMember.memberNumber,
    newMember.planMonths,
    newMember.monthlyInstallment,
    firstDueDate,
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
    const existingSnap = await getDoc(memberRef);
    const existingMember = existingSnap.exists() ? (existingSnap.data() as Member) : null;

    const batch = writeBatch(db);
    batch.update(memberRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    // Check if planMonths or monthlyInstallment changed and sync installments
    const targetPlan = data.planMonths || existingMember?.planMonths;
    const targetMonthly = data.monthlyInstallment || existingMember?.monthlyInstallment;
    const firstDueDate = data.firstInstallmentDueDate || existingMember?.firstInstallmentDueDate || '2026-10-10';
    const memberNum = data.memberNumber || existingMember?.memberNumber || 'MZA-#001';

    if (existingMember && targetPlan && targetMonthly) {
      const instSnap = await getDocs(
        query(collection(db, 'installments'), where('memberId', '==', memberId))
      );
      const currentInsts = instSnap.docs.map((d) => d.data() as Installment);
      const currentCount = currentInsts.length;

      // Update existing installments' base amount if monthly changed
      currentInsts.forEach((inst) => {
        if (inst.amount !== targetMonthly) {
          const instDocRef = doc(db, 'installments', inst.id);
          const newRemaining = Math.max(0, targetMonthly - (inst.paidAmount || 0));
          const newStatus = newRemaining === 0 ? 'Paid' : (inst.paidAmount > 0 ? 'Partial' : 'Upcoming');
          batch.update(instDocRef, {
            amount: targetMonthly,
            remainingAmount: newRemaining,
            status: newStatus,
          });
        }
      });

      // If plan changed from 24 to 36, create missing installments 25 to 36
      if (targetPlan === 36 && currentCount < 36) {
        for (let num = currentCount + 1; num <= 36; num++) {
          const dueDate = calculateInstallmentDueDate(firstDueDate, num, 10);
          const instId = `inst_${memberId}_${String(num).padStart(2, '0')}`;
          const newInst: Installment = {
            id: instId,
            memberId,
            memberNumber: memberNum,
            installmentNumber: num,
            dueDate,
            amount: targetMonthly,
            paidAmount: 0,
            remainingAmount: targetMonthly,
            status: 'Upcoming',
            createdAt: new Date().toISOString(),
          };
          batch.set(doc(db, 'installments', instId), newInst);
        }
      } else if (targetPlan === 24 && currentCount > 24) {
        // If reduced to 24, delete unpaid installments > 24
        instSnap.docs.forEach((d) => {
          const instData = d.data() as Installment;
          if (instData.installmentNumber > 24 && (instData.paidAmount || 0) === 0) {
            batch.delete(d.ref);
          }
        });
      }
    }

    await batch.commit();
    await logAudit(userEmail, 'ADMIN', 'UPDATE_MEMBER', 'Member', memberId, `Updated member profile details and synced installments`);
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
      const match = r.receiptNumber?.match(/(?:MZA|MZ)-RCP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= maxNumber) maxNumber = num + 1;
      }
    }
    return `MZA-RCP-${String(maxNumber).padStart(4, '0')}`;
  } catch {
    return `MZA-RCP-0001`;
  }
}

export interface RecordPaymentPayload {
  memberId: string;
  installmentId?: string;
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

  const allInstallments = await getInstallmentsForMember(payload.memberId);
  const sortedInstallments = allInstallments.sort((a, b) => a.installmentNumber - b.installmentNumber);

  // Identify target starting installment
  let startIdx = 0;
  if (payload.installmentId) {
    const foundIdx = sortedInstallments.findIndex((i) => i.id === payload.installmentId);
    if (foundIdx !== -1) startIdx = foundIdx;
  }
  // Helper to reliably detect fully paid installment
  const isFullyPaid = (inst: Installment) => {
    const rem = inst.remainingAmount !== undefined ? inst.remainingAmount : (inst.amount - (inst.paidAmount || 0));
    return rem <= 0 || inst.status === 'Paid';
  };

  // If selected installment is already paid, automatically find earliest unpaid
  if (sortedInstallments[startIdx] && isFullyPaid(sortedInstallments[startIdx])) {
    const firstUnpaidIdx = sortedInstallments.findIndex((i) => !isFullyPaid(i));
    if (firstUnpaidIdx !== -1) startIdx = firstUnpaidIdx;
  }

  const primaryInstallment = sortedInstallments[startIdx] || sortedInstallments[0];
  const receiptNumber = await getNextReceiptNumber();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const receiptId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const previousPaidAmount = member.paidAmount || 0;
  const currentPayment = payload.amountReceived;

  const batch = writeBatch(db);

  // Sequential multi-installment allocation
  let remainingToAllocate = currentPayment;
  const installmentsCovered: number[] = [];
  const updatedInstallments: Installment[] = [];

  // Allocate starting from startIdx onward
  for (let i = startIdx; i < sortedInstallments.length; i++) {
    if (remainingToAllocate <= 0) break;
    const inst = sortedInstallments[i];
    const instNeeded = inst.remainingAmount ?? (inst.amount - inst.paidAmount);
    if (instNeeded <= 0) continue;

    const allocated = Math.min(remainingToAllocate, instNeeded);
    const newPaid = inst.paidAmount + allocated;
    const newRemaining = Math.max(0, inst.amount - newPaid);
    const newStatus: Installment['status'] = newRemaining === 0 ? 'Paid' : 'Partial';

    const updatedInst: Installment = {
      ...inst,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newStatus,
      paidDate: payload.paymentDate,
      paymentMethod: payload.paymentMethod,
      receiptNumber: inst.receiptNumber ? `${inst.receiptNumber}, ${receiptNumber}` : receiptNumber,
      receiptId,
      notes: payload.notes || inst.notes || '',
    };

    batch.set(doc(db, 'installments', inst.id), updatedInst);
    updatedInstallments.push(updatedInst);
    installmentsCovered.push(inst.installmentNumber);

    remainingToAllocate -= allocated;
  }

  // Any leftover beyond all remaining installments in plan is added to advanceAmount
  const updatedAdvance = (member.advanceAmount || 0) + Math.max(0, remainingToAllocate);

  // Calculate updated financial summary for member
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

  const installmentDesc = installmentsCovered.length > 1
    ? `Qist #${installmentsCovered.join(', #')}`
    : installmentsCovered.length === 1
    ? `Qist #${installmentsCovered[0]}`
    : `Qist #${primaryInstallment.installmentNumber}`;

  // 1. Create Payment Record
  const paymentRecord: Payment = {
    id: paymentId,
    memberId: member.id,
    memberNumber: member.memberNumber,
    memberName: member.fullName,
    installmentId: primaryInstallment.id,
    installmentNumber: primaryInstallment.installmentNumber,
    installmentsCovered,
    installmentDescription: installmentDesc,
    receiptId,
    receiptNumber,
    amountReceived: currentPayment,
    paymentMethod: payload.paymentMethod,
    paymentDate: payload.paymentDate,
    referenceNumber: payload.referenceNumber || '',
    transactionRef: payload.referenceNumber || '',
    notes: payload.notes || '',
    collectedBy: payload.collectedBy,
    allocationType: payload.allocationType || 'current',
    createdAt: now,
  };
  batch.set(doc(db, 'payments', paymentId), paymentRecord);

  // 2. Create Single Official Receipt for total amount
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
    installmentNumber: primaryInstallment.installmentNumber,
    installmentsCovered,
    installmentDescription: installmentDesc,
    dueDate: primaryInstallment.dueDate,
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
    referenceNumber: payload.referenceNumber || '',
    transactionRef: payload.referenceNumber || '',
    generatedBy: payload.collectedBy,
    verificationStatus: 'Verified',
    createdAt: now,
  };
  batch.set(doc(db, 'receipts', receiptId), receiptRecord);

  try {
    await batch.commit();

    // Cleanly harmonize all installments, receipt descriptions, and financials
    await recalculateMemberInstallmentsAndFinancials(payload.memberId);

    const freshReceiptSnap = await getDoc(doc(db, 'receipts', receiptId));
    const finalReceipt = freshReceiptSnap.exists() ? (freshReceiptSnap.data() as Receipt) : receiptRecord;
    const freshMemberSnap = await getDoc(doc(db, 'members', member.id));
    const finalMember = freshMemberSnap.exists() ? (freshMemberSnap.data() as Member) : updatedMember;

    await logAudit(
      payload.collectedBy,
      'STAFF',
      'RECORD_PAYMENT',
      'Payment',
      paymentId,
      `Collected ${currentPayment} PKR from ${member.fullName} (${member.memberNumber}) covering ${finalReceipt.installmentDescription || installmentDesc} via ${payload.paymentMethod}. Generated receipt ${receiptNumber}.`
    );

    return {
      payment: paymentRecord,
      receipt: finalReceipt,
      installment: updatedInstallments[0] || primaryInstallment,
      member: finalMember,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments+receipts+atomic');
  }
}

/**
 * Cleanly recalculates and synchronizes all installments and member financials
 * strictly from all active receipts for that member in Firestore.
 * Eliminates any orphaned installment balances, phantom receipt numbers, or ledger mismatches.
 */
export async function recalculateMemberInstallmentsAndFinancials(memberId: string): Promise<void> {
  const memberRef = doc(db, 'members', memberId);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return;
  const member = memberSnap.data() as Member;

  const [installments, receipts] = await Promise.all([
    getInstallmentsForMember(memberId),
    getMemberReceipts(memberId),
  ]);

  // Sort installments strictly by installmentNumber ascending
  const sortedInsts = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

  // Sort receipts by issuance sequence (createdAt ascending, then receiptNumber)
  const sortedReceipts = [...receipts].sort((a, b) => {
    const cDiff = (a.createdAt || '').localeCompare(b.createdAt || '');
    if (cDiff !== 0) return cDiff;
    return (a.receiptNumber || '').localeCompare(b.receiptNumber || '');
  });

  const todayStr = getTodayKarachiDate();

  // Reset all installments to pristine unpaid state
  const instMap = new Map<number, Installment>();
  for (const inst of sortedInsts) {
    const due = inst.dueDate || '';
    let initialStatus: InstallmentStatus = 'Upcoming';
    if (due < todayStr) initialStatus = 'Overdue';
    else if (due === todayStr) initialStatus = 'Due';

    instMap.set(inst.installmentNumber, {
      ...inst,
      amount: inst.amount || member.monthlyInstallment || 5000,
      paidAmount: 0,
      remainingAmount: inst.amount || member.monthlyInstallment || 5000,
      status: initialStatus,
      paidDate: undefined,
      paymentMethod: undefined,
      receiptNumber: undefined,
      receiptId: undefined,
      notes: undefined,
    });
  }

  // Sequential allocation with contribution tracking
  interface Contribution {
    receipt: Receipt;
    allocatedAmount: number;
    isTargetInstallment: boolean;
  }

  const instContributions = new Map<number, Contribution[]>();

  // Allocate each receipt sequentially
  for (const r of sortedReceipts) {
    let remToAllocate = Number(r.amount) || 0;
    const targetInstNum = r.installmentNumber || 1;

    // Find earliest installment that has remainingAmount > 0
    for (const inst of sortedInsts) {
      if (remToAllocate <= 0) break;
      const currentInst = instMap.get(inst.installmentNumber)!;
      const needed = currentInst.remainingAmount;
      if (needed <= 0) continue;

      const allocated = Math.min(remToAllocate, needed);
      currentInst.paidAmount += allocated;
      currentInst.remainingAmount = Math.max(0, currentInst.amount - currentInst.paidAmount);
      currentInst.status = currentInst.remainingAmount === 0 ? 'Paid' : 'Partial';
      currentInst.paidDate = r.paymentDate;
      currentInst.paymentMethod = r.paymentMethod;

      if (!instContributions.has(inst.installmentNumber)) {
        instContributions.set(inst.installmentNumber, []);
      }
      instContributions.get(inst.installmentNumber)!.push({
        receipt: r,
        allocatedAmount: allocated,
        isTargetInstallment: targetInstNum === inst.installmentNumber,
      });

      remToAllocate -= allocated;
    }
  }

  // Determine receiptNumber(s) for each installment based on Scenario 1 vs Scenario 2:
  // Scenario 1: Overpayment spillover does not linger on the subsequent installment if that installment has its own targeted receipt.
  // Scenario 2: Multiple payments targeted at the same installment (partial + remaining) will show BOTH receipts.
  for (const inst of sortedInsts) {
    const currentInst = instMap.get(inst.installmentNumber)!;
    const contribs = instContributions.get(inst.installmentNumber) || [];

    if (contribs.length === 0 || currentInst.paidAmount === 0) {
      currentInst.receiptNumber = undefined;
      currentInst.receiptId = undefined;
      continue;
    }

    if (contribs.length === 1) {
      currentInst.receiptNumber = contribs[0].receipt.receiptNumber;
      currentInst.receiptId = contribs[0].receipt.id;
      continue;
    }

    // Multiple receipts contributed to this installment
    const targetContribs = contribs.filter((c) => c.isTargetInstallment);

    if (targetContribs.length > 0) {
      // Scenario 1: Only keep the receipt(s) specifically targeted at this installment
      // Scenario 2: If multiple receipts targeted this installment, display all of them comma-separated
      currentInst.receiptNumber = targetContribs.map((c) => c.receipt.receiptNumber).join(', ');
      currentInst.receiptId = targetContribs[targetContribs.length - 1].receipt.id;
    } else {
      // No receipt targeted this installment directly (e.g. earlier large advance paid it)
      currentInst.receiptNumber = contribs.map((c) => c.receipt.receiptNumber).join(', ');
      currentInst.receiptId = contribs[contribs.length - 1].receipt.id;
    }
  }

  // Total amount paid by this member across all active receipts
  const totalPaid = sortedReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalCommittee = member.totalCommitteeAmount || (member.planMonths * (member.monthlyInstallment || 5000));
  const totalDue = Math.max(0, totalCommittee - totalPaid);
  const advanceAmount = Math.max(0, totalPaid - totalCommittee);
  const newMemberStatus: MemberStatus = totalPaid >= totalCommittee ? 'Completed' : 'Active';

  // Determine covered installments and description for each receipt
  const receiptBatchUpdates: { receiptRef: any; covered: number[]; primaryInstNum: number; desc: string }[] = [];

  for (const r of sortedReceipts) {
    const coveredNums: number[] = [];
    for (const inst of sortedInsts) {
      const currentInst = instMap.get(inst.installmentNumber)!;
      if (currentInst.receiptNumber && currentInst.receiptNumber.includes(r.receiptNumber)) {
        coveredNums.push(inst.installmentNumber);
      }
    }
    // Fallback: If this receipt was an overpayment whose spillover got completed by a subsequent receipt,
    // default coveredNums to the receipt's own original target installment
    if (coveredNums.length === 0) {
      coveredNums.push(r.installmentNumber || 1);
    }

    const instDesc = coveredNums.length > 1
      ? `Qist #${coveredNums.join(', #')}`
      : `Qist #${coveredNums[0]}`;

    receiptBatchUpdates.push({
      receiptRef: doc(db, 'receipts', r.id),
      covered: coveredNums,
      primaryInstNum: coveredNums[0],
      desc: instDesc,
    });
  }

  // Perform Firestore batch commit
  const batch = writeBatch(db);

  // 1. Update all installments
  for (const inst of sortedInsts) {
    const updated = instMap.get(inst.installmentNumber)!;
    batch.update(doc(db, 'installments', inst.id), {
      amount: updated.amount,
      paidAmount: updated.paidAmount,
      remainingAmount: updated.remainingAmount,
      status: updated.status,
      paidDate: updated.paidDate || null,
      paymentMethod: updated.paymentMethod || null,
      receiptNumber: updated.receiptNumber || null,
      receiptId: updated.receiptId || null,
    });
  }

  // 2. Update member financial summary
  batch.update(memberRef, {
    paidAmount: totalPaid,
    dueAmount: totalDue,
    advanceAmount: advanceAmount,
    status: newMemberStatus,
    updatedAt: new Date().toISOString(),
  });

  // 3. Update receipts with correct covered installments & descriptions
  for (const ru of receiptBatchUpdates) {
    batch.update(ru.receiptRef, {
      installmentsCovered: ru.covered,
      installmentNumber: ru.primaryInstNum,
      installmentDescription: ru.desc,
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
}

export async function deleteReceiptAndRevertPayment(
  receiptId: string,
  userEmail: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const receiptRef = doc(db, 'receipts', receiptId);
  const receiptSnap = await getDoc(receiptRef);
  if (!receiptSnap.exists()) {
    throw new Error('Receipt not found');
  }
  const receipt = receiptSnap.data() as Receipt;

  const batch = writeBatch(db);

  // Delete associated payment document by ID
  if (receipt.paymentId) {
    batch.delete(doc(db, 'payments', receipt.paymentId));
  }
  // Also delete any payment records tied to this receipt number to ensure no orphaned transaction records
  const payQuery = query(collection(db, 'payments'), where('receiptNumber', '==', receipt.receiptNumber));
  const payDocs = await getDocs(payQuery);
  payDocs.forEach((d) => batch.delete(d.ref));

  // Delete the receipt document
  batch.delete(receiptRef);

  await batch.commit();

  // Cleanly recalculate member installments and financials from remaining receipts
  if (receipt.memberId && !receipt.memberId.startsWith('manual_')) {
    await recalculateMemberInstallmentsAndFinancials(receipt.memberId);
  }

  await logAudit(
    userEmail,
    'SUPER ADMIN',
    'DELETE_RECEIPT',
    'Receipt',
    receiptId,
    `Deleted receipt ${receipt.receiptNumber} (${receipt.amount} PKR) and completely reversed payment transaction for ${receipt.memberName}.`
  );

  return {
    success: true,
    message: `رسید #${receipt.receiptNumber} اور متعلقہ ادائیگی کامیابی سے حذف کر دی گئی، اور اکاؤنٹ لیجر بحال کر دیا گیا۔`,
  };
}

export async function updateReceiptDetails(
  receiptId: string,
  updates: {
    amount?: number;
    paymentDate?: string;
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
  },
  userEmail: string = 'admin'
): Promise<void> {
  const receiptRef = doc(db, 'receipts', receiptId);
  const snap = await getDoc(receiptRef);
  if (!snap.exists()) throw new Error('Receipt not found');
  const receipt = snap.data() as Receipt;

  const oldAmount = receipt.amount;
  const newAmount = updates.amount !== undefined ? Number(updates.amount) : oldAmount;
  const amountChanged = updates.amount !== undefined && newAmount !== oldAmount;

  const receiptUpdates: any = {
    ...updates,
    amount: newAmount,
    currentPayment: newAmount,
    updatedAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.update(receiptRef, receiptUpdates);

  if (receipt.paymentId) {
    const payRef = doc(db, 'payments', receipt.paymentId);
    batch.update(payRef, {
      ...updates,
      amountReceived: newAmount,
      amount: newAmount,
      updatedAt: new Date().toISOString(),
    });
  }

  // Also update any matching payments by receiptNumber
  const payQuery = query(collection(db, 'payments'), where('receiptNumber', '==', receipt.receiptNumber));
  const payDocs = await getDocs(payQuery);
  payDocs.forEach((d) => {
    if (d.id !== receipt.paymentId) {
      batch.update(d.ref, {
        ...updates,
        amountReceived: newAmount,
        amount: newAmount,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  await batch.commit();

  // If amount changed or member is registered, recalculate member installments & ledger
  if (receipt.memberId && !receipt.memberId.startsWith('manual_')) {
    await recalculateMemberInstallmentsAndFinancials(receipt.memberId);
  }

  await logAudit(
    userEmail,
    'ADMIN',
    'UPDATE_RECEIPT',
    'Receipt',
    receiptId,
    `Updated receipt #${receipt.receiptNumber} details${amountChanged ? ` (Amount updated from ${oldAmount} to ${newAmount} PKR)` : ''}.`
  );
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

  const memberNumber = payload.memberNumber || `MZA-M-${Date.now().toString().slice(-4)}`;

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
    referenceNumber: payload.referenceNumber || '',
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

// -------------------------------------------------------------
// FULL DATABASE BACKUP EXPORT SERVICE (READ-ONLY)
// -------------------------------------------------------------
export interface DatabaseBackupPayload {
  exportedAt: string;
  collections: {
    members: any[];
    installments: any[];
    payments: any[];
    receipts: any[];
    refunds: any[];
    auditLogs: any[];
    settings: any[];
  };
}

export function downloadJsonFile(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function createFullDatabaseBackup(userEmail: string = 'admin'): Promise<{
  backupData: DatabaseBackupPayload;
  filename: string;
  stats: {
    membersCount: number;
    installmentsCount: number;
    paymentsCount: number;
    receiptsCount: number;
    refundsCount: number;
    auditLogsCount: number;
    settingsCount: number;
  };
}> {
  const collectionNames = [
    'members',
    'installments',
    'payments',
    'receipts',
    'refunds',
    'auditLogs',
    'settings',
  ] as const;

  const results: Record<string, any[]> = {
    members: [],
    installments: [],
    payments: [],
    receipts: [],
    refunds: [],
    auditLogs: [],
    settings: [],
  };

  for (const colName of collectionNames) {
    try {
      const snap = await getDocs(collection(db, colName));
      results[colName] = snap.docs.map((d) => {
        const data = d.data();
        if (colName === 'settings') {
          // Exclude adminPassword field from settings for security
          const { adminPassword, ...safeSettings } = data;
          return { id: d.id, ...safeSettings };
        }
        return { id: d.id, ...data };
      });
    } catch (err) {
      console.warn(`Could not read collection ${colName} for backup:`, err);
      results[colName] = [];
    }
  }

  const now = new Date();
  const exportedAt = now.toISOString();
  const dateStr = exportedAt.split('T')[0];
  const filename = `mz-backup-${dateStr}.json`;

  const backupData: DatabaseBackupPayload = {
    exportedAt,
    collections: {
      members: results.members,
      installments: results.installments,
      payments: results.payments,
      receipts: results.receipts,
      refunds: results.refunds,
      auditLogs: results.auditLogs,
      settings: results.settings,
    },
  };

  // Record audit log entry: BACKUP_DOWNLOADED
  try {
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'BACKUP_DOWNLOADED',
      'Database',
      'all_collections',
      `Full system backup exported (${results.members.length} members, ${results.installments.length} installments, ${results.payments.length} payments, ${results.receipts.length} receipts, ${results.refunds.length} refunds, ${results.auditLogs.length} audit logs)`
    );
  } catch (auditErr) {
    console.warn('Could not record BACKUP_DOWNLOADED audit log:', auditErr);
  }

  return {
    backupData,
    filename,
    stats: {
      membersCount: results.members.length,
      installmentsCount: results.installments.length,
      paymentsCount: results.payments.length,
      receiptsCount: results.receipts.length,
      refundsCount: results.refunds.length,
      auditLogsCount: results.auditLogs.length,
      settingsCount: results.settings.length,
    },
  };
}

// -------------------------------------------------------------
// RESCHEDULE INSTALLMENTS (ADMIN-ONLY, CONTROLLED, WITH PREVIEW)
// -------------------------------------------------------------
export interface RescheduleInstallmentDiff {
  installmentId: string;
  installmentNumber: number;
  oldDueDate: string;
  newDueDate: string;
  oldStatus: string;
  newStatus: string;
  paidAmount: number;
  remainingAmount: number;
  receiptNumber?: string;
  isDateChanged: boolean;
  isStatusChanged: boolean;
}

export interface MemberReschedulePreview {
  memberId: string;
  memberNumber: string;
  fullName: string;
  planMonths: number;
  firstInstallmentDueDate: string;
  totalInstallments: number;
  paidInstallmentsCount: number;
  overdueCount: number;
  upcomingCount: number;
  paidInstallmentNumbers: number[];
  hasWarning: boolean;
  warningMessage?: string;
  diffs: RescheduleInstallmentDiff[];
}

export interface ReschedulePreviewSummary {
  totalMembers: number;
  totalInstallmentsToUpdate: number;
  membersWithChangesCount: number;
  totalPaidCount: number;
  totalOverdueCount: number;
  totalUpcomingCount: number;
  totalWarningsCount: number;
  previews: MemberReschedulePreview[];
}

export function previewRescheduleInstallments(
  members: Member[],
  allInstallments: Installment[],
  targetFirstDueDate: string = '2026-10-10'
): ReschedulePreviewSummary {
  const todayStr = getTodayKarachiDate();
  const previews: MemberReschedulePreview[] = [];
  let totalInstallmentsToUpdate = 0;
  let totalPaidCount = 0;
  let totalOverdueCount = 0;
  let totalUpcomingCount = 0;
  let totalWarningsCount = 0;
  let membersWithChangesCount = 0;

  for (const member of members) {
    const memberInsts = allInstallments
      .filter((i) => i.memberId === member.id)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const diffs: RescheduleInstallmentDiff[] = [];
    const paidInstallmentNumbers: number[] = [];
    let memberHasChange = false;
    let memberPaidCount = 0;
    let memberOverdueCount = 0;
    let memberUpcomingCount = 0;

    const baseFirstDueDate = targetFirstDueDate || '2026-10-10';

    for (const inst of memberInsts) {
      const newDueDate = calculateInstallmentDueDate(baseFirstDueDate, inst.installmentNumber, 10);
      
      // Calculate new dynamic status while 100% PRESERVING paidAmount / remainingAmount
      const newStatus = computeInstallmentStatus(
        {
          ...inst,
          dueDate: newDueDate,
        },
        todayStr
      );

      const isDateChanged = inst.dueDate !== newDueDate;
      const isStatusChanged = inst.status !== newStatus;

      if (isDateChanged || isStatusChanged) {
        memberHasChange = true;
        totalInstallmentsToUpdate++;
      }

      const isPaid = (inst.paidAmount || 0) >= inst.amount || (inst.remainingAmount !== undefined && inst.remainingAmount <= 0) || inst.status === 'Paid';
      if (isPaid || (inst.paidAmount || 0) > 0) {
        paidInstallmentNumbers.push(inst.installmentNumber);
      }

      if (newStatus === 'Paid') {
        memberPaidCount++;
        totalPaidCount++;
      } else if (newStatus === 'Overdue') {
        memberOverdueCount++;
        totalOverdueCount++;
      } else {
        memberUpcomingCount++;
        totalUpcomingCount++;
      }

      diffs.push({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        oldDueDate: inst.dueDate,
        newDueDate,
        oldStatus: inst.status,
        newStatus,
        paidAmount: inst.paidAmount || 0,
        remainingAmount: inst.remainingAmount !== undefined ? inst.remainingAmount : (inst.amount - (inst.paidAmount || 0)),
        receiptNumber: inst.receiptNumber,
        isDateChanged,
        isStatusChanged,
      });
    }

    if (memberHasChange) {
      membersWithChangesCount++;
    }

    // Warning check: Is any payment allocated to installment # > 1, or in advance?
    const paymentsOnOtherThanOne = paidInstallmentNumbers.filter((num) => num > 1);
    const hasWarning = paymentsOnOtherThanOne.length > 0;
    let warningMessage: string | undefined;
    if (hasWarning) {
      warningMessage = `دھیان دیں: ادائیگی قسط ۱ کے بجائے قسط نمبر ${paymentsOnOtherThanOne.join(', ')} پر لگی ہوئی ہے!`;
      totalWarningsCount++;
    }

    previews.push({
      memberId: member.id,
      memberNumber: member.memberNumber,
      fullName: member.fullName,
      planMonths: member.planMonths,
      firstInstallmentDueDate: baseFirstDueDate,
      totalInstallments: memberInsts.length,
      paidInstallmentsCount: memberPaidCount,
      overdueCount: memberOverdueCount,
      upcomingCount: memberUpcomingCount,
      paidInstallmentNumbers,
      hasWarning,
      warningMessage,
      diffs,
    });
  }

  return {
    totalMembers: members.length,
    totalInstallmentsToUpdate,
    membersWithChangesCount,
    totalPaidCount,
    totalOverdueCount,
    totalUpcomingCount,
    totalWarningsCount,
    previews,
  };
}

export async function rescheduleAllMemberInstallments(
  members: Member[],
  allInstallments: Installment[],
  targetFirstDueDate: string = '2026-10-10',
  userEmail: string = 'admin'
): Promise<{
  success: boolean;
  membersUpdated: number;
  installmentsUpdated: number;
  paidPreserved: number;
  overdueCount: number;
  warningsCount: number;
}> {
  const preview = previewRescheduleInstallments(members, allInstallments, targetFirstDueDate);
  let totalInstallmentsCommitted = 0;
  let membersCommitted = 0;

  for (const memberPreview of preview.previews) {
    const changedDiffs = memberPreview.diffs.filter((d) => d.isDateChanged || d.isStatusChanged);
    if (changedDiffs.length === 0) continue;

    // Use separate writeBatch per member (max 36 docs per member, well below 500 limit)
    const batch = writeBatch(db);

    for (const diff of changedDiffs) {
      const instRef = doc(db, 'installments', diff.installmentId);
      // Strictly update ONLY dueDate and status. NEVER touch paidAmount, remainingAmount, receipts, etc.
      batch.update(instRef, {
        dueDate: diff.newDueDate,
        status: diff.newStatus,
      });
      totalInstallmentsCommitted++;
    }

    // Also update member's firstInstallmentDueDate
    const memberRef = doc(db, 'members', memberPreview.memberId);
    batch.update(memberRef, {
      firstInstallmentDueDate: targetFirstDueDate,
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();
    membersCommitted++;
  }

  // Record audit log
  try {
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'RESCHEDULE_INSTALLMENTS',
      'Installments',
      'all',
      `Applied installment schedule update: ${membersCommitted} members (${totalInstallmentsCommitted} installments updated) aligned to first installment due date ${targetFirstDueDate} (10th monthly). Paid records: ${preview.totalPaidCount}, Overdue: ${preview.totalOverdueCount}.`
    );
  } catch (err) {
    console.warn('Could not write audit log for RESCHEDULE_INSTALLMENTS:', err);
  }

  return {
    success: true,
    membersUpdated: membersCommitted,
    installmentsUpdated: totalInstallmentsCommitted,
    paidPreserved: preview.totalPaidCount,
    overdueCount: preview.totalOverdueCount,
    warningsCount: preview.totalWarningsCount,
  };
}

/**
 * Reschedule installments for a single member to start from targetFirstDueDate (default '2026-10-10').
 * Safely preserves paidAmount, receipts, remainingAmount.
 */
export async function rescheduleSingleMemberInstallments(
  memberId: string,
  targetFirstDueDate: string = '2026-10-10',
  userEmail: string = 'admin'
): Promise<{ success: boolean; installmentsUpdated: number }> {
  const member = await getMemberById(memberId);
  if (!member) throw new Error('Member not found');

  const allInsts = await getMemberInstallments(memberId);
  if (allInsts.length === 0) return { success: true, installmentsUpdated: 0 };

  const preview = previewRescheduleInstallments([member], allInsts, targetFirstDueDate);
  const memberPreview = preview.previews[0];
  if (!memberPreview) return { success: true, installmentsUpdated: 0 };

  const changedDiffs = memberPreview.diffs.filter((d) => d.isDateChanged || d.isStatusChanged);
  if (changedDiffs.length === 0) return { success: true, installmentsUpdated: 0 };

  const batch = writeBatch(db);
  for (const diff of changedDiffs) {
    const instRef = doc(db, 'installments', diff.installmentId);
    batch.update(instRef, {
      dueDate: diff.newDueDate,
      status: diff.newStatus,
    });
  }

  const memberRef = doc(db, 'members', memberId);
  batch.update(memberRef, {
    firstInstallmentDueDate: targetFirstDueDate,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();

  try {
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'RESCHEDULE_INSTALLMENTS',
      'Installments',
      memberId,
      `Rescheduled member ${member.memberNumber} (${member.fullName}) installments to first due date ${targetFirstDueDate}. ${changedDiffs.length} installments updated.`
    );
  } catch (err) {
    console.warn('Could not log audit:', err);
  }

  return { success: true, installmentsUpdated: changedDiffs.length };
}
