import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Dropdown, message, Modal, Form, Input } from 'antd'
import type { MenuProps } from 'antd'
import { 
  LockOutlined, 
  LogoutOutlined 
} from '@ant-design/icons'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { authApi } from '@/services/api'

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
  
  // 修改密码弹窗状态
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordForm] = Form.useForm()
  const [changingPassword, setChangingPassword] = useState(false)

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

  // 修改密码
  const handleChangePassword = async (values: { old_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }
    
    setChangingPassword(true)
    try {
      await authApi.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success('密码修改成功')
      setPasswordModalOpen(false)
      passwordForm.resetFields()
    } catch (error: unknown) {
      const err = error as Error
      message.error(err.message || '密码修改失败')
    } finally {
      setChangingPassword(false)
    }
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: '修改密码',
      onClick: () => setPasswordModalOpen(true),
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

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields() }}
        onOk={() => passwordForm.submit()}
        okText="确认修改"
        cancelText="取消"
        confirmLoading={changingPassword}
        width={400}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="old_password"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
