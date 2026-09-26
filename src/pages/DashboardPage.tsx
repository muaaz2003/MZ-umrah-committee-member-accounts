import React, { useState, useMemo } from 'react';
import {
  Users,
  CalendarDays,
  HandCoins,
  AlertTriangle,
  Receipt as ReceiptIcon,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  PlusCircle,
  Building2,
  ArrowRight,
  Wallet,
  Smartphone,
  CreditCard,
  Banknote,
  Search,
  Filter,
  RefreshCw,
  Phone,
  MessageCircle,
  BarChart3,
  Percent,
  Coins,
} from 'lucide-react';
import { Member, Payment, Receipt, FinancialSummary, Installment, Refund } from '../types';
import { formatPKR, formatDateDisplay, getDaysLate } from '../utils/calculations';
import { MemberCard } from '../components/MemberCard';

interface DashboardPageProps {
  members: Member[];
  payments: Payment[];
  receipts: Receipt[];
  refunds?: Refund[];
  summary: FinancialSummary;
  installments: Installment[];
  onOpenQistWasool: (member?: Member) => void;
  onOpenAddMember: () => void;
  onSelectMember: (memberId: string) => void;
  onOpenReceipt: (receipt: Receipt) => void;
  onNavigate: (page: string) => void;
  onOpenEditMember?: (member: Member) => void;
  onOpenDeleteMember?: (member: Member) => void;
}

