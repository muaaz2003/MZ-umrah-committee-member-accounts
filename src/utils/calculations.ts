import {
  Installment,
  InstallmentStatus,
  Member,
  Payment,
  Refund,
  FinancialSummary,
} from '../types';

export const DEFAULT_MONTHLY_INSTALLMENT = 5000;
export const MIN_MONTHLY_INSTALLMENT = 5000;
export const MAX_MONTHLY_INSTALLMENT = 10000;
export const COMMITTEE_START_DATE = '2027-01-01';
export const COMMITTEE_DUE_DAY = 10; // 10th of every month
export const PLAN_A_MONTHS = 24;
export const PLAN_B_MONTHS = 36;
export const PLAN_A_TOTAL = PLAN_A_MONTHS * DEFAULT_MONTHLY_INSTALLMENT; // 120,000 (standard 5k)
export const PLAN_B_TOTAL = PLAN_B_MONTHS * DEFAULT_MONTHLY_INSTALLMENT; // 180,000 (standard 5k)

export function calculateCommitteeTotal(planMonths: 24 | 36, monthlyInstallment: number): number {
  return planMonths * (monthlyInstallment || DEFAULT_MONTHLY_INSTALLMENT);
}

export function formatPKR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0';
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

export function formatDateDisplay(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

export function calculateMemberFinancials(
  totalCommitteeAmount: number,
  paidAmount: number,
  advanceAmount: number = 0,
  refundAmount: number = 0
) {
  const safeTotal = Math.max(0, totalCommitteeAmount);
  const safePaid = Math.max(0, paidAmount);
  const safeAdvance = Math.max(0, advanceAmount);
  const safeRefund = Math.max(0, refundAmount);

  const dueAmount = Math.max(0, safeTotal - safePaid - safeAdvance + safeRefund);
  const progressPercent = safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safePaid / safeTotal) * 1000) / 10)) : 0;

  return {
    totalCommitteeAmount: safeTotal,
    paidAmount: safePaid,
    dueAmount,
    advanceAmount: safeAdvance,
    refundAmount: safeRefund,
    progressPercent,
  };
}

export function calculateFinancialSummary(
  membersOrTotal: Member[] | number,
  paymentsOrPaid?: Payment[] | number,
  refundsOrAdvance: Refund[] | number = 0,
  singleRefund: number = 0
): any {
  // If called with arrays: members, payments, refunds
  if (Array.isArray(membersOrTotal)) {
    const members: Member[] = membersOrTotal;
    const payments: Payment[] = Array.isArray(paymentsOrPaid) ? paymentsOrPaid : [];
    const refunds: Refund[] = Array.isArray(refundsOrAdvance) ? refundsOrAdvance : [];

    const totalCommitteeAmount = members.reduce((sum, m) => sum + (m.totalCommitteeAmount || 0), 0);
    const totalPaidAmount = members.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
    const totalDueAmount = members.reduce((sum, m) => sum + (m.dueAmount || 0), 0);
    const totalAdvanceAmount = members.reduce((sum, m) => sum + (m.advanceAmount || 0), 0);
    const totalRefundsAmount = refunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const netFundBalance = Math.max(0, totalPaidAmount - totalRefundsAmount);

    const registrationFeesCollected = members
      .filter((m) => m.registrationFeeStatus === 'Paid')
      .reduce((sum, m) => sum + (m.registrationFee || 1000), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    let todayCollection = 0;
    let thisMonthCollection = 0;
    let cashCollected = 0;
    let easyPaisaCollected = 0;
    let jazzCashCollected = 0;
    let bankCollected = 0;

    payments.forEach((p) => {
      const pAmount = p.amountReceived || (p as any).amount || 0;
      if (p.paymentDate && p.paymentDate.startsWith(todayStr)) {
        todayCollection += pAmount;
      }
      if (p.paymentDate && p.paymentDate.startsWith(currentMonthPrefix)) {
        thisMonthCollection += pAmount;
      }

      if (p.paymentMethod === 'Cash') {
        cashCollected += pAmount;
      } else if (p.paymentMethod === 'EasyPaisa') {
        easyPaisaCollected += pAmount;
      } else if (p.paymentMethod === 'JazzCash') {
        jazzCashCollected += pAmount;
      } else {
        bankCollected += pAmount;
      }
    });

    const activeMembers = members.filter((m) => m.status === 'Active').length;
    const completedMembers = members.filter((m) => m.status === 'Completed').length;

    const plan24List = members.filter((m) => m.planMonths === 24);
    const plan36List = members.filter((m) => m.planMonths === 36);

    const plan24Count = plan24List.length;
    const plan36Count = plan36List.length;

    const plan24Total = plan24List.reduce((sum, m) => sum + (m.totalCommitteeAmount || 0), 0);
    const plan24Paid = plan24List.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
    const plan24Due = plan24List.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

    const plan36Total = plan36List.reduce((sum, m) => sum + (m.totalCommitteeAmount || 0), 0);
    const plan36Paid = plan36List.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
    const plan36Due = plan36List.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

    const collectionRate =
      totalCommitteeAmount > 0
        ? Math.round((totalPaidAmount / totalCommitteeAmount) * 1000) / 10
        : 0;

    const summary: FinancialSummary = {
      totalCommitteeAmount,
      totalPaidAmount,
      totalDueAmount,
      totalAdvanceAmount,
      totalRefundsAmount,
      netFundBalance,
      registrationFeesCollected,
      todayCollection,
      thisMonthCollection,
      collectionRate,
      totalMembers: members.length,
      activeMembers,
      completedMembers,
      plan24Count,
      plan36Count,
      plan24Total,
      plan24Paid,
      plan24Due,
      plan36Total,
      plan36Paid,
      plan36Due,
      totalCommitteeFund: totalPaidAmount,
      cashCollected,
      easyPaisaCollected,
      jazzCashCollected,
      bankCollected,
      advanceCollected: totalAdvanceAmount,
      refundsPaid: totalRefundsAmount,
    };
    return summary;
  }

  // Otherwise handle single member numbers (backward compatibility)
  const safeTotal = Math.max(0, typeof membersOrTotal === 'number' ? membersOrTotal : 0);
  const safePaid = Math.max(0, typeof paymentsOrPaid === 'number' ? paymentsOrPaid : 0);
  const safeAdvance = Math.max(0, typeof refundsOrAdvance === 'number' ? refundsOrAdvance : 0);
  const safeRefund = Math.max(0, singleRefund);

  const dueAmount = Math.max(0, safeTotal - safePaid - safeAdvance + safeRefund);
  const progressPercent = safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safePaid / safeTotal) * 1000) / 10)) : 0;

  return {
    totalCommitteeAmount: safeTotal,
    paidAmount: safePaid,
    dueAmount,
    advanceAmount: safeAdvance,
    refundAmount: safeRefund,
    progressPercent,
  };
}

