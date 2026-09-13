import React, { useState } from 'react';
import {
  Search,
  User,
  Shield,
  Bell,
  CheckCircle2,
  ChevronDown,
  Building2,
  Menu,
  Lock,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { AuthUser, Member, UserRole } from '../types';

interface HeaderProps {
  currentUser: AuthUser;
  onSwitchUserRole: (role: UserRole, memberId?: string) => void;
  members: Member[];
  onSelectMember: (memberId: string) => void;
  overdueCount: number;
  todayDueCount: number;
  onNavigate: (page: string) => void;
  currentPage?: string;
  selectedMember?: Member | null;
  onToggleMobileMenu: () => void;
  isAdminLoggedIn: boolean;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchUserRole,
  members,
  onSelectMember,
  overdueCount,
  todayDueCount,
  onNavigate,
  currentPage = 'dashboard',
  selectedMember,
  onToggleMobileMenu,
  isAdminLoggedIn,
  onOpenAdminLogin,
  onAdminLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fast search by Name, Membership Number (MZ-#...), CNIC, Mobile, WhatsApp
  const filteredMembers = searchQuery.trim()
    ? members.filter((m) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          m.fullName.toLowerCase().includes(q) ||
          m.memberNumber.toLowerCase().includes(q) ||
          m.cnic.toLowerCase().includes(q) ||
          m.mobile.toLowerCase().includes(q) ||
          (m.whatsapp && m.whatsapp.toLowerCase().includes(q))
        );
      })
    : [];

  const handleSelectSearchResult = (memberId: string) => {
    onSelectMember(memberId);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const getPageTitle = () => {
    if (selectedMember) {
      return (
        <div className="text-xs sm:text-sm font-medium text-gray-500">
          Members / <span className="text-gray-900 font-semibold">{selectedMember.fullName}</span>
        </div>
      );
    }
    const titles: Record<string, string> = {
      'zati-record': 'اپنا ذاتی ریکارڈ (Member Portal)',
      dashboard: 'Dashboard',
      members: 'All Members',
      'plan-24': '24 Month Committee Plan',
      'plan-36': '36 Month Committee Plan',
      collection: 'Qist Wasooli',
      due: 'Due Installments',
      overdue: 'Overdue Installments',
      receipts: 'Official Receipts',
      refunds: 'Refund Management',
      'registration-fees': 'Registration Fees',
      reports: 'Financial Reports',
      'audit-logs': 'System Audit Logs',
      settings: 'Committee Settings',
    };
    return (
      <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
        {titles[currentPage] || 'MZ Umrah Committee'}
      </div>
    );
  };

  return (
    <header className="no-print h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left side: Hamburger menu button for mobile + Title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1.5 text-gray-700 hover:text-emerald-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-950" />
        </button>

        {getPageTitle()}
      </div>

      {/* Right side: Search, Admin controls */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* If Admin is NOT logged in: Show Admin Login Button */}
        {!isAdminLoggedIn ? (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="px-3.5 sm:px-4 py-2 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Login</span>
          </button>
        ) : (
          /* Admin is LOGGED IN: Full Admin Tools */
          <>
            {/* Quick Button to View/Test Public Portal */}
            <button
              onClick={() => onNavigate('zati-record')}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                currentPage === 'zati-record'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="عوامی پورٹل دیکھیں"
            >
              <Search className="w-3.5 h-3.5 text-emerald-700" />
              <span>عوامی پورٹل</span>
            </button>

            {/* Fast Member Search (Admin only) */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search MZ-#..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-xs w-36 sm:w-56 focus:ring-2 focus:ring-emerald-500 focus:bg-white text-gray-800 placeholder-gray-400 transition-all outline-hidden"
              />

              {/* Search Dropdown Results */}
              {showSearchResults && searchQuery.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto z-50">
                  {filteredMembers.length > 0 ? (
                    <div className="p-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5">
                        Matching Members ({filteredMembers.length})
                      </div>
                      {filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectSearchResult(m.id)}
                          className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-emerald-900 group-hover:text-emerald-700 text-xs">
                                {m.fullName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-900 font-mono font-bold rounded-sm">
                                {m.memberNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {m.planMonths}M Plan • {m.mobile}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <span className="font-bold text-emerald-700">
                              Rs. {m.paidAmount.toLocaleString()}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No member found for "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => onNavigate('due')}
              title="View Due & Overdue Installments"
              className="relative w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 opacity-75" />
              {(overdueCount > 0 || todayDueCount > 0) && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-600 text-[9px] font-bold text-white items-center justify-center">
                    {overdueCount + todayDueCount}
                  </span>
                </span>
              )}
            </button>

            {/* Admin Badge: Abdul Shakoor Madni */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-emerald-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                ASM
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-emerald-950 leading-tight">
                  عبد الشکور مدنی
                </div>
                <div className="text-[9px] font-semibold text-emerald-700">ایڈمن (Active)</div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onAdminLogout}
              className="px-2.5 py-1.5 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer font-semibold border border-rose-200"
              title="ایڈمن لاگ آؤٹ"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">لاگ آؤٹ</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
