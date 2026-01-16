import { useEffect, useState, useMemo } from 'react'
import { 
  Button, Modal, Form, Select, DatePicker, Input, Popconfirm,
  message, Spin, Card, List, Tag, Empty, Tabs, Calendar, Badge 
} from 'antd'
import { PlusOutlined, RobotOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UserOutlined, ProjectOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { weeklyReportsApi } from '@/services/api'
import type { WeeklyReport } from '@/types'
import './index.css'

// 启用 ISO 周插件
dayjs.extend(isoWeek)

const { TextArea } = Input
const { confirm } = Modal

export default function Weekly() {
  const { user } = useAuthStore()
  const { projects, members, fetchMembers } = useAppStore()
  const isAdmin = user?.role === 'admin'
  
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
  
  // Tab 和筛选状态
  const [activeTab, setActiveTab] = useState<'personal' | 'project'>('personal')
  const [filterMemberId, setFilterMemberId] = useState<number | undefined>()
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>()
  
  // 日历相关状态
  const [calendarDate, setCalendarDate] = useState(dayjs())
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null)
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    fetchMembers()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await weeklyReportsApi.getList({ page_size: 100 })
      setReports(res.data.items)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取某个日期所属的周信息（周一为起始）
  const getWeekRange = (date: Dayjs) => {
    const weekStart = date.startOf('isoWeek').format('YYYY-MM-DD')
    const weekEnd = date.endOf('isoWeek').format('YYYY-MM-DD')
    return { weekStart, weekEnd }
  }

  // 获取包含周报的周列表（用于日历标记）
  const weekReportsMap = useMemo(() => {
    const map: Record<string, WeeklyReport[]> = {}
    const filteredByTab = reports.filter(r => r.report_type === activeTab)
    
    filteredByTab.forEach(report => {
      const key = `${report.week_start}_${report.week_end}`
      if (!map[key]) {
        map[key] = []
      }
      map[key].push(report)
    })
    return map
  }, [reports, activeTab])

  // 根据 Tab、筛选条件和选中的周过滤并排序周报
  const filteredReports = useMemo(() => {
    let result = reports.filter(r => r.report_type === activeTab)
    
    // 应用成员/项目筛选
    if (activeTab === 'personal' && filterMemberId) {
      result = result.filter(r => r.member?.id === filterMemberId)
    }
    if (activeTab === 'project' && filterProjectId) {
      result = result.filter(r => r.project?.id === filterProjectId)
    }
    
    // 应用周筛选
    if (selectedWeekStart && selectedWeekEnd) {
      result = result.filter(r => 
        r.week_start === selectedWeekStart && r.week_end === selectedWeekEnd
      )
    }
    
    // 按生成时间倒序排列
    return result.sort((a, b) => 
      new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    )
  }, [reports, activeTab, filterMemberId, filterProjectId, selectedWeekStart, selectedWeekEnd])

  // 执行生成周报
  const doGenerate = async (
    reportType: 'personal' | 'project',
    weekStart: string,
    weekEnd: string,
    projectId?: number
  ) => {
    setGenerating(true)
    try {
      if (reportType === 'personal') {
        await weeklyReportsApi.generatePersonal({ week_start: weekStart, week_end: weekEnd })
      } else {
        await weeklyReportsApi.generateProject({
          project_id: projectId!,
          week_start: weekStart,
          week_end: weekEnd,
        })
      }
      
      message.success('周报生成成功')
      setGenerateModalOpen(false)
      form.resetFields()
      loadData()
    } catch (err: any) {
      message.error(err?.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 生成周报（带存在性检查）
  const handleGenerate = async (values: {
    report_type: 'personal' | 'project'
    project_id?: number
    week: dayjs.Dayjs
  }) => {
    const weekStart = values.week.startOf('isoWeek').format('YYYY-MM-DD')
    const weekEnd = values.week.endOf('isoWeek').format('YYYY-MM-DD')
    
    if (values.report_type === 'project' && !values.project_id) {
      message.error('请选择项目')
      return
    }

    // 先检查是否已存在
    try {
      const checkRes = await weeklyReportsApi.checkExists({
        report_type: values.report_type,
        week_start: weekStart,
        week_end: weekEnd,
        project_id: values.project_id,
      })
      
      if (checkRes.data.exists) {
        // 已存在，询问是否覆盖
        confirm({
          title: '周报已存在',
          icon: <ExclamationCircleOutlined />,
          content: `该时间段（${weekStart} ~ ${weekEnd}）的${values.report_type === 'personal' ? '个人' : '项目'}周报已存在，重新生成将覆盖原有内容。是否继续？`,
          okText: '重新生成',
          cancelText: '取消',
          onOk: () => doGenerate(values.report_type, weekStart, weekEnd, values.project_id),
        })
      } else {
        // 不存在，直接生成
        doGenerate(values.report_type, weekStart, weekEnd, values.project_id)
      }
    } catch (err) {
      // 检查失败，尝试直接生成
      doGenerate(values.report_type, weekStart, weekEnd, values.project_id)
    }
  }

  // 日历日期点击 - 选择周
  const handleCalendarSelect = (date: Dayjs) => {
    const { weekStart, weekEnd } = getWeekRange(date)
    
    // 如果点击的是已选中的周，则取消选择
    if (selectedWeekStart === weekStart && selectedWeekEnd === weekEnd) {
      setSelectedWeekStart(null)
      setSelectedWeekEnd(null)
    } else {
      setSelectedWeekStart(weekStart)
      setSelectedWeekEnd(weekEnd)
    }
    setCalendarDate(date)
  }

  // 选中周报卡片时，同步日历选中状态
  const handleReportCardClick = (report: WeeklyReport) => {
    // 更新日历选中的周
    setSelectedWeekStart(report.week_start)
    setSelectedWeekEnd(report.week_end)
    // 将日历跳转到该周
    setCalendarDate(dayjs(report.week_start))
    // 打开详情
    openDetail(report)
  }

  // 日历单元格渲染 - 显示该日所在周的周报数量
  const dateCellRender = (value: Dayjs) => {
    const { weekStart, weekEnd } = getWeekRange(value)
    const key = `${weekStart}_${weekEnd}`
    const weekReports = weekReportsMap[key] || []
    
    // 只在每周第一天（周一）显示标记
    if (value.isoWeekday() !== 1) return null
    if (weekReports.length === 0) return null
    
    return (
      <div className="calendar-week-badge">
        <Badge 
          count={weekReports.length} 
          size="small"
          style={{ backgroundColor: activeTab === 'personal' ? '#3B82F6' : '#10B981' }}
        />
      </div>
    )
  }

  // 判断日期是否在选中的周范围内
  const isDateInSelectedWeek = (date: Dayjs) => {
    if (!selectedWeekStart || !selectedWeekEnd) return false
    const dateStr = date.format('YYYY-MM-DD')
    return dateStr >= selectedWeekStart && dateStr <= selectedWeekEnd
  }

  // 查看详情
  const openDetail = async (report: WeeklyReport) => {
    setIsEditing(false)
    setSelectedReport(report)
    setDetailModalOpen(true)
    setDetailLoading(true)
    try {
      const res = await weeklyReportsApi.getById(report.id)
      setSelectedReport(res.data)
    } catch (err) {
      console.error('Failed to load report detail:', err)
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

  // 判断是否可以编辑/删除
  // - 管理员可以操作所有周报
  // - 普通用户只能操作自己的个人周报
  // - 项目周报只有管理员可以操作
  const canEditOrDelete = () => {
    if (!selectedReport || !user) return false
    if (user.role === 'admin') return true
    if (selectedReport.report_type === 'personal') {
      // 使用嵌套的 member?.id，因为后端返回的是 member 对象而非 member_id
      return selectedReport.member?.id === user.id
    }
    // 项目周报只有管理员可以编辑/删除
    return false
  }

  // 清除周筛选
  const clearWeekFilter = () => {
    setSelectedWeekStart(null)
    setSelectedWeekEnd(null)
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

      <div className="weekly-content">
        {/* 左侧日历 */}
        <div className="calendar-section">
          <div className="calendar-header">
            <CalendarOutlined /> 周报日历
          </div>
          <Calendar
            fullscreen={false}
            value={calendarDate}
            onSelect={handleCalendarSelect}
            onPanelChange={(date) => setCalendarDate(date)}
            cellRender={(current, info) => {
              if (info.type === 'date') {
                return (
                  <div className={`calendar-cell ${isDateInSelectedWeek(current) ? 'selected-week' : ''}`}>
                    {dateCellRender(current)}
                  </div>
                )
              }
              return info.originNode
            }}
          />
          {/* 选中周的提示 */}
          {selectedWeekStart && selectedWeekEnd && (
            <div className="selected-week-info">
              <span>
                已选择: {selectedWeekStart} ~ {selectedWeekEnd}
              </span>
              <Button type="link" size="small" onClick={clearWeekFilter}>
                清除筛选
              </Button>
            </div>
          )}
          {/* 图例说明 */}
          <div className="calendar-legend">
            <div className="legend-item">
              <Badge color="#3B82F6" /> 个人周报
            </div>
            <div className="legend-item">
              <Badge color="#10B981" /> 项目周报
            </div>
          </div>
        </div>

        {/* 右侧周报列表 */}
        <div className="reports-section">
          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key as 'personal' | 'project')
                // 切换 Tab 时清空成员/项目筛选，但保留周筛选
                setFilterMemberId(undefined)
                setFilterProjectId(undefined)
              }}
              items={[
                {
                  key: 'personal',
                  label: (
                    <span>
                      <UserOutlined />
                      个人周报
                    </span>
                  ),
                  children: (
                    <>
                      {/* 筛选条件 */}
                      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                        <Select
                          placeholder="按成员筛选"
                          allowClear
                          style={{ width: 200 }}
                          value={filterMemberId}
                          onChange={setFilterMemberId}
                        >
                          {members.map(m => (
                            <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                          ))}
                        </Select>
                        {selectedWeekStart && (
                          <Tag 
                            closable 
                            onClose={clearWeekFilter}
                            color="blue"
                          >
                            {selectedWeekStart} ~ {selectedWeekEnd}
                          </Tag>
                        )}
                      </div>
                      {/* 周报列表 */}
                      {filteredReports.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={selectedWeekStart ? "该周暂无个人周报" : "暂无个人周报"}
                        >
                          <Button 
                            type="primary" 
                            icon={<PlusOutlined />}
                            onClick={() => {
                              form.setFieldValue('report_type', 'personal')
                              setGenerateModalOpen(true)
                            }}
                          >
                            生成个人周报
                          </Button>
                        </Empty>
                      ) : (
                        <List
                          grid={{ gutter: 24, xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}
                          dataSource={filteredReports}
                          renderItem={(report) => (
                            <List.Item>
                              <Card 
                                className={`report-card ${selectedWeekStart === report.week_start ? 'active' : ''}`}
                                hoverable
                                onClick={() => handleReportCardClick(report)}
                              >
                                <div className="report-header">
                                  <Tag color="blue">个人周报</Tag>
                                  <span className="report-date">
                                    {dayjs(report.generated_at).format('YYYY-MM-DD HH:mm')}
                                  </span>
                                </div>
                                <h3 className="report-title">
                                  {report.member?.name} 的周报
                                </h3>
                                <p className="report-period">
                                  {report.week_start} ~ {report.week_end}
                                </p>
                                <p className="report-summary">{report.summary?.trim() || '点击查看详情'}</p>
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
                    </>
                  ),
                },
                {
                  key: 'project',
                  label: (
                    <span>
                      <ProjectOutlined />
                      项目周报
                    </span>
                  ),
                  children: (
                    <>
                      {/* 筛选条件 */}
                      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                        <Select
                          placeholder="按项目筛选"
                          allowClear
                          style={{ width: 200 }}
                          value={filterProjectId}
                          onChange={setFilterProjectId}
                        >
                          {projects.map(p => (
                            <Select.Option key={p.id} value={p.id}>[{p.code}] {p.name}</Select.Option>
                          ))}
                        </Select>
                        {selectedWeekStart && (
                          <Tag 
                            closable 
                            onClose={clearWeekFilter}
                            color="green"
                          >
                            {selectedWeekStart} ~ {selectedWeekEnd}
                          </Tag>
                        )}
                      </div>
                      {/* 周报列表 */}
                      {filteredReports.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={selectedWeekStart ? "该周暂无项目周报" : "暂无项目周报"}
                        >
                          {isAdmin && (
                            <Button 
                              type="primary" 
                              icon={<PlusOutlined />}
                              onClick={() => {
                                form.setFieldValue('report_type', 'project')
                                setGenerateModalOpen(true)
                              }}
                            >
                              生成项目周报
                            </Button>
                          )}
                        </Empty>
                      ) : (
                        <List
                          grid={{ gutter: 24, xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}
                          dataSource={filteredReports}
                          renderItem={(report) => (
                            <List.Item>
                              <Card 
                                className={`report-card ${selectedWeekStart === report.week_start ? 'active' : ''}`}
                                hoverable
                                onClick={() => handleReportCardClick(report)}
                              >
                                <div className="report-header">
                                  <Tag color="green">项目周报</Tag>
                                  <span className="report-date">
                                    {dayjs(report.generated_at).format('YYYY-MM-DD HH:mm')}
                                  </span>
                                </div>
                                <h3 className="report-title">
                                  {report.project?.name} 周报
                                </h3>
                                <p className="report-period">
                                  {report.week_start} ~ {report.week_end}
                                </p>
                                <p className="report-summary">{report.summary?.trim() || '点击查看详情'}</p>
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
                    </>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>

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
            extra={!isAdmin ? '普通用户只能生成个人周报' : undefined}
          >
            <Select>
              <Select.Option value="personal">个人周报</Select.Option>
              <Select.Option value="project" disabled={!isAdmin}>
                项目周报{!isAdmin ? '（仅管理员）' : ''}
              </Select.Option>
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
            initialValue={dayjs().startOf('isoWeek')}
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
                  <h4>本周总结</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {(selectedReport.edited_summary || selectedReport.summary)?.trim() || '暂无内容'}
                  </p>
                </div>

                <div className="report-section">
                  <h4>主要成果</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {(selectedReport.edited_achievements || selectedReport.achievements)?.trim() || '暂无内容'}
                  </p>
                </div>

                <div className="report-section">
                  <h4>问题与挑战</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {(selectedReport.edited_issues || selectedReport.issues)?.trim() || '暂无问题'}
                  </p>
                </div>

                <div className="report-section">
                  <h4>下周计划</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {(selectedReport.edited_next_week_plan || selectedReport.next_week_plan)?.trim() || '暂无计划'}
                  </p>
                </div>

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
