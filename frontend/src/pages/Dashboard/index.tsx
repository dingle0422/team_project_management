import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Modal, Form, Input, Select, InputNumber, DatePicker, Popconfirm, message, Spin, Tag, Avatar, Checkbox } from 'antd'
import { PlusOutlined, EditOutlined, CalendarOutlined, DeleteOutlined, BellOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { tasksApi, dailyLogsApi, meetingsApi, notificationsApi } from '@/services/api'
import type { Task, DailyWorkLog, Meeting, DailySummary, Notification, TaskDetail } from '@/types'
import './index.css'

// 扩展 dayjs 以支持 ISO 周
dayjs.extend(isoWeek)

// 近期事项类型定义
type RecentItemType = 'task_start' | 'task_due' | 'approval' | 'mention'

interface RecentItem {
  id: string
  type: RecentItemType
  title: string
  subtitle?: string
  date?: string
  taskId?: number
  notificationId?: number
  link?: string
  priority?: string
  projectName?: string
  isValid?: boolean  // 是否有效（任务是否还存在/待处理）
}

const { TextArea } = Input

// 工作类型配置
const WORK_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  development: { label: '开发', color: '#3B82F6' },
  design: { label: '设计', color: '#8B5CF6' },
  testing: { label: '测试', color: '#10B981' },
  meeting: { label: '会议', color: '#F59E0B' },
  research: { label: '研究', color: '#EC4899' },
  other: { label: '其他', color: '#6B7280' },
}

// 获取问候语
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

