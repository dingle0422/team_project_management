import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin, DatePicker, Select } from 'antd'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { dailyLogsApi } from '@/services/api'
import './index.css'

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#6B7280']

export default function Analytics() {
  const { user } = useAuthStore()
  const { projects, tasks, members } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    total_hours: number
    by_project: Array<{ project_id: number; project_name: string; hours: number }>
    by_type: Array<{ work_type: string; hours: number }>
  } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
      const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD')
      
      const res = await dailyLogsApi.getStats({
        start_date: weekStart,
        end_date: weekEnd,
      })
      setStats(res.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // 任务状态统计
  const taskStatusData = [
    { name: '待办', value: tasks.filter(t => t.status === 'todo').length, color: '#6B7280' },
    { name: '任务评审', value: tasks.filter(t => t.status === 'task_review').length, color: '#4F46E5' },
    { name: '进行中', value: tasks.filter(t => t.status === 'in_progress').length, color: '#3B82F6' },
    { name: '成果评审', value: tasks.filter(t => t.status === 'result_review').length, color: '#F59E0B' },
    { name: '已完成', value: tasks.filter(t => t.status === 'done').length, color: '#10B981' },
  ].filter(d => d.value > 0)

  // 项目状态统计
  const projectStatusData = [
    { name: '规划中', value: projects.filter(p => p.status === 'planning').length, color: '#6B7280' },
    { name: '进行中', value: projects.filter(p => p.status === 'active').length, color: '#3B82F6' },
    { name: '暂停', value: projects.filter(p => p.status === 'on_hold').length, color: '#F59E0B' },
    { name: '已完成', value: projects.filter(p => p.status === 'completed').length, color: '#10B981' },
  ].filter(d => d.value > 0)

  // 工作类型映射
  const workTypeMap: Record<string, string> = {
    development: '开发',
    design: '设计',
    testing: '测试',
    meeting: '会议',
    research: '研究',
    other: '其他',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="analytics-page fade-in">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="greeting">
          <h1>数据看板</h1>
          <p className="subtitle">项目和团队数据概览</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7' }}>📁</div>
          <div className="stat-content">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">总项目数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE' }}>📋</div>
          <div className="stat-content">
            <div className="stat-value">{tasks.length}</div>
            <div className="stat-label">总任务数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#D1FAE5' }}>👥</div>
          <div className="stat-content">
            <div className="stat-value">{members.length}</div>
            <div className="stat-label">团队成员</div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <Row gutter={[24, 24]}>
        {/* 任务状态分布 */}
        <Col xs={24} lg={12}>
          <Card title="任务状态分布" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 项目状态分布 */}
        <Col xs={24} lg={12}>
          <Card title="项目状态分布" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 项目工时分布 */}
        <Col xs={24} lg={12}>
          <Card title="本周项目工时分布" className="chart-card">
            {(stats?.by_project || []).length === 0 ? (
              <div style={{ 
                height: 300, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#9CA3AF'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
                <div>暂无项目工时数据</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>记录工时后将显示分布图</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.by_project || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="project_name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* 工作类型分布 */}
        <Col xs={24} lg={12}>
          <Card title="本周工作类型分布" className="chart-card">
            {(stats?.by_type || []).length === 0 ? (
              <div style={{ 
                height: 300, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#9CA3AF'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div>暂无工作类型数据</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>记录工时后将显示分布图</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={(stats?.by_type || []).map((item, index) => ({
                      name: workTypeMap[item.work_type] || item.work_type,
                      value: item.hours,
                      color: COLORS[index % COLORS.length],
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}h`}
                  >
                    {(stats?.by_type || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
