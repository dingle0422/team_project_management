import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Member, LoginResponse } from '@/types'
import { authApi } from '@/services/api'

interface AuthState {
  token: string | null
  user: Member | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchCurrentUser: () => Promise<void>
  setUser: (user: Member) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
