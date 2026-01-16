import { useEffect, useState } from 'react'
import { 
  Button, Modal, Form, Input, Select, InputNumber, DatePicker, Popconfirm,
  message, Spin, Calendar, Badge, List, Avatar, Tag 
} from 'antd'
import type { BadgeProps } from 'antd'
import { PlusOutlined, CalendarOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { dailyLogsApi } from '@/services/api'
import type { DailyWorkLog, DailySummary } from '@/types'
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

export default function Daily() {
  const { user } = useAuthStore()
  const { myTasks, fetchMyTasks, projects } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [logs, setLogs] = useState<DailyWorkLog[]>([])
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<DailyWorkLog | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    setLoading(true)
    try {
      await fetchMyTasks()
      
      // 获取当月日志
      const startOfMonth = selectedDate.startOf('month').format('YYYY-MM-DD')
      const endOfMonth = selectedDate.endOf('month').format('YYYY-MM-DD')
      
      const [logsRes, summariesRes] = await Promise.all([
        dailyLogsApi.getLogs({ 
          member_id: user?.id,
          page_size: 100,
        }),
        dailyLogsApi.getSummaries({
          member_id: user?.id,
          start_date: startOfMonth,
          end_date: endOfMonth,
        }),
      ])
      
      setLogs(logsRes.data.items)
      setSummaries(summariesRes.data.items)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 提交日报
  const handleSubmit = async (values: {
    task_id: number
    hours: number
    description: string
    work_type: string
    problems?: string
    tomorrow_plan?: string
  }) => {
    try {
      const workDate = selectedDate.format('YYYY-MM-DD')
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
      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch {
      message.error('提交失败')
    }
  }

  // 编辑日志
  const handleEditLog = (log: DailyWorkLog) => {
    setEditingLog(log)
    editForm.setFieldsValue({
      task_id: log.task_id,
      hours: log.hours,
      description: log.description,
      work_type: log.work_type,
    })
    setEditModalOpen(true)
  }

  // 保存编辑
  const handleSaveEdit = async (values: {
    task_id: number
    hours: number
    description: string
    work_type: 'development' | 'design' | 'testing' | 'meeting' | 'research' | 'other'
  }) => {
    if (!editingLog) return
    try {
      await dailyLogsApi.updateLog(editingLog.id, values)
      message.success('日志已更新')
      setEditModalOpen(false)
      setEditingLog(null)
      editForm.resetFields()
      loadData()
    } catch {
      message.error('更新失败')
    }
  }

  // 删除日志
  const handleDeleteLog = async (logId: number) => {
    try {
      await dailyLogsApi.deleteLog(logId)
      message.success('日志已删除')
      loadData()
    } catch {
      message.error('删除失败')
    }
  }

  // 日历日期单元格渲染
  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD')
    const dayLogs = logs.filter(log => log.work_date === dateStr)
    const totalHours = dayLogs.reduce((sum, log) => sum + Number(log.hours), 0)
    
    if (dayLogs.length === 0) return null
    
    return (
      <div className="calendar-cell-content">
        <Badge 
          status={totalHours >= 8 ? 'success' : 'warning'} 
          text={`${totalHours}h`} 
        />
      </div>
    )
  }

  // 日历月份单元格渲染（年视图）
  const monthCellRender = (value: Dayjs) => {
    // 计算该月的总工时
    const monthStr = value.format('YYYY-MM')
    const monthLogs = logs.filter(log => log.work_date.startsWith(monthStr))
    const totalHours = monthLogs.reduce((sum, log) => sum + Number(log.hours), 0)
    
    if (monthLogs.length === 0) return null
    
    return (
      <div className="calendar-month-content">
        <Badge 
          status={totalHours >= 160 ? 'success' : 'processing'} 
          text={`${totalHours}h`} 
        />
      </div>
    )
  }

  // 获取选中日期的日志
  const selectedDateLogs = logs.filter(
    log => log.work_date === selectedDate.format('YYYY-MM-DD')
  )

  // 过滤掉已取消的任务（用于日报选择）
  const availableTasks = myTasks.filter(task => task.status !== 'cancelled')

  if (loading && logs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="daily-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>日报管理</h1>
          <p className="subtitle">记录每日工作内容</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          填写日报
        </Button>
      </div>

      <div className="daily-content">
        {/* 左侧日历 */}
        <div className="calendar-section">
          <Calendar
            fullscreen={false}
            value={selectedDate}
            onSelect={setSelectedDate}
            cellRender={(current, info) => {
              if (info.type === 'date') {
                return dateCellRender(current)
              }
              if (info.type === 'month') {
                return monthCellRender(current)
              }
              return null
            }}
          />
        </div>

        {/* 右侧日志列表 */}
        <div className="logs-section">
          <div className="section-header">
            <h2>
              <CalendarOutlined /> {selectedDate.format('YYYY年M月D日')} 工作记录
            </h2>
            <Button 
              type="link" 
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              添加
            </Button>
          </div>

          {selectedDateLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <div className="empty-state-text">当日暂无工作记录</div>
              <Button 
                type="primary" 
                style={{ marginTop: 16 }}
                onClick={() => setModalOpen(true)}
              >
                立即填写
              </Button>
            </div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={selectedDateLogs}
              renderItem={(log) => (
                <List.Item
                  actions={[
                    <Button 
                      key="edit" 
                      type="text" 
                      icon={<EditOutlined />}
                      onClick={() => handleEditLog(log)}
                    />,
                    <Popconfirm
                      key="delete"
                      title="确认删除"
                      description="确定要删除这条工时记录吗？"
                      onConfirm={() => handleDeleteLog(log.id)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ background: WORK_TYPE_CONFIG[log.work_type]?.color }}>
                        {log.hours}h
                      </Avatar>
                    }
                    title={
                      <div className="log-title">
                        <span>{log.task?.title || '未关联任务'}</span>
                        <Tag color={WORK_TYPE_CONFIG[log.work_type]?.color}>
                          {WORK_TYPE_CONFIG[log.work_type]?.label}
                        </Tag>
                      </div>
                    }
                    description={
                      <div className="log-desc">
                        <p>{log.description}</p>
                        <span className="log-project">{log.project?.name}</span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {/* 统计 */}
          {selectedDateLogs.length > 0 && (
            <div className="day-stats">
              <div className="stat-item">
                <span className="label">总工时</span>
                <span className="value">
                  {selectedDateLogs.reduce((sum, log) => sum + Number(log.hours), 0)}h
                </span>
              </div>
              <div className="stat-item">
                <span className="label">任务数</span>
                <span className="value">{selectedDateLogs.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 填写日报弹窗 */}
      <Modal
        title={`填写日报 - ${selectedDate.format('YYYY年M月D日')}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
              <InputNumber 
                min={0.5} 
                max={24} 
                step={0.5} 
                addonAfter="小时" 
                style={{ width: '100%' }} 
              />
            </Form.Item>
            <Form.Item
              name="work_type"
              label="工作类型"
              initialValue="development"
              style={{ flex: 1 }}
            >
              <Select>
                {Object.entries(WORK_TYPE_CONFIG).map(([key, config]) => (
                  <Select.Option key={key} value={key}>{config.label}</Select.Option>
                ))}
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

      {/* 编辑日志弹窗 */}
      <Modal
        title="编辑工时记录"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingLog(null); editForm.resetFields(); }}
        footer={null}
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
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
              <InputNumber 
                min={0.5} 
                max={24} 
                step={0.5} 
                addonAfter="小时" 
                style={{ width: '100%' }} 
              />
            </Form.Item>
            <Form.Item
              name="work_type"
              label="工作类型"
              style={{ flex: 1 }}
            >
              <Select>
                {Object.entries(WORK_TYPE_CONFIG).map(([key, config]) => (
                  <Select.Option key={key} value={key}>{config.label}</Select.Option>
                ))}
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setEditModalOpen(false); setEditingLog(null); editForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
