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
  runTransaction,
  serverTimestamp,
  DocumentReference,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  Member,
  Installment,
  Payment,
  Receipt,
  Refund,
  CancellationNotice,
  QarzaHasanaAgreement,
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
  getKarachiTimeString,
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

export function removeUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      return obj;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function stripPhotosForCache(membersList: Member[]): Member[] {
  return membersList.map(({ memberPhoto: _photo, ...rest }) => rest as Member);
}

type BatchOp =
  | { type: 'set'; ref: DocumentReference; data: Record<string, any>; merge?: boolean }
  | { type: 'update'; ref: DocumentReference; data: Record<string, any> }
  | { type: 'delete'; ref: DocumentReference };

export async function commitInChunks(ops: BatchOp[], chunkSize: number = 400): Promise<void> {
  if (ops.length === 0) return;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        const cleanData = removeUndefined(op.data);
        if (op.merge) {
          batch.set(op.ref, cleanData, { merge: true });
        } else {
          batch.set(op.ref, cleanData);
        }
      } else if (op.type === 'update') {
        batch.update(op.ref, removeUndefined(op.data));
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
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
};

// -------------------------------------------------------------
// SETTINGS SERVICE
// -------------------------------------------------------------
export async function getSettings(): Promise<CommitteeSettings> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CommitteeSettings;
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
    await setDoc(docRef, removeUndefined(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.warn('Could not fetch settings from Firestore, returning defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: Partial<CommitteeSettings>, userEmail: string = 'admin'): Promise<void> {
  const path = 'settings';
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, removeUndefined({ ...settings, updatedAt: new Date().toISOString() }), { merge: true });

    // If registrationFee was updated in settings, synchronize ONLY Unpaid members automatically
    const targetFee = settings.registrationFee !== undefined ? Number(settings.registrationFee) : settings.defaultRegistrationFee !== undefined ? Number(settings.defaultRegistrationFee) : undefined;
    if (targetFee !== undefined && !isNaN(targetFee)) {
      const membersSnap = await getDocs(collection(db, 'members'));
      const ops: BatchOp[] = [];
      const syncTimestamp = new Date().toISOString();
      membersSnap.forEach((mDoc) => {
        const mData = mDoc.data() as Member;
        if (mData.registrationFeeStatus !== 'Paid') {
          ops.push({
            type: 'update',
            ref: mDoc.ref,
            data: {
              registrationFee: targetFee,
              updatedAt: syncTimestamp,
            },
          });
        }
      });
      await commitInChunks(ops, 400);
    }

    await logAudit(userEmail, 'SUPER ADMIN', 'UPDATE_SETTINGS', 'Settings', 'general', 'Updated committee general settings');
  } catch (error) {
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
      date: getTodayKarachiDate(),
      time: getKarachiTimeString(now),
      recordType,
      recordId,
      details,
      createdAt: now.toISOString(),
    };
    await setDoc(doc(db, path, logId), removeUndefined(logEntry));
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
    const sorted = members.sort((a, b) =>
      (a.memberNumber || '').localeCompare(b.memberNumber || '', undefined, { numeric: true })
    );
    try {
      localStorage.setItem('mz_cached_members', JSON.stringify(stripPhotosForCache(sorted)));
    } catch {}
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

const COUNTERS_DOC_REF = () => doc(db, 'settings', 'counters');

async function getMaxExistingMemberNumber(): Promise<number> {
  const snap = await getDocs(collection(db, 'members'));
  let maxNumber = 0;
  snap.forEach((d) => {
    const m = d.data() as Member;
    const match = m.memberNumber?.match(/(?:MZA|MZ)-#(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxNumber) maxNumber = num;
    }
  });
  return maxNumber;
}

async function getMaxExistingReceiptNumber(): Promise<number> {
  const snap = await getDocs(collection(db, 'receipts'));
  let maxNumber = 0;
  snap.forEach((d) => {
    const r = d.data() as Receipt;
    const match = r.receiptNumber?.match(/(?:MZA|MZ)-RCP-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxNumber) maxNumber = num;
    }
  });
  return maxNumber;
}

export async function peekNextMembershipNumber(): Promise<string> {
  try {
    const counterRef = COUNTERS_DOC_REF();
    const counterSnap = await getDoc(counterRef);
    const storedLast =
      counterSnap.exists() && typeof counterSnap.data()?.lastMemberNumber === 'number'
        ? counterSnap.data()!.lastMemberNumber
        : 0;
    const existingMax = await getMaxExistingMemberNumber();
    const nextNum = Math.max(storedLast, existingMax) + 1;
    return `MZA-#${String(nextNum).padStart(3, '0')}`;
  } catch {
    return `MZA-#001`;
  }
}

