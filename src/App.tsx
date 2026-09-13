import React, { useState, useEffect } from 'react';
import {
  Member,
  Payment,
  Receipt,
  Installment,
  Refund,
  AuditLog,
  CommitteeSettings,
  AuthUser,
  UserRole,
} from './types';
import {
  getAllMembers,
  getAllPayments,
  getAllReceipts,
  getAllInstallments,
  getAllRefunds,
  getAllAuditLogs,
  getSettings,
  saveSettings,
  getMemberById,
  getMemberInstallments,
  seedInitialDemoDataIfEmpty,
} from './services/firebaseService';
import { calculateFinancialSummary, isInstallmentOverdue } from './utils/calculations';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { QistWasoolModal } from './components/QistWasoolModal';
import { ReceiptModal } from './components/ReceiptModal';
import { AddMemberModal } from './components/AddMemberModal';
import { ReceiptVerificationView } from './components/ReceiptVerificationView';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { MembersListPage } from './pages/MembersListPage';
import { MemberProfilePage } from './pages/MemberProfilePage';
import { QistWasooliPage } from './pages/QistWasooliPage';
import { DueInstallmentsPage } from './pages/DueInstallmentsPage';
import { ReceiptsListPage } from './pages/ReceiptsListPage';
import { RefundsPage } from './pages/RefundsPage';
import { RegistrationFeesPage } from './pages/RegistrationFeesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MemberPortalPage } from './pages/MemberPortalPage';
import { ZatiRecordPage } from './pages/ZatiRecordPage';
import { AdminLoginModal } from './components/AdminLoginModal';