// 格式化日期
const formatDate = () => {
  return dayjs().format('YYYY年M月D日，dddd')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, myTasks, fetchMyTasks, fetchMeetings, meetings } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ todayTasks: 0, weekHours: 0, weekCompleted: 0, activeProjects: 0 })
  const [todayLogs, setTodayLogs] = useState<DailyWorkLog[]>([])
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null)
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [selectedLog, setSelectedLog] = useState<DailyWorkLog | null>(null)
  
  // 近期事项状态
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [weekOffset, setWeekOffset] = useState(0)  // 0 表示当前周（前后各1周），正数表示未来，负数表示过去
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())  // 选中的事项ID
  const [batchMode, setBatchMode] = useState(false)  // 批量处理模式
  const [allMyTasks, setAllMyTasks] = useState<Task[]>([])  // 所有任务缓存
  
  // 弹窗状态
  const [dailyModalOpen, setDailyModalOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [meetingDetailModalOpen, setMeetingDetailModalOpen] = useState(false)
  const [logDetailModalOpen, setLogDetailModalOpen] = useState(false)
  const [editLogModalOpen, setEditLogModalOpen] = useState(false)
  const [editMeetingModalOpen, setEditMeetingModalOpen] = useState(false)
  const [dailyForm] = Form.useForm()
  const [meetingForm] = Form.useForm()
  const [editLogForm] = Form.useForm()
  const [editMeetingForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  // 当周偏移量变化时重新加载近期事项
  useEffect(() => {
    if (!loading && allMyTasks.length > 0) {
      loadRecentItems()
    }
  }, [weekOffset])

  const loadData = async () => {
    setLoading(true)
    try {
      await fetchMyTasks()
      
      // 获取今日工作日志（只获取当前用户自己的）
      const today = dayjs().format('YYYY-MM-DD')
      const currentUserId = useAuthStore.getState().user?.id
      
      // 获取本周的开始和结束日期（用于统计）
      const weekStart = dayjs().startOf('isoWeek').format('YYYY-MM-DD')
      const weekEnd = dayjs().endOf('isoWeek').format('YYYY-MM-DD')
      
      const [logsRes, summariesRes, meetingsRes, statsRes, tasksRes] = await Promise.all([
        dailyLogsApi.getLogs({ 
          start_date: today, 
          end_date: today,
          member_id: currentUserId 
        }),
        dailyLogsApi.getSummaries({
          member_id: currentUserId,
          start_date: today,
          end_date: today,
        }),
        meetingsApi.getList({ page_size: 5 }),
        dailyLogsApi.getStats({ 
          start_date: weekStart, 
          end_date: weekEnd 
        }),
        // 获取所有我的任务
        tasksApi.getMyTasks({ page_size: 200 }),
      ])
      
      setTodayLogs(logsRes.data.items)
      setTodaySummary(summariesRes.data.items?.[0] || null)
      setRecentMeetings(meetingsRes.data.items)
      
      const tasksData = tasksRes.data.items || []
      setAllMyTasks(tasksData)
      
      setStats({
        todayTasks: tasksData.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
        weekHours: statsRes.data.total_hours || 0,
        weekCompleted: tasksData.filter(t => t.status === 'done').length,
        activeProjects: projects.filter(p => p.status === 'active').length,
      })
      
      // 加载近期事项
      await loadRecentItems(tasksData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载近期事项（分离出来以便周切换时调用）
  const loadRecentItems = async (tasksData?: Task[]) => {
    try {
      const tasks = tasksData || allMyTasks
      
      // 计算时间窗口：以当前日期为中心，前后各1周（共2周）
      // weekOffset 控制这个窗口的偏移
      const centerDate = dayjs().add(weekOffset, 'week')
      const windowStart = centerDate.subtract(1, 'week').startOf('day')
      const windowEnd = centerDate.add(1, 'week').endOf('day')
      
      console.log('Time window:', windowStart.format('YYYY-MM-DD'), 'to', windowEnd.format('YYYY-MM-DD'))
      console.log('Tasks count:', tasks.length)
      
      // 获取通知
      const notificationsRes = await notificationsApi.getList({ 
        page_size: 100,
        unread_only: false 
      })
      
      const items: RecentItem[] = []
      
      // 判断日期是否在时间窗口内（包含边界）
      const isInWindow = (dateStr: string) => {
        const date = dayjs(dateStr).startOf('day')
        return (date.isAfter(windowStart) || date.isSame(windowStart, 'day')) && 
               (date.isBefore(windowEnd) || date.isSame(windowEnd, 'day'))
      }
      
      // 1. 时间窗口内开始的任务（待完成标签）
      const windowStartTasks = tasks.filter(task => {
        if (!task.start_date) return false
        return isInWindow(task.start_date)
      }).filter(task => task.status !== 'done' && task.status !== 'cancelled')
      
      console.log('Window start tasks:', windowStartTasks.length, windowStartTasks.map(t => ({ title: t.title, start_date: t.start_date })))
      
      windowStartTasks.forEach(task => {
        items.push({
          id: `task_start_${task.id}`,
          type: 'task_start',
          title: task.title,
          subtitle: task.project?.name,
          date: task.start_date,
          taskId: task.id,
          priority: task.priority,
          projectName: task.project?.name,
          isValid: true,
        })
      })
      
      // 2. 时间窗口内到期的任务（到期预警标签）
      const windowDueTasks = tasks.filter(task => {
        if (!task.due_date) return false
        return isInWindow(task.due_date)
      }).filter(task => task.status !== 'done' && task.status !== 'cancelled')
      
      console.log('Window due tasks:', windowDueTasks.length, windowDueTasks.map(t => ({ title: t.title, due_date: t.due_date })))
      
      windowDueTasks.forEach(task => {
        const existingIndex = items.findIndex(item => item.taskId === task.id && item.type === 'task_start')
        if (existingIndex === -1) {
          items.push({
            id: `task_due_${task.id}`,
            type: 'task_due',
            title: task.title,
            subtitle: task.project?.name,
            date: task.due_date,
            taskId: task.id,
            priority: task.priority,
            projectName: task.project?.name,
            isValid: true,
          })
        } else {
          items[existingIndex].type = 'task_due'
        }
      })
      
      // 3. 审核提醒 - 不受时间窗口限制，只检查任务是否仍有待审核状态
      const approvalNotifications = notificationsRes.data.items.filter(
        (n: Notification) => (n.notification_type === 'review' || n.notification_type === 'approval_request') && !n.is_read
      )
      
      // 检查每个审核通知对应的任务状态
      for (const notification of approvalNotifications) {
        // 检查任务是否仍需审核
        if (notification.content_type === 'task') {
          const relatedTask = tasks.find(t => t.id === notification.content_id)
          // 如果任务不存在，或已完成/取消，或不在评审状态，则跳过
          if (!relatedTask) {
            // 任务可能不在我的任务列表中，尝试获取任务详情
            try {
              const taskRes = await tasksApi.getById(notification.content_id)
              const taskDetail = taskRes.data as TaskDetail
              // 检查是否有待审批信息
              if (!taskDetail.pending_approval && 
                  taskDetail.status !== 'task_review' && 
                  taskDetail.status !== 'result_review') {
                continue  // 任务已不需要审核
              }
            } catch {
              continue  // 任务已删除或无权访问
            }
          } else {
            // 任务在列表中，检查状态
            if (relatedTask.status === 'done' || relatedTask.status === 'cancelled') {
              continue
            }
            // 检查是否仍在评审状态
            if (relatedTask.status !== 'task_review' && relatedTask.status !== 'result_review') {
              continue
            }
          }
        }
        
        items.push({
          id: `approval_${notification.id}`,
          type: 'approval',
          title: notification.title,
          subtitle: notification.message,
          date: notification.created_at,
          notificationId: notification.id,
          taskId: notification.content_type === 'task' ? notification.content_id : undefined,
          link: notification.link,
          isValid: true,
        })
      }
      
      // 4. @提及消息提醒 - 不受时间窗口限制，只检查内容是否仍存在
      const mentionNotifications = notificationsRes.data.items.filter(
        (n: Notification) => n.notification_type === 'mention' && !n.is_read
      )
      
      for (const notification of mentionNotifications) {
        // 检查关联的任务是否仍存在
        if (notification.content_type === 'task') {
          const relatedTask = tasks.find(t => t.id === notification.content_id)
          if (!relatedTask) {
            try {
              await tasksApi.getById(notification.content_id)
            } catch {
              continue  // 任务已删除
            }
          }
        }
        
        items.push({
          id: `mention_${notification.id}`,
          type: 'mention',
          title: notification.title,
          subtitle: notification.message,
          date: notification.created_at,
          notificationId: notification.id,
          taskId: notification.content_type === 'task' ? notification.content_id : undefined,
          link: notification.link,
          isValid: true,
        })
      }
      
      // 按时间排序（最近的在前）
      items.sort((a, b) => {
        const dateA = a.date ? dayjs(a.date) : dayjs(0)
        const dateB = b.date ? dayjs(b.date) : dayjs(0)
        return dateB.valueOf() - dateA.valueOf()
      })
      
      setRecentItems(items)
      setSelectedItems(new Set())  // 清空选择
    } catch (error) {
      console.error('Failed to load recent items:', error)
    }
  }

  // 获取时间窗口的显示文本
  const getTimeWindowText = () => {
    const centerDate = dayjs().add(weekOffset, 'week')
    const windowStart = centerDate.subtract(1, 'week')
    const windowEnd = centerDate.add(1, 'week')
    return `${windowStart.format('M月D日')} - ${windowEnd.format('M月D日')}`
  }

  // 批量标记已处理
  const handleBatchMarkAsRead = async () => {
    const notificationIds = Array.from(selectedItems)
      .map(id => {
        const item = recentItems.find(i => i.id === id)
        return item?.notificationId
      })
      .filter((id): id is number => id !== undefined)
    
    if (notificationIds.length === 0) {
      message.warning('请选择包含通知的事项')
      return
    }
    
    try {
      await notificationsApi.markBatchAsRead(notificationIds)
      message.success(`已标记 ${notificationIds.length} 条通知为已读`)
      setBatchMode(false)
      setSelectedItems(new Set())
      loadRecentItems()
    } catch {
      message.error('操作失败')
    }
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedItems.size === recentItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(recentItems.map(item => item.id)))
    }
  }

  // 切换单个选择
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  // 过滤掉已取消的任务（用于日报选择）
  const availableTasks = myTasks.filter(task => task.status !== 'cancelled')

  // 提交日报
  const handleDailySubmit = async (values: { 
    task_id: number
    hours: number
    description: string
    work_type: string
    problems?: string
    tomorrow_plan?: string
  }) => {
    try {
      const workDate = dayjs().format('YYYY-MM-DD')
      await dailyLogsApi.quickSubmit({
        report_date: workDate,
        work_logs: [{
          task_id: values.task_id,
          work_date: workDate,
          hours: values.hours,
          description: values.description,
          work_type: values.work_type,
          problems: values.problems,
          tomorrow_plan: values.tomorrow_plan,
        }],
      })
      message.success('日报提交成功')
      setDailyModalOpen(false)
      dailyForm.resetFields()
      loadData()
    } catch (error) {
      message.error('提交失败')
    }
  }

  // 查看日报详情
  const openLogDetail = (log: DailyWorkLog) => {
    setSelectedLog(log)
    setLogDetailModalOpen(true)
  }

  // 编辑日报（从详情弹窗）
  const handleEditFromDetail = () => {
    if (selectedLog) {
      setLogDetailModalOpen(false)
      editLogForm.setFieldsValue({
        task_id: selectedLog.task_id,
        hours: selectedLog.hours,
        description: selectedLog.description,
        work_type: selectedLog.work_type,
        problems: selectedLog.problems || '',
        tomorrow_plan: selectedLog.tomorrow_plan || '',
      })
      setEditLogModalOpen(true)
    }
  }

  // 保存编辑
  const handleSaveEditLog = async (values: {
    task_id: number
    hours: number
    description: string
    work_type: 'development' | 'design' | 'testing' | 'meeting' | 'research' | 'other'
    problems?: string
    tomorrow_plan?: string
  }) => {
    if (!selectedLog) return
    try {
      // 更新工时记录（包含 problems 和 tomorrow_plan）
      await dailyLogsApi.updateLog(selectedLog.id, {
        task_id: values.task_id,
        hours: values.hours,
        description: values.description,
        work_type: values.work_type,
        problems: values.problems,
        tomorrow_plan: values.tomorrow_plan,
      })
      
      message.success('日志已更新')
      setEditLogModalOpen(false)
      setSelectedLog(null)
      editLogForm.resetFields()
      loadData()
    } catch {
      message.error('更新失败')
    }
  }

  // 删除日报
  const handleDeleteLog = async () => {
    if (!selectedLog) return
    try {
      await dailyLogsApi.deleteLog(selectedLog.id)
      message.success('日志已删除')
      setLogDetailModalOpen(false)
      setSelectedLog(null)
      loadData()
    } catch {
      message.error('删除失败')
    }
  }

  // 创建会议纪要
  const handleMeetingSubmit = async (values: {
    project_id: number
    title: string
    meeting_date: dayjs.Dayjs
    summary: string
  }) => {
    try {
      await meetingsApi.create({
        ...values,
        meeting_date: values.meeting_date.format('YYYY-MM-DD'),
      })
      message.success('会议纪要创建成功')
      setMeetingModalOpen(false)
      meetingForm.resetFields()
      // 刷新会议纪要列表
      const meetingsRes = await meetingsApi.getList({ page_size: 5 })
      setRecentMeetings(meetingsRes.data.items)
    } catch (error) {
      message.error('创建失败')
    }
  }

  // 查看会议详情
  const openMeetingDetail = async (meeting: Meeting) => {
    try {
      const res = await meetingsApi.getById(meeting.id)
      setSelectedMeeting(res.data)
      setMeetingDetailModalOpen(true)
    } catch {
      message.error('获取会议详情失败')
    }
  }

  // 判断是否可以编辑/删除会议纪要（创建人或管理员）
  const canEditOrDeleteMeeting = (meeting: Meeting | null) => {
    if (!meeting || !user) return false
    const creatorId = meeting.created_by?.id || meeting.creator?.id
    return user.role === 'admin' || creatorId === user.id
  }

  // 打开编辑会议弹窗
  const openEditMeetingModal = () => {
    if (selectedMeeting) {
      editMeetingForm.setFieldsValue({
        project_id: selectedMeeting.project_id,
        title: selectedMeeting.title,
        meeting_date: dayjs(selectedMeeting.meeting_date),
        location: selectedMeeting.location,
        summary: selectedMeeting.summary,
        content: selectedMeeting.content,
      })
      setMeetingDetailModalOpen(false)
      setEditMeetingModalOpen(true)
    }
  }

  // 更新会议纪要
  const handleUpdateMeeting = async (values: {
    project_id: number
    title: string
    meeting_date: dayjs.Dayjs
    location?: string
    summary?: string
    content?: string
  }) => {
    if (!selectedMeeting) return
    try {
      await meetingsApi.update(selectedMeeting.id, {
        ...values,
        meeting_date: values.meeting_date.format('YYYY-MM-DD'),
      })
      message.success('会议纪要更新成功')
      setEditMeetingModalOpen(false)
      editMeetingForm.resetFields()
      setSelectedMeeting(null)
      // 刷新会议列表
      const meetingsRes = await meetingsApi.getList({ page_size: 5 })
      setRecentMeetings(meetingsRes.data.items)
    } catch {
      message.error('更新失败')
    }
  }

  // 删除会议纪要
  const handleDeleteMeeting = async () => {
    if (!selectedMeeting) return
    try {
      await meetingsApi.delete(selectedMeeting.id)
      message.success('会议纪要已删除')
      setMeetingDetailModalOpen(false)
      setSelectedMeeting(null)
      // 刷新会议列表
      const meetingsRes = await meetingsApi.getList({ page_size: 5 })
      setRecentMeetings(meetingsRes.data.items)
    } catch (error: unknown) {
      const err = error as Error
      message.error(err.message || '删除失败')
    }
  }

  // 获取优先级样式
  const getPriorityClass = (priority: string) => {
    const map: Record<string, string> = {
      urgent: 'high',
      high: 'high',
      medium: 'medium',
      low: 'low',
    }
    return map[priority] || 'low'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  // 近期事项点击处理
  const handleRecentItemClick = async (item: RecentItem) => {
    // 如果有通知ID，标记为已读
    if (item.notificationId) {
      try {
        await notificationsApi.markAsRead(item.notificationId)
      } catch (e) {
        console.error('Failed to mark notification as read:', e)
      }
    }
    
    // 跳转到对应页面
    if (item.taskId) {
      navigate(`/tasks?task=${item.taskId}`)
    } else if (item.link) {
      navigate(item.link)
    }
  }
  
  // 获取近期事项标签配置
  const getRecentItemTag = (type: RecentItemType) => {
    switch (type) {
      case 'task_start':
        return { label: '待完成', color: '#3B82F6', bg: '#DBEAFE', icon: <CheckCircleOutlined /> }
      case 'task_due':
        return { label: '到期预警', color: '#DC2626', bg: '#FEE2E2', icon: <ExclamationCircleOutlined /> }
      case 'approval':
        return { label: '审核提醒', color: '#D97706', bg: '#FEF3C7', icon: <ClockCircleOutlined /> }
      case 'mention':
        return { label: '消息提醒', color: '#8B5CF6', bg: '#EDE9FE', icon: <BellOutlined /> }
      default:
        return { label: '提醒', color: '#6B7280', bg: '#F3F4F6', icon: <BellOutlined /> }
    }
  }
  
  // 格式化相对时间
  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = dayjs(dateStr)
    const now = dayjs()
    const diffDays = date.diff(now, 'day')
    
    if (date.isSame(now, 'day')) return '今天'
    if (diffDays === 1) return '明天'
    if (diffDays === -1) return '昨天'
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}天后`
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}天前`
    return date.format('M月D日')
  }

  const pendingTasks = myTasks.filter(t => 
    t.status === 'todo' || t.status === 'task_review' || t.status === 'in_progress' || t.status === 'result_review'
  ).slice(0, 5)

  return (
    <div className="dashboard-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>{getGreeting()}，{user?.name} 👋</h1>
          <p className="subtitle">今天是 {formatDate()}</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card clickable" onClick={() => navigate('/tasks')}>
          <div className="stat-icon" style={{ background: '#FEF3C7' }}>📋</div>
          <div className="stat-content">
            <div className="stat-value">{stats.todayTasks}</div>
            <div className="stat-label">待处理任务</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/daily')}>
          <div className="stat-icon" style={{ background: '#DBEAFE' }}>⏰</div>
          <div className="stat-content">
            <div className="stat-value">{stats.weekHours}h</div>
            <div className="stat-label">本周已记录工时</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/tasks')}>
          <div className="stat-icon" style={{ background: '#D1FAE5' }}>✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.weekCompleted}</div>
            <div className="stat-label">本周完成任务</div>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/projects')}>
          <div className="stat-icon" style={{ background: '#E0E7FF' }}>📁</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeProjects}</div>
            <div className="stat-label">进行中项目</div>
          </div>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="dashboard-grid three-col">
        {/* 近期事项 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📋 近期事项</h2>
            <div className="section-header-actions">
              {batchMode ? (
                <>
                  <Button size="small" onClick={handleSelectAll}>
                    {selectedItems.size === recentItems.length ? '取消全选' : '全选'}
                  </Button>
                  <Button 
                    size="small" 
                    type="primary"
                    disabled={selectedItems.size === 0}
                    onClick={handleBatchMarkAsRead}
                  >
                    标记已处理 ({selectedItems.size})
                  </Button>
                  <Button size="small" onClick={() => { setBatchMode(false); setSelectedItems(new Set()) }}>
                    取消
                  </Button>
                </>
              ) : (
                <Button size="small" onClick={() => setBatchMode(true)}>
                  批量处理
                </Button>
              )}
            </div>
          </div>
          
          {/* 时间窗口选择器 */}
          <div className="time-window-selector">
            <Button 
              type="text" 
              icon={<LeftOutlined />} 
              onClick={() => setWeekOffset(weekOffset - 1)}
              size="small"
            />
            <span className="time-window-text">
              {weekOffset === 0 ? '近两周' : getTimeWindowText()}
            </span>
            <Button 
              type="text" 
              icon={<RightOutlined />} 
              onClick={() => setWeekOffset(weekOffset + 1)}
              size="small"
            />
            {weekOffset !== 0 && (
              <Button 
                type="link" 
                size="small"
                onClick={() => setWeekOffset(0)}
              >
                回到当前
              </Button>
            )}
          </div>
          
          <div className="recent-items-list">
            {recentItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-text">该时间段暂无事项</div>
              </div>
            ) : (
              recentItems.map(item => {
                const tagConfig = getRecentItemTag(item.type)
                return (
                  <div 
                    key={item.id} 
                    className={`recent-item clickable ${selectedItems.has(item.id) ? 'selected' : ''}`}
                    onClick={() => {
                      if (batchMode) {
                        toggleItemSelection(item.id)
                      } else {
                        handleRecentItemClick(item)
                      }
                    }}
                  >
                    {batchMode && (
                      <Checkbox 
                        checked={selectedItems.has(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleItemSelection(item.id)}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <div className="recent-item-main">
                      <div className="recent-item-header">
                        <Tag 
                          className="recent-item-tag"
                          style={{ 
                            color: tagConfig.color, 
                            background: tagConfig.bg,
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {tagConfig.icon}
                          {tagConfig.label}
                        </Tag>
                        {item.date && (
                          <span className="recent-item-date">
                            {formatRelativeDate(item.date)}
                          </span>
                        )}
                      </div>
                      <div className="recent-item-content">
                        <div className="recent-item-title">{item.title}</div>
                        {item.subtitle && (
                          <div className="recent-item-subtitle">{item.subtitle}</div>
                        )}
                      </div>
                      {item.priority && (
                        <div className="recent-item-footer">
                          <span className={`priority-badge ${getPriorityClass(item.priority)}`}>
                            {item.priority === 'urgent' ? '紧急' : 
                             item.priority === 'high' ? '高' : 
                             item.priority === 'medium' ? '中' : '低'}
                          </span>
                          {item.projectName && (
                            <span className="recent-item-project">{item.projectName}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 快速日报 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📝 今日工作记录</h2>
            <Link to="/daily" className="link-btn">查看更多 →</Link>
          </div>
          <div className="quick-entry">
            <div className="quick-entry-header">
              <div className="quick-entry-icon" style={{ background: '#DBEAFE' }}>📝</div>
              <span className="quick-entry-title">快速记录</span>
            </div>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />} 
              block
              onClick={() => setDailyModalOpen(true)}
            >
              添加工作记录
            </Button>
          </div>
          {todayLogs.length > 0 && (
            <div className="today-logs" style={{ marginTop: 16 }}>
              {todayLogs.map(log => (
                <div 
                  key={log.id} 
                  className="log-item clickable"
                  onClick={() => openLogDetail(log)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="log-item-header">
                    <Tag color={WORK_TYPE_CONFIG[log.work_type]?.color}>
                      {log.hours}h
                    </Tag>
                    <span className="log-task">{log.task?.title}</span>
                  </div>
                  <div className="log-meta">
                    <span className="log-desc-preview">{log.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 快速会议纪要 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📅 会议纪要</h2>
            <Link to="/projects" className="link-btn">查看全部 →</Link>
          </div>
          <div className="quick-entry">
            <div className="quick-entry-header">
              <div className="quick-entry-icon" style={{ background: '#D1FAE5' }}>📅</div>
              <span className="quick-entry-title">创建会议纪要</span>
            </div>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />} 
              block
              onClick={() => setMeetingModalOpen(true)}
            >
              新建会议纪要
            </Button>
          </div>
          {recentMeetings.length > 0 && (
            <div className="recent-meetings" style={{ marginTop: 16 }}>
              {recentMeetings.map(meeting => (
                <div 
                  key={meeting.id} 
                  className="meeting-item"
                  onClick={() => openMeetingDetail(meeting)}
                  style={{ 
                    padding: '12px', 
                    background: '#F9FAFB', 
                    borderRadius: 8, 
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9FAFB')}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{meeting.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6B7280', flexWrap: 'wrap' }}>
                    <span><CalendarOutlined /> {meeting.meeting_date}</span>
                    <span>{meeting.project?.name}</span>
                    {meeting.created_by && <span>👤 {meeting.created_by.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 日报弹窗 */}
      <Modal
        title="填写今日日报"
        open={dailyModalOpen}
        onCancel={() => setDailyModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={dailyForm}
          layout="vertical"
          onFinish={handleDailySubmit}
        >
          <Form.Item
            name="task_id"
            label="关联任务"
            rules={[{ required: true, message: '请选择任务' }]}
          >
            <Select placeholder="选择任务">
              {availableTasks.map(task => (
                <Select.Option key={task.id} value={task.id}>
                  [{task.project?.code}] {task.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="hours"
              label="工作时长"
              rules={[{ required: true, message: '请输入时长' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0.5} max={24} step={0.5} addonAfter="小时" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="work_type"
              label="工作类型"
              initialValue="development"
              style={{ flex: 1 }}
            >
              <Select>
                <Select.Option value="development">开发</Select.Option>
                <Select.Option value="design">设计</Select.Option>
                <Select.Option value="testing">测试</Select.Option>
                <Select.Option value="meeting">会议</Select.Option>
                <Select.Option value="research">研究</Select.Option>
                <Select.Option value="other">其他</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="description"
            label="工作内容"
            rules={[{ required: true, message: '请输入工作内容' }]}
          >
            <TextArea rows={3} placeholder="描述今天做了什么..." />
          </Form.Item>
          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={2} placeholder="有什么需要帮助的问题吗？" />
          </Form.Item>
          <Form.Item name="tomorrow_plan" label="明日计划">
            <TextArea rows={2} placeholder="明天打算做什么？" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交日报
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 日报详情弹窗 */}
      <Modal
        title={null}
        open={logDetailModalOpen}
        onCancel={() => { setLogDetailModalOpen(false); setSelectedLog(null); }}
        footer={null}
        width={600}
      >
        {selectedLog && (
          <div className="log-detail">
            {/* 头部操作栏 */}
            <div className="log-detail-header">
              <div className="log-detail-title">
                <Tag color={WORK_TYPE_CONFIG[selectedLog.work_type]?.color}>
                  {WORK_TYPE_CONFIG[selectedLog.work_type]?.label}
                </Tag>
                <span className="log-detail-date">
                  {dayjs(selectedLog.work_date).format('YYYY年M月D日')}
                </span>
              </div>
              <div className="log-detail-actions">
                <Button icon={<EditOutlined />} onClick={handleEditFromDetail}>
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除"
                  description="确定要删除这条工时记录吗？此操作不可撤销。"
                  onConfirm={handleDeleteLog}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </div>
            </div>

            {/* 任务信息 */}
            <div className="log-detail-section">
              <h4>关联任务</h4>
              <div className="log-detail-task">
                <span className="task-name">{selectedLog.task?.title || '未关联任务'}</span>
                {selectedLog.project && (
                  <Tag color="blue">{selectedLog.project.name}</Tag>
                )}
              </div>
            </div>

            {/* 工时信息 */}
            <div className="log-detail-section">
              <h4>工作时长</h4>
              <div className="log-detail-hours">
                <Avatar 
                  size={48}
                  style={{ 
                    background: WORK_TYPE_CONFIG[selectedLog.work_type]?.color,
                    fontSize: 18,
                    fontWeight: 600
                  }}
                >
                  {selectedLog.hours}h
                </Avatar>
              </div>
            </div>

            {/* 工作内容 */}
            <div className="log-detail-section">
              <h4>工作内容</h4>
              <p className="log-detail-content">
                {selectedLog.description || '暂无描述'}
              </p>
            </div>

            {/* 遇到的问题 */}
            {selectedLog.problems && (
              <div className="log-detail-section">
                <h4>遇到的问题</h4>
                <p className="log-detail-content log-detail-problems">
                  {selectedLog.problems}
                </p>
              </div>
            )}

            {/* 明日计划 */}
            {selectedLog.tomorrow_plan && (
              <div className="log-detail-section">
                <h4>明日计划</h4>
                <p className="log-detail-content log-detail-plan">
                  {selectedLog.tomorrow_plan}
                </p>
              </div>
            )}

            {/* 记录信息 */}
            <div className="log-detail-meta">
              <span>记录时间: {dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm')}</span>
              {selectedLog.member && (
                <span>记录人: {selectedLog.member.name}</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑日报弹窗 */}
      <Modal
        title="编辑工时记录"
        open={editLogModalOpen}
        onCancel={() => { setEditLogModalOpen(false); setSelectedLog(null); editLogForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={editLogForm} layout="vertical" onFinish={handleSaveEditLog}>
          <Form.Item
            name="task_id"
            label="关联任务"
            rules={[{ required: true, message: '请选择任务' }]}
          >
            <Select placeholder="选择任务">
              {availableTasks.map(task => (
                <Select.Option key={task.id} value={task.id}>
                  [{task.project?.code}] {task.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="hours"
              label="工作时长"
              rules={[{ required: true, message: '请输入时长' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0.5} max={24} step={0.5} addonAfter="小时" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="work_type"
              label="工作类型"
              style={{ flex: 1 }}
            >
              <Select>
                <Select.Option value="development">开发</Select.Option>
                <Select.Option value="design">设计</Select.Option>
                <Select.Option value="testing">测试</Select.Option>
                <Select.Option value="meeting">会议</Select.Option>
                <Select.Option value="research">研究</Select.Option>
                <Select.Option value="other">其他</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="description"
            label="工作内容"
            rules={[{ required: true, message: '请输入工作内容' }]}
          >
            <TextArea rows={3} placeholder="描述今天做了什么..." />
          </Form.Item>
          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={2} placeholder="有什么需要帮助的问题吗？" />
          </Form.Item>
          <Form.Item name="tomorrow_plan" label="明日计划">
            <TextArea rows={2} placeholder="明天打算做什么？" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setEditLogModalOpen(false); setSelectedLog(null); editLogForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </div>
        </Form>
      </Modal>

      {/* 会议纪要弹窗 */}
      <Modal
        title="新建会议纪要"
        open={meetingModalOpen}
        onCancel={() => setMeetingModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={meetingForm}
          layout="vertical"
          onFinish={handleMeetingSubmit}
        >
          <Form.Item
            name="project_id"
            label="所属项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select placeholder="选择项目">
              {projects.map(project => (
                <Select.Option key={project.id} value={project.id}>
                  [{project.code}] {project.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, message: '请输入会议标题' }]}
          >
            <Input placeholder="例如：需求评审会议" />
          </Form.Item>
          <Form.Item
            name="meeting_date"
            label="会议日期"
            initialValue={dayjs()}
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="summary"
            label="会议纪要"
            rules={[{ required: true, message: '请输入会议纪要' }]}
          >
            <TextArea rows={6} placeholder="会议讨论内容、决议、待办事项..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建会议纪要
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 会议详情弹窗 */}
      <Modal
        title={null}
        open={meetingDetailModalOpen}
        onCancel={() => setMeetingDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedMeeting && (
          <div>
            {/* 头部操作栏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{selectedMeeting.title}</h3>
              {canEditOrDeleteMeeting(selectedMeeting) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button icon={<EditOutlined />} onClick={openEditMeetingModal}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    description="确定要删除这个会议纪要吗？此操作不可撤销。"
                    onConfirm={handleDeleteMeeting}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, color: '#6B7280', fontSize: 14, flexWrap: 'wrap' }}>
              <span><CalendarOutlined /> 会议日期: {selectedMeeting.meeting_date}</span>
              {selectedMeeting.location && <span>📍 地点: {selectedMeeting.location}</span>}
              {selectedMeeting.project && <span>📁 项目: {selectedMeeting.project.name}</span>}
              {selectedMeeting.created_by && <span>👤 创建人: {selectedMeeting.created_by.name}</span>}
            </div>
            
            {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>参会人员</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedMeeting.attendees.map(a => (
                    <span key={a.id} style={{ 
                      padding: '4px 12px', 
                      background: '#F3F4F6', 
                      borderRadius: 16,
                      fontSize: 13
                    }}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {selectedMeeting.summary && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>会议摘要</h4>
                <p style={{ whiteSpace: 'pre-wrap', background: '#F9FAFB', padding: 12, borderRadius: 8, margin: 0 }}>
                  {selectedMeeting.summary}
                </p>
              </div>
            )}
            
            {selectedMeeting.content && (
              <div>
                <h4 style={{ marginBottom: 8 }}>会议内容</h4>
                <div style={{ whiteSpace: 'pre-wrap', background: '#F9FAFB', padding: 12, borderRadius: 8 }}>
                  {selectedMeeting.content}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 编辑会议纪要弹窗 */}
      <Modal
        title="编辑会议纪要"
        open={editMeetingModalOpen}
        onCancel={() => { setEditMeetingModalOpen(false); editMeetingForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form
          form={editMeetingForm}
          layout="vertical"
          onFinish={handleUpdateMeeting}
        >
          <Form.Item
            name="project_id"
            label="所属项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select placeholder="选择项目">
              {projects.map(project => (
                <Select.Option key={project.id} value={project.id}>
                  [{project.code}] {project.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, message: '请输入会议标题' }]}
          >
            <Input placeholder="例如：需求评审会议" />
          </Form.Item>
          <Form.Item
            name="meeting_date"
            label="会议日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="location"
            label="会议地点"
          >
            <Input placeholder="会议室/线上会议链接" />
          </Form.Item>
          <Form.Item
            name="summary"
            label="会议摘要"
          >
            <TextArea rows={3} placeholder="会议主要讨论内容概要..." />
          </Form.Item>
          <Form.Item
            name="content"
            label="会议内容"
          >
            <TextArea rows={6} placeholder="会议详细内容、决议、待办事项..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setEditMeetingModalOpen(false); editMeetingForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
