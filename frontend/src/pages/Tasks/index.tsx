import { useEffect, useState, useCallback } from 'react'
import { 
  Button, Modal, Form, Input, Select, InputNumber, DatePicker, 
  message, Spin, Tag, Avatar, Tooltip, Dropdown 
} from 'antd'
import type { MenuProps } from 'antd'
import { 
  PlusOutlined, MoreOutlined, UserOutlined, 
  ClockCircleOutlined, CalendarOutlined 
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/useAppStore'
import { tasksApi } from '@/services/api'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import './index.css'

const { TextArea } = Input

// 任务状态配置
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: '待办', color: '#6B7280', bg: '#F3F4F6' },
  task_review: { label: '任务评审', color: '#4F46E5', bg: '#E0E7FF' },
  in_progress: { label: '进行中', color: '#2563EB', bg: '#DBEAFE' },
  outcome_review: { label: '成果评审', color: '#D97706', bg: '#FEF3C7' },
  completed: { label: '已完成', color: '#059669', bg: '#D1FAE5' },
  cancelled: { label: '已取消', color: '#DC2626', bg: '#FEE2E2' },
}

// 优先级配置
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: '低', color: '#3B82F6' },
  medium: { label: '中', color: '#F59E0B' },
  high: { label: '高', color: '#EF4444' },
  urgent: { label: '紧急', color: '#DC2626' },
}

// 看板列配置
const KANBAN_COLUMNS: TaskStatus[] = ['todo', 'task_review', 'in_progress', 'outcome_review', 'completed']

