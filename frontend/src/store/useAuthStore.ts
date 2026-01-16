import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Member, LoginResponse } from '@/types'
import { authApi } from '@/services/api'

interface AuthState {
  token: string | null
  user: Member | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean  // 标记初始化是否完成
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchCurrentUser: () => Promise<void>
  setUser: (user: Member) => void
  initializeAuth: () => Promise<void>  // 初始化认证状态
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          // axios 拦截器已返回 response.data，直接就是 LoginResponse
          const { access_token, user } = await authApi.login({ email, password }) as unknown as LoginResponse
          
          localStorage.setItem('token', access_token)
          
          set({
            token: access_token,
            user: user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
      },

      fetchCurrentUser: async () => {
        const { token } = get()
        if (!token) return

        set({ isLoading: true })
        try {
          const response = await authApi.getCurrentUser()
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          get().logout()
          set({ isLoading: false })
        }
      },

      setUser: (user: Member) => {
        set({ user })
      },

      // 应用启动时初始化认证状态
      initializeAuth: async () => {
        const { token, user, isInitialized } = get()
        
        // 如果已经初始化过，直接返回
        if (isInitialized) return
        
        // 如果有 token 和 user 信息（从持久化存储恢复），设置认证状态
        if (token && user) {
          set({ isAuthenticated: true, isInitialized: true })
          
          // 后台验证 token 有效性（静默验证，不影响用户体验）
          try {
            const response = await authApi.getCurrentUser()
            set({ user: response.data })
          } catch {
            // token 无效，清除登录状态
            get().logout()
          }
        } else {
          set({ isInitialized: true })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
