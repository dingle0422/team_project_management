import { useEffect, useState } from 'react'
import { 
  Button, Modal, Form, Select, DatePicker, Input, Popconfirm,
  message, Spin, Card, List, Avatar, Tag, Empty 
} from 'antd'
import { PlusOutlined, RobotOutlined, FileTextOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { weeklyReportsApi } from '@/services/api'
import type { WeeklyReport } from '@/types'
import './index.css'

const { TextArea } = Input

export default function Weekly() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await weeklyReportsApi.getList({ page_size: 50 })
      setReports(res.data.items)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成周报
  const handleGenerate = async (values: {
    report_type: 'personal' | 'project'
    project_id?: number
    week: dayjs.Dayjs
  }) => {
    setGenerating(true)
    try {
      const weekStart = values.week.startOf('week').format('YYYY-MM-DD')
      const weekEnd = values.week.endOf('week').format('YYYY-MM-DD')
      
      if (values.report_type === 'personal') {
        await weeklyReportsApi.generatePersonal({ week_start: weekStart, week_end: weekEnd })
      } else {
        if (!values.project_id) {
          message.error('请选择项目')
          return
        }
        await weeklyReportsApi.generateProject({
          project_id: values.project_id,
          week_start: weekStart,
          week_end: weekEnd,
        })
      }
      
      message.success('周报生成成功')
      setGenerateModalOpen(false)
      form.resetFields()
      loadData()
    } catch (err) {
      message.error('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 查看详情
  const openDetail = async (report: WeeklyReport) => {
    setIsEditing(false)
    setSelectedReport(report)  // 先显示基本信息
    setDetailModalOpen(true)
    setDetailLoading(true)
    try {
      const res = await weeklyReportsApi.getById(report.id)
      setSelectedReport(res.data)
    } catch (err) {
      console.error('Failed to load report detail:', err)
      // 保持使用基本信息
    } finally {
      setDetailLoading(false)
    }
  }

  // 编辑周报
  const startEditing = () => {
    if (selectedReport) {
      editForm.setFieldsValue({
        edited_summary: selectedReport.edited_summary || selectedReport.summary,
        edited_achievements: selectedReport.edited_achievements || selectedReport.achievements,
        edited_issues: selectedReport.edited_issues || selectedReport.issues,
        edited_next_week_plan: selectedReport.edited_next_week_plan || selectedReport.next_week_plan,
      })
      setIsEditing(true)
    }
  }

  // 保存编辑
  const handleSaveEdit = async (values: {
    edited_summary?: string
    edited_achievements?: string
    edited_issues?: string
    edited_next_week_plan?: string
  }) => {
    if (!selectedReport) return
    try {
      const res = await weeklyReportsApi.update(selectedReport.id, values)
      message.success('周报已更新')
      setSelectedReport(res.data)
      setIsEditing(false)
      loadData()
    } catch (err) {
      message.error('更新失败')
    }
  }

  // 删除周报
  const handleDelete = async () => {
    if (!selectedReport) return
    try {
      await weeklyReportsApi.delete(selectedReport.id)
      message.success('周报已删除')
      setDetailModalOpen(false)
      setSelectedReport(null)
      loadData()
    } catch (err) {
      message.error('删除失败')
    }
  }

  // 判断是否可以编辑/删除（个人周报本人可编辑，项目周报项目创建者可编辑）
  const canEditOrDelete = () => {
    if (!selectedReport || !user) return false
    if (user.role === 'admin') return true
    if (selectedReport.report_type === 'personal') {
      return selectedReport.member_id === user.id
    }
    // 项目周报暂时允许所有人编辑
    return true
  }

  if (loading && reports.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="weekly-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>周报中心</h1>
          <p className="subtitle">AI 自动生成个人和项目周报</p>
        </div>
        <Button 
          type="primary" 
          icon={<RobotOutlined />}
          onClick={() => setGenerateModalOpen(true)}
        >
          生成周报
        </Button>
      </div>

      {/* 周报列表 */}
      {reports.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无周报"
          >
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setGenerateModalOpen(true)}
            >
              生成第一份周报
            </Button>
          </Empty>
        </Card>
      ) : (
        <List
          grid={{ gutter: 24, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
          dataSource={reports}
          renderItem={(report) => (
            <List.Item>
              <Card 
                className="report-card"
                hoverable
                onClick={() => openDetail(report)}
              >
                <div className="report-header">
                  <Tag color={report.report_type === 'personal' ? 'blue' : 'green'}>
                    {report.report_type === 'personal' ? '个人周报' : '项目周报'}
                  </Tag>
                  <span className="report-date">
                    {dayjs(report.generated_at).format('YYYY-MM-DD')}
                  </span>
                </div>
                <h3 className="report-title">
                  {report.report_type === 'personal' 
                    ? `${report.member?.name} 的周报`
                    : `${report.project?.name} 周报`
                  }
                </h3>
                <p className="report-period">
                  {report.week_start} ~ {report.week_end}
                </p>
                <p className="report-summary">{report.summary}</p>
                <div className="report-footer">
                  {report.ai_model && (
                    <Tag icon={<RobotOutlined />} color="purple">
                      {report.ai_model}
                    </Tag>
                  )}
                  {report.is_reviewed && (
                    <Tag color="success">已审阅</Tag>
                  )}
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      {/* 生成周报弹窗 */}
      <Modal
        title="生成周报"
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item
            name="report_type"
            label="周报类型"
            rules={[{ required: true, message: '请选择类型' }]}
            initialValue="personal"
          >
            <Select>
              <Select.Option value="personal">个人周报</Select.Option>
              <Select.Option value="project">项目周报</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.report_type !== curr.report_type}
          >
            {({ getFieldValue }) => 
              getFieldValue('report_type') === 'project' && (
                <Form.Item
                  name="project_id"
                  label="选择项目"
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
              )
            }
          </Form.Item>

          <Form.Item
            name="week"
            label="选择周"
            rules={[{ required: true, message: '请选择周' }]}
            initialValue={dayjs().startOf('week')}
          >
            <DatePicker picker="week" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={generating}
              icon={<RobotOutlined />}
            >
              {generating ? 'AI 正在生成...' : '生成周报'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 周报详情弹窗 */}
      <Modal
        title={null}
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setIsEditing(false); editForm.resetFields(); }}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : selectedReport && (
          <div className="report-detail">
            {!isEditing ? (
              // 查看模式
              <>
                <div className="report-detail-header">
                  <div>
                    <Tag color={selectedReport.report_type === 'personal' ? 'blue' : 'green'}>
                      {selectedReport.report_type === 'personal' ? '个人周报' : '项目周报'}
                    </Tag>
                    <span style={{ marginLeft: 8 }}>{selectedReport.week_start} ~ {selectedReport.week_end}</span>
                  </div>
                  {canEditOrDelete() && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button icon={<EditOutlined />} onClick={startEditing}>编辑</Button>
                      <Popconfirm
                        title="确认删除"
                        description="确定要删除这份周报吗？此操作不可撤销。"
                        onConfirm={handleDelete}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </div>
                  )}
                </div>
                
                <h2>
                  {selectedReport.report_type === 'personal' 
                    ? `${selectedReport.member?.name} 的周报`
                    : `${selectedReport.project?.name} 周报`
                  }
                </h2>

                <div className="report-section">
                  <h4>📝 本周总结</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.edited_summary || selectedReport.summary || '暂无内容'}</p>
                </div>

                <div className="report-section">
                  <h4>✅ 主要成果</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.edited_achievements || selectedReport.achievements || '暂无内容'}</p>
                </div>

                {(selectedReport.edited_issues || selectedReport.issues) && (
                  <div className="report-section">
                    <h4>⚠️ 问题与挑战</h4>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.edited_issues || selectedReport.issues}</p>
                  </div>
                )}

                {(selectedReport.edited_next_week_plan || selectedReport.next_week_plan) && (
                  <div className="report-section">
                    <h4>📅 下周计划</h4>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.edited_next_week_plan || selectedReport.next_week_plan}</p>
                  </div>
                )}

                <div className="report-meta">
                  <span>生成时间: {dayjs(selectedReport.generated_at).format('YYYY-MM-DD HH:mm')}</span>
                  {selectedReport.ai_model && (
                    <Tag icon={<RobotOutlined />} color="purple">{selectedReport.ai_model}</Tag>
                  )}
                </div>
              </>
            ) : (
              // 编辑模式
              <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
                <div className="report-detail-header">
                  <div>
                    <Tag color={selectedReport.report_type === 'personal' ? 'blue' : 'green'}>
                      {selectedReport.report_type === 'personal' ? '个人周报' : '项目周报'}
                    </Tag>
                    <span style={{ marginLeft: 8 }}>{selectedReport.week_start} ~ {selectedReport.week_end}</span>
                  </div>
                </div>
                
                <h2 style={{ marginBottom: 16 }}>
                  编辑: {selectedReport.report_type === 'personal' 
                    ? `${selectedReport.member?.name} 的周报`
                    : `${selectedReport.project?.name} 周报`
                  }
                </h2>

                <Form.Item
                  name="edited_summary"
                  label="本周总结"
                >
                  <TextArea rows={3} placeholder="本周总结..." />
                </Form.Item>

                <Form.Item
                  name="edited_achievements"
                  label="主要成果"
                >
                  <TextArea rows={4} placeholder="主要成果..." />
                </Form.Item>

                <Form.Item
                  name="edited_issues"
                  label="问题与挑战"
                >
                  <TextArea rows={3} placeholder="问题与挑战..." />
                </Form.Item>

                <Form.Item
                  name="edited_next_week_plan"
                  label="下周计划"
                >
                  <TextArea rows={3} placeholder="下周计划..." />
                </Form.Item>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setIsEditing(false); editForm.resetFields(); }}>取消</Button>
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