export async function getNextMembershipNumber(requestedNumber?: string): Promise<string> {
  const counterRef = COUNTERS_DOC_REF();
  const initialSnap = await getDoc(counterRef);
  let seededMax = 0;
  if (!initialSnap.exists() || typeof initialSnap.data()?.lastMemberNumber !== 'number') {
    seededMax = await getMaxExistingMemberNumber();
  }

  const reqMatch = requestedNumber?.trim().match(/^(?:MZA|MZ)-#(\d+)$/);
  const reqNum = reqMatch ? parseInt(reqMatch[1], 10) : NaN;

  const assignedNum = await runTransaction(db, async (transaction) => {
    const txSnap = await transaction.get(counterRef);
    const txData = txSnap.exists() ? txSnap.data() : {};
    const currentLast =
      typeof txData?.lastMemberNumber === 'number' ? txData.lastMemberNumber : seededMax;
    const baseLast = Math.max(currentLast, seededMax);
    const next = Number.isFinite(reqNum) && reqNum > baseLast ? reqNum : baseLast + 1;
    transaction.set(
      counterRef,
      removeUndefined({ lastMemberNumber: next, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
    return next;
  });

  return `MZA-#${String(assignedNum).padStart(3, '0')}`;
}

export async function createMember(
  data: Omit<Member, 'id' | 'paidAmount' | 'dueAmount' | 'advanceAmount' | 'createdAt' | 'updatedAt'>,
  userEmail: string = 'admin'
): Promise<Member> {
  const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const assignedMemberNumber =
    !data.memberNumber || /^(?:MZA|MZ)-#(\d+)$/.test(data.memberNumber.trim())
      ? await getNextMembershipNumber(data.memberNumber)
      : data.memberNumber.trim();

  const planMonths = data.planMonths === 36 ? 36 : 24;
  const monthly = Math.max(5000, Math.min(10000, Number(data.monthlyInstallment) || 5000));
  const totalAmount = data.totalCommitteeAmount || (planMonths * monthly);
  const joiningDate = data.joiningDate || '2026-10-01';
  const firstDueDate = data.firstInstallmentDueDate || '2026-10-10';

  const newMember: Member = {
    ...data,
    id: memberId,
    memberNumber: assignedMemberNumber,
    planMonths,
    monthlyInstallment: monthly,
    totalCommitteeAmount: totalAmount,
    registrationFee: Number(data.registrationFee) || 0,
    registrationFeeStatus: data.registrationFeeStatus || 'Unpaid',
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
  batch.set(memberRef, removeUndefined(newMember));

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
    batch.set(instRef, removeUndefined({ ...item, id: instId }));
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
): Promise<Member | void> {
  const path = `members/${memberId}`;
  const memberRef = doc(db, 'members', memberId);
  const existingSnap = await getDoc(memberRef);
  if (!existingSnap.exists()) {
    throw new Error('Member not found');
  }
  const existingMember = existingSnap.data() as Member;

  const targetPlan: 24 | 36 =
    data.planMonths === 36 || data.planMonths === 24 ? data.planMonths : existingMember.planMonths;
  const targetMonthly =
    data.monthlyInstallment !== undefined
      ? Math.max(5000, Math.min(10000, Number(data.monthlyInstallment) || existingMember.monthlyInstallment || 5000))
      : existingMember.monthlyInstallment;
  const firstDueDate = data.firstInstallmentDueDate || existingMember.firstInstallmentDueDate || '2026-10-10';
  const memberNum = data.memberNumber || existingMember.memberNumber || 'MZA-#001';

  const instSnap = await getDocs(
    query(collection(db, 'installments'), where('memberId', '==', memberId))
  );
  const currentInsts = instSnap.docs.map((d) => ({ ...(d.data() as Installment), id: d.id }));

  // Block 36 -> 24 downgrade if any installment > 24 already has payment
  if (targetPlan === 24) {
    const paidAfter24 = currentInsts.some(
      (inst) => inst.installmentNumber > 24 && (inst.paidAmount || 0) > 0
    );
    if (paidAfter24) {
      throw new Error(
        'Cannot change plan from 36 to 24 months: one or more installments after Qist #24 already have payments recorded.'
      );
    }
  }

  try {
    const batch = writeBatch(db);
    let totalCommitteeAmountSum = 0;
    const existingNumbers = new Set<number>();

    for (const inst of currentInsts) {
      if (targetPlan === 24 && inst.installmentNumber > 24) {
        // Safe to delete since we already verified paidAmount === 0
        batch.delete(doc(db, 'installments', inst.id));
        continue;
      }

      existingNumbers.add(inst.installmentNumber);
      const paidAmt = inst.paidAmount || 0;

      if (paidAmt > 0) {
        // NEVER change amount of installments that already have payments recorded
        totalCommitteeAmountSum += inst.amount || 0;
      } else {
        if (inst.amount !== targetMonthly) {
          batch.update(
            doc(db, 'installments', inst.id),
            removeUndefined({
              amount: targetMonthly,
              remainingAmount: targetMonthly,
            })
          );
        }
        totalCommitteeAmountSum += targetMonthly;
      }
    }

    // Create any missing installments for targetPlan (e.g. 25..36 when upgrading 24 -> 36)
    for (let num = 1; num <= targetPlan; num++) {
      if (!existingNumbers.has(num)) {
        const dueDate = calculateInstallmentDueDate(firstDueDate, num, 10);
        const instId = `inst_${memberId}_${num}`;
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
        batch.set(doc(db, 'installments', instId), removeUndefined(newInst));
        totalCommitteeAmountSum += targetMonthly;
      }
    }

    const { dueAmount: _ignoredDue, paidAmount: _ignoredPaid, advanceAmount: _ignoredAdv, ...safeData } = data;
    batch.update(
      memberRef,
      removeUndefined({
        ...safeData,
        planMonths: targetPlan,
        monthlyInstallment: targetMonthly,
        totalCommitteeAmount: totalCommitteeAmountSum > 0 ? totalCommitteeAmountSum : targetPlan * targetMonthly,
        updatedAt: new Date().toISOString(),
      })
    );

    await batch.commit();
    await recalculateMemberInstallmentsAndFinancials(memberId);

    const freshSnap = await getDoc(memberRef);
    await logAudit(userEmail, 'ADMIN', 'UPDATE_MEMBER', 'Member', memberId, `Updated member profile details and synced installments`);
    return freshSnap.exists() ? ({ id: freshSnap.id, ...(freshSnap.data() as Member) }) : undefined;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMemberCompletely(
  memberId: string,
  userEmail: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const path = `members/${memberId}`;

  // Block deletion if member has any Active or Defaulted Qarza-e-Hasana loan
  const qarzaSnap = await getDocs(
    query(collection(db, 'qarzaHasana'), where('memberId', '==', memberId))
  );
  const blockingLoan = qarzaSnap.docs.find((d) => {
    const qData = d.data() as QarzaHasanaAgreement;
    return qData.status === 'Active' || qData.status === 'Defaulted';
  });
  if (blockingLoan) {
    const qData = blockingLoan.data() as QarzaHasanaAgreement;
    throw new Error(
      `اس ممبر کو حذف نہیں کیا جا سکتا کیونکہ ان کا قرضِ حسنہ (${qData.agreementNumber} - ${qData.status}) ابھی باقی ہے۔`
    );
  }

  try {
    // 1. Fetch existing member data for informative audit logging
    const memberDocRef = doc(db, 'members', memberId);
    const snap = await getDoc(memberDocRef);
    const memberData = snap.exists() ? (snap.data() as Member) : null;
    const memberName = memberData?.fullName || memberId;
    const memberNum = memberData?.memberNumber || '';

    // 2. Chunked batch delete all associated records (installments, payments, receipts, refunds, settled cancellations)
    const ops: BatchOp[] = [];

    const [instSnap, paySnap, recSnap, refSnap, canSnap] = await Promise.all([
      getDocs(query(collection(db, 'installments'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'payments'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'receipts'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'refunds'), where('memberId', '==', memberId))),
      getDocs(query(collection(db, 'cancellations'), where('memberId', '==', memberId))),
    ]);

    instSnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
    paySnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
    recSnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
    refSnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
    canSnap.forEach((d) => {
      const cData = d.data() as CancellationNotice;
      if (cData.status === 'Settled') {
        ops.push({ type: 'delete', ref: d.ref });
      }
    });

    // Delete the member document itself
    ops.push({ type: 'delete', ref: memberDocRef });

    await commitInChunks(ops, 400);

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
    await updateDoc(
      doc(db, 'members', memberId),
      removeUndefined({
        status: 'Archived',
        notes: member.notes ? `${member.notes} | Archived: ${reason}` : `Archived: ${reason}`,
        updatedAt: new Date().toISOString(),
      })
    );

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

export async function restoreMemberToActive(
  memberId: string,
  userEmail: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const path = `members/${memberId}`;
  try {
    const member = await getMemberById(memberId);
    if (!member) return { success: false, message: 'Member not found' };

    const now = new Date().toISOString();
    await updateDoc(
      doc(db, 'members', memberId),
      removeUndefined({
        status: 'Active',
        updatedAt: now,
      })
    );

    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'RESTORE_MEMBER',
      'Member',
      memberId,
      `Restored cancelled/archived member ${member.fullName} (${member.memberNumber}) to Active status with full previous records intact.`
    );

    return {
      success: true,
      message: `ممبر ${member.fullName} (${member.memberNumber}) کو دوبارہ ایکٹو ممبرشپ میں کامیابی سے بحال کر دیا گیا ہے۔ تمام سابقہ اقساط اور ریکارڈز محفوظ ہیں۔`,
    };
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
    await updateDoc(
      doc(db, 'members', memberId),
      removeUndefined({
        registrationFeeStatus: status,
        updatedAt: new Date().toISOString(),
      })
    );
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
  const counterRef = COUNTERS_DOC_REF();
  const initialSnap = await getDoc(counterRef);
  let seededMax = 0;
  if (!initialSnap.exists() || typeof initialSnap.data()?.lastReceiptNumber !== 'number') {
    seededMax = await getMaxExistingReceiptNumber();
  }

  const nextNum = await runTransaction(db, async (transaction) => {
    const txSnap = await transaction.get(counterRef);
    const txData = txSnap.exists() ? txSnap.data() : {};
    const currentLast =
      typeof txData?.lastReceiptNumber === 'number' ? txData.lastReceiptNumber : seededMax;
    const next = Math.max(currentLast, seededMax) + 1;
    transaction.set(
      counterRef,
      removeUndefined({ lastReceiptNumber: next, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
    return next;
  });

  return `MZA-RCP-${String(nextNum).padStart(4, '0')}`;
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
  const currentPayment = Number(payload.amountReceived);
  if (!Number.isFinite(currentPayment) || currentPayment <= 0) {
    throw new Error('Payment amount must be a valid number greater than 0.');
  }

  const member = await getMemberById(payload.memberId);
  if (!member) throw new Error('Member not found');

  if (member.status === 'Cancelled' || member.status === 'Refunded' || member.status === 'Archived') {
    throw new Error(`Cannot record payment for a ${member.status} member.`);
  }

  const allInstallments = await getInstallmentsForMember(payload.memberId);
  const sortedInstallments = allInstallments.sort((a, b) => a.installmentNumber - b.installmentNumber);

  // Identify target starting installment for metadata
  let startIdx = 0;
  if (payload.installmentId) {
    const foundIdx = sortedInstallments.findIndex((i) => i.id === payload.installmentId);
    if (foundIdx !== -1) startIdx = foundIdx;
  }
  const todayStr = getTodayKarachiDate();
  const isFullyPaid = (inst: Installment) => {
    const rem = inst.remainingAmount !== undefined ? inst.remainingAmount : (inst.amount - (inst.paidAmount || 0));
    return rem <= 0 || computeInstallmentStatus(inst, todayStr) === 'Paid';
  };
  if (sortedInstallments[startIdx] && isFullyPaid(sortedInstallments[startIdx])) {
    const firstUnpaidIdx = sortedInstallments.findIndex((i) => !isFullyPaid(i));
    if (firstUnpaidIdx !== -1) startIdx = firstUnpaidIdx;
  }

  const primaryInstallment = sortedInstallments[startIdx] || sortedInstallments[0] || {
    id: `inst_${member.id}_1`,
    memberId: member.id,
    memberNumber: member.memberNumber,
    installmentNumber: 1,
    dueDate: payload.paymentDate,
    amount: member.monthlyInstallment || 5000,
    paidAmount: 0,
    remainingAmount: member.monthlyInstallment || 5000,
    status: 'Due' as InstallmentStatus,
    createdAt: new Date().toISOString(),
  };

  const receiptNumber = await getNextReceiptNumber();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const receiptId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const previousPaidAmount = member.paidAmount || 0;
  const totalPaidAfter = previousPaidAmount + currentPayment;
  const totalCommittee = member.totalCommitteeAmount || (member.planMonths * (member.monthlyInstallment || 5000));
  const dueAfter = Math.max(0, totalCommittee - totalPaidAfter);
  const advanceAfter = Math.max(0, totalPaidAfter - totalCommittee);
  const initialInstDesc = `Qist #${primaryInstallment.installmentNumber}`;

  const batch = writeBatch(db);

  // 1. Create Payment Record (allocation is performed solely by recalculateMemberInstallmentsAndFinancials)
  const paymentRecord: Payment = {
    id: paymentId,
    memberId: member.id,
    memberNumber: member.memberNumber,
    memberName: member.fullName,
    installmentId: primaryInstallment.id,
    installmentNumber: primaryInstallment.installmentNumber,
    installmentsCovered: [primaryInstallment.installmentNumber],
    installmentDescription: initialInstDesc,
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
  batch.set(doc(db, 'payments', paymentId), removeUndefined(paymentRecord));

  // 2. Create Official Receipt
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
    installmentsCovered: [primaryInstallment.installmentNumber],
    installmentDescription: initialInstDesc,
    dueDate: primaryInstallment.dueDate,
    amount: currentPayment,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    previousPaidAmount,
    currentPayment,
    remainingBalance: dueAfter,
    advanceAmount: advanceAfter,
    totalCommitteeAmount: totalCommittee,
    totalPaidAmount: totalPaidAfter,
    totalDueAmount: dueAfter,
    registrationFeeStatus: member.registrationFeeStatus,
    notes: payload.notes || '',
    referenceNumber: payload.referenceNumber || '',
    transactionRef: payload.referenceNumber || '',
    generatedBy: payload.collectedBy,
    verificationStatus: 'Verified',
    createdAt: now,
  };
  batch.set(doc(db, 'receipts', receiptId), removeUndefined(receiptRecord));

  try {
    await batch.commit();

    // Sole allocator: recalculate all installments, receipt descriptions, and member financials
    await recalculateMemberInstallmentsAndFinancials(payload.memberId);

    const [freshReceiptSnap, freshMemberSnap, freshPaymentSnap, freshInstallments] = await Promise.all([
      getDoc(doc(db, 'receipts', receiptId)),
      getDoc(doc(db, 'members', member.id)),
      getDoc(doc(db, 'payments', paymentId)),
      getInstallmentsForMember(payload.memberId),
    ]);

    const finalReceipt = freshReceiptSnap.exists() ? (freshReceiptSnap.data() as Receipt) : receiptRecord;
    const finalMember = freshMemberSnap.exists() ? (freshMemberSnap.data() as Member) : member;
    let finalPayment = freshPaymentSnap.exists() ? (freshPaymentSnap.data() as Payment) : paymentRecord;

    // Keep payment's covered installment fields synced with recalculated receipt
    if (
      freshPaymentSnap.exists() &&
      (finalReceipt.installmentDescription !== finalPayment.installmentDescription ||
        finalReceipt.installmentNumber !== finalPayment.installmentNumber)
    ) {
      await updateDoc(
        doc(db, 'payments', paymentId),
        removeUndefined({
          installmentNumber: finalReceipt.installmentNumber,
          installmentsCovered: finalReceipt.installmentsCovered || [finalReceipt.installmentNumber],
          installmentDescription: finalReceipt.installmentDescription || initialInstDesc,
        })
      );
      const reReadPay = await getDoc(doc(db, 'payments', paymentId));
      if (reReadPay.exists()) finalPayment = reReadPay.data() as Payment;
    }

    const finalInstallment =
      freshInstallments.find((i) => i.installmentNumber === finalReceipt.installmentNumber) ||
      freshInstallments.find((i) => i.id === primaryInstallment.id) ||
      primaryInstallment;

    await logAudit(
      payload.collectedBy,
      'STAFF',
      'RECORD_PAYMENT',
      'Payment',
      paymentId,
      `Collected ${currentPayment} PKR from ${member.fullName} (${member.memberNumber}) covering ${finalReceipt.installmentDescription || initialInstDesc} via ${payload.paymentMethod}. Generated receipt ${receiptNumber}.`
    );

    return {
      payment: finalPayment,
      receipt: finalReceipt,
      installment: finalInstallment,
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
      currentInst.status = computeInstallmentStatus(currentInst, todayStr);
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
  const totalPaid = sortedReceipts.reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0);
  const totalCommittee = member.totalCommitteeAmount || (member.planMonths * (member.monthlyInstallment || 5000));
  const totalDue = Math.max(0, totalCommittee - totalPaid);
  const advanceAmount = Math.max(0, totalPaid - totalCommittee);
  const preserveTerminalStatus =
    member.status === 'Cancelled' ||
    member.status === 'Refunded' ||
    member.status === 'Archived';
  const newMemberStatus: MemberStatus = preserveTerminalStatus
    ? member.status
    : (totalPaid >= totalCommittee ? 'Completed' : 'Active');

  // Determine covered installments and description for each receipt
  const receiptBatchUpdates: {
    receiptRef: any;
    covered: number[];
    primaryInstNum: number;
    desc: string;
    previousPaidAmount: number;
    totalPaidAmount: number;
    totalDueAmount: number;
    advanceAmount: number;
  }[] = [];

  let runningPaid = 0;
  for (const r of sortedReceipts) {
    const rAmount = Math.max(0, Number(r.amount) || 0);
    const prevPaid = runningPaid;
    runningPaid += rAmount;
    const rDueAfter = Math.max(0, totalCommittee - runningPaid);
    const rAdvAfter = Math.max(0, runningPaid - totalCommittee);

    const coveredNums: number[] = [];
    for (const inst of sortedInsts) {
      const currentInst = instMap.get(inst.installmentNumber)!;
      if (
        currentInst.receiptNumber &&
        currentInst.receiptNumber.split(',').map((s) => s.trim()).includes(r.receiptNumber)
      ) {
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
      previousPaidAmount: prevPaid,
      totalPaidAmount: runningPaid,
      totalDueAmount: rDueAfter,
      advanceAmount: rAdvAfter,
    });
  }

  // Perform Firestore chunked commit
  const ops: BatchOp[] = [];

  // 1. Update all installments
  for (const inst of sortedInsts) {
    const updated = instMap.get(inst.installmentNumber)!;
    ops.push({
      type: 'update',
      ref: doc(db, 'installments', inst.id),
      data: {
        amount: updated.amount,
        paidAmount: updated.paidAmount,
        remainingAmount: updated.remainingAmount,
        status: updated.status,
        paidDate: updated.paidDate || null,
        paymentMethod: updated.paymentMethod || null,
        receiptNumber: updated.receiptNumber || null,
        receiptId: updated.receiptId || null,
      },
    });
  }

  // 2. Update member financial summary
  ops.push({
    type: 'update',
    ref: memberRef,
    data: {
      paidAmount: totalPaid,
      dueAmount: totalDue,
      advanceAmount: advanceAmount,
      status: newMemberStatus,
      updatedAt: new Date().toISOString(),
    },
  });

  // 3. Update receipts with correct covered installments, descriptions, and running totals
  for (const ru of receiptBatchUpdates) {
    ops.push({
      type: 'update',
      ref: ru.receiptRef,
      data: {
        installmentsCovered: ru.covered,
        installmentNumber: ru.primaryInstNum,
        installmentDescription: ru.desc,
        previousPaidAmount: ru.previousPaidAmount,
        totalPaidAmount: ru.totalPaidAmount,
        totalDueAmount: ru.totalDueAmount,
        remainingBalance: ru.totalDueAmount,
        advanceAmount: ru.advanceAmount,
        totalCommitteeAmount: totalCommittee,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  await commitInChunks(ops, 400);
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
  if (updates.amount !== undefined) {
    const parsedAmt = Number(updates.amount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      throw new Error('Receipt amount must be a valid number greater than 0.');
    }
  }

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
  batch.update(receiptRef, removeUndefined(receiptUpdates));

  if (receipt.paymentId) {
    const payRef = doc(db, 'payments', receipt.paymentId);
    batch.update(
      payRef,
      removeUndefined({
        ...updates,
        amountReceived: newAmount,
        amount: newAmount,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // Also update any matching payments by receiptNumber
  const payQuery = query(collection(db, 'payments'), where('receiptNumber', '==', receipt.receiptNumber));
  const payDocs = await getDocs(payQuery);
  payDocs.forEach((d) => {
    if (d.id !== receipt.paymentId) {
      batch.update(
        d.ref,
        removeUndefined({
          ...updates,
          amountReceived: newAmount,
          amount: newAmount,
          updatedAt: new Date().toISOString(),
        })
      );
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
  const manualAmt = Number(payload.amountReceived);
  if (!Number.isFinite(manualAmt) || manualAmt <= 0) {
    throw new Error('Payment amount must be a valid number greater than 0.');
  }

  const receiptNumber = await getNextReceiptNumber();
  const manualTs = Date.now();
  const randSuffix = Math.random().toString(36).substring(2, 6);
  const paymentId = `pay_${manualTs}_${randSuffix}`;
  const receiptId = `rcp_${manualTs}_${randSuffix}`;
  const manualMemberId = `manual_${manualTs}`;
  const manualInstId = `manual_inst_${manualTs}`;
  const now = new Date().toISOString();
  const instNum = payload.installmentNumber || 1;
  const instDesc = payload.installmentDescription || 'دستی وصولی';

  const memberNumber = payload.memberNumber || `MZA-M-${String(manualTs).slice(-4)}`;

  const paymentRecord: Payment = {
    id: paymentId,
    memberId: manualMemberId,
    memberNumber,
    memberName: payload.memberName,
    installmentId: manualInstId,
    installmentNumber: instNum,
    installmentsCovered: [instNum],
    installmentDescription: instDesc,
    receiptId,
    receiptNumber,
    amountReceived: manualAmt,
    amount: manualAmt,
    paymentMethod: payload.paymentMethod,
    paymentDate: payload.paymentDate,
    referenceNumber: payload.referenceNumber || '',
    notes: payload.notes || instDesc,
    collectedBy: payload.collectedBy,
    allocationType: 'current',
    createdAt: now,
  };

  const receiptRecord: Receipt = {
    id: receiptId,
    receiptNumber,
    memberId: manualMemberId,
    memberNumber,
    memberName: payload.memberName,
    fatherName: payload.fatherName || '—',
    mobile: payload.mobile || '—',
    address: 'دستی اندراج / Manual Entry',
    planMonths: 1,
    paymentId,
    installmentNumber: instNum,
    installmentsCovered: [instNum],
    installmentDescription: instDesc,
    dueDate: payload.paymentDate,
    amount: manualAmt,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    previousPaidAmount: 0,
    currentPayment: manualAmt,
    remainingBalance: 0,
    advanceAmount: 0,
    totalCommitteeAmount: manualAmt,
    totalPaidAmount: manualAmt,
    totalDueAmount: 0,
    registrationFeeStatus: 'Paid',
    notes: payload.notes || instDesc,
    referenceNumber: payload.referenceNumber || '',
    generatedBy: payload.collectedBy,
    verificationStatus: 'Verified',
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'payments', paymentId), removeUndefined(paymentRecord));
  batch.set(doc(db, 'receipts', receiptId), removeUndefined(receiptRecord));

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
  const refundAmt = Number(data.refundAmount);
  if (!Number.isFinite(refundAmt) || refundAmt <= 0) {
    throw new Error('Refund amount must be a valid number greater than 0.');
  }

  const member = await getMemberById(data.memberId);
  if (!member) throw new Error('Member not found');

  const memberPaid = Number(member.paidAmount) || 0;
  if (refundAmt > memberPaid) {
    throw new Error(
      `Refund amount (Rs. ${refundAmt.toLocaleString()}) cannot exceed member's total paid amount (Rs. ${memberPaid.toLocaleString()}).`
    );
  }

  if (member.status === 'Refunded') {
    throw new Error('This member has already been refunded.');
  }

  const existingRefundsSnap = await getDocs(
    query(collection(db, 'refunds'), where('memberId', '==', data.memberId))
  );
  if (!existingRefundsSnap.empty) {
    throw new Error('A refund record already exists for this member.');
  }

  const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const refundRecord: Refund = {
    ...data,
    refundAmount: refundAmt,
    id: refundId,
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'refunds', refundId), removeUndefined(refundRecord));

  // Update member record with status Refunded or cancelled
  batch.update(
    doc(db, 'members', member.id),
    removeUndefined({
      status: 'Refunded',
      notes: member.notes ? `${member.notes} | Refunded Rs. ${data.refundAmount}` : `Refunded Rs. ${data.refundAmount}`,
      updatedAt: now,
    })
  );

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
// CANCELLATION NOTICE MANAGEMENT SERVICE
// -------------------------------------------------------------
export async function recordCancellationNotice(
  data: Omit<CancellationNotice, 'id' | 'createdAt'>,
  updateMemberStatus: boolean = true,
  userEmail: string = 'admin'
): Promise<CancellationNotice> {
  const canId = `can_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const noticeRecord: CancellationNotice = {
    ...data,
    id: canId,
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'cancellations', canId), removeUndefined(noticeRecord));

  if (updateMemberStatus && data.memberId) {
    const member = await getMemberById(data.memberId);
    const noteLine = `Cancellation Notice #${data.noticeNumber} issued on ${data.noticeDate}. Refunded Rs. ${data.refundAmount}`;
    const memberRef = doc(db, 'members', data.memberId);
    batch.update(
      memberRef,
      removeUndefined({
        status: 'Cancelled',
        notes: member?.notes ? `${member.notes} | ${noteLine}` : noteLine,
        updatedAt: now,
      })
    );
  }

  try {
    await batch.commit();
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'ISSUE_CANCELLATION',
      'Cancellation',
      canId,
      `Issued cancellation notice #${data.noticeNumber} for ${data.fullName} (${data.memberNumber || data.cnic}). Refunded: Rs. ${data.refundAmount}.`
    );
    return noticeRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'cancellations');
  }
}

export async function updateCancellationNotice(
  id: string,
  data: Partial<CancellationNotice>,
  updateMemberStatus: boolean = true,
  userEmail: string = 'admin'
): Promise<CancellationNotice> {
  const path = `cancellations/${id}`;
  const docRef = doc(db, 'cancellations', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('منسوخی نوٹس کا ریکارڈ نہیں ملا۔');
  }
  const existing = snap.data() as CancellationNotice;
  const now = new Date().toISOString();

  const updatedRecord = removeUndefined<CancellationNotice>({
    ...existing,
    ...data,
    id,
  });

  const batch = writeBatch(db);
  batch.set(docRef, updatedRecord, { merge: true });

  if (updateMemberStatus && updatedRecord.memberId) {
    const member = await getMemberById(updatedRecord.memberId);
    if (member && member.status !== 'Cancelled') {
      const noteLine = `Cancellation Notice #${updatedRecord.noticeNumber} updated on ${updatedRecord.noticeDate}. Refunded Rs. ${updatedRecord.refundAmount}`;
      batch.update(
        doc(db, 'members', updatedRecord.memberId),
        removeUndefined({
          status: 'Cancelled',
          notes: member.notes ? `${member.notes} | ${noteLine}` : noteLine,
          updatedAt: now,
        })
      );
    }
  }

  try {
    await batch.commit();
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'UPDATE_CANCELLATION',
      'Cancellation',
      id,
      `Updated cancellation notice #${updatedRecord.noticeNumber} for ${updatedRecord.fullName}.`
    );
    return updatedRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getAllCancellations(): Promise<CancellationNotice[]> {
  const path = 'cancellations';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CancellationNotice) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCancellationNotice(
  id: string,
  userEmail: string = 'admin'
): Promise<void> {
  const path = `cancellations/${id}`;
  try {
    await deleteDoc(doc(db, 'cancellations', id));
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'DELETE_CANCELLATION',
      'Cancellation',
      id,
      `Deleted cancellation notice record #${id}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// QARZA-E-HASANA (INTEREST-FREE LOAN) AGREEMENTS
// -------------------------------------------------------------
const normalizeCnicDigits = (cnic?: string) => (cnic || '').replace(/[-\s]/g, '').trim();

export async function recordQarzaAgreement(
  data: Omit<QarzaHasanaAgreement, 'id' | 'createdAt'>,
  userEmail: string = 'admin'
): Promise<QarzaHasanaAgreement> {
  const loanAmt = Number(data.loanAmount);
  if (!Number.isFinite(loanAmt) || loanAmt <= 0 || loanAmt > 20000) {
    throw new Error('قرضِ حسنہ کی رقم 1 روپے سے 20,000 روپے کے درمیان ہونی چاہیے۔');
  }

  const borrowerCnicNorm = normalizeCnicDigits(data.cnic);
  const guarantorCnicNorm = normalizeCnicDigits(data.guarantorCnic);
  if (borrowerCnicNorm && guarantorCnicNorm && borrowerCnicNorm === guarantorCnicNorm) {
    throw new Error('قرض دار اور ضامن کا شناختی کارڈ نمبر ایک جیسا نہیں ہو سکتا۔');
  }

  if (data.memberId) {
    const member = await getMemberById(data.memberId);
    if (!member) {
      throw new Error('منتخب کردہ ممبر ریکارڈ میں موجود نہیں ہے۔');
    }
    if (member.status !== 'Active' && member.status !== 'Completed') {
      throw new Error(
        `صرف فعال (Active) یا مکمل (Completed) ممبر کو قرضِ حسنہ جاری کیا جا سکتا ہے۔ اس ممبر کا اسٹیٹس ${member.status} ہے۔`
      );
    }
  }

  if (data.memberId || borrowerCnicNorm) {
    const activeLoansSnap = await getDocs(
      query(collection(db, 'qarzaHasana'), where('status', '==', 'Active'))
    );
    const hasActiveLoan = activeLoansSnap.docs.some((d) => {
      const a = d.data() as QarzaHasanaAgreement;
      if (data.memberId && a.memberId && a.memberId === data.memberId) return true;
      if (borrowerCnicNorm && normalizeCnicDigits(a.cnic) === borrowerCnicNorm) return true;
      return false;
    });
    if (hasActiveLoan) {
      throw new Error('اس فرد/ممبر کے نام پر پہلے سے ایک فعال (Active) قرضِ حسنہ جاری ہے، نیا قرض جاری نہیں ہو سکتا۔');
    }
  }

  const qarId = `qarz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const agreementRecord = removeUndefined<QarzaHasanaAgreement>({
    ...data,
    loanAmount: loanAmt,
    id: qarId,
    paidReturnAmount: data.paidReturnAmount || 0,
    remainingReturnAmount:
      data.remainingReturnAmount !== undefined ? data.remainingReturnAmount : loanAmt,
    status: data.status || 'Active',
    createdAt: now,
  });

  const path = `qarzaHasana/${qarId}`;
  try {
    await setDoc(doc(db, 'qarzaHasana', qarId), agreementRecord);
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'ISSUE_QARZA_HASANA',
      'QarzaHasana',
      qarId,
      `Issued Qarza-e-Hasana agreement #${data.agreementNumber} for ${data.fullName} (${data.cnic}). Loan Amount: Rs. ${loanAmt}, Monthly Return: Rs. ${data.monthlyReturnAmount}. Guarantor: ${data.guarantorName} (${data.guarantorCnic}).`
    );
    return agreementRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateQarzaAgreement(
  id: string,
  data: Partial<QarzaHasanaAgreement>,
  userEmail: string = 'admin'
): Promise<QarzaHasanaAgreement> {
  const path = `qarzaHasana/${id}`;
  const docRef = doc(db, 'qarzaHasana', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('قرضِ حسنہ کا ریکارڈ نہیں ملا۔');
  }
  const existing = snap.data() as QarzaHasanaAgreement;

  const loanAmt = data.loanAmount !== undefined ? Number(data.loanAmount) : Number(existing.loanAmount);
  if (!Number.isFinite(loanAmt) || loanAmt <= 0 || loanAmt > 20000) {
    throw new Error('قرضِ حسنہ کی رقم 1 روپے سے 20,000 روپے کے درمیان ہونی چاہیے۔');
  }

  const borrowerCnicNorm = normalizeCnicDigits(data.cnic ?? existing.cnic);
  const guarantorCnicNorm = normalizeCnicDigits(data.guarantorCnic ?? existing.guarantorCnic);
  if (borrowerCnicNorm && guarantorCnicNorm && borrowerCnicNorm === guarantorCnicNorm) {
    throw new Error('قرض دار اور ضامن کا شناختی کارڈ نمبر ایک جیسا نہیں ہو سکتا۔');
  }

  const paid = Number(data.paidReturnAmount ?? existing.paidReturnAmount) || 0;
  const remaining = Math.max(0, loanAmt - paid);
  const nextStatus: QarzaHasanaAgreement['status'] =
    existing.status === 'Defaulted' ? 'Defaulted' : remaining <= 0 ? 'Repaid' : 'Active';

  const updatedRecord = removeUndefined<QarzaHasanaAgreement>({
    ...existing,
    ...data,
    id,
    loanAmount: loanAmt,
    paidReturnAmount: paid,
    remainingReturnAmount: remaining,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, updatedRecord, { merge: true });
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'UPDATE_QARZA_HASANA',
      'QarzaHasana',
      id,
      `Updated Qarza-e-Hasana agreement #${updatedRecord.agreementNumber} for ${updatedRecord.fullName}.`
    );
    return updatedRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getAllQarzaAgreements(): Promise<QarzaHasanaAgreement[]> {
  const path = 'qarzaHasana';
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as QarzaHasanaAgreement) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteQarzaAgreement(
  id: string,
  userEmail: string = 'admin'
): Promise<void> {
  const path = `qarzaHasana/${id}`;
  try {
    await deleteDoc(doc(db, 'qarzaHasana', id));
    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'DELETE_QARZA_HASANA',
      'QarzaHasana',
      id,
      `Deleted Qarza-e-Hasana agreement record #${id}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordQarzaRepayment(
  agreementId: string,
  repaymentAmount: number,
  userEmail: string = 'admin',
  notes?: string
): Promise<void> {
  const amt = Number(repaymentAmount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('واپسی کی رقم صفر سے زیادہ ہونی چاہیے۔');
  }

  const path = `qarzaHasana/${agreementId}`;
  const docRef = doc(db, 'qarzaHasana', agreementId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('قرضِ حسنہ کا ریکارڈ نہیں ملا۔');
  }
  const existing = snap.data() as QarzaHasanaAgreement;
  const currentRemaining =
    existing.remainingReturnAmount !== undefined
      ? Math.max(0, Number(existing.remainingReturnAmount) || 0)
      : Math.max(0, (Number(existing.loanAmount) || 0) - (Number(existing.paidReturnAmount) || 0));

  if (existing.status === 'Repaid' || currentRemaining <= 0) {
    throw new Error('یہ قرضِ حسنہ پہلے ہی مکمل طور پر ادا ہو چکا ہے۔');
  }
  if (amt > currentRemaining) {
    throw new Error(
      `واپسی کی رقم (${amt.toLocaleString()} روپے) باقی واجب الادا رقم (${currentRemaining.toLocaleString()} روپے) سے زیادہ نہیں ہو سکتی۔`
    );
  }

  try {
    const newPaid = (existing.paidReturnAmount || 0) + amt;
    const newRemaining = Math.max(0, existing.loanAmount - newPaid);
    const newStatus = newRemaining <= 0 ? ('Repaid' as const) : ('Active' as const);

    await updateDoc(
      docRef,
      removeUndefined({
        paidReturnAmount: newPaid,
        remainingReturnAmount: newRemaining,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(notes ? { notes: `${existing.notes ? existing.notes + ' | ' : ''}${notes}` } : {}),
      })
    );

    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'REPAY_QARZA_HASANA',
      'QarzaHasana',
      agreementId,
      `Recorded return payment of Rs. ${amt} for Qarza-e-Hasana #${existing.agreementNumber} (${existing.fullName}). Total Returned: Rs. ${newPaid}, Remaining: Rs. ${newRemaining}. Status: ${newStatus}.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markQarzaAsDefaulted(
  agreementId: string,
  userEmail: string = 'admin',
  reason?: string
): Promise<void> {
  const path = `qarzaHasana/${agreementId}`;
  const docRef = doc(db, 'qarzaHasana', agreementId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('قرضِ حسنہ کا ریکارڈ نہیں ملا۔');
  }
  const existing = snap.data() as QarzaHasanaAgreement;
  if (existing.status === 'Repaid') {
    throw new Error('مکمل ادا شدہ قرض کو نادہندہ (Defaulted) قرار نہیں دیا جا سکتا۔');
  }
  if (existing.status === 'Defaulted') {
    throw new Error('یہ قرضِ حسنہ پہلے ہی نادہندہ (Defaulted) قرار دیا جا چکا ہے۔');
  }

  const remaining =
    existing.remainingReturnAmount !== undefined
      ? Math.max(0, Number(existing.remainingReturnAmount) || 0)
      : Math.max(0, (Number(existing.loanAmount) || 0) - (Number(existing.paidReturnAmount) || 0));

  try {
    await updateDoc(
      docRef,
      removeUndefined({
        status: 'Defaulted',
        updatedAt: new Date().toISOString(),
        ...(reason ? { notes: `${existing.notes ? existing.notes + ' | ' : ''}Defaulted: ${reason}` } : {}),
      })
    );

    await logAudit(
      userEmail,
      'SUPER ADMIN',
      'MARK_QARZA_DEFAULTED',
      'QarzaHasana',
      agreementId,
      `Marked Qarza-e-Hasana #${existing.agreementNumber} (${existing.fullName}) as Defaulted. Remaining: Rs. ${remaining}${reason ? `. Reason: ${reason}` : ''}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -------------------------------------------------------------
// SEED REALISTIC DEMO DATA (IF DATABASE IS FRESH)
// -------------------------------------------------------------
export async function seedInitialDemoDataIfEmpty(): Promise<void> {
  // Disabled permanently: Real production database. Never seed demo data.
  return;
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
    cancellations: any[];
    qarzaHasana: any[];
    auditLogs: any[];
    settings: any[];
    counters: any | null;
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
    cancellationsCount: number;
    qarzaHasanaCount: number;
    auditLogsCount: number;
    settingsCount: number;
    hasCounters: boolean;
  };
}> {
  const collectionNames = [
    'members',
    'installments',
    'payments',
    'receipts',
    'refunds',
    'cancellations',
    'qarzaHasana',
    'auditLogs',
    'settings',
  ] as const;

  const results: Record<string, any[]> = {
    members: [],
    installments: [],
    payments: [],
    receipts: [],
    refunds: [],
    cancellations: [],
    qarzaHasana: [],
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

  let countersDoc: any | null = null;
  try {
    const counterSnap = await getDoc(COUNTERS_DOC_REF());
    if (counterSnap.exists()) {
      countersDoc = { id: counterSnap.id, ...counterSnap.data() };
      if (!results.settings.some((s) => s.id === 'counters')) {
        results.settings.push(countersDoc);
      }
    }
  } catch (err) {
    console.warn('Could not read settings/counters for backup:', err);
  }

  const now = new Date();
  const exportedAt = now.toISOString();
  const dateStr = getTodayKarachiDate();
  const filename = `mz-backup-${dateStr}.json`;

  const backupData: DatabaseBackupPayload = {
    exportedAt,
    collections: {
      members: results.members,
      installments: results.installments,
      payments: results.payments,
      receipts: results.receipts,
      refunds: results.refunds,
      cancellations: results.cancellations,
      qarzaHasana: results.qarzaHasana,
      auditLogs: results.auditLogs,
      settings: results.settings,
      counters: countersDoc,
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
      `Full system backup exported (${results.members.length} members, ${results.installments.length} installments, ${results.payments.length} payments, ${results.receipts.length} receipts, ${results.refunds.length} refunds, ${results.cancellations.length} cancellations, ${results.qarzaHasana.length} qarza agreements, ${results.auditLogs.length} audit logs, ${results.settings.length} settings${countersDoc ? ' incl. counters' : ''})`
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
      cancellationsCount: results.cancellations.length,
      qarzaHasanaCount: results.qarzaHasana.length,
      auditLogsCount: results.auditLogs.length,
      settingsCount: results.settings.length,
      hasCounters: countersDoc !== null,
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

      const isPaid = computeInstallmentStatus(inst, todayStr) === 'Paid';
      if (isPaid || (inst.paidAmount || 0) > 0) {
        paidInstallmentNumbers.push(inst.installmentNumber);
      }

      if (newStatus === 'Paid') {
        memberPaidCount++;
        totalPaidCount++;
      } else if (newStatus === 'Overdue' || newStatus === 'Partial - Overdue' || newStatus === 'Late') {
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

  const ops: BatchOp[] = [];
  const syncNow = new Date().toISOString();

  for (const memberPreview of preview.previews) {
    const changedDiffs = memberPreview.diffs.filter((d) => d.isDateChanged || d.isStatusChanged);
    if (changedDiffs.length === 0) continue;

    for (const diff of changedDiffs) {
      const instRef = doc(db, 'installments', diff.installmentId);
      // Strictly update ONLY dueDate and status. NEVER touch paidAmount, remainingAmount, receipts, etc.
      ops.push({
        type: 'update',
        ref: instRef,
        data: {
          dueDate: diff.newDueDate,
          status: diff.newStatus,
        },
      });
      totalInstallmentsCommitted++;
    }

    // Also update member's firstInstallmentDueDate
    const memberRef = doc(db, 'members', memberPreview.memberId);
    ops.push({
      type: 'update',
      ref: memberRef,
      data: {
        firstInstallmentDueDate: targetFirstDueDate,
        updatedAt: syncNow,
      },
    });

    membersCommitted++;
  }

  await commitInChunks(ops, 400);

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
    batch.update(
      instRef,
      removeUndefined({
        dueDate: diff.newDueDate,
        status: diff.newStatus,
      })
    );
  }

  const memberRef = doc(db, 'members', memberId);
  batch.update(
    memberRef,
    removeUndefined({
      firstInstallmentDueDate: targetFirstDueDate,
      updatedAt: new Date().toISOString(),
    })
  );

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
