import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Dropdown, Badge, message } from 'antd'
import type { MenuProps } from 'antd'
import { 
  BellOutlined, 
  UserOutlined, 
  SettingOutlined, 
  LogoutOutlined 
} from '@ant-design/icons'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'

const navItems = [
  { key: 'dashboard', label: '工作台', path: '/' },
  { key: 'projects', label: '项目', path: '/projects' },
  { key: 'tasks', label: '任务', path: '/tasks' },
  { key: 'daily', label: '日报', path: '/daily' },
  { key: 'weekly', label: '周报', path: '/weekly' },
  { key: 'analytics', label: '看板', path: '/analytics' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAuthenticated, fetchCurrentUser } = useAuthStore()
  const { fetchProjects, fetchMembers } = useAppStore()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    // 初始化加载数据
    fetchCurrentUser()
    fetchProjects()
    fetchMembers()
  }, [isAuthenticated, navigate, fetchCurrentUser, fetchProjects, fetchMembers])

  const handleLogout = () => {
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  const getActiveKey = () => {
    const path = location.pathname
    if (path === '/') return 'dashboard'
    const item = navItems.find(item => path.startsWith(item.path) && item.path !== '/')
    return item?.key || 'dashboard'
  }

  const activeKey = getActiveKey()

  return (
    <div className="app-layout">
      {/* 顶部导航 */}
      <header className="app-header">
        <div className="header-left">
          <Link to="/" className="logo">
            <span className="logo-icon">🚀</span>
            <span>算法团队</span>
          </Link>
          <nav className="header-nav">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="header-right">
          <Badge count={3} size="small">
            <button className="btn btn-ghost" style={{ fontSize: 18 }}>
              <BellOutlined />
            </button>
          </Badge>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="user-menu">
              <div className="user-avatar">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="user-name">{user?.name || '用户'}</span>
            </div>
          </Dropdown>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
