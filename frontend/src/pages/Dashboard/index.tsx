import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Modal, Form, Input, Select, InputNumber, DatePicker, Popconfirm, message, Spin, Tag, Avatar } from 'antd'
import { PlusOutlined, EditOutlined, CalendarOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { tasksApi, dailyLogsApi, meetingsApi } from '@/services/api'
import type { Task, DailyWorkLog, Meeting, DailySummary } from '@/types'
import './index.css'

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
  
  // 弹窗状态
  const [dailyModalOpen, setDailyModalOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [meetingDetailModalOpen, setMeetingDetailModalOpen] = useState(false)
  const [logDetailModalOpen, setLogDetailModalOpen] = useState(false)
  const [editLogModalOpen, setEditLogModalOpen] = useState(false)
  const [dailyForm] = Form.useForm()
  const [meetingForm] = Form.useForm()
  const [editLogForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await fetchMyTasks()
      
      // 获取今日工作日志（只获取当前用户自己的）
      const today = dayjs().format('YYYY-MM-DD')
      const currentUserId = useAuthStore.getState().user?.id
      
      const [logsRes, summariesRes, meetingsRes, statsRes] = await Promise.all([
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
          start_date: dayjs().startOf('week').format('YYYY-MM-DD'), 
          end_date: dayjs().endOf('week').format('YYYY-MM-DD') 
        }),
      ])
      
      setTodayLogs(logsRes.data.items)
      setTodaySummary(summariesRes.data.items?.[0] || null)
      setRecentMeetings(meetingsRes.data.items)
      
      setStats({
        todayTasks: myTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
        weekHours: statsRes.data.total_hours || 0,
        weekCompleted: myTasks.filter(t => t.status === 'done').length,
        activeProjects: projects.filter(p => p.status === 'active').length,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
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
        <Button 
          type="primary" 
          icon={<EditOutlined />}
          onClick={() => setDailyModalOpen(true)}
        >
          填写今日日报
        </Button>
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
        {/* 今日待办 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📋 今日待办</h2>
            <Link to="/tasks" className="link-btn">查看全部 →</Link>
          </div>
          <div className="task-list">
            {pendingTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-text">暂无待办任务</div>
              </div>
            ) : (
              pendingTasks.map(task => (
                <div 
                  key={task.id} 
                  className="task-item clickable"
                  onClick={() => navigate(`/tasks?task=${task.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="task-checkbox" />
                  <div className="task-content">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                        {task.priority === 'urgent' ? '紧急' : 
                         task.priority === 'high' ? '高' : 
                         task.priority === 'medium' ? '中' : '低'}
                      </span>
                      <span>{task.project?.name}</span>
                      {task.estimated_hours && (
                        <span className="task-hours">{task.estimated_hours}h</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
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
        title={selectedMeeting?.title}
        open={meetingDetailModalOpen}
        onCancel={() => setMeetingDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedMeeting && (
          <div>
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
    </div>
  )
}
