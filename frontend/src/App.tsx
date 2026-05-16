import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));

const EmployeeDashboard = lazy(() => import("@/pages/employee/EmployeeDashboard"));
const MyGoals = lazy(() => import("@/pages/employee/MyGoals"));
const QuarterlyUpdate = lazy(() => import("@/pages/employee/QuarterlyUpdate"));

const ManagerDashboard = lazy(() => import("@/pages/manager/ManagerDashboard"));
const ApprovalQueuePage = lazy(() => import("@/pages/manager/ApprovalQueuePage"));
const GoalReviewPage = lazy(() => import("@/pages/manager/GoalReviewPage"));
const TeamGoalsPage = lazy(() => import("@/pages/manager/TeamGoalsPage"));
const CheckinModule = lazy(() => import("@/pages/manager/CheckinModule"));

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const CycleConfigPage = lazy(() => import("@/pages/admin/CycleConfigPage"));
const SharedGoalsPage = lazy(() => import("@/pages/admin/SharedGoalsPage"));
const AuditTrailPage = lazy(() => import("@/pages/admin/AuditTrailPage"));
const ReportsPage = lazy(() => import("@/pages/admin/ReportsPage"));
const GoalUnlockPage = lazy(() => import("@/pages/admin/GoalUnlockPage"));

// ─── Page loading fallback ────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <Skeleton key={k} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Root redirect — role-aware ───────────────────────────────────────────────

function RootRedirect() {
  const { isAuthenticated, hasPermission } = useAuthStore();

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (hasPermission(Permission.CONFIGURE_CYCLE)) return <Navigate to={ROUTES.ADMIN.ROOT} replace />;
  if (hasPermission(Permission.APPROVE_GOAL)) return <Navigate to={ROUTES.MANAGER.ROOT} replace />;
  return <Navigate to={ROUTES.EMPLOYEE.ROOT} replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />

          {/* Employee routes — gated by SUBMIT_GOAL_SHEET (employee-exclusive) */}
          <Route element={<ProtectedRoute requiredPermission={Permission.SUBMIT_GOAL_SHEET} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTES.EMPLOYEE.ROOT} element={<EmployeeDashboard />} />
              <Route path={ROUTES.EMPLOYEE.GOALS} element={<MyGoals />} />
              <Route path={ROUTES.EMPLOYEE.QUARTERLY_UPDATE} element={<QuarterlyUpdate />} />
              <Route path="/employee/*" element={<Navigate to={ROUTES.EMPLOYEE.ROOT} replace />} />
            </Route>
          </Route>

          {/* Manager routes — gated by APPROVE_GOAL */}
          <Route element={<ProtectedRoute requiredPermission={Permission.APPROVE_GOAL} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTES.MANAGER.ROOT} element={<ManagerDashboard />} />
              <Route path={ROUTES.MANAGER.REVIEW} element={<ApprovalQueuePage />} />
              <Route path="/manager/review/:sheetId" element={<GoalReviewPage />} />
              <Route path={ROUTES.MANAGER.TEAM_GOALS} element={<TeamGoalsPage />} />
              <Route path={ROUTES.MANAGER.CHECKIN} element={<CheckinModule />} />
              <Route path="/manager/*" element={<Navigate to={ROUTES.MANAGER.ROOT} replace />} />
            </Route>
          </Route>

          {/* Admin routes — gated by CONFIGURE_CYCLE (admin-exclusive) */}
          <Route element={<ProtectedRoute requiredPermission={Permission.CONFIGURE_CYCLE} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTES.ADMIN.ROOT} element={<AdminDashboard />} />
              <Route path={ROUTES.ADMIN.CYCLES} element={<CycleConfigPage />} />
              <Route path={ROUTES.ADMIN.SHARED_GOALS} element={<SharedGoalsPage />} />
              <Route path={ROUTES.ADMIN.AUDIT} element={<AuditTrailPage />} />
              <Route path={ROUTES.ADMIN.REPORTS} element={<ReportsPage />} />
              <Route path={ROUTES.ADMIN.GOAL_UNLOCK} element={<GoalUnlockPage />} />
              <Route path="/admin/*" element={<Navigate to={ROUTES.ADMIN.ROOT} replace />} />
            </Route>
          </Route>

          {/* Root + catch-all */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
