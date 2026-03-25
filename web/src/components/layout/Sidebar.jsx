import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  BarChart3,
  Users,
  Settings,
  AlertCircle,
  BookOpen,
  Clock,
  Home,
  FileText,
  Key,
  Activity,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useState } from 'react'

const SIDEBAR_ITEMS = {
  CITTAA_SUPER_ADMIN: [
    { label: 'Platform Overview', path: '/cittaa-admin', icon: BarChart3 },
    { label: 'Tenants', path: '/cittaa-admin/tenants', icon: Users },
    { label: 'Analytics', path: '/cittaa-admin/analytics', icon: TrendingUp },
    { label: 'API Keys', path: '/cittaa-admin/api-keys', icon: Key },
    { label: 'Health Monitor', path: '/cittaa-admin/health', icon: Activity },
    { label: 'Audit Log', path: '/cittaa-admin/audit-log', icon: FileText },
    { label: 'Error Log', path: '/cittaa-admin/errors', icon: AlertCircle },
  ],
  COMPANY_ADMIN: [
    { label: 'Company Overview', path: '/company', icon: Home },
    { label: 'HR Admins', path: '/company/hr-admins', icon: Users },
    { label: 'Departments', path: '/company/departments', icon: BarChart3 },
    { label: 'Settings', path: '/company/settings', icon: Settings },
    { label: 'Billing', path: '/company/billing', icon: FileText },
    { label: 'API Keys', path: '/company/api-keys', icon: Key },
  ],
  HR_ADMIN: [
    { label: 'Overview', path: '/hr', icon: Home },
    { label: 'Employees', path: '/hr/employees', icon: Users },
    { label: 'Alerts', path: '/hr/alerts', icon: AlertCircle },
    { label: 'Analytics', path: '/hr/analytics', icon: TrendingUp },
    { label: 'Scheduling', path: '/hr/scheduling', icon: Clock },
  ],
  SENIOR_CLINICIAN: [
    { label: 'Dashboard', path: '/clinical', icon: Home },
    { label: 'Patients', path: '/clinical/patients', icon: Users },
    { label: 'New Assessment', path: '/clinical/assessment/new', icon: FileText },
    { label: 'Alerts', path: '/clinical/alerts', icon: AlertCircle },
    { label: 'Analytics', path: '/clinical/analytics', icon: TrendingUp },
    { label: 'Consultations', path: '/clinical/consultations', icon: Clock },
    { label: 'Protocol Guide', path: '/clinical/protocol', icon: BookOpen },
  ],
  CLINICAL_PSYCHOLOGIST: [
    { label: 'Dashboard', path: '/clinical', icon: Home },
    { label: 'Patients', path: '/clinical/patients', icon: Users },
    { label: 'New Assessment', path: '/clinical/assessment/new', icon: FileText },
    { label: 'Alerts', path: '/clinical/alerts', icon: AlertCircle },
    { label: 'Analytics', path: '/clinical/analytics', icon: TrendingUp },
    { label: 'Consultations', path: '/clinical/consultations', icon: Clock },
    { label: 'Protocol Guide', path: '/clinical/protocol', icon: BookOpen },
  ],
  EMPLOYEE: [
    { label: 'Home', path: '/my', icon: Home },
    { label: 'Check-in', path: '/my/check-in', icon: BarChart3 },
    { label: 'History', path: '/my/history', icon: FileText },
    { label: 'Resources', path: '/my/resources', icon: BookOpen },
    { label: 'Consultations', path: '/my/consultations', icon: Clock },
    { label: 'Profile', path: '/my/profile', icon: Settings },
  ],
}

export const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const items = SIDEBAR_ITEMS[user?.role] || []

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={clsx(
          'fixed md:relative w-64 h-screen bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-300 z-50',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cittaa-700 flex items-center justify-center">
              <span className="text-white font-bold">V</span>
            </div>
            <div>
              <h1 className="font-bold text-app text-lg">Vocalysis</h1>
              <p className="text-xs text-gray-500">Platform 2.0</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setMobileOpen(false)
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition',
                  isActive(item.path)
                    ? 'bg-cittaa-50 text-cittaa-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            {user?.name} • {user?.role?.replace(/_/g, ' ')}
          </p>
        </div>
      </nav>
    </>
  )
}

export default Sidebar
