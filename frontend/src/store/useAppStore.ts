import { create } from 'zustand'
import type { Project, Task, Member, Meeting } from '@/types'
import { projectsApi, tasksApi, membersApi, meetingsApi } from '@/services/api'

interface AppState {
  // 项目
  projects: Project[]
  projectsLoading: boolean
  fetchProjects: () => Promise<void>
  
  // 任务
  tasks: Task[]
  myTasks: Task[]
  tasksLoading: boolean
  fetchTasks: (params?: { project_id?: number; status?: string }) => Promise<void>
  fetchMyTasks: () => Promise<void>
  
  // 成员
  members: Member[]
  membersLoading: boolean
  fetchMembers: () => Promise<void>
  
  // 会议
  meetings: Meeting[]
  meetingsLoading: boolean
  fetchMeetings: (projectId?: number) => Promise<void>
  
  // 通用
  clearAll: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // 项目
  projects: [],
  projectsLoading: false,
  fetchProjects: async () => {
    set({ projectsLoading: true })
    try {
      const response = await projectsApi.getList({ page_size: 100 })
      set({ projects: response.data.items, projectsLoading: false })
    } catch {
      set({ projectsLoading: false })
    }
  },
  
  // 任务
  tasks: [],
  myTasks: [],
  tasksLoading: false,
  fetchTasks: async (params) => {
    set({ tasksLoading: true })
    try {
      const response = await tasksApi.getList({ ...params, page_size: 100 })
      set({ tasks: response.data.items, tasksLoading: false })
    } catch {
      set({ tasksLoading: false })
    }
  },
  fetchMyTasks: async () => {
    set({ tasksLoading: true })
    try {
      const response = await tasksApi.getMyTasks()
      set({ myTasks: response.data.items, tasksLoading: false })
    } catch {
      set({ tasksLoading: false })
    }
  },
  
  // 成员
  members: [],
  membersLoading: false,
  fetchMembers: async () => {
    set({ membersLoading: true })
    try {
      const response = await membersApi.getList({ page_size: 100 })
      set({ members: response.data.items, membersLoading: false })
    } catch {
      set({ membersLoading: false })
    }
  },
  
  // 会议
  meetings: [],
  meetingsLoading: false,
  fetchMeetings: async (projectId) => {
    set({ meetingsLoading: true })
    try {
      const response = await meetingsApi.getList({ project_id: projectId, page_size: 100 })
      set({ meetings: response.data.items, meetingsLoading: false })
    } catch {
      set({ meetingsLoading: false })
    }
  },
  
  // 通用
  clearAll: () => {
    set({
      projects: [],
      tasks: [],
      myTasks: [],
      members: [],
      meetings: [],
    })
  },
}))
