// 用户/成员类型
export interface Member {
  id: number
  name: string
  email: string
  avatar_url?: string
  role: 'admin' | 'member'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface MemberBrief {
  id: number
  name: string
  avatar_url?: string
}

// 项目类型
export interface Project {
  id: number
  name: string
  code: string
  description?: string
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  start_date?: string
  end_date?: string
  owner_id: number
  owner?: MemberBrief
  created_at: string
  updated_at: string
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
  task_stats?: {
    total: number
    completed: number
    in_progress: number
  }
}

export interface ProjectMember {
  id: number
  member: MemberBrief
  role: 'owner' | 'developer' | 'viewer'
  joined_at: string
}

// 会议纪要类型
export interface Meeting {
  id: number
  project_id: number
  project?: { id: number; name: string; code: string }
  title: string
  meeting_date: string
  location?: string
  summary?: string
  content?: string
  attendee_ids?: number[]
  attendees?: MemberBrief[]
  created_by: number
  creator?: MemberBrief
  created_at: string
  updated_at: string
}

// 任务状态
export type TaskStatus = 'todo' | 'task_review' | 'in_progress' | 'outcome_review' | 'completed' | 'cancelled'

// 任务优先级
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

// 任务类型
export interface Task {
  id: number
  project_id: number
  project?: { id: number; name: string; code: string }
  meeting_id?: number
  meeting?: { id: number; title: string }
  title: string
  description?: string
  assignee_id?: number
  assignee?: MemberBrief
  estimated_hours?: number
  actual_hours?: number
  status: TaskStatus
  priority: TaskPriority
  start_date?: string
  due_date?: string
  completed_at?: string
  parent_task_id?: number
  stakeholders?: TaskStakeholder[]
  created_at: string
  updated_at: string
}

export interface TaskStakeholder {
  id: number
  member: MemberBrief
  role: 'reviewer' | 'collaborator' | 'stakeholder'
}

// 每日工作日志
export interface DailyWorkLog {
  id: number
  member_id: number
  member?: MemberBrief
  task_id: number
  task?: { id: number; title: string }
  project_id: number
  project?: { id: number; name: string; code: string }
  work_date: string
  hours: number
  description: string
  work_type: 'development' | 'design' | 'testing' | 'meeting' | 'research' | 'other'
  created_at: string
  updated_at: string
}

// 每日总结
export interface DailySummary {
  id: number
  member_id: number
  member?: MemberBrief
  summary_date: string
  problems?: string
  tomorrow_plan?: string
  notes?: string
  work_logs?: DailyWorkLog[]
  created_at: string
  updated_at: string
}

// 周报类型
export interface WeeklyReport {
  id: number
  report_type: 'personal' | 'project'
  member_id?: number
  member?: MemberBrief
  project_id?: number
  project?: { id: number; name: string; code: string }
  week_start: string
  week_end: string
  summary: string
  achievements: string
  issues?: string
  next_week_plan?: string
  ai_model?: string
  generated_at: string
  is_reviewed: boolean
  reviewed_by?: number
  reviewer?: MemberBrief
  reviewed_at?: string
  created_at: string
}

// API 响应类型
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginatedResponse<T> {
  code: number
  message: string
  data: PaginatedData<T>
}

// 登录相关
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  member: Member
}

// 统计数据
export interface DashboardStats {
  today_tasks: number
  week_hours: number
  week_completed: number
  active_projects: number
}
