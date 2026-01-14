import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Button, Modal, Form, Input, Select, DatePicker, 
  message, Spin, Tag, Progress, Card, Row, Col 
} from 'antd'
import { PlusOutlined, TeamOutlined, CalendarOutlined, FolderOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/useAppStore'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'
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
  
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form] = Form.useForm()
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
              onClick={() => navigate(`/projects/${project.id}`)}
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
                {project.start_date && (
                  <span>
                    <CalendarOutlined /> {dayjs(project.start_date).format('YYYY-MM-DD')}
                  </span>
                )}
                <span>
                  <TeamOutlined /> {project.owner?.name || '-'}
                </span>
              </div>
              <Progress 
                percent={30} 
                size="small" 
                strokeColor="#F59E0B"
                format={() => '3/10'}
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
          <Form.Item name="description" label="项目描述">
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
    </div>
  )
}
