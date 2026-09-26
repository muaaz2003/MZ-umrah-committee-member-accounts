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
  updateMemberRegistrationFeeStatus,
  deleteMemberCompletely,
  DEFAULT_SETTINGS,
} from './services/firebaseService';
import { calculateFinancialSummary, isInstallmentOverdue } from './utils/calculations';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { QistWasoolModal } from './components/QistWasoolModal';
import { ReceiptModal } from './components/ReceiptModal';
import { AddMemberModal } from './components/AddMemberModal';
import { DeleteMemberModal } from './components/DeleteMemberModal';
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
  const [settings, setSettingsState] = useState<CommitteeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isQistModalOpen, setIsQistModalOpen] = useState(false);
  const [qistTargetMember, setQistTargetMember] = useState<Member | null>(null);
  const [qistTargetInstallments, setQistTargetInstallments] = useState<Installment[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
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

  // Fetch data from Firestore.
  // showSpinner = true ONLY on the initial app mount. Subsequent updates refresh silently in background.
  const loadAllData = async (showSpinner: boolean = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
        await seedInitialDemoDataIfEmpty();
      }
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

      setMembers(membersData || []);
      setPayments(paymentsData || []);
      setReceipts(receiptsData || []);
      setInstallments(installmentsData || []);
      setRefunds(refundsData || []);
      setAuditLogs(auditLogsData || []);
      if (settingsData) {
        setSettingsState(settingsData);
      }
    } catch (err) {
      console.error('Error loading Firestore data:', err);
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllData(true);
  }, []);

  // Instant optimistic toggle for Registration Fee (Unpaid <-> Paid)
  const handleToggleMemberRegistrationFee = async (memberId: string, nextStatus: 'Paid' | 'Unpaid') => {
    // 1. Instant optimistic state update: 0ms UI delay, no spinner, no full-screen reload!
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, registrationFeeStatus: nextStatus } : m))
    );

    // 2. Persist to Firestore in background
    try {
      await updateMemberRegistrationFeeStatus(memberId, nextStatus);
      // Silent refresh without spinner
      loadAllData(false);
    } catch (err) {
      console.error('Failed to update registration fee in Firestore:', err);
      loadAllData(false);
    }
  };

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
    const target = member || null;
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
    // Refresh Firestore data silently in background WITHOUT full-page spinner
    loadAllData(false);
  };

  // On member created successfully - Instant UI response
  const handleMemberCreated = (newMember: Member) => {
    setIsAddMemberModalOpen(false);
    setMemberToEdit(null);
    setMembers((prev) => [newMember, ...prev]);
    setSelectedMemberId(newMember.id);
    setCurrentPage('profile');
    // Refresh Firestore data silently in background
    loadAllData(false);
  };

  // Open Add Member Form Modal
  const handleOpenAddMember = () => {
    setMemberToEdit(null);
    setIsAddMemberModalOpen(true);
  };

  // Open Edit Member Form Modal
  const handleOpenEditMember = (member: Member) => {
    setMemberToEdit(member);
    setIsAddMemberModalOpen(true);
  };

  // Open Delete Member Confirmation (Surety) Modal
  const handleOpenDeleteMember = (member: Member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  // On member updated successfully - Instant UI response
  const handleMemberUpdated = (updatedMember: Member) => {
    setIsAddMemberModalOpen(false);
    setMemberToEdit(null);
    // Instant optimistic update
    setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
    // Refresh Firestore data silently in background
    loadAllData(false);
  };

  // Confirm complete deletion of member and all associated records
  const handleConfirmDeleteMember = async (memberId: string) => {
    try {
      setIsDeletingMember(true);
      // 1. Instant optimistic UI deletion
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setInstallments((prev) => prev.filter((i) => i.memberId !== memberId));
      setPayments((prev) => prev.filter((p) => p.memberId !== memberId));
      setReceipts((prev) => prev.filter((r) => r.memberId !== memberId));
      setRefunds((prev) => prev.filter((rf) => rf.memberId !== memberId));

      if (selectedMemberId === memberId) {
        setSelectedMemberId(null);
        setCurrentPage('members');
      }

      // 2. Perform Firestore complete batch delete
      await deleteMemberCompletely(memberId, currentUser.email);

      setIsDeletingMember(false);
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);

      // 3. Silent background refresh
      loadAllData(false);
    } catch (err) {
      console.error('Failed to delete member:', err);
      setIsDeletingMember(false);
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
      loadAllData(false);
    }
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
        onOpenAddMember={handleOpenAddMember}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        overdueCount={overdueCount}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Content Area: lg:pl-64 ensures desktop layout is never hidden behind sidebar */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
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
              onRefreshMember={() => loadAllData(false)}
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
              onOpenAddMember={handleOpenAddMember}
              onOpenEditMember={handleOpenEditMember}
              onOpenDeleteMember={handleOpenDeleteMember}
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
              onOpenAddMember={handleOpenAddMember}
              onOpenEditMember={handleOpenEditMember}
              onOpenDeleteMember={handleOpenDeleteMember}
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
              onOpenAddMember={handleOpenAddMember}
              onOpenEditMember={handleOpenEditMember}
              onOpenDeleteMember={handleOpenDeleteMember}
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
              onOpenAddMember={handleOpenAddMember}
              onOpenEditMember={handleOpenEditMember}
              onOpenDeleteMember={handleOpenDeleteMember}
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
            <RegistrationFeesPage
              members={members}
              onRefresh={() => loadAllData(false)}
              onToggleFeeStatus={handleToggleMemberRegistrationFee}
            />
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
        allInstallments={installments}
        onPaymentSuccess={handlePaymentSuccess}
        staffName={currentUser.name}
      />

      {/* Add / Edit Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setMemberToEdit(null);
        }}
        onMemberCreated={handleMemberCreated}
        onMemberUpdated={handleMemberUpdated}
        memberToEdit={memberToEdit}
        currentUserEmail={currentUser.email}
        existingMembers={members}
      />

      {/* Delete Member Confirmation (Surety) Modal */}
      <DeleteMemberModal
        isOpen={isDeleteModalOpen}
        member={memberToDelete}
        onClose={() => {
          if (!isDeletingMember) {
            setIsDeleteModalOpen(false);
            setMemberToDelete(null);
          }
        }}
        onConfirmDelete={handleConfirmDeleteMember}
        isDeleting={isDeletingMember}
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
        adminPassword={settings.adminPassword}
      />
    </div>
  );
}

export default App;