export function generateInstallmentSchedule(
  memberId: string,
  memberNumber: string,
  planMonths: 24 | 36,
  monthlyInstallment: number,
  joiningDateStr: string = COMMITTEE_START_DATE,
  fixedDueDay: number = COMMITTEE_DUE_DAY
): Omit<Installment, 'id'>[] {
  const installments: Omit<Installment, 'id'>[] = [];
  const baseDate = new Date(joiningDateStr || COMMITTEE_START_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startYear = baseDate.getFullYear();
  const startMonth = baseDate.getMonth();
  // Fixed due date is always the 10th of every month
  const targetDay = fixedDueDay && fixedDueDay >= 1 && fixedDueDay <= 28 ? fixedDueDay : COMMITTEE_DUE_DAY;

  for (let i = 1; i <= planMonths; i++) {
    const dueDate = new Date(startYear, startMonth + (i - 1), targetDay);
    // Ensure 2-digit format
    const yyyy = dueDate.getFullYear();
    const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dueDate.getDate()).padStart(2, '0');
    const formattedDueDate = `${yyyy}-${mm}-${dd}`;

    const isPastDue = dueDate < today;
    const isToday = dueDate.getTime() === today.getTime();

    let initialStatus: InstallmentStatus = 'Upcoming';
    if (isToday) {
      initialStatus = 'Due';
    } else if (isPastDue) {
      initialStatus = 'Overdue';
    }

    installments.push({
      memberId,
      memberNumber,
      installmentNumber: i,
      dueDate: formattedDueDate,
      amount: monthlyInstallment,
      paidAmount: 0,
      remainingAmount: monthlyInstallment,
      status: initialStatus,
      createdAt: new Date().toISOString(),
    });
  }

  return installments;
}

export function isInstallmentOverdue(inst: Installment): boolean {
  if (!inst || inst.status === 'Paid') return false;
  if (inst.status === 'Overdue' || inst.status === 'Late') return true;
  const todayStr = new Date().toISOString().split('T')[0];
  return inst.dueDate < todayStr;
}

