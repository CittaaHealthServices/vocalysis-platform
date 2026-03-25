import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

// Auth Pages
import Login from '../pages/auth/Login'
import ForgotPassword from '../pages/auth/ForgotPassword'
import ResetPassword from '../pages/auth/ResetPassword'

// Layout
import AppLayout from '../components/layout/AppLayout'

// Clinical Pages
import ClinicalDashboard from '../pages/clinical/Dashboard'
import NewAssessment from '../pages/clinical/NewAssessment'
import SessionResults from '../pages/clinical/SessionResults'
import PatientProfile from '../pages/clinical/PatientProfile'
import PatientRegistry from '../pages/clinical/PatientRegistry'
import Consultations from '../pages/clinical/Consultations'
import ClinicalAlerts from '../pages/clinical/ClinicalAlerts'
import ClinicalAnalytics from '../pages/clinical/ClinicalAnalytics'
import ProtocolGuide from '../pages/clinical/ProtocolGuide'

// HR Pages
import HROverview from '../pages/hr/HROverview'
import EmployeeList from '../pages/hr/EmployeeList'
import BulkImport from '../pages/hr/BulkImport'
import HRAlerts from '../pages/hr/HRAlerts'
import HRAnalytics from '../pages/hr/HRAnalytics'
import Scheduling from '../pages/hr/Scheduling'

// Company Pages
import CompanyOverview from '../pages/company/CompanyOverview'
import ManageHRAdmins from '../pages/company/ManageHRAdmins'
import Departments from '../pages/company/Departments'
import CompanySettings from '../pages/company/CompanySettings'
import Billing from '../pages/company/Billing'
import CompanyAPIKeys from '../pages/company/CompanyAPIKeys'

// Employee Pages
import MyWellnessHome from '../pages/employee/Home'
import WellnessCheckIn from '../pages/employee/WellnessCheckIn'
import MyHistory from '../pages/employee/MyHistory'
import Resources from '../pages/employee/Resources'
import MyProfile from '../pages/employee/MyProfile'
import MyConsultations from '../pages/employee/MyConsultations'

// Cittaa Admin Pages
import CittaaAdminOverview from '../pages/cittaa-admin/Overview'
import TenantList from '../pages/cittaa-admin/TenantList'
import TenantDetail from '../pages/cittaa-admin/TenantDetail'
import OnboardWizard from '../pages/cittaa-admin/OnboardWizard'
import CittaaAdminAnalytics from '../pages/cittaa-admin/Analytics'
import APIKeys from '../pages/cittaa-admin/APIKeys'
import HealthMonitor from '../pages/cittaa-admin/HealthMonitor'
import AuditLog from '../pages/cittaa-admin/AuditLog'
import ErrorLog from '../pages/cittaa-admin/ErrorLog'

// Error Pages
import NotFound from '../pages/errors/NotFound'
import Unauthorized from '../pages/errors/Unauthorized'

const ROLES = {
  CITTAA_SUPER_ADMIN: 'CITTAA_SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  SENIOR_CLINICIAN: 'SENIOR_CLINICIAN',
  CLINICAL_PSYCHOLOGIST: 'CLINICAL_PSYCHOLOGIST',
  EMPLOYEE: 'EMPLOYEE',
}

const router = createBrowserRouter([
  // Auth Routes
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/reset-password/:token',
    element: <ResetPassword />,
  },
  {
    path: '/unauthorized',
    element: <Unauthorized />,
  },

  // Clinical Routes
  {
    path: '/clinical',
    element: (
      <ProtectedRoute requiredRoles={[ROLES.SENIOR_CLINICIAN, ROLES.CLINICAL_PSYCHOLOGIST]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <ClinicalDashboard />,
      },
      {
        path: 'patients',
        element: <PatientRegistry />,
      },
      {
        path: 'patients/:id',
        element: <PatientProfile />,
      },
      {
        path: 'assessment/new',
        element: <NewAssessment />,
      },
      {
        path: 'session/:id',
        element: <SessionResults />,
      },
      {
        path: 'alerts',
        element: <ClinicalAlerts />,
      },
      {
        path: 'analytics',
        element: <ClinicalAnalytics />,
      },
      {
        path: 'consultations',
        element: <Consultations />,
      },
      {
        path: 'protocol',
        element: <ProtocolGuide />,
      },
    ],
  },

  // HR Routes
  {
    path: '/hr',
    element: (
      <ProtectedRoute requiredRoles={[ROLES.HR_ADMIN]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HROverview />,
      },
      {
        path: 'employees',
        element: <EmployeeList />,
      },
      {
        path: 'employees/import',
        element: <BulkImport />,
      },
      {
        path: 'alerts',
        element: <HRAlerts />,
      },
      {
        path: 'analytics',
        element: <HRAnalytics />,
      },
      {
        path: 'scheduling',
        element: <Scheduling />,
      },
    ],
  },

  // Company Routes
  {
    path: '/company',
    element: (
      <ProtectedRoute requiredRoles={[ROLES.COMPANY_ADMIN]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <CompanyOverview />,
      },
      {
        path: 'hr-admins',
        element: <ManageHRAdmins />,
      },
      {
        path: 'departments',
        element: <Departments />,
      },
      {
        path: 'settings',
        element: <CompanySettings />,
      },
      {
        path: 'billing',
        element: <Billing />,
      },
      {
        path: 'api-keys',
        element: <CompanyAPIKeys />,
      },
    ],
  },

  // Employee Routes
  {
    path: '/my',
    element: (
      <ProtectedRoute requiredRoles={[ROLES.EMPLOYEE]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <MyWellnessHome />,
      },
      {
        path: 'check-in',
        element: <WellnessCheckIn />,
      },
      {
        path: 'history',
        element: <MyHistory />,
      },
      {
        path: 'resources',
        element: <Resources />,
      },
      {
        path: 'profile',
        element: <MyProfile />,
      },
      {
        path: 'consultations',
        element: <MyConsultations />,
      },
    ],
  },

  // Cittaa Admin Routes
  {
    path: '/cittaa-admin',
    element: (
      <ProtectedRoute requiredRoles={[ROLES.CITTAA_SUPER_ADMIN]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <CittaaAdminOverview />,
      },
      {
        path: 'tenants',
        element: <TenantList />,
      },
      {
        path: 'tenants/:id',
        element: <TenantDetail />,
      },
      {
        path: 'tenants/new',
        element: <OnboardWizard />,
      },
      {
        path: 'analytics',
        element: <CittaaAdminAnalytics />,
      },
      {
        path: 'api-keys',
        element: <APIKeys />,
      },
      {
        path: 'health',
        element: <HealthMonitor />,
      },
      {
        path: 'audit-log',
        element: <AuditLog />,
      },
      {
        path: 'errors',
        element: <ErrorLog />,
      },
    ],
  },

  // Root redirect
  {
    path: '/',
    element: <RootRedirect />,
  },

  // 404
  {
    path: '*',
    element: <NotFound />,
  },
])

function RootRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect based on role
  switch (user.role) {
    case ROLES.CITTAA_SUPER_ADMIN:
      return <Navigate to="/cittaa-admin" replace />
    case ROLES.COMPANY_ADMIN:
      return <Navigate to="/company" replace />
    case ROLES.HR_ADMIN:
      return <Navigate to="/hr" replace />
    case ROLES.SENIOR_CLINICIAN:
    case ROLES.CLINICAL_PSYCHOLOGIST:
      return <Navigate to="/clinical" replace />
    case ROLES.EMPLOYEE:
      return <Navigate to="/my" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

export { useAuth } from '../hooks/useAuth'
export default router