type TimeFilter = 'all' | 'month' | 'week';
type ActiveTab = 'receipts' | 'overdue' | 'members';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  members,
  payments,
  receipts,
  refunds = [],
  summary,
  installments,
  onOpenQistWasool,
  onOpenAddMember,
  onSelectMember,
  onOpenReceipt,
  onNavigate,
  onOpenEditMember,
  onOpenDeleteMember,
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>('receipts');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'Cash' | 'EasyPaisa' | 'JazzCash' | 'Other'>('ALL');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Today and Month dates for calculations
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayDateStr.substring(0, 7), [todayDateStr]);

  // Filtered Payments based on Time Filter
  const filteredPayments = useMemo(() => {
    if (timeFilter === 'all') return payments;

    const now = new Date();
    if (timeFilter === 'month') {
      return payments.filter((p) => p.paymentDate && p.paymentDate.startsWith(currentMonthStr));
    }
    if (timeFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
      return payments.filter((p) => p.paymentDate && p.paymentDate >= weekAgoStr);
    }
    return payments;
  }, [payments, timeFilter, currentMonthStr]);

  // Filtered Collection Amount for current time frame
  const periodCollectionTotal = useMemo(() => {
    return filteredPayments.reduce(
      (sum, p) => sum + (p.amountReceived || (p as any).amount || 0),
      0
    );
  }, [filteredPayments]);

  // Overdue Installments
  const overdueInstallments = useMemo(() => {
    return installments
      .filter((i) => i.status === 'Overdue' || i.status === 'Late')
      .map((inst) => {
        const member = members.find((m) => m.id === inst.memberId);
        const daysLate = getDaysLate(inst.dueDate);
        return {
          ...inst,
          member,
          daysLate,
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [installments, members]);

  const totalOverdueAmount = useMemo(() => {
    return overdueInstallments.reduce((sum, i) => sum + (i.remainingAmount || i.amount || 0), 0);
  }, [overdueInstallments]);

  // Payment Method Breakdown for records
  const methodStats = useMemo(() => {
    const methods = {
      Cash: { count: 0, total: 0, label: 'Cash at Counter', icon: Banknote, color: 'emerald' },
      EasyPaisa: { count: 0, total: 0, label: 'EasyPaisa Wallet', icon: Smartphone, color: 'green' },
      JazzCash: { count: 0, total: 0, label: 'JazzCash Wallet', icon: Wallet, color: 'amber' },
      Other: { count: 0, total: 0, label: 'Bank / Cheque', icon: CreditCard, color: 'blue' },
    };

    payments.forEach((p) => {
      const amt = p.amountReceived || (p as any).amount || 0;
      const m = p.paymentMethod || 'Other';
      if (m === 'Cash') {
        methods.Cash.count += 1;
        methods.Cash.total += amt;
      } else if (m === 'EasyPaisa') {
        methods.EasyPaisa.count += 1;
        methods.EasyPaisa.total += amt;
      } else if (m === 'JazzCash') {
        methods.JazzCash.count += 1;
        methods.JazzCash.total += amt;
      } else {
        methods.Other.count += 1;
        methods.Other.total += amt;
      }
    });

    const totalCollected = summary.totalPaidAmount || 1;
    return {
      cash: { ...methods.Cash, pct: Math.round((methods.Cash.total / totalCollected) * 100) },
      easyPaisa: { ...methods.EasyPaisa, pct: Math.round((methods.EasyPaisa.total / totalCollected) * 100) },
      jazzCash: { ...methods.JazzCash, pct: Math.round((methods.JazzCash.total / totalCollected) * 100) },
      other: { ...methods.Other, pct: Math.round((methods.Other.total / totalCollected) * 100) },
    };
  }, [payments, summary.totalPaidAmount]);

  // Monthly Trend Chart Data (Last 6 months)
  const monthlyChartData = useMemo(() => {
    const monthMap: { [key: string]: number } = {};
    const monthsToShow: string[] = [];

    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayLabel = `${monthNames[past.getMonth()]} ${past.getFullYear().toString().slice(-2)}`;
      monthMap[key] = 0;
      monthsToShow.push(key);
    }

    payments.forEach((p) => {
      if (p.paymentDate) {
        const monthKey = p.paymentDate.substring(0, 7);
        if (monthMap[monthKey] !== undefined) {
          monthMap[monthKey] += p.amountReceived || (p as any).amount || 0;
        }
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthsToShow.map((key) => {
      const [yearStr, mStr] = key.split('-');
      const monthIdx = parseInt(mStr, 10) - 1;
      return {
        month: `${monthNames[monthIdx]} '${yearStr.slice(-2)}`,
        amount: monthMap[key] || 0,
        formatted: formatPKR(monthMap[key] || 0),
      };
    });
  }, [payments]);

  const maxMonthlyAmount = useMemo(() => {
    const maxVal = Math.max(...monthlyChartData.map((d) => d.amount), 0);
    return maxVal > 0 ? Math.ceil(maxVal / 10000) * 10000 : 50000;
  }, [monthlyChartData]);

  // Search & Filter for Receipts / Money Records table
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        const matchesMethod = methodFilter === 'ALL' || r.paymentMethod === methodFilter;
        const q = receiptSearch.toLowerCase().trim();
        const matchesSearch =
          !q ||
          r.receiptNumber.toLowerCase().includes(q) ||
          r.memberName.toLowerCase().includes(q) ||
          r.memberNumber.toLowerCase().includes(q) ||
          r.paymentMethod.toLowerCase().includes(q);
        return matchesMethod && matchesSearch;
      })
      .slice(0, 20); // Top 20 for responsive speed
  }, [receipts, receiptSearch, methodFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Executive Controls */}
      <div className="bg-[#064E3B] rounded-2xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-amber-500 text-emerald-950 rounded-full uppercase tracking-wider">
                Financial Operations ERP
              </span>
              <span className="text-xs text-emerald-100/70 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Verified Audit Ledger</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              MZ Umrah Committee Performance & Financial Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
              Real-time monitoring of committee collections, member installment ledgers, cash counter records, and plan recovery performance.
            </p>
          </div>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenQistWasool()}
              className="px-3.5 sm:px-5 py-2 sm:py-3 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-[11px] sm:text-xs uppercase tracking-wider rounded-lg sm:rounded-xl shadow-xs transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-98"
            >
              <HandCoins className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Qist Wasool Karein</span>
            </button>

            <button
              onClick={onOpenAddMember}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] sm:text-xs rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 border border-white/20 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Time Period Filter Bar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-emerald-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-100">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Filter Period:</span>
            <div className="inline-flex bg-emerald-950/60 p-1 rounded-xl border border-emerald-800">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  timeFilter === 'all'
                    ? 'bg-amber-500 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                All Time (مکمل)
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  timeFilter === 'month'
                    ? 'bg-amber-500 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                This Month (ماہانہ)
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  timeFilter === 'week'
                    ? 'bg-amber-500 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                This Week (ہفتہ وار)
              </button>
            </div>
          </div>

          <div className="text-xs text-emerald-200/90 font-mono">
            <span>Selected Period Inflow: </span>
            <strong className="text-amber-300 font-bold">{formatPKR(periodCollectionTotal)}</strong>
            <span className="text-[11px] text-emerald-300/80 ml-1.5">
              ({filteredPayments.length} transactions)
            </span>
          </div>
        </div>
      </div>

      {/* 4 Core Accounting Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Committee Portfolio Value */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Total Committee Portfolio
              </span>
              <Building2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
              {formatPKR(summary.totalCommitteeAmount)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>{members.length} Total Enrolled</span>
            <span className="text-emerald-700 font-semibold">{summary.activeMembers} Active</span>
          </div>
        </div>

        {/* Total Paid / Collected */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Total Money Collected
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2">
              {formatPKR(summary.totalPaidAmount)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>Target Recovery</span>
              <span className="font-bold text-emerald-700">{summary.collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{ width: `${Math.min(100, summary.collectionRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total Due Amount */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Total Outstanding Due
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-2">
              {formatPKR(summary.totalDueAmount)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Remaining to Recover</span>
            <span className="text-amber-700 font-medium">{100 - summary.collectionRate}%</span>
          </div>
        </div>

        {/* Net Fund Liquidity (Cash Collected - Refunds) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Net Committee Liquidity
              </span>
              <Coins className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-700 mt-2">
              {formatPKR(summary.netFundBalance)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Refunds Paid:</span>
            <span className="text-rose-600 font-semibold">{formatPKR(summary.totalRefundsAmount)}</span>
          </div>
        </div>
      </div>

      {/* Secondary Performance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-medium text-gray-500">This Month Inflow</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">
            {formatPKR(summary.thisMonthCollection)}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">15th Due Cycle Target</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-medium text-gray-500">Advance Reserves Held</div>
          <div className="text-lg font-bold text-blue-700 mt-0.5">
            {formatPKR(summary.totalAdvanceAmount)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Allocated to future Qist</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-medium text-gray-500">Registration Fees Collected</div>
          <div className="text-lg font-bold text-emerald-800 mt-0.5">
            {formatPKR(summary.registrationFeesCollected)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Rs. 1,000 non-refundable</div>
        </div>

        <button
          onClick={() => setActiveTab('overdue')}
          className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-left hover:border-rose-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-rose-700">
            <span>Overdue Installments</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-rose-800 mt-0.5">
            {overdueInstallments.length} Qist Late
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">
            Total {formatPKR(totalOverdueAmount)} due
          </div>
        </button>
      </div>

      {/* Visual Analytics & Money Records (Chart & Payment Channels Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Inflow Trajectory Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-700" />
                <span>Monthly Money Inflow Trend (ماہانہ وصولی)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Installment collection performance over recent 6-month cycles
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              Total Recorded: {formatPKR(summary.totalPaidAmount)}
            </span>
          </div>

          <div className="h-64 w-full relative pt-6 pb-2 select-none">
            {/* Horizontal Grid lines with Y-Axis value indicators */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-2">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const val = Math.round(maxMonthlyAmount * ratio);
                return (
                  <div key={ratio} className="w-full flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-400 w-12 text-right shrink-0">
                      Rs.{val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                    </span>
                    <div className="w-full border-b border-gray-100" />
                  </div>
                );
              })}
            </div>

            {/* Bars container */}
            <div className="relative h-full flex items-end justify-between pl-14 pr-2 pb-8 gap-3 sm:gap-4">
              {monthlyChartData.map((entry, index) => {
                const isCurrentCycle = index === monthlyChartData.length - 1;
                const heightPct = Math.max(
                  entry.amount > 0 ? (entry.amount / maxMonthlyAmount) * 100 : 4,
                  3
                );
                const isHovered = hoveredBarIndex === index;

                return (
                  <div
                    key={entry.month}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-all">
                        <div className="font-bold text-[11px] text-amber-300">{entry.formatted}</div>
                        <div className="text-[10px] text-gray-300">
                          {entry.month} {isCurrentCycle ? '• Current' : ''}
                        </div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[42px] rounded-t-md transition-all duration-300 ${
                        isCurrentCycle
                          ? 'bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-200'
                          : 'bg-[#064E3B] hover:bg-emerald-800 shadow-sm shadow-emerald-200'
                      } ${isHovered ? 'scale-y-[1.03] brightness-110' : ''}`}
                      style={{ height: `${heightPct}%`, minHeight: '6px' }}
                    />

                    {/* Month Label */}
                    <span className="absolute -bottom-6 text-[11px] font-medium text-gray-600 text-center truncate max-w-full">
                      {entry.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#064E3B]"></span>
              <span>Previous Cycles</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#F59E0B]"></span>
              <span>Current Cycle</span>
            </span>
          </div>
        </div>

        {/* Right Col: Payment Channels (Cash vs Digital Breakdown) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
              <Wallet className="w-5 h-5 text-emerald-700" />
              <span>Payment Channels (پیسوں کی تقسیم)</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Breakdown of physical counter cash vs mobile wallet transfers
            </p>

            <div className="space-y-4">
              {/* Cash at Counter */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Cash at Counter</span>
                      <span className="text-[10px] text-gray-500">{methodStats.cash.count} receipts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-800 block">{formatPKR(methodStats.cash.total)}</span>
                    <span className="text-[10px] font-semibold text-gray-400">{methodStats.cash.pct}% of total</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${methodStats.cash.pct}%` }} />
                </div>
              </div>

              {/* EasyPaisa */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-green-100 text-green-800 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">EasyPaisa Wallet</span>
                      <span className="text-[10px] text-gray-500">{methodStats.easyPaisa.count} receipts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-green-800 block">{formatPKR(methodStats.easyPaisa.total)}</span>
                    <span className="text-[10px] font-semibold text-gray-400">{methodStats.easyPaisa.pct}% of total</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-green-600 h-full rounded-full" style={{ width: `${methodStats.easyPaisa.pct}%` }} />
                </div>
              </div>

              {/* JazzCash */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">JazzCash Wallet</span>
                      <span className="text-[10px] text-gray-500">{methodStats.jazzCash.count} receipts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-800 block">{formatPKR(methodStats.jazzCash.total)}</span>
                    <span className="text-[10px] font-semibold text-gray-400">{methodStats.jazzCash.pct}% of total</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${methodStats.jazzCash.pct}%` }} />
                </div>
              </div>

              {/* Bank / Other */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Bank Transfer / Slip</span>
                      <span className="text-[10px] text-gray-500">{methodStats.other.count} receipts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-blue-800 block">{formatPKR(methodStats.other.total)}</span>
                    <span className="text-[10px] font-semibold text-gray-400">{methodStats.other.pct}% of total</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${methodStats.other.pct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <span className="text-[11px] text-gray-500">
              Total Cash in Hand:{' '}
              <strong className="text-emerald-800 font-bold">{formatPKR(methodStats.cash.total)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Committee Plans Performance Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan A: 24 Months */}
        <div
          onClick={() => onNavigate('plan-24')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                24M
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                  Plan A — 24 Months Committee
                </h3>
                <span className="text-[11px] text-gray-500">
                  Target: Rs. 120,000 / member @ Rs. 5,000 monthly
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 transition-colors" />
          </div>

          <div className="grid grid-cols-3 gap-2 my-3 text-center">
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Members</span>
              <span className="text-sm font-bold text-gray-900">{summary.plan24Count}</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Collected</span>
              <span className="text-sm font-bold text-emerald-700">{formatPKR(summary.plan24Paid)}</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Remaining</span>
              <span className="text-sm font-bold text-amber-700">{formatPKR(summary.plan24Due)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>Plan Recovery Rate</span>
              <span className="font-bold text-emerald-700">
                {summary.plan24Total > 0
                  ? Math.round((summary.plan24Paid / summary.plan24Total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{
                  width: `${
                    summary.plan24Total > 0
                      ? Math.min(100, Math.round((summary.plan24Paid / summary.plan24Total) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Plan B: 36 Months */}
        <div
          onClick={() => onNavigate('plan-36')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-center font-bold">
                36M
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                  Plan B — 36 Months Committee
                </h3>
                <span className="text-[11px] text-gray-500">
                  Target: Rs. 180,000 / member @ Rs. 5,000 monthly
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 transition-colors" />
          </div>

          <div className="grid grid-cols-3 gap-2 my-3 text-center">
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Members</span>
              <span className="text-sm font-bold text-gray-900">{summary.plan36Count}</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Collected</span>
              <span className="text-sm font-bold text-emerald-700">{formatPKR(summary.plan36Paid)}</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Remaining</span>
              <span className="text-sm font-bold text-amber-700">{formatPKR(summary.plan36Due)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>Plan Recovery Rate</span>
              <span className="font-bold text-amber-700">
                {summary.plan36Total > 0
                  ? Math.round((summary.plan36Paid / summary.plan36Total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full"
                style={{
                  width: `${
                    summary.plan36Total > 0
                      ? Math.min(100, Math.round((summary.plan36Paid / summary.plan36Total) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Money Records & Ledger Tabs Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 sm:shrink flex-1 sm:flex-initial ${
                activeTab === 'receipts'
                  ? 'bg-[#064E3B] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ReceiptIcon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span>
                <span className="hidden md:inline">Money Collections & </span>Receipts ({receipts.length})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 sm:shrink flex-1 sm:flex-initial ${
                activeTab === 'overdue'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span>
                Overdue<span className="hidden md:inline"> Follow-ups</span> ({overdueInstallments.length})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 sm:shrink flex-1 sm:flex-initial ${
                activeTab === 'members'
                  ? 'bg-[#064E3B] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span>
                <span className="hidden md:inline">Featured </span>Members
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end sm:justify-start gap-2">
            <button
              onClick={() => onNavigate('collection')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Money Collections & Live Receipts Table */}
        {activeTab === 'receipts' && (
          <div className="p-6 space-y-4">
            {/* Search & Channel Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search receipt #, member name, membership ID..."
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Method:</span>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">All Methods</option>
                  <option value="Cash">Cash (کاپی)</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="Other">Bank / Other</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {filteredReceipts.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No receipts match your search filter. Use "Qist Wasool Karein" to record payments.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Qist #</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4 text-right">Amount Received</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReceipts.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {rec.receiptNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDateDisplay(rec.paymentDate)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onSelectMember(rec.memberId)}
                            className="font-semibold text-gray-900 hover:text-emerald-700 text-left cursor-pointer"
                          >
                            {rec.memberName}
                          </button>
                          <span className="block text-[10px] text-gray-400">{rec.memberNumber}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-700">
                          Qist #{rec.installmentNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rec.paymentMethod === 'Cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.paymentMethod === 'EasyPaisa'
                                ? 'bg-green-100 text-green-800'
                                : rec.paymentMethod === 'JazzCash'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {rec.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                          {formatPKR(rec.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onOpenReceipt(rec)}
                            className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-gray-100 text-emerald-800 border border-gray-200 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Receipt</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Overdue Follow-ups */}
        {activeTab === 'overdue' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Late & Overdue Committee Installments
                </h3>
                <p className="text-xs text-gray-500">
                  Total {overdueInstallments.length} installments require urgent counter follow-up.
                </p>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                Total Overdue: {formatPKR(totalOverdueAmount)}
              </span>
            </div>

            {overdueInstallments.length === 0 ? (
              <div className="py-12 text-center text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-xl border border-emerald-200">
                Masha'Allah! All member installments are currently up to date. No overdue accounts.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-rose-50/60 border-b border-rose-100 text-rose-900 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Member #</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Qist #</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Days Late</th>
                      <th className="py-3 px-4 text-right">Overdue Amount</th>
                      <th className="py-3 px-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overdueInstallments.map((item) => (
                      <tr key={item.id} className="hover:bg-rose-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {item.memberNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          {item.member?.fullName || 'Member'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {item.member?.mobile || '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          Qist #{item.installmentNumber}
                        </td>
                        <td className="py-3 px-4 text-rose-700 font-medium">
                          {formatDateDisplay(item.dueDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {item.daysLate} Days Late
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-700">
                          {formatPKR(item.remainingAmount || item.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {item.member && (
                              <button
                                onClick={() => onOpenQistWasool(item.member)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                              >
                                Wasool Karein
                              </button>
                            )}
                            {item.member?.mobile && (
                              <a
                                href={`https://wa.me/92${item.member.mobile.replace(/[^0-9]/g, '').slice(-10)}?text=Assalam-o-Alaikum%20${encodeURIComponent(
                                  item.member.fullName
                                )},%20your%20MZ%20Umrah%20Committee%20Qist%20#${item.installmentNumber}%20is%20pending.`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                title="Send WhatsApp Reminder"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Featured Member Cards */}
        {activeTab === 'members' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.slice(0, 6).map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onViewProfile={(id) => onSelectMember(id)}
                  onOpenQistWasool={(m) => onOpenQistWasool(m)}
                  onEditMember={onOpenEditMember}
                  onDeleteMember={onOpenDeleteMember}
                  userRole="ADMIN"
                />
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => onNavigate('members')}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                View All {members.length} Members List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
