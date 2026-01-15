import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Modal, Form, Input, Select, InputNumber, DatePicker, message, Spin } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { tasksApi, dailyLogsApi, meetingsApi } from '@/services/api'
import type { Task, DailyWorkLog } from '@/types'
import './index.css'

const { TextArea } = Input

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
  
  // 弹窗状态
  const [dailyModalOpen, setDailyModalOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [dailyForm] = Form.useForm()
  const [meetingForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await fetchMyTasks()
      
      // 获取今日工作日志
      const today = dayjs().format('YYYY-MM-DD')
      const logsRes = await dailyLogsApi.getLogs({ work_date: today })
      setTodayLogs(logsRes.data.items)
      
      // 获取统计
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
      const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD')
      const statsRes = await dailyLogsApi.getStats({ start_date: weekStart, end_date: weekEnd })
      
      setStats({
        todayTasks: myTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        weekHours: statsRes.data.total_hours || 0,
        weekCompleted: myTasks.filter(t => t.status === 'completed').length,
        activeProjects: projects.filter(p => p.status === 'active').length,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

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
        }],
        problems: values.problems,
        tomorrow_plan: values.tomorrow_plan,
      })
      message.success('日报提交成功')
      setDailyModalOpen(false)
      dailyForm.resetFields()
      loadData()
    } catch (error) {
      message.error('提交失败')
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
    } catch (error) {
      message.error('创建失败')
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
    t.status === 'todo' || t.status === 'task_review' || t.status === 'in_progress' || t.status === 'outcome_review'
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
                <div key={task.id} className="task-item">
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
                <div key={log.id} className="log-item">
                  <div className="log-task">{log.task?.title}</div>
                  <div className="log-meta">
                    <span>{log.hours}h</span>
                    <span>{log.description}</span>
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
              {myTasks.map(task => (
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
    </div>
  )
}
