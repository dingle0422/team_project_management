import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Button, Modal, Form, Input, Select, InputNumber, DatePicker, 
  message, Spin, Tag, Avatar, Tooltip, Dropdown, Popconfirm 
} from 'antd'
import type { MenuProps } from 'antd'
import { 
  PlusOutlined, MoreOutlined, UserOutlined, 
  ClockCircleOutlined, CalendarOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/useAppStore'
import { tasksApi } from '@/services/api'
import type { Task, TaskDetail, TaskStatus, TaskPriority } from '@/types'
import { useAuthStore } from '@/store/useAuthStore'
import './index.css'

const { TextArea } = Input

// 任务状态配置
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: '待办', color: '#6B7280', bg: '#F3F4F6' },
  task_review: { label: '任务评审', color: '#4F46E5', bg: '#E0E7FF' },
  in_progress: { label: '进行中', color: '#2563EB', bg: '#DBEAFE' },
  result_review: { label: '成果评审', color: '#D97706', bg: '#FEF3C7' },
  done: { label: '已完成', color: '#059669', bg: '#D1FAE5' },
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
const KANBAN_COLUMNS: TaskStatus[] = ['todo', 'task_review', 'in_progress', 'result_review', 'done', 'cancelled']

// 状态流转规则：定义每个状态可以转换到哪些状态
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['task_review', 'cancelled'],
  task_review: ['todo', 'in_progress', 'cancelled'],
  in_progress: ['result_review', 'cancelled'],
  result_review: ['in_progress', 'done', 'cancelled'],
  done: ['cancelled'],
  cancelled: ['todo'],
}