export function getDaysLate(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function numberToWordsEnglish(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const res = inWords(Math.floor(num)).trim();
  return res ? `${res} Only` : '';
}

const URDU_0_TO_99: { [key: number]: string } = {
  0: 'صفر', 1: 'ایک', 2: 'دو', 3: 'تین', 4: 'چار', 5: 'پانچ', 6: 'چھ', 7: 'سات', 8: 'آٹھ', 9: 'نو', 10: 'دس',
  11: 'گیارہ', 12: 'بارہ', 13: 'تیرہ', 14: 'چودہ', 15: 'پندرہ', 16: 'سولہ', 17: 'سترہ', 18: 'اٹھارہ', 19: 'انیس',
  20: 'بیس', 21: 'اکیس', 22: 'بائیس', 23: 'تیئیس', 24: 'چوبیس', 25: 'پچیس', 26: 'چھبیس', 27: 'ستائیس', 28: 'اٹھائیس', 29: 'انتیس',
  30: 'تیس', 31: 'اکتیس', 32: 'بتیس', 33: 'تینتیس', 34: 'چونتیس', 35: 'پینتیس', 36: 'چھتیس', 37: 'سینتیس', 38: 'اڑتیس', 39: 'انتالیس',
  40: 'چالیس', 41: 'اکتالیس', 42: 'بیالیس', 43: 'تینتالیس', 44: 'چوالیس', 45: 'پینتالیس', 46: 'چھیالیس', 47: 'سینتالیس', 48: 'اڑتالیس', 49: 'انچاس',
  50: 'پچاس', 51: 'اکیاون', 52: 'باون', 53: 'ترپن', 54: 'چون', 55: 'پچپن', 56: 'چھپن', 57: 'ستاون', 58: 'اٹھاون', 59: 'انسٹھ',
  60: 'ساٹھ', 61: 'اکسٹھ', 62: 'باسٹھ', 63: 'تریسٹھ', 64: 'چونسٹھ', 65: 'پینسٹھ', 66: 'چھیاسٹھ', 67: 'سڑسٹھ', 68: 'اڑسٹھ', 69: 'انہتر',
  70: 'ستر', 71: 'اکہتر', 72: 'بہتر', 73: 'تہتر', 74: 'چوہتر', 75: 'پچھتر', 76: 'چھہتر', 77: 'ستتر', 78: 'اٹھتر', 79: 'اناسی',
  80: 'اسی', 81: 'اکیاسی', 82: 'بیاسی', 83: 'تراسی', 84: 'چوراسی', 85: 'پچاسی', 86: 'چھیاسی', 87: 'ستاسی', 88: 'اٹھاسی', 89: 'نواسی',
  90: 'نوے', 91: 'اکیانوے', 92: 'بانوے', 93: 'ترانوے', 94: 'چورانوے', 95: 'پچانوے', 96: 'چھیانوے', 97: 'ستانوے', 98: 'اٹھانوے', 99: 'نانوے'
};

function convertHundredsUrdu(n: number): string {
  if (n <= 0) return '';
  if (n < 100) return URDU_0_TO_99[n] || '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const hText = (h === 1 ? 'ایک سو' : ((URDU_0_TO_99[h] || '') + ' سو'));
  if (rem === 0) return hText;
  return `${hText} ${URDU_0_TO_99[rem] || ''}`.trim();
}

export function numberToWordsUrdu(val: number | string): string {
  if (val === undefined || val === null) return '';
  const strVal = String(val).replace(/,/g, '').trim();
  if (strVal === '') return '';
  const num = Number(strVal);
  if (isNaN(num)) return '';
  if (num === 0) return 'صفر';

  // Special colloquial Urdu case: 1100, 1200 ... 1500 (e.g. 1500 -> پندرہ سو)
  if (num >= 1100 && num <= 1900 && num % 100 === 0) {
    const h = Math.floor(num / 100);
    return `${URDU_0_TO_99[h] || ''} سو`.trim();
  }

  let n = Math.floor(Math.abs(num));
  const parts: string[] = [];

  // Crores (10,000,000)
  if (n >= 10000000) {
    const crore = Math.floor(n / 10000000);
    n = n % 10000000;
    parts.push(`${numberToWordsUrdu(crore)} کروڑ`);
  }

  // Lakhs (100,000)
  if (n >= 100000) {
    const lakh = Math.floor(n / 100000);
    n = n % 100000;
    parts.push(`${URDU_0_TO_99[lakh] || convertHundredsUrdu(lakh)} لاکھ`);
  }

  // Thousands (1,000)
  if (n >= 1000) {
    const thousand = Math.floor(n / 1000);
    n = n % 1000;
    parts.push(`${URDU_0_TO_99[thousand] || convertHundredsUrdu(thousand)} ہزار`);
  }

  // Remainder (1 to 999)
  if (n > 0) {
    parts.push(convertHundredsUrdu(n));
  }

  return parts.join(' ').trim();
}

