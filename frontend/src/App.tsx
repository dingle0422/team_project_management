import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/useAuthStore'

// Layout
import AppLayout from '@/components/Layout/AppLayout'

// Pages
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import Tasks from '@/pages/Tasks'
import Daily from '@/pages/Daily'
import Weekly from '@/pages/Weekly'
import Analytics from '@/pages/Analytics'

// 路由守卫
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isInitialized } = useAuthStore()
  
  // 如果还没初始化完成，显示加载状态
  if (!isInitialized) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

export default function App() {
  const { initializeAuth, isInitialized } = useAuthStore()

  // 应用启动时初始化认证状态
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // 等待初始化完成再渲染路由
  if (!isInitialized) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />
      
      {/* 受保护路由 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="daily" element={<Daily />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      
      {/* 404 重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
