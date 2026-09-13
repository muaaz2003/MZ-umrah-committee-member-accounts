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

export function numberToWordsUrdu(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '';
  if (num === 120000) return 'ایک لاکھ بیس ہزار روپے فقط';
  if (num === 180000) return 'ایک لاکھ اسی ہزار روپے فقط';
  if (num === 60000) return 'ساٹھ ہزار روپے فقط';
  if (num === 100000) return 'ایک لاکھ روپے فقط';
  if (num === 50000) return 'پچاس ہزار روپے فقط';
  if (num === 10000) return 'دس ہزار روپے فقط';
  if (num === 5000) return 'پانچ ہزار روپے فقط';

  // Generic lakhs and thousands converter
  const lakh = Math.floor(num / 100000);
  const remainderLakh = num % 100000;
  const thousand = Math.floor(remainderLakh / 1000);

  const urduDigits: { [key: number]: string } = {
    1: 'ایک', 2: 'دو', 3: 'تین', 4: 'چار', 5: 'پانچ', 6: 'چھ', 7: 'سات', 8: 'آٹھ', 9: 'نو', 10: 'دس',
    15: 'پندرہ', 20: 'بیس', 25: 'پچیس', 30: 'تیس', 35: 'پینتیس', 40: 'چالیس', 45: 'پینتالیس', 50: 'پچاس',
    55: 'پچپن', 60: 'ساٹھ', 65: 'پینسٹھ', 70: 'ستر', 75: 'پچھتر', 80: 'اسی', 85: 'پچاسی', 90: 'نوے', 95: 'پچانوے'
  };

  let str = '';
  if (lakh > 0) {
    str += `${urduDigits[lakh] || lakh} لاکھ `;
  }
  if (thousand > 0) {
    str += `${urduDigits[thousand] || thousand} ہزار `;
  }
  return str ? `${str.trim()} روپے فقط` : `${num} روپے فقط`;
}

