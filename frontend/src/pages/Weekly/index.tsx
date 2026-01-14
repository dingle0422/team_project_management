import { useEffect, useState } from 'react'
import { 
  Button, Modal, Form, Select, DatePicker, 
  message, Spin, Card, List, Avatar, Tag, Empty 
} from 'antd'
import { PlusOutlined, RobotOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { weeklyReportsApi } from '@/services/api'
import type { WeeklyReport } from '@/types'
import './index.css'

export default function Weekly() {
  const { user } = useAuthStore()
  const { projects } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [form] = Form.useForm()

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
  const openDetail = (report: WeeklyReport) => {
    setSelectedReport(report)
    setDetailModalOpen(true)
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
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedReport && (
          <div className="report-detail">
            <div className="report-detail-header">
              <Tag color={selectedReport.report_type === 'personal' ? 'blue' : 'green'}>
                {selectedReport.report_type === 'personal' ? '个人周报' : '项目周报'}
              </Tag>
              <span>{selectedReport.week_start} ~ {selectedReport.week_end}</span>
            </div>
            
            <h2>
              {selectedReport.report_type === 'personal' 
                ? `${selectedReport.member?.name} 的周报`
                : `${selectedReport.project?.name} 周报`
              }
            </h2>

            <div className="report-section">
              <h4>📝 本周总结</h4>
              <p>{selectedReport.summary}</p>
            </div>

            <div className="report-section">
              <h4>✅ 主要成果</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.achievements}</p>
            </div>

            {selectedReport.issues && (
              <div className="report-section">
                <h4>⚠️ 问题与挑战</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.issues}</p>
              </div>
            )}

            {selectedReport.next_week_plan && (
              <div className="report-section">
                <h4>📅 下周计划</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.next_week_plan}</p>
              </div>
            )}

            <div className="report-meta">
              <span>生成时间: {dayjs(selectedReport.generated_at).format('YYYY-MM-DD HH:mm')}</span>
              {selectedReport.ai_model && (
                <Tag icon={<RobotOutlined />} color="purple">{selectedReport.ai_model}</Tag>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
