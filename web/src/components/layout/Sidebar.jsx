import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  BarChart3, Users, Settings, AlertCircle, BookOpen, Clock,
  Home, FileText, Key, Activity, TrendingUp, Video,
  DollarSign, Building2, HeartPulse, LogOut,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const ROLE_LABELS = {
  CITTAA_SUPER_ADMIN:    'Super Admin',
  CITTAA_CEO:            'CEO',
  COMPANY_ADMIN:         'Company Admin',
  HR_ADMIN:              'HR Admin',
  SENIOR_CLINICIAN:      'Senior Clinician',
  CLINICAL_PSYCHOLOGIST: 'Clinical Psychologist',
  EAP_PROVIDER:          'EAP Provider',
  EMPLOYEE:              'Employee',
}

const SIDEBAR_ITEMS = {
  CITTAA_SUPER_ADMIN: [
    { label: 'Platform Overview', path: '/cittaa-admin',            icon: BarChart3  },
    { label: 'Tenants',           path: '/cittaa-admin/tenants',    icon: Building2  },
    { label: 'Analytics',         path: '/cittaa-admin/analytics',  icon: TrendingUp },
    { label: 'API Keys',          path: '/cittaa-admin/api-keys',   icon: Key        },
    { label: 'Health Monitor',    path: '/cittaa-admin/health',     icon: Activity   },
    { label: 'Audit Log',         path: '/cittaa-admin/audit-log',  icon: FileText   },
    { label: 'Error Log',         path: '/cittaa-admin/errors',     icon: AlertCircle},
  ],
  CITTAA_CEO: [
    { label: 'Executive Overview', path: '/ceo',    icon: BarChart3  },
    { label: 'Revenue & Growth',   path: '/ceo',    icon: DollarSign },
    { label: 'Client Health',      path: '/ceo',    icon: Building2  },
  ],
  COMPANY_ADMIN: [
    { label: 'Company Overview', path: '/company',            icon: Home      },
    { label: 'HR Admins',        path: '/company/hr-admins',  icon: Users     },
    { label: 'Departments',      path: '/company/departments',icon: BarChart3 },
    { label: 'Settings',         path: '/company/settings',   icon: Settings  },
    { label: 'Billing',          path: '/company/billing',    icon: FileText  },
    { label: 'API Keys',         path: '/company/api-keys',   icon: Key       },
  ],
  HR_ADMIN: [
    { label: 'Overview',    path: '/hr',               icon: Home       },
    { label: 'Employees',   path: '/hr/employees',     icon: Users      },
    { label: 'Alerts',      path: '/hr/alerts',        icon: AlertCircle},
    { label: 'Analytics',   path: '/hr/analytics',     icon: TrendingUp },
    { label: 'Scheduling',  path: '/hr/scheduling',    icon: Clock      },
  ],
  SENIOR_CLINICIAN: [
    { label: 'Dashboard',      path: '/clinical',                  icon: Home       },
    { label: 'Patients',       path: '/clinical/patients',         icon: Users      },
    { label: 'New Assessment', path: '/clinical/assessment/new',   icon: FileText   },
    { label: 'Alerts',         path: '/clinical/alerts',           icon: AlertCircle},
    { label: 'Analytics',      path: '/clinical/analytics',        icon: TrendingUp },
    { label: 'Consultations',  path: '/clinical/consultations',    icon: Clock      },
    { label: 'Protocol Guide', path: '/clinical/protocol',         icon: BookOpen   },
  ],
  CLINICAL_PSYCHOLOGIST: [
    { label: 'Dashboard',      path: '/clinical',                  icon: Home       },
    { label: 'Patients',       path: '/clinical/patients',         icon: Users      },
    { label: 'New Assessment', path: '/clinical/assessment/new',   icon: FileText   },
    { label: 'Alerts',         path: '/clinical/alerts',           icon: AlertCircle},
    { label: 'Analytics',      path: '/clinical/analytics',        icon: TrendingUp },
    { label: 'Consultations',  path: '/clinical/consultations',    icon: Clock      },
    { label: 'Protocol Guide', path: '/clinical/protocol',         icon: BookOpen   },
  ],
  EAP_PROVIDER: [
    { label: 'EAP Hub',        path: '/eap', icon: Home    },
    { label: 'Webinars',       path: '/eap', icon: Video   },
    { label: 'Consultations',  path: '/eap', icon: Clock   },
    { label: 'Resources',      path: '/eap', icon: BookOpen},
  ],
  EMPLOYEE: [
    { label: 'Home',          path: '/my',               icon: Home       },
    { label: 'Check-in',      path: '/my/check-in',      icon: HeartPulse },
    { label: 'History',       path: '/my/history',       icon: BarChart3  },
    { label: 'Resources',     path: '/my/resources',     icon: BookOpen   },
    { label: 'Consultations', path: '/my/consultations', icon: Clock      },
    { label: 'Profile',       path: '/my/profile',       icon: Settings   },
  ],
}

export const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate  = useNavigate()

  const items = SIDEBAR_ITEMS[user?.role] || []
  const roleLabel = ROLE_LABELS[user?.role] || (user?.role || '').replace(/_/g, ' ')

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={clsx(
        'fixed md:relative w-64 h-screen flex flex-col bg-white border-r border-gray-100 overflow-hidden transition-transform duration-300 z-50',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Logo header */}
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Brand logo */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}>
              <span className="text-white font-black text-base leading-none select-none"
                    style={{ fontFamily: "'Kaushan Script', cursive" }}>C</span>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-900 leading-none"
                    style={{ fontFamily: "'Kaushan Script', cursive" }}>Cittaa</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Vocalysis Platform</p>
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3 border-b border-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 flex-shrink-0">
              {(user?.firstName || user?.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : user?.email}
              </p>
              <p className="text-[11px] text-violet-600 font-medium">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {items.map((item) => {
            const Icon  = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.label + item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-violet-50 text-violet-700 font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className={clsx('w-4.5 h-4.5 flex-shrink-0', active ? 'text-violet-600' : 'text-gray-400')} style={{ width: '18px', height: '18px' }} />
                <span className="truncate">{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Footer / logout */}
        <div className="flex-shrink-0 p-3 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
            <span>Sign out</span>
          </button>
          <p className="text-[10px] text-gray-300 text-center mt-2" style={{ fontFamily: "'Kaushan Script', cursive" }}>
            Cittaa Health Services
          </p>
        </div>
      </nav>
    </>
  )
}

export default Sidebar