export default function Tasks() {
  const { projects, members, tasks, fetchTasks, tasksLoading } = useAppStore()
  
  const [selectedProject, setSelectedProject] = useState<number | undefined>()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchTasks({ project_id: selectedProject })
  }, [selectedProject, fetchTasks])

  // 按状态分组任务
  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return tasks.filter(t => t.status === status)
  }, [tasks])

  // 创建任务
  const handleCreate = async (values: Partial<Task> & { due_date?: dayjs.Dayjs; start_date?: dayjs.Dayjs }) => {
    try {
      await tasksApi.create({
        ...values,
        due_date: values.due_date?.format('YYYY-MM-DD'),
        start_date: values.start_date?.format('YYYY-MM-DD'),
      })
      message.success('任务创建成功')
      setCreateModalOpen(false)
      form.resetFields()
      fetchTasks({ project_id: selectedProject })
    } catch {
      message.error('创建失败')
    }
  }

  // 更新任务状态
  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    try {
      await tasksApi.updateStatus(taskId, { status: newStatus })
      message.success('状态已更新')
      fetchTasks({ project_id: selectedProject })
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus })
      }
    } catch {
      message.error('更新失败')
    }
  }

  // 打开任务详情
  const openTaskDetail = (task: Task) => {
    setSelectedTask(task)
    setDetailModalOpen(true)
  }

  // 渲染任务卡片
  const renderTaskCard = (task: Task) => {
    const priorityConfig = PRIORITY_CONFIG[task.priority]
    
    const menuItems: MenuProps['items'] = KANBAN_COLUMNS
      .filter(s => s !== task.status)
      .map(status => ({
        key: status,
        label: `移至 ${STATUS_CONFIG[status].label}`,
        onClick: () => handleStatusChange(task.id, status),
      }))

    return (
      <div key={task.id} className="kanban-card" onClick={() => openTaskDetail(task)}>
        <div className="kanban-card-header">
          <Tag color={priorityConfig.color} style={{ margin: 0 }}>
            {priorityConfig.label}
          </Tag>
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button 
              type="text" 
              size="small" 
              icon={<MoreOutlined />}
              onClick={e => e.stopPropagation()}
            />
          </Dropdown>
        </div>
        <div className="kanban-card-title">{task.title}</div>
        <div className="kanban-card-meta">
          <span className="project-tag">{task.project?.code}</span>
          {task.due_date && (
            <Tooltip title={`截止: ${task.due_date}`}>
              <span className="due-date">
                <CalendarOutlined /> {dayjs(task.due_date).format('M/D')}
              </span>
            </Tooltip>
          )}
        </div>
        <div className="kanban-card-footer">
          {task.assignee ? (
            <Tooltip title={task.assignee.name}>
              <Avatar size="small" style={{ background: '#F59E0B' }}>
                {task.assignee.name?.charAt(0)}
              </Avatar>
            </Tooltip>
          ) : (
            <Avatar size="small" icon={<UserOutlined />} />
          )}
          {task.estimated_hours && (
            <span className="hours">
              <ClockCircleOutlined /> {task.estimated_hours}h
            </span>
          )}
        </div>
      </div>
    )
  }

  if (tasksLoading && tasks.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="tasks-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>任务看板</h1>
          <p className="subtitle">拖拽任务卡片或点击查看详情</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            placeholder="筛选项目"
            allowClear
            style={{ width: 200 }}
            value={selectedProject}
            onChange={setSelectedProject}
          >
            {projects.map(p => (
              <Select.Option key={p.id} value={p.id}>
                [{p.code}] {p.name}
              </Select.Option>
            ))}
          </Select>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新建任务
          </Button>
        </div>
      </div>

      {/* 看板 */}
      <div className="kanban-board">
        {KANBAN_COLUMNS.map(status => {
          const config = STATUS_CONFIG[status]
          const columnTasks = getTasksByStatus(status)
          
          return (
            <div key={status} className="kanban-column">
              <div className="kanban-column-header">
                <div className="kanban-column-title">
                  <span 
                    className="status-dot" 
                    style={{ background: config.color }}
                  />
                  {config.label}
                </div>
                <span className="kanban-column-count">{columnTasks.length}</span>
              </div>
              <div className="kanban-column-body">
                {columnTasks.map(renderTaskCard)}
                {columnTasks.length === 0 && (
                  <div className="kanban-empty">暂无任务</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 创建任务弹窗 */}
      <Modal
        title="新建任务"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="project_id"
            label="所属项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select placeholder="选择项目">
              {projects.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="输入任务标题" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <TextArea rows={3} placeholder="描述任务详情..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="assignee_id" label="负责人" style={{ flex: 1 }}>
              <Select placeholder="选择负责人" allowClear>
                {members.map(m => (
                  <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="优先级" initialValue="medium" style={{ flex: 1 }}>
              <Select>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <Select.Option key={key} value={key}>{config.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="estimated_hours" label="预估工时" style={{ flex: 1 }}>
              <InputNumber min={0.5} step={0.5} addonAfter="小时" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="due_date" label="截止日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建任务
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情弹窗 */}
      <Modal
        title={null}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
        className="task-detail-modal"
      >
        {selectedTask && (
          <div className="task-detail">
            <div className="task-detail-header">
              <Tag color={PRIORITY_CONFIG[selectedTask.priority].color}>
                {PRIORITY_CONFIG[selectedTask.priority].label}
              </Tag>
              <Select
                value={selectedTask.status}
                onChange={(v) => handleStatusChange(selectedTask.id, v)}
                style={{ width: 120 }}
              >
                {KANBAN_COLUMNS.map(s => (
                  <Select.Option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <h2 className="task-detail-title">{selectedTask.title}</h2>
            <p className="task-detail-project">
              项目: {selectedTask.project?.name} ({selectedTask.project?.code})
            </p>
            {selectedTask.description && (
              <div className="task-detail-desc">
                <h4>描述</h4>
                <p>{selectedTask.description}</p>
              </div>
            )}
            <div className="task-detail-info">
              <div className="info-item">
                <span className="label">负责人</span>
                <span className="value">
                  {selectedTask.assignee ? (
                    <Avatar size="small" style={{ background: '#F59E0B', marginRight: 8 }}>
                      {selectedTask.assignee.name?.charAt(0)}
                    </Avatar>
                  ) : null}
                  {selectedTask.assignee?.name || '未分配'}
                </span>
              </div>
              <div className="info-item">
                <span className="label">预估工时</span>
                <span className="value">{selectedTask.estimated_hours || '-'}h</span>
              </div>
              <div className="info-item">
                <span className="label">实际工时</span>
                <span className="value">{selectedTask.actual_hours || '-'}h</span>
              </div>
              <div className="info-item">
                <span className="label">截止日期</span>
                <span className="value">{selectedTask.due_date || '-'}</span>
              </div>
            </div>
            {selectedTask.stakeholders && selectedTask.stakeholders.length > 0 && (
              <div className="task-detail-stakeholders">
                <h4>干系人</h4>
                <div className="stakeholder-list">
                  {selectedTask.stakeholders.map(s => (
                    <Tag key={s.id}>
                      {s.member.name} ({s.role === 'reviewer' ? '评审人' : s.role === 'collaborator' ? '协作者' : '干系人'})
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