// 判断状态是否可以转换
const canTransitionTo = (currentStatus: TaskStatus, targetStatus: TaskStatus): boolean => {
  if (currentStatus === targetStatus) return true // 当前状态始终可选
  return STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false
}

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, members, tasks, fetchTasks, tasksLoading } = useAppStore()
  const { user } = useAuthStore()
  
  // 从 URL 参数初始化项目筛选
  const projectParam = searchParams.get('project')
  const taskParam = searchParams.get('task')
  const [selectedProject, setSelectedProject] = useState<number | undefined>(
    projectParam ? parseInt(projectParam) : undefined
  )
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [approving, setApproving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  useEffect(() => {
    fetchTasks({ project_id: selectedProject })
  }, [selectedProject, fetchTasks])

  // 处理URL中的task参数，自动打开任务详情
  useEffect(() => {
    if (taskParam && tasks.length > 0) {
      const taskId = parseInt(taskParam)
      const task = tasks.find(t => t.id === taskId)
      
      // 清除URL中的task参数
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('task')
      setSearchParams(newParams, { replace: true })
      
      if (task) {
        openTaskDetail(task)
      } else {
        // 如果任务不在当前列表中，尝试从API获取
        setDetailLoading(true)
        setDetailModalOpen(true)
        tasksApi.getById(taskId).then(res => {
          if (res.data) {
            setSelectedTask(res.data as TaskDetail)
          }
        }).catch(() => {
          message.warning('未找到指定任务')
          setDetailModalOpen(false)
        }).finally(() => {
          setDetailLoading(false)
        })
      }
    }
  }, [taskParam, tasks.length])

  // 当选择项目改变时更新 URL
  const handleProjectChange = (projectId: number | undefined) => {
    setSelectedProject(projectId)
    if (projectId) {
      setSearchParams({ project: String(projectId) })
    } else {
      setSearchParams({})
    }
  }

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
      const res = await tasksApi.updateStatus(taskId, { new_status: newStatus })
      message.success(res.message || '状态已更新')
      fetchTasks({ project_id: selectedProject })
      // 实时刷新任务详情以获取待审批信息
      if (selectedTask?.id === taskId) {
        try {
          const detailRes = await tasksApi.getById(taskId)
          setSelectedTask(detailRes.data as TaskDetail)
        } catch {
          // 如果获取详情失败，至少更新本地状态
          setSelectedTask({ ...selectedTask, status: newStatus })
        }
      }
    } catch {
      message.error('更新失败')
    }
  }

  // 打开任务详情
  const openTaskDetail = async (task: Task) => {
    setIsEditing(false)
    setSelectedTask(task as TaskDetail)  // 先设置基本信息
    setDetailModalOpen(true)
    setDetailLoading(true)
    // 获取完整的任务详情（包括审批信息）
    try {
      const res = await tasksApi.getById(task.id)
      setSelectedTask(res.data as TaskDetail)
    } catch (err) {
      console.error('Failed to load task detail:', err)
      // 保持使用基本信息
    } finally {
      setDetailLoading(false)
    }
  }

  // 审批状态变更
  const handleApproval = async (action: 'approve' | 'reject', comment?: string) => {
    if (!selectedTask) return
    setApproving(true)
    try {
      const res = await tasksApi.approveStatusChange(selectedTask.id, { action, comment })
      message.success(res.message || (action === 'approve' ? '审批通过' : '已拒绝'))
      fetchTasks({ project_id: selectedProject })
      // 刷新任务详情
      const detailRes = await tasksApi.getById(selectedTask.id)
      setSelectedTask(detailRes.data as TaskDetail)
    } catch {
      message.error('审批失败')
    } finally {
      setApproving(false)
    }
  }

  // 取消审批申请
  const handleCancelApproval = async () => {
    if (!selectedTask) return
    setCancelling(true)
    try {
      const res = await tasksApi.cancelApproval(selectedTask.id)
      message.success(res.message || '申请已取消')
      fetchTasks({ project_id: selectedProject })
      // 刷新任务详情
      const detailRes = await tasksApi.getById(selectedTask.id)
      setSelectedTask(detailRes.data as TaskDetail)
    } catch {
      message.error('取消失败')
    } finally {
      setCancelling(false)
    }
  }

  // 判断当前用户是否为待审批的申请人
  const isApprovalRequester = () => {
    if (!selectedTask?.pending_approval || !user) return false
    return selectedTask.pending_approval.requester?.id === user.id
  }

  // 开始编辑任务
  const startEditing = () => {
    if (selectedTask) {
      // 提取干系人ID列表
      const stakeholderIds = selectedTask.stakeholders?.map((s: any) => s.member_id || s.member?.id) || []
      editForm.setFieldsValue({
        title: selectedTask.title,
        description: selectedTask.description,
        requester_name: selectedTask.requester_name,
        priority: selectedTask.priority,
        estimated_hours: selectedTask.estimated_hours,
        due_date: selectedTask.due_date ? dayjs(selectedTask.due_date) : undefined,
        start_date: selectedTask.start_date ? dayjs(selectedTask.start_date) : undefined,
        stakeholder_ids: stakeholderIds,
      })
      setIsEditing(true)
    }
  }

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false)
    editForm.resetFields()
  }

  // 更新任务
  const handleUpdate = async (values: Partial<Task> & { due_date?: dayjs.Dayjs; start_date?: dayjs.Dayjs }) => {
    if (!selectedTask) return
    try {
      await tasksApi.update(selectedTask.id, {
        ...values,
        due_date: values.due_date?.format('YYYY-MM-DD'),
        start_date: values.start_date?.format('YYYY-MM-DD'),
      })
      message.success('任务更新成功')
      setIsEditing(false)
      fetchTasks({ project_id: selectedProject })
      // 重新获取任务详情以获取最新的干系人信息
      const detailRes = await tasksApi.getById(selectedTask.id)
      setSelectedTask(detailRes.data as TaskDetail)
    } catch {
      message.error('更新失败')
    }
  }

  // 删除任务
  const handleDelete = async () => {
    if (!selectedTask) return
    try {
      await tasksApi.delete(selectedTask.id)
      message.success('任务已删除')
      setDetailModalOpen(false)
      setSelectedTask(null)
      fetchTasks({ project_id: selectedProject })
    } catch {
      message.error('删除失败')
    }
  }

  // 判断是否可以编辑（管理员、创建者）
  const canEdit = (task?: Task | TaskDetail | null) => {
    const t = task || selectedTask
    if (!t || !user) return false
    if (user.role === 'admin') return true
    // 创建者可以编辑
    const creatorId = (t as any).created_by?.id
    if (creatorId === user.id) return true
    return false
  }

  // 判断是否可以删除（创建者或管理员）
  const canDelete = () => {
    if (!selectedTask || !user) return false
    if (user.role === 'admin') return true
    // 检查 created_by 字段
    const creatorId = (selectedTask as any).created_by?.id || (selectedTask as any).created_by
    return creatorId === user.id
  }

  // 判断是否可以修改状态（仅管理员、创建者）
  const canChangeStatus = (task?: Task | TaskDetail | null) => {
    const t = task || selectedTask
    if (!t || !user) return false
    if (user.role === 'admin') return true
    // 创建者可以修改状态
    const creatorId = (t as any).created_by?.id
    if (creatorId === user.id) return true
    return false
  }

  // 渲染任务卡片
  const renderTaskCard = (task: Task) => {
    const priorityConfig = PRIORITY_CONFIG[task.priority]
    const canModifyStatus = canChangeStatus(task)
    
    // 只显示可转换的状态（如果有权限）
    const menuItems: MenuProps['items'] = canModifyStatus 
      ? KANBAN_COLUMNS
          .filter(s => s !== task.status && canTransitionTo(task.status, s))
          .map(status => ({
            key: status,
            label: `移至 ${STATUS_CONFIG[status].label}`,
            onClick: () => handleStatusChange(task.id, status),
          }))
      : []

    return (
      <div key={task.id} className="kanban-card" onClick={() => openTaskDetail(task)}>
        <div className="kanban-card-header">
          <Tag color={priorityConfig.color} style={{ margin: 0 }}>
            {priorityConfig.label}
          </Tag>
          {canModifyStatus && menuItems.length > 0 && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button 
                type="text" 
                size="small" 
                icon={<MoreOutlined />}
                onClick={e => e.stopPropagation()}
              />
            </Dropdown>
          )}
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
        {/* 显示需求方、审核人、创建人 */}
        <div className="kanban-card-people">
          {task.requester_name && (
            <Tooltip title={`需求方: ${task.requester_name}`}>
              <Tag color="orange" style={{ margin: '2px' }}>需求: {task.requester_name}</Tag>
            </Tooltip>
          )}
          {task.stakeholders && task.stakeholders.length > 0 && (
            <Tooltip title={`审核人: ${task.stakeholders.map((s: any) => s.name || s.member?.name).join(', ')}`}>
              <Tag color="blue" style={{ margin: '2px' }}>
                审核: {task.stakeholders.length > 1 
                  ? `${(task.stakeholders[0] as any).name || (task.stakeholders[0] as any).member?.name}等${task.stakeholders.length}人`
                  : (task.stakeholders[0] as any).name || (task.stakeholders[0] as any).member?.name
                }
              </Tag>
            </Tooltip>
          )}
          {task.created_by && (
            <Tooltip title={`创建人: ${task.created_by.name}`}>
              <Tag color="green" style={{ margin: '2px' }}>创建: {task.created_by.name}</Tag>
            </Tooltip>
          )}
        </div>
        <div className="kanban-card-footer">
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
            onChange={handleProjectChange}
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
            <Form.Item 
              name="requester_name" 
              label="需求方" 
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入需求方' }]}
            >
              <Input placeholder="输入需求方名称" />
            </Form.Item>
            <Form.Item name="priority" label="优先级" initialValue="medium" style={{ flex: 1 }}>
              <Select>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <Select.Option key={key} value={key}>{config.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item 
            name="stakeholder_ids" 
            label="审核人（可多选，创建后会收到通知）"
            rules={[{ required: true, message: '请选择审核人' }]}
          >
            <Select mode="multiple" placeholder="选择审核人">
              {members.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="estimated_hours" label="预估工时" style={{ flex: 1 }}>
              <InputNumber min={0.5} step={0.5} addonAfter="小时" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="start_date" label="开始日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
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
        onCancel={() => { setDetailModalOpen(false); setIsEditing(false); editForm.resetFields(); }}
        footer={null}
        width={700}
        className="task-detail-modal"
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : selectedTask && (
          <div className="task-detail">
            {!isEditing ? (
              // 查看模式
              <>
                <div className="task-detail-header">
                  <Tag color={PRIORITY_CONFIG[selectedTask.priority]?.color || '#6B7280'}>
                    {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                  </Tag>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canChangeStatus() ? (
                      <Tooltip title={selectedTask.pending_approval ? '有待审批的状态变更，请等待审批完成或取消申请' : ''}>
                        <Select
                          value={selectedTask.status}
                          onChange={(v) => handleStatusChange(selectedTask.id, v)}
                          style={{ width: 120 }}
                          disabled={!!selectedTask.pending_approval}
                        >
                          {KANBAN_COLUMNS.map(s => (
                            <Select.Option 
                              key={s} 
                              value={s}
                              disabled={!canTransitionTo(selectedTask.status, s)}
                            >
                              {STATUS_CONFIG[s].label}
                            </Select.Option>
                          ))}
                        </Select>
                      </Tooltip>
                    ) : (
                      <Tag style={{ 
                        background: STATUS_CONFIG[selectedTask.status]?.bg, 
                        color: STATUS_CONFIG[selectedTask.status]?.color,
                        border: 'none',
                        padding: '4px 12px'
                      }}>
                        {STATUS_CONFIG[selectedTask.status]?.label}
                      </Tag>
                    )}
                    {canEdit() && (
                      <Tooltip title={selectedTask.pending_approval ? '有待审批的状态变更，请等待审批完成或取消申请' : ''}>
                        <Button 
                          icon={<EditOutlined />} 
                          onClick={startEditing}
                          disabled={!!selectedTask.pending_approval}
                        >
                          编辑
                        </Button>
                      </Tooltip>
                    )}
                    {canDelete() && (
                      <Tooltip title={selectedTask.pending_approval ? '有待审批的状态变更，请等待审批完成或取消申请' : ''}>
                        <span>
                          <Popconfirm
                            title="确认删除"
                            description="确定要删除这个任务吗？此操作不可撤销。"
                            onConfirm={handleDelete}
                            okText="确认"
                            cancelText="取消"
                            disabled={!!selectedTask.pending_approval}
                          >
                            <Button danger icon={<DeleteOutlined />} disabled={!!selectedTask.pending_approval}>
                              删除
                            </Button>
                          </Popconfirm>
                        </span>
                      </Tooltip>
                    )}
                  </div>
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
                    <span className="label">需求方</span>
                    <span className="value">
                      {selectedTask.requester_name || '-'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">创建人</span>
                    <span className="value">
                      {selectedTask.created_by ? (
                        <Avatar size="small" style={{ background: '#10B981', marginRight: 8 }}>
                          {selectedTask.created_by.name?.charAt(0)}
                        </Avatar>
                      ) : null}
                      {selectedTask.created_by?.name || '-'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">预估工时</span>
                    <span className="value">{selectedTask.estimated_hours ? `${selectedTask.estimated_hours}h` : '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">实际工时</span>
                    <span className="value">{selectedTask.actual_hours ? `${Number(selectedTask.actual_hours)}h` : '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">开始日期</span>
                    <span className="value">{selectedTask.start_date || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">截止日期</span>
                    <span className="value">{selectedTask.due_date || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">创建时间</span>
                    <span className="value">{selectedTask.created_at ? dayjs(selectedTask.created_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                  </div>
                </div>
                {selectedTask.stakeholders && selectedTask.stakeholders.length > 0 && (
                  <div className="task-detail-stakeholders">
                    <h4>审核人</h4>
                    <div className="stakeholder-list">
                      {selectedTask.stakeholders.map((s: any) => (
                        <Tag key={s.id} color="blue">
                          {s.name || s.member?.name}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 待审批信息 */}
                {selectedTask.pending_approval && (
                  <div className="task-detail-approval" style={{ marginTop: 20, padding: 16, background: '#FEF3C7', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LoadingOutlined style={{ color: '#D97706' }} />
                        等待审批
                      </h4>
                      {/* 申请人可以取消申请 */}
                      {isApprovalRequester() && (
                        <Popconfirm
                          title="确认取消"
                          description="确定要取消此状态变更申请吗？"
                          onConfirm={handleCancelApproval}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button 
                            size="small" 
                            danger
                            loading={cancelling}
                          >
                            取消申请
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                    <p style={{ margin: '0 0 12px', color: '#92400E' }}>
                      {selectedTask.pending_approval.requester?.name} 请求将状态从 
                      「{STATUS_CONFIG[selectedTask.pending_approval.from_status as TaskStatus]?.label || selectedTask.pending_approval.from_status}」
                      变更为「{STATUS_CONFIG[selectedTask.pending_approval.to_status as TaskStatus]?.label || selectedTask.pending_approval.to_status}」
                    </p>
                    <div style={{ marginBottom: 12 }}>
                      <strong>审批进度：</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {selectedTask.pending_approval.approvals.map(a => (
                          <Tag 
                            key={a.id}
                            color={a.approval_status === 'approved' ? 'success' : a.approval_status === 'rejected' ? 'error' : 'warning'}
                            icon={a.approval_status === 'approved' ? <CheckCircleOutlined /> : a.approval_status === 'rejected' ? <CloseCircleOutlined /> : <LoadingOutlined />}
                          >
                            {a.stakeholder_name}: {a.approval_status === 'approved' ? '已通过' : a.approval_status === 'rejected' ? '已拒绝' : '待审批'}
                          </Tag>
                        ))}
                      </div>
                    </div>
                    
                    {/* 如果当前用户有待审批项，显示审批按钮 */}
                    {selectedTask.pending_approval.approvals.some(
                      a => a.stakeholder_id === user?.id && a.approval_status === 'pending'
                    ) && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <Button 
                          type="primary" 
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleApproval('approve')}
                          loading={approving}
                        >
                          通过
                        </Button>
                        <Button 
                          danger 
                          icon={<CloseCircleOutlined />}
                          onClick={() => handleApproval('reject')}
                          loading={approving}
                        >
                          拒绝
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // 编辑模式
              <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
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
                  <Form.Item 
                    name="requester_name" 
                    label="需求方" 
                    style={{ flex: 1 }}
                    rules={[{ required: true, message: '请输入需求方' }]}
                  >
                    <Input placeholder="输入需求方名称" />
                  </Form.Item>
                  <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
                    <Select>
                      {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <Select.Option key={key} value={key}>{config.label}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
                <Form.Item 
                  name="stakeholder_ids" 
                  label="审核人（可多选）"
                  rules={[{ required: true, message: '请选择审核人' }]}
                >
                  <Select mode="multiple" placeholder="选择审核人">
                    {members.map(m => (
                      <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Form.Item name="estimated_hours" label="预估工时" style={{ flex: 1 }}>
                    <InputNumber min={0.5} step={0.5} addonAfter="小时" style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="start_date" label="开始日期" style={{ flex: 1 }}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </div>
                <Form.Item name="due_date" label="截止日期">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button onClick={cancelEditing}>取消</Button>
                  <Button type="primary" htmlType="submit">保存</Button>
                </div>
              </Form>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
