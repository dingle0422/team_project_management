import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message, Tabs } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, KeyOutlined, IdcardOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/useAuthStore'
import { authApi, invitationCodesApi } from '@/services/api'
import type { RegisterRequest } from '@/types'
import './index.css'

interface LoginForm {
  email: string
  password: string
}

interface RegisterForm extends RegisterRequest {
  confirmPassword: string
}

export default function Login() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('login')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [invitationCodeValid, setInvitationCodeValid] = useState<boolean | null>(null)
  const [validatingCode, setValidatingCode] = useState(false)

  const handleLogin = async (values: LoginForm) => {
    setError('')
    try {
      await login(values.email, values.password)
      message.success('登录成功')
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    }
  }

  const handleRegister = async (values: RegisterForm) => {
    setError('')
    setRegisterLoading(true)
    try {
      const { confirmPassword, ...registerData } = values
      await authApi.register(registerData)
      message.success('注册成功，请登录')
      // 切换到登录页面并填入邮箱
      setActiveTab('login')
      loginForm.setFieldValue('email', values.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setRegisterLoading(false)
    }
  }

  // 验证邀请码
  const validateInvitationCode = async (code: string) => {
    if (!code || code.length < 6) {
      setInvitationCodeValid(null)
      return
    }
    
    setValidatingCode(true)
    try {
      const response = await invitationCodesApi.validate(code)
      setInvitationCodeValid(response.data.valid)
      if (!response.data.valid && response.data.reason) {
        registerForm.setFields([{
          name: 'invitation_code',
          errors: [response.data.reason]
        }])
      }
    } catch {
      setInvitationCodeValid(false)
    } finally {
      setValidatingCode(false)
    }
  }

  const tabItems = [
    {
      key: 'login',
      label: '登录',
      children: (
        <>
          {error && activeTab === 'login' && (
            <div className="login-error">{error}</div>
          )}

          <Form
            form={loginForm}
            onFinish={handleLogin}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="邮箱地址"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <div className="login-footer">
            <p>
              测试账号: <code>admin@example.com</code> / <code>admin123</code>
            </p>
          </div>
        </>
      ),
    },
    {
      key: 'register',
      label: '注册',
      children: (
        <>
          {error && activeTab === 'register' && (
            <div className="login-error">{error}</div>
          )}

          <Form
            form={registerForm}
            onFinish={handleRegister}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="invitation_code"
              rules={[
                { required: true, message: '请输入邀请码' },
                { min: 6, message: '邀请码至少6个字符' },
              ]}
              validateStatus={
                validatingCode ? 'validating' : 
                invitationCodeValid === true ? 'success' : 
                invitationCodeValid === false ? 'error' : undefined
              }
              hasFeedback
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="邀请码"
                onChange={(e) => {
                  setInvitationCodeValid(null)
                }}
                onBlur={(e) => validateInvitationCode(e.target.value)}
              />
            </Form.Item>

            <Form.Item
              name="name"
              rules={[
                { required: true, message: '请输入姓名' },
                { max: 50, message: '姓名最多50个字符' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="姓名"
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="邮箱地址"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
              />
            </Form.Item>

            <Form.Item
              name="job_title"
            >
              <Input
                prefix={<IdcardOutlined />}
                placeholder="职位（选填）"
              />
            </Form.Item>

            <Form.Item
              name="phone"
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="手机号（选填）"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={registerLoading}
                block
              >
                注册
              </Button>
            </Form.Item>
          </Form>

          <div className="login-footer">
            <p>需要管理员提供的邀请码才能注册</p>
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🚀</span>
            <h1>算法团队</h1>
          </div>
          <p className="login-subtitle">项目管理系统</p>
        </div>

        <div className="login-card">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key)
              setError('')
            }}
            items={tabItems}
            centered
          />
        </div>
      </div>
    </div>
  )
}
