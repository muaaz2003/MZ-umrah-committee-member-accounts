import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  HandCoins,
  ClockAlert,
  AlertTriangle,
  Receipt,
  RotateCcw,
  BadgeDollarSign,
  BarChart3,
  ShieldCheck,
  History,
  Settings,
  PlusCircle,
  Menu,
  X,
  LogOut,
  Search,
  Lock,
  Phone,
  Home,
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: UserRole;
  onOpenQistWasool: () => void;
  onOpenAddMember: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  overdueCount: number;
  isAdminLoggedIn: boolean;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  userRole,
  onOpenQistWasool,
  onOpenAddMember,
  isMobileOpen,
  setIsMobileOpen,
  overdueCount,
  isAdminLoggedIn,
  onOpenAdminLogin,
  onAdminLogout,
}) => {
  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'zati-record', label: 'اپنا ذاتی ریکارڈ (Public)', icon: Search, badgeText: 'Live' },
    { id: 'members', label: 'All Members', icon: Users },
    { id: 'plan-24', label: '24 Month Committee', icon: CalendarCheck },
    { id: 'plan-36', label: '36 Month Committee', icon: CalendarDays },
    { id: 'collection', label: 'Qist Wasooli', icon: HandCoins, highlight: true },
    { id: 'due', label: 'Due Installments', icon: ClockAlert },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle, badge: overdueCount },
    { id: 'receipts', label: 'Receipts', icon: Receipt },
    { id: 'refunds', label: 'Refunds', icon: RotateCcw },
    { id: 'registration-fees', label: 'Registration Fees', icon: BadgeDollarSign },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit-logs', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (pageId: string) => {
    onNavigate(pageId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`no-print fixed top-0 bottom-0 left-0 z-50 w-72 sm:w-80 lg:w-64 bg-[#064E3B] text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } border-r border-emerald-800`}
      >
        {/* Brand Header */}
        <div className="p-5 sm:p-6 border-b border-emerald-800 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>MZ UMRAH</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-400 text-emerald-950 rounded">
                PK
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-300 opacity-80 font-medium">
              Committee System
            </div>
            {isAdminLoggedIn ? (
              <div className="text-[11px] text-emerald-200 mt-1">
                ایڈمن: <strong>عبد الشکور مدنی</strong>
              </div>
            ) : (
              <div className="text-[10px] text-emerald-300/80 mt-1">
                Portal: <strong>Online System</strong>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-2 text-emerald-200 hover:text-white rounded-xl hover:bg-emerald-800/80 transition-colors"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ADMIN IS NOT LOGGED IN: Public Navigation */}
        {!isAdminLoggedIn ? (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 bg-emerald-900/50 rounded-2xl border border-emerald-800 text-xs text-emerald-100">
                <p className="font-bold text-amber-300 mb-1 text-sm">عوامی پورٹل (Public View)</p>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  آپ اپنا ذاتی سالانہ کمیٹی ریکارڈ نام اور شناختی کارڈ درج کر کے تلاش کر سکتے ہیں۔
                </p>
              </div>

              <button
                onClick={() => handleNavClick('zati-record')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-bold transition-all ${
                  currentPage === 'zati-record'
                    ? 'bg-amber-400 text-emerald-950 shadow-md'
                    : 'text-emerald-100 hover:bg-emerald-800/50'
                }`}
              >
                <Search className="w-5 h-5" />
                <span>اپنا ذاتی ریکارڈ تلاش کریں</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileOpen(false);
                  onOpenAdminLogin();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Admin Login</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-400 text-emerald-950 rounded">
                  Admin
                </span>
              </button>
            </div>

            {/* Helpline on Public Menu */}
            <div className="mt-auto p-4 bg-emerald-900/40 rounded-2xl border border-emerald-800 text-xs space-y-1 text-emerald-200">
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>کمیٹی ہیلپ لائن</span>
              </div>
              <p className="text-[11px] font-mono text-emerald-300 font-bold">+92 300 8765432</p>
              <p className="text-[10px] text-emerald-400">عبد الشکور مدنی (ایم زیڈ ویلفیئر)</p>
            </div>
          </div>
        ) : (
          /* ADMIN IS LOGGED IN: Full ERP Navigation for Abdul Shakoor Madni */
          <>
            {/* Quick Actions: QIST WASOOL & ADD MEMBER */}
            <div className="p-4 space-y-2 border-b border-emerald-800">
              <button
                onClick={() => {
                  onOpenQistWasool();
                  setIsMobileOpen(false);
                }}
                className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <HandCoins className="w-4 h-4 text-emerald-950" />
                <span>Qist Wasool Karein</span>
              </button>

              <button
                onClick={() => {
                  onOpenAddMember();
                  setIsMobileOpen(false);
                }}
                className="w-full py-2 px-3 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-emerald-700/60 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-300" />
                <span>Add New Member</span>
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-emerald-800">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-800/60 text-white font-bold'
                        : 'text-emerald-200/80 hover:bg-emerald-800/30 hover:text-emerald-100'
                    } ${item.highlight ? 'text-amber-300 hover:text-amber-200' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-amber-300' : 'opacity-60'}`} />
                      <span className="text-xs sm:text-sm font-medium">{item.label}</span>
                    </div>
                    {item.badge && item.badge > 0 ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-emerald-950 rounded-full">
                        {item.badge}
                      </span>
                    ) : item.badgeText ? (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-700 text-emerald-100 rounded">
                        {item.badgeText}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            {/* Footer Admin Bar with Logout */}
            <div className="p-4 mt-auto border-t border-emerald-800 bg-[#064E3B]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-bold text-xs shrink-0">
                    ASM
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">عبد الشکور مدنی</div>
                    <div className="text-[10px] text-amber-300">سپر ایڈمن (Active)</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    onAdminLogout();
                  }}
                  className="p-2 text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 rounded-lg transition-colors cursor-pointer"
                  title="لاگ آؤٹ برائے ایڈمن"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
};
