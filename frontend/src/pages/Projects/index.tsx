import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Button, Modal, Form, Input, Select, DatePicker, Popconfirm,
  message, Spin, Tag, Progress, Card, Row, Col, List, Empty
} from 'antd'
import { 
  PlusOutlined, TeamOutlined, CalendarOutlined, FolderOutlined,
  EditOutlined, UnorderedListOutlined, FileTextOutlined, EyeOutlined, DeleteOutlined, UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/useAppStore'
import { useAuthStore } from '@/store/useAuthStore'
import { projectsApi, meetingsApi } from '@/services/api'
import type { Project, Meeting } from '@/types'
import './index.css'

const { TextArea } = Input

// 项目状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: '规划中', color: 'default' },
  active: { label: '进行中', color: 'processing' },
  on_hold: { label: '暂停', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
  cancelled: { label: '已取消', color: 'error' },
}

export default function Projects() {
  const navigate = useNavigate()
  const { projects, fetchProjects, projectsLoading, members } = useAppStore()
  const { user } = useAuthStore()
  
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [meetingsModalOpen, setMeetingsModalOpen] = useState(false)
  const [meetingDetailModalOpen, setMeetingDetailModalOpen] = useState(false)
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectMeetings, setProjectMeetings] = useState<Meeting[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [editMeetingModalOpen, setEditMeetingModalOpen] = useState(false)
  
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editMeetingForm] = Form.useForm()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // 创建项目
  const handleCreate = async (values: Partial<Project> & { 
    start_date?: dayjs.Dayjs
    end_date?: dayjs.Dayjs 
  }) => {
    try {
      await projectsApi.create({
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      })
      message.success('项目创建成功')
      setCreateModalOpen(false)
      form.resetFields()
      fetchProjects()
    } catch {
      message.error('创建失败')
    }
  }

  // 打开项目详情
  const openProjectDetail = (project: Project) => {
    setSelectedProject(project)
    setDetailModalOpen(true)
  }

  // 打开编辑弹窗
  const openEditModal = () => {
    if (selectedProject) {
      editForm.setFieldsValue({
        name: selectedProject.name,
        code: selectedProject.code,
        description: selectedProject.description,
        business_party: selectedProject.business_party,
        status: selectedProject.status,
        start_date: selectedProject.start_date ? dayjs(selectedProject.start_date) : undefined,
        end_date: selectedProject.end_date ? dayjs(selectedProject.end_date) : undefined,
      })
      setDetailModalOpen(false)
      setEditModalOpen(true)
    }
  }

  // 更新项目
  const handleUpdate = async (values: Partial<Project> & { 
    start_date?: dayjs.Dayjs
    end_date?: dayjs.Dayjs 
  }) => {
    if (!selectedProject) return
    try {
      await projectsApi.update(selectedProject.id, {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      })
      message.success('项目更新成功')
      setEditModalOpen(false)
      editForm.resetFields()
      fetchProjects()
    } catch {
      message.error('更新失败')
    }
  }

  // 删除项目
  const handleDelete = async () => {
    if (!selectedProject) return
    try {
      await projectsApi.delete(selectedProject.id)
      message.success('项目已删除')
      setDetailModalOpen(false)
      setSelectedProject(null)
      fetchProjects()
    } catch {
      message.error('删除失败')
    }
  }

  // 判断是否可以编辑/删除（管理员可以编辑/删除任何项目，普通用户只能编辑/删除自己创建的）
  const canEditOrDelete = () => {
    if (!selectedProject || !user) return false
    // 管理员可以编辑/删除任何项目，普通用户只能编辑/删除自己创建的项目
    return user.role === 'admin' || selectedProject.created_by === user.id
  }

  // 跳转到任务页面
  const goToTasks = () => {
    if (selectedProject) {
      setDetailModalOpen(false)
      navigate(`/tasks?project=${selectedProject.id}`)
    }
  }

  // 打开会议纪要列表
  const openMeetingsList = async () => {
    if (!selectedProject) return
    setDetailModalOpen(false)
    setMeetingsModalOpen(true)
    setMeetingsLoading(true)
    try {
      const res = await meetingsApi.getList({ project_id: selectedProject.id })
      setProjectMeetings(res.data.items)
    } catch {
      message.error('获取会议纪要失败')
    } finally {
      setMeetingsLoading(false)
    }
  }

  // 打开会议详情
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
      if (selectedProject) {
        const res = await meetingsApi.getList({ project_id: selectedProject.id })
        setProjectMeetings(res.data.items)
      }
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
      if (selectedProject) {
        const res = await meetingsApi.getList({ project_id: selectedProject.id })
        setProjectMeetings(res.data.items)
      }
    } catch (error: unknown) {
      const err = error as Error
      message.error(err.message || '删除失败')
    }
  }

  // 过滤项目
  const filteredProjects = statusFilter 
    ? projects.filter(p => p.status === statusFilter)
    : projects

  if (projectsLoading && projects.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="projects-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>项目管理</h1>
          <p className="subtitle">共 {projects.length} 个项目</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <Select.Option key={key} value={key}>{config.label}</Select.Option>
            ))}
          </Select>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新建项目
          </Button>
        </div>
      </div>

      {/* 项目列表 */}
      <Row gutter={[24, 24]}>
        {filteredProjects.map(project => (
          <Col key={project.id} xs={24} sm={12} lg={8} xl={6}>
            <Card 
              className="project-card"
              hoverable
              onClick={() => openProjectDetail(project)}
            >
              <div className="project-card-header">
                <div className="project-icon">
                  <FolderOutlined />
                </div>
                <Tag color={STATUS_CONFIG[project.status]?.color}>
                  {STATUS_CONFIG[project.status]?.label}
                </Tag>
              </div>
              <h3 className="project-name">{project.name}</h3>
              <p className="project-code">{project.code}</p>
              {project.description && (
                <p className="project-desc">{project.description}</p>
              )}
              <div className="project-meta">
                <span>
                  <UserOutlined /> 创建人: {project.creator?.name || '-'}
                </span>
                <span>
                  <TeamOutlined /> 业务方: {project.business_party || '-'}
                </span>
              </div>
              <Progress 
                percent={project.task_stats?.total ? Math.round((project.task_stats.completed / project.task_stats.total) * 100) : 0} 
                size="small" 
                strokeColor="#F59E0B"
                format={() => `${project.task_stats?.completed || 0}/${project.task_stats?.total || 0}`}
              />
            </Card>
          </Col>
        ))}
        {filteredProjects.length === 0 && (
          <Col span={24}>
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <div className="empty-state-text">暂无项目</div>
            </div>
          </Col>
        )}
      </Row>

      {/* 创建项目弹窗 */}
      <Modal
        title="新建项目"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="输入项目名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="项目代号"
            rules={[{ required: true, message: '请输入项目代号' }]}
          >
            <Input placeholder="例如: PROJ-001" />
          </Form.Item>
          <Form.Item 
            name="business_party" 
            label="业务方"
            rules={[{ required: true, message: '请输入业务方' }]}
          >
            <Input placeholder="输入业务方名称" />
          </Form.Item>
          <Form.Item 
            name="description" 
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <TextArea rows={3} placeholder="描述项目目标和范围..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="start_date" label="开始日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="end_date" label="结束日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="status" label="项目状态" initialValue="planning">
            <Select>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <Select.Option key={key} value={key}>{config.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建项目
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目详情弹窗 */}
      <Modal
        title={null}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={500}
      >
        {selectedProject && (
          <div className="project-detail">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: '#FEF3C7', display: 'flex', 
                alignItems: 'center', justifyContent: 'center',
                fontSize: 24
              }}>
                <FolderOutlined style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h2 style={{ margin: 0 }}>{selectedProject.name}</h2>
                <p style={{ margin: 0, color: '#6B7280' }}>{selectedProject.code}</p>
              </div>
              <Tag color={STATUS_CONFIG[selectedProject.status]?.color} style={{ marginLeft: 'auto' }}>
                {STATUS_CONFIG[selectedProject.status]?.label}
              </Tag>
            </div>
            
            {selectedProject.description && (
              <p style={{ color: '#6B7280', marginBottom: 16 }}>{selectedProject.description}</p>
            )}
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20, color: '#6B7280', fontSize: 14 }}>
              {selectedProject.start_date && (
                <span><CalendarOutlined /> 开始: {selectedProject.start_date}</span>
              )}
              {selectedProject.end_date && (
                <span><CalendarOutlined /> 截止: {selectedProject.end_date}</span>
              )}
              <span><TeamOutlined /> 负责人: {selectedProject.owner?.name || '-'}</span>
              <span><UserOutlined /> 创建人: {selectedProject.creator?.name || '-'}</span>
              <span>📋 业务方: {selectedProject.business_party || '-'}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {canEditOrDelete() && (
                <Button 
                  type="primary" 
                  icon={<EditOutlined />} 
                  block
                  onClick={openEditModal}
                >
                  编辑项目
                </Button>
              )}
              <Button 
                icon={<UnorderedListOutlined />} 
                block
                onClick={goToTasks}
              >
                查看任务
              </Button>
              <Button 
                icon={<FileTextOutlined />} 
                block
                onClick={openMeetingsList}
              >
                会议纪要
              </Button>
              {canEditOrDelete() && (
                <Popconfirm
                  title="确认删除"
                  description="确定要删除这个项目吗？此操作不可撤销，项目下的所有任务也将被删除。"
                  onConfirm={handleDelete}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    block
                  >
                    删除项目
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑项目弹窗 */}
      <Modal
        title="编辑项目"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="输入项目名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="项目代号"
            rules={[{ required: true, message: '请输入项目代号' }]}
          >
            <Input placeholder="例如: PROJ-001" />
          </Form.Item>
          <Form.Item 
            name="business_party" 
            label="业务方"
            rules={[{ required: true, message: '请输入业务方' }]}
          >
            <Input placeholder="输入业务方名称" />
          </Form.Item>
          <Form.Item 
            name="description" 
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <TextArea rows={3} placeholder="描述项目目标和范围..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="start_date" label="开始日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="end_date" label="结束日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="status" label="项目状态">
            <Select>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <Select.Option key={key} value={key}>{config.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 会议纪要列表弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined />
            {selectedProject?.name} - 会议纪要
          </div>
        }
        open={meetingsModalOpen}
        onCancel={() => setMeetingsModalOpen(false)}
        footer={null}
        width={600}
      >
        {meetingsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <Spin />
          </div>
        ) : projectMeetings.length > 0 ? (
          <List
            dataSource={projectMeetings}
            renderItem={(meeting) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px 0' }}
                onClick={() => openMeetingDetail(meeting)}
                actions={[
                  <Button 
                    type="link" 
                    icon={<EyeOutlined />}
                    onClick={(e) => { e.stopPropagation(); openMeetingDetail(meeting); }}
                  >
                    查看
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={meeting.title}
                  description={
                    <div style={{ display: 'flex', gap: 16, color: '#6B7280', fontSize: 12 }}>
                      <span><CalendarOutlined /> {meeting.meeting_date}</span>
                      {meeting.creator && <span><TeamOutlined /> {meeting.creator.name}</span>}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无会议纪要" />
        )}
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
              {selectedMeeting.creator && <span><TeamOutlined /> 创建人: {selectedMeeting.creator.name}</span>}
            </div>
            
            {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4>参会人员</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedMeeting.attendees.map(a => (
                    <Tag key={a.id}>{a.name}</Tag>
                  ))}
                </div>
              </div>
            )}
            
            {selectedMeeting.summary && (
              <div style={{ marginBottom: 16 }}>
                <h4>会议摘要</h4>
                <p style={{ whiteSpace: 'pre-wrap', background: '#F9FAFB', padding: 12, borderRadius: 8 }}>
                  {selectedMeeting.summary}
                </p>
              </div>
            )}
            
            {selectedMeeting.content && (
              <div>
                <h4>会议内容</h4>
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
