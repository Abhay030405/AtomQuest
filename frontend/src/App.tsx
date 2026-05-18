import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES, ROUTE_PATTERNS } from "@/constants/routes";
import { logRouteChange } from "@/utils/devRouteLogger";

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
const PersonnelPage = lazy(() => import("@/pages/admin/PersonnelPage"));
const NewPersonnelPage = lazy(() => import("@/pages/admin/NewPersonnelPage"));
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
  const { isAuthenticated, hasPermission, currentUser } = useAuthStore();

  if (!currentUser?.id) return <Navigate to={ROUTES.LOGIN} replace />;

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (hasPermission(Permission.CONFIGURE_CYCLE)) return <Navigate to={ROUTES.ADMIN.ROOT(currentUser.id)} replace />;
  if (hasPermission(Permission.APPROVE_GOAL)) return <Navigate to={ROUTES.MANAGER.ROOT(currentUser.id)} replace />;
  return <Navigate to={ROUTES.EMPLOYEE.ROOT(currentUser.id)} replace />;
}

function RolePathRedirect({ role }: { role: "employee" | "manager" | "admin" }) {
  const { currentUser, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !currentUser?.id) return <Navigate to={ROUTES.LOGIN} replace />;
  if (role === "admin") return <Navigate to={ROUTES.ADMIN.ROOT(currentUser.id)} replace />;
  if (role === "manager") return <Navigate to={ROUTES.MANAGER.ROOT(currentUser.id)} replace />;
  return <Navigate to={ROUTES.EMPLOYEE.ROOT(currentUser.id)} replace />;
}

function RouteLogger() {
  const location = useLocation();

  useEffect(() => {
    logRouteChange(location.pathname);
  }, [location.pathname]);

  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <RouteLogger />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />

          {/* Employee routes — gated by SUBMIT_GOAL_SHEET (employee-exclusive) */}
          <Route element={<ProtectedRoute requiredPermission={Permission.SUBMIT_GOAL_SHEET} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTE_PATTERNS.EMPLOYEE.ROOT} element={<EmployeeDashboard />} />
              <Route path={ROUTE_PATTERNS.EMPLOYEE.GOALS} element={<MyGoals />} />
              <Route path={ROUTE_PATTERNS.EMPLOYEE.QUARTERLY_UPDATE} element={<QuarterlyUpdate />} />
            </Route>
          </Route>

          <Route path="/employee/*" element={<RolePathRedirect role="employee" />} />

          {/* Manager routes — gated by APPROVE_GOAL */}
          <Route element={<ProtectedRoute requiredPermission={Permission.APPROVE_GOAL} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTE_PATTERNS.MANAGER.ROOT} element={<ManagerDashboard />} />
              <Route path={ROUTE_PATTERNS.MANAGER.REVIEW} element={<ApprovalQueuePage />} />
              <Route path={ROUTE_PATTERNS.MANAGER.REVIEW_SHEET} element={<GoalReviewPage />} />
              <Route path={ROUTE_PATTERNS.MANAGER.TEAM_GOALS} element={<TeamGoalsPage />} />
              <Route path={ROUTE_PATTERNS.MANAGER.CHECKIN} element={<CheckinModule />} />
            </Route>
          </Route>

          <Route path="/manager/*" element={<RolePathRedirect role="manager" />} />

          {/* Admin routes — gated by CONFIGURE_CYCLE (admin-exclusive) */}
          <Route element={<ProtectedRoute requiredPermission={Permission.CONFIGURE_CYCLE} />}>
            <Route element={<AppShell />}>
              <Route path={ROUTE_PATTERNS.ADMIN.ROOT} element={<AdminDashboard />} />
              <Route path={ROUTE_PATTERNS.ADMIN.PERSONNEL} element={<PersonnelPage />} />
              <Route
                path={ROUTE_PATTERNS.ADMIN.PERSONNEL_NEW_EMPLOYEE}
                element={<NewPersonnelPage role="employee" />}
              />
              <Route
                path={ROUTE_PATTERNS.ADMIN.PERSONNEL_NEW_MANAGER}
                element={<NewPersonnelPage role="manager" />}
              />
              <Route path={ROUTE_PATTERNS.ADMIN.CYCLES} element={<CycleConfigPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN.SHARED_GOALS} element={<SharedGoalsPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN.AUDIT} element={<AuditTrailPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN.REPORTS} element={<ReportsPage />} />
              <Route path={ROUTE_PATTERNS.ADMIN.GOAL_UNLOCK} element={<GoalUnlockPage />} />
            </Route>
          </Route>

          <Route path="/admin/*" element={<RolePathRedirect role="admin" />} />

          {/* Root + catch-all */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