export function App() {
  // Admin authentication state: Single Admin = Abdul Shakoor Madni
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('mz_admin_session') === 'true';
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  // Navigation & Page State - Default to 'zati-record' as requested by user
  const [currentPage, setCurrentPage] = useState<string>(() => {
    const savedSession = localStorage.getItem('mz_admin_session') === 'true';
    return savedSession ? 'dashboard' : 'zati-record';
  });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // QR Receipt Verification Mode
  const [verifyReceiptId, setVerifyReceiptId] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => {
    const savedSession = localStorage.getItem('mz_admin_session') === 'true';
    if (savedSession) {
      return {
        uid: 'admin-abdul-shakoor',
        email: 'abdulshakoor.madni@mzumrah.com',
        name: 'Abdul Shakoor Madni',
        role: 'SUPER ADMIN',
      };
    }
    return {
      uid: 'public-visitor',
      email: 'visitor@mzumrah.com',
      name: 'عوامی ممبر (Visitor)',
      role: 'MEMBER',
    };
  });

  // Database Data States
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettingsState] = useState<CommitteeSettings>({
    organizationName: 'M.Z.A Welfare Pakistan',
    establishedYear: 2019,
    committeeName: 'MZ Umrah Committee',
    receiptPrefix: 'MZ-RCP-',
    membershipPrefix: 'MZ-#',
    defaultMonthlyInstallment: 5000,
    defaultRegistrationFee: 1000,
    fixedDueDay: 15,
    authorizedSignatoryTitle: 'General Secretary',
  });
  const [loading, setLoading] = useState(true);

  // Modals
  const [isQistModalOpen, setIsQistModalOpen] = useState(false);
  const [qistTargetMember, setQistTargetMember] = useState<Member | null>(null);
  const [qistTargetInstallments, setQistTargetInstallments] = useState<Installment[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Check URL parameters for ?verify=receipt_id
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verifyId = urlParams.get('verify');
    if (verifyId) {
      setVerifyReceiptId(verifyId);
    }
  }, []);

  // Fetch all initial data from Firestore
  const loadAllData = async () => {
    try {
      setLoading(true);
      await seedInitialDemoDataIfEmpty();
      const [
        membersData,
        paymentsData,
        receiptsData,
        installmentsData,
        refundsData,
        auditLogsData,
        settingsData,
      ] = await Promise.all([
        getAllMembers(),
        getAllPayments(),
        getAllReceipts(),
        getAllInstallments(),
        getAllRefunds(),
        getAllAuditLogs(),
        getSettings(),
      ]);

      setMembers(membersData);
      setPayments(paymentsData);
      setReceipts(receiptsData);
      setInstallments(installmentsData);
      setRefunds(refundsData);
      setAuditLogs(auditLogsData);
      setSettingsState(settingsData);
    } catch (err) {
      console.error('Error loading Firestore data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Calculated Financial Summary
  const summary = calculateFinancialSummary(members, payments, refunds);

  // Overdue count and today due count
  const overdueCount = installments.filter((i) => isInstallmentOverdue(i)).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDueCount = installments.filter((i) => i.dueDate === todayStr && i.status !== 'Paid').length;

  // Role Switcher Handler (to test Flow 7: Member login, Flow 8: Staff login, etc.)
  const handleSwitchUserRole = (role: UserRole, memberId?: string) => {
    if (role === 'MEMBER') {
      const targetMember = members.find((m) => m.id === memberId) || members[0];
      setCurrentUser({
        uid: targetMember ? targetMember.id : 'member-uid',
        email: targetMember ? `${targetMember.memberNumber.toLowerCase()}@member.mzumrah.com` : 'member@mzumrah.com',
        name: targetMember ? targetMember.fullName : 'Member Account',
        role: 'MEMBER',
        memberId: targetMember?.id,
      });
      setSelectedMemberId(targetMember ? targetMember.id : null);
    } else if (role === 'STAFF') {
      setCurrentUser({
        uid: 'staff-uid-1',
        email: 'staff@mzumrah.com',
        name: 'Kamran Ali (Cashier / Staff)',
        role: 'STAFF',
      });
    } else if (role === 'ADMIN') {
      setCurrentUser({
        uid: 'admin-uid-2',
        email: 'operations@mzumrah.com',
        name: 'Rashid Khan (Committee Admin)',
        role: 'ADMIN',
      });
    } else {
      setCurrentUser({
        uid: 'admin-uid-1',
        email: 'admin@mzumrah.com',
        name: 'M. Zubair (Super Admin)',
        role: 'SUPER ADMIN',
      });
    }
  };

  // Open Qist Wasool Modal - Instant response without blocking network requests
  const handleOpenQistWasool = (member?: Member, targetInstallment?: Installment) => {
    const target = member || (members.length > 0 ? members[0] : null);
    setQistTargetMember(target);
    if (target) {
      // Instantly populate from in-memory state
      const insts = installments.filter((i) => i.memberId === target.id);
      setQistTargetInstallments(insts);
    } else {
      setQistTargetInstallments([]);
    }
    setIsQistModalOpen(true);
  };

  // On payment recorded successfully - Instant UI response
  const handlePaymentSuccess = (receipt: Receipt) => {
    setIsQistModalOpen(false);
    setActiveReceipt(receipt);
    setIsReceiptModalOpen(true);
    // Refresh Firestore data in background
    loadAllData();
  };

  // On member created successfully - Instant UI response
  const handleMemberCreated = (newMember: Member) => {
    setIsAddMemberModalOpen(false);
    setMembers((prev) => [newMember, ...prev]);
    setSelectedMemberId(newMember.id);
    setCurrentPage('profile');
    // Refresh Firestore data in background
    loadAllData();
  };

  // Admin Login and Logout Handlers (Abdul Shakoor Madni)
  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    localStorage.setItem('mz_admin_session', 'true');
    setCurrentUser({
      uid: 'admin-abdul-shakoor',
      email: 'abdulshakoor.madni@mzumrah.com',
      name: 'Abdul Shakoor Madni',
      role: 'SUPER ADMIN',
    });
    setCurrentPage('dashboard');
    setIsAdminLoginModalOpen(false);
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('mz_admin_session');
    setCurrentUser({
      uid: 'public-visitor',
      email: 'visitor@mzumrah.com',
      name: 'عوامی ممبر (Visitor)',
      role: 'MEMBER',
    });
    setCurrentPage('zati-record');
    setSelectedMemberId(null);
  };

  // If viewing a verification QR link
  if (verifyReceiptId) {
    return (
      <ReceiptVerificationView
        receiptId={verifyReceiptId}
        onBackToApp={() => {
          setVerifyReceiptId(null);
          // Remove query param from browser URL cleanly
          window.history.pushState({}, document.title, window.location.pathname);
        }}
      />
    );
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="min-h-screen bg-[#F9FAF8] text-[#1F2937] flex flex-col font-sans selection:bg-emerald-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setSelectedMemberId(null);
        }}
        userRole={currentUser.role}
        onOpenQistWasool={() => handleOpenQistWasool()}
        onOpenAddMember={() => setIsAddMemberModalOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        overdueCount={overdueCount}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Content Area */}
      <div className={`${isAdminLoggedIn ? 'lg:pl-64' : ''} flex-1 flex flex-col`}>
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          onSwitchUserRole={handleSwitchUserRole}
          members={members}
          onSelectMember={(memberId) => {
            setSelectedMemberId(memberId);
            setCurrentPage('profile');
          }}
          overdueCount={overdueCount}
          todayDueCount={todayDueCount}
          onNavigate={(page) => {
            setCurrentPage(page);
            setSelectedMemberId(null);
          }}
          currentPage={currentPage}
          selectedMember={selectedMember}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isAdminLoggedIn={isAdminLoggedIn}
          onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
          onAdminLogout={handleAdminLogout}
        />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-emerald-900">
                Synchronizing MZ Umrah Committee Ledger...
              </p>
            </div>
          ) : !isAdminLoggedIn || currentPage === 'zati-record' ? (
            /* Public Member Record Search Page ("Apna Zati Record Talash Karein") */
            <ZatiRecordPage
              members={members}
              installments={installments}
              receipts={receipts}
              onOpenReceipt={(rec) => {
                setActiveReceipt(rec);
                setIsReceiptModalOpen(true);
              }}
              onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
              isAdminLoggedIn={isAdminLoggedIn}
            />
          ) : selectedMemberId && selectedMember ? (
            /* Member Profile / Full Ledger View */
            <MemberProfilePage
              member={selectedMember}
              onBack={() => {
                setSelectedMemberId(null);
                setCurrentPage('members');
              }}
              onOpenQistWasool={(m, inst) => handleOpenQistWasool(m, inst)}
              onOpenReceipt={(rec) => {
                setActiveReceipt(rec);
                setIsReceiptModalOpen(true);
              }}
              userRole={currentUser.role}
              currentUserEmail={currentUser.email}
              onRefreshMember={loadAllData}
            />
          ) : currentPage === 'dashboard' ? (
            /* Dashboard View */
            <DashboardPage
              members={members}
              payments={payments}
              receipts={receipts}
              refunds={refunds}
              summary={summary}
              installments={installments}
              onOpenQistWasool={handleOpenQistWasool}
              onOpenAddMember={() => setIsAddMemberModalOpen(true)}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
              onOpenReceipt={(rec) => {
                setActiveReceipt(rec);
                setIsReceiptModalOpen(true);
              }}
              onNavigate={(page) => setCurrentPage(page)}
            />
          ) : currentPage === 'members' ? (
            /* All Members View */
            <MembersListPage
              members={members}
              onOpenAddMember={() => setIsAddMemberModalOpen(true)}
              onOpenQistWasool={handleOpenQistWasool}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
              userRole={currentUser.role}
            />
          ) : currentPage === 'plan-24' ? (
            /* 24 Month Committee Members (Rs. 120,000) */
            <MembersListPage
              members={members}
              onOpenAddMember={() => setIsAddMemberModalOpen(true)}
              onOpenQistWasool={handleOpenQistWasool}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
              userRole={currentUser.role}
              initialPlanFilter={24}
            />
          ) : currentPage === 'plan-36' ? (
            /* 36 Month Committee Members (Rs. 180,000) */
            <MembersListPage
              members={members}
              onOpenAddMember={() => setIsAddMemberModalOpen(true)}
              onOpenQistWasool={handleOpenQistWasool}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
              userRole={currentUser.role}
              initialPlanFilter={36}
            />
          ) : currentPage === 'collection' ? (
            /* Qist Wasooli / Collection Dashboard */
            <QistWasooliPage
              payments={payments}
              receipts={receipts}
              onOpenQistWasool={() => handleOpenQistWasool()}
              onOpenReceipt={(rec) => {
                setActiveReceipt(rec);
                setIsReceiptModalOpen(true);
              }}
            />
          ) : currentPage === 'due' ? (
            /* Due Installments (Fixed 15th monthly system) */
            <DueInstallmentsPage
              installments={installments}
              members={members}
              onOpenQistWasool={handleOpenQistWasool}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
            />
          ) : currentPage === 'overdue' ? (
            /* Overdue Installments */
            <DueInstallmentsPage
              installments={installments}
              members={members}
              onOpenQistWasool={handleOpenQistWasool}
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentPage('profile');
              }}
              onlyOverdue={true}
            />
          ) : currentPage === 'receipts' ? (
            /* All Issued Receipts */
            <ReceiptsListPage
              receipts={receipts}
              onOpenReceipt={(rec) => {
                setActiveReceipt(rec);
                setIsReceiptModalOpen(true);
              }}
              onVerifyReceipt={(receiptId) => setVerifyReceiptId(receiptId)}
            />
          ) : currentPage === 'refunds' ? (
            /* Refund Vouchers */
            <RefundsPage
              refunds={refunds}
              members={members}
              currentUserEmail={currentUser.email}
              onRefresh={loadAllData}
            />
          ) : currentPage === 'registration-fees' ? (
            /* Registration Fees Ledger */
            <RegistrationFeesPage members={members} onRefresh={loadAllData} />
          ) : currentPage === 'reports' ? (
            /* Reports & Export */
            <ReportsPage
              members={members}
              payments={payments}
              summary={summary}
              installments={installments}
            />
          ) : currentPage === 'audit-logs' ? (
            /* Audit Logs */
            <AuditLogsPage auditLogs={auditLogs} />
          ) : currentPage === 'settings' ? (
            /* System Settings */
            <SettingsPage
              settings={settings}
              onSaveSettings={async (newSettings) => {
                await saveSettings(newSettings);
                setSettingsState(newSettings);
              }}
              userRole={currentUser.role}
            />
          ) : (
            <div className="p-8 text-center text-slate-500">Page not found</div>
          )}
        </main>
      </div>

      {/* Primary Payment Recording Modal ("QIST WASOOL KAREIN") */}
      <QistWasoolModal
        isOpen={isQistModalOpen}
        onClose={() => setIsQistModalOpen(false)}
        member={qistTargetMember}
        installments={qistTargetInstallments}
        allMembers={members}
        onPaymentSuccess={handlePaymentSuccess}
        staffName={currentUser.name}
      />

      {/* Add New Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onMemberCreated={handleMemberCreated}
        currentUserEmail={currentUser.email}
        existingMembers={members}
      />

      {/* Official Umrah Committee Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receipt={activeReceipt}
      />

      {/* Admin Login Modal (Abdul Shakoor Madni) */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />
    </div>
  );
}

export default App;
