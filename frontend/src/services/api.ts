import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { 
  ApiResponse, 
  PaginatedResponse, 
  LoginRequest, 
  LoginResponse,
  Member,
  Project,
  ProjectDetail,
  Meeting,
  Task,
  DailyWorkLog,
  DailySummary,
  WeeklyReport
} from '@/types'

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<ApiResponse<null>>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    const message = error.response?.data?.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

// ============ 认证相关 ============
export const authApi = {
  login: (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
    api.post('/auth/login', data),
  
  register: (data: { name: string; email: string; password: string }): Promise<ApiResponse<Member>> =>
    api.post('/auth/register', data),
  
  getCurrentUser: (): Promise<ApiResponse<Member>> =>
    api.get('/auth/me'),
  
  changePassword: (data: { old_password: string; new_password: string }): Promise<ApiResponse<null>> =>
    api.put('/auth/change-password', data),
}

// ============ 成员相关 ============
export const membersApi = {
  getList: (params?: { page?: number; page_size?: number; status?: string }): Promise<PaginatedResponse<Member>> =>
    api.get('/members', { params }),
  
  getById: (id: number): Promise<ApiResponse<Member>> =>
    api.get(`/members/${id}`),
  
  create: (data: { name: string; email: string; password: string; role?: string }): Promise<ApiResponse<Member>> =>
    api.post('/members', data),
  
  update: (id: number, data: Partial<Member>): Promise<ApiResponse<Member>> =>
    api.put(`/members/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/members/${id}`),
  
  updateStatus: (id: number, status: 'active' | 'inactive'): Promise<ApiResponse<Member>> =>
    api.patch(`/members/${id}/status`, { status }),
}

// ============ 项目相关 ============
export const projectsApi = {
  getList: (params?: { page?: number; page_size?: number; status?: string }): Promise<PaginatedResponse<Project>> =>
    api.get('/projects', { params }),
  
  getById: (id: number): Promise<ApiResponse<ProjectDetail>> =>
    api.get(`/projects/${id}`),
  
  create: (data: Partial<Project>): Promise<ApiResponse<Project>> =>
    api.post('/projects', data),
  
  update: (id: number, data: Partial<Project>): Promise<ApiResponse<Project>> =>
    api.put(`/projects/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/projects/${id}`),
  
  // 项目成员
  addMember: (projectId: number, data: { member_id: number; role?: string }): Promise<ApiResponse<null>> =>
    api.post(`/projects/${projectId}/members`, data),
  
  removeMember: (projectId: number, memberId: number): Promise<ApiResponse<null>> =>
    api.delete(`/projects/${projectId}/members/${memberId}`),
}

// ============ 会议纪要相关 ============
export const meetingsApi = {
  getList: (params?: { project_id?: number; page?: number; page_size?: number }): Promise<PaginatedResponse<Meeting>> =>
    api.get('/meetings', { params }),
  
  getById: (id: number): Promise<ApiResponse<Meeting>> =>
    api.get(`/meetings/${id}`),
  
  create: (data: Partial<Meeting>): Promise<ApiResponse<Meeting>> =>
    api.post('/meetings', data),
  
  update: (id: number, data: Partial<Meeting>): Promise<ApiResponse<Meeting>> =>
    api.put(`/meetings/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/meetings/${id}`),
}

// ============ 任务相关 ============
export const tasksApi = {
  getList: (params?: { 
    project_id?: number
    assignee_id?: number
    status?: string
    page?: number
    page_size?: number 
  }): Promise<PaginatedResponse<Task>> =>
    api.get('/tasks', { params }),
  
  getById: (id: number): Promise<ApiResponse<Task>> =>
    api.get(`/tasks/${id}`),
  
  create: (data: Partial<Task>): Promise<ApiResponse<Task>> =>
    api.post('/tasks', data),
  
  update: (id: number, data: Partial<Task>): Promise<ApiResponse<Task>> =>
    api.put(`/tasks/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/tasks/${id}`),
  
  updateStatus: (id: number, data: { status: string; comment?: string }): Promise<ApiResponse<Task>> =>
    api.patch(`/tasks/${id}/status`, data),
  
  // 干系人
  addStakeholder: (taskId: number, data: { member_id: number; role: string }): Promise<ApiResponse<null>> =>
    api.post(`/tasks/${taskId}/stakeholders`, data),
  
  removeStakeholder: (taskId: number, memberId: number): Promise<ApiResponse<null>> =>
    api.delete(`/tasks/${taskId}/stakeholders/${memberId}`),
  
  // 我的任务
  getMyTasks: (params?: { status?: string }): Promise<PaginatedResponse<Task>> =>
    api.get('/tasks/my', { params }),
}

// ============ 日报相关 ============
export const dailyLogsApi = {
  // 工作日志
  getLogs: (params?: { 
    member_id?: number
    project_id?: number
    work_date?: string
    page?: number
    page_size?: number 
  }): Promise<PaginatedResponse<DailyWorkLog>> =>
    api.get('/daily-logs/logs', { params }),
  
  createLog: (data: Partial<DailyWorkLog>): Promise<ApiResponse<DailyWorkLog>> =>
    api.post('/daily-logs/logs', data),
  
  updateLog: (id: number, data: Partial<DailyWorkLog>): Promise<ApiResponse<DailyWorkLog>> =>
    api.put(`/daily-logs/logs/${id}`, data),
  
  deleteLog: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/daily-logs/logs/${id}`),
  
  // 每日总结
  getSummaries: (params?: { 
    member_id?: number
    start_date?: string
    end_date?: string
    page?: number
    page_size?: number 
  }): Promise<PaginatedResponse<DailySummary>> =>
    api.get('/daily-logs/summaries', { params }),
  
  getSummaryByDate: (date: string): Promise<ApiResponse<DailySummary>> =>
    api.get(`/daily-logs/summaries/${date}`),
  
  createSummary: (data: Partial<DailySummary>): Promise<ApiResponse<DailySummary>> =>
    api.post('/daily-logs/summaries', data),
  
  updateSummary: (id: number, data: Partial<DailySummary>): Promise<ApiResponse<DailySummary>> =>
    api.put(`/daily-logs/summaries/${id}`, data),
  
  // 快速提交日报
  quickSubmit: (data: {
    work_date: string
    logs: Array<{
      task_id: number
      hours: number
      description: string
      work_type?: string
    }>
    problems?: string
    tomorrow_plan?: string
    notes?: string
  }): Promise<ApiResponse<DailySummary>> =>
    api.post('/daily-logs/quick-submit', data),
  
  // 统计
  getStats: (params?: { member_id?: number; start_date?: string; end_date?: string }): Promise<ApiResponse<{
    total_hours: number
    by_project: Array<{ project_id: number; project_name: string; hours: number }>
    by_type: Array<{ work_type: string; hours: number }>
  }>> =>
    api.get('/daily-logs/stats', { params }),
}

// ============ 周报相关 ============
export const weeklyReportsApi = {
  getList: (params?: { 
    report_type?: string
    member_id?: number
    project_id?: number
    page?: number
    page_size?: number 
  }): Promise<PaginatedResponse<WeeklyReport>> =>
    api.get('/weekly-reports', { params }),
  
  getById: (id: number): Promise<ApiResponse<WeeklyReport>> =>
    api.get(`/weekly-reports/${id}`),
  
  // 生成个人周报
  generatePersonal: (data: { week_start: string; week_end: string }): Promise<ApiResponse<WeeklyReport>> =>
    api.post('/weekly-reports/generate/personal', data),
  
  // 生成项目周报
  generateProject: (data: { project_id: number; week_start: string; week_end: string }): Promise<ApiResponse<WeeklyReport>> =>
    api.post('/weekly-reports/generate/project', data),
  
  update: (id: number, data: Partial<WeeklyReport>): Promise<ApiResponse<WeeklyReport>> =>
    api.put(`/weekly-reports/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<null>> =>
    api.delete(`/weekly-reports/${id}`),
}

export default api
