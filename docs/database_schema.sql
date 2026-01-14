-- ============================================
-- 算法团队项目管理系统 - 数据库Schema
-- 版本: v1.0
-- 创建日期: 2026-01-14
-- 数据库: PostgreSQL 15+
-- ============================================

-- 启用UUID扩展（可选）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 团队成员表 (members)
-- ============================================
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',  -- admin, manager, member
    job_title VARCHAR(100),  -- 职位：算法工程师、项目经理等
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 成员表索引
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);

-- 成员表注释
COMMENT ON TABLE members IS '团队成员表';
COMMENT ON COLUMN members.role IS '系统角色: admin-管理员, manager-项目经理, member-普通成员';
COMMENT ON COLUMN members.job_title IS '职位名称';
COMMENT ON COLUMN members.status IS '账号状态: active-启用, inactive-禁用';

-- ============================================
-- 2. 项目表 (projects)
-- ============================================
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE,  -- 项目编号，如 AI-2024-001
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, suspended, archived
    priority VARCHAR(10) DEFAULT 'medium',  -- low, medium, high
    start_date DATE,
    end_date DATE,
    owner_id INT REFERENCES members(id) ON DELETE SET NULL,  -- 项目负责人
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 项目表索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_code ON projects(code);

-- 项目表注释
COMMENT ON TABLE projects IS '项目表';
COMMENT ON COLUMN projects.code IS '项目编号，唯一标识';
COMMENT ON COLUMN projects.status IS '项目状态: active-进行中, completed-已完成, suspended-暂停, archived-已归档';
COMMENT ON COLUMN projects.owner_id IS '项目负责人ID';

-- ============================================
-- 3. 项目成员关联表 (project_members)
-- ============================================
CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'developer',  -- 在项目中的角色: owner, developer, tester等
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, member_id)
);

-- 项目成员关联表索引
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_member ON project_members(member_id);

-- 项目成员关联表注释
COMMENT ON TABLE project_members IS '项目成员关联表（多对多）';
COMMENT ON COLUMN project_members.role IS '成员在项目中的角色';

-- ============================================
-- 4. 会议纪要表 (meetings)
-- ============================================
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    meeting_date TIMESTAMP NOT NULL,
    location VARCHAR(100),  -- 会议地点/线上链接
    summary TEXT,  -- 会议摘要
    content TEXT,  -- 会议详细内容/纪要
    attendee_ids INT[],  -- 参会人员ID数组
    created_by INT REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 会议纪要表索引
CREATE INDEX idx_meetings_project ON meetings(project_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);

-- 会议纪要表注释
COMMENT ON TABLE meetings IS '会议纪要表';
COMMENT ON COLUMN meetings.attendee_ids IS '参会人员ID数组';
COMMENT ON COLUMN meetings.summary IS '会议摘要（简短描述）';
COMMENT ON COLUMN meetings.content IS '会议详细纪要内容';

-- ============================================
-- 5. 任务表 (tasks)
-- ============================================
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    meeting_id INT REFERENCES meetings(id) ON DELETE SET NULL,  -- 关联会议纪要，NULL表示"无关联"
    
    -- 任务基本信息
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- 负责人
    assignee_id INT REFERENCES members(id) ON DELETE SET NULL,
    
    -- 干系人ID数组（参与者、评审人等）
    stakeholder_ids INT[],
    
    -- 时间预估与实际
    estimated_hours DECIMAL(8,2),  -- 预估工时
    actual_hours DECIMAL(8,2) DEFAULT 0,  -- 实际工时（根据日报自动计算）
    
    -- 状态与优先级
    status VARCHAR(20) DEFAULT 'todo',  -- todo, in_progress, task_review, result_review, done, cancelled
    priority VARCHAR(10) DEFAULT 'medium',  -- low, medium, high, urgent
    
    -- 时间节点
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP,
    
    -- 父任务（支持子任务结构）
    parent_task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 任务类型标签
    task_type VARCHAR(50),  -- feature, bugfix, research, documentation等
    
    -- 排序
    sort_order INT DEFAULT 0,
    
    created_by INT REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 任务表索引
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_meeting ON tasks(meeting_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- 任务表注释
COMMENT ON TABLE tasks IS '任务表';
COMMENT ON COLUMN tasks.meeting_id IS '关联会议纪要ID，NULL表示无关联（选择"空"选项）';
COMMENT ON COLUMN tasks.estimated_hours IS '预估工时（小时）';
COMMENT ON COLUMN tasks.actual_hours IS '实际工时（小时），根据日报自动累计';
COMMENT ON COLUMN tasks.status IS '任务状态: todo-待办, in_progress-进行中, task_review-任务评审(需求/方案评审), result_review-成果评审(代码/功能评审), done-已完成, cancelled-已取消';
COMMENT ON COLUMN tasks.parent_task_id IS '父任务ID，支持任务分解';
COMMENT ON COLUMN tasks.stakeholder_ids IS '干系人ID数组，包括评审人、协作者等';

-- ============================================
-- 5.1 任务干系人关联表 (task_stakeholders)
-- 用于更灵活的干系人管理和查询
-- ============================================
CREATE TABLE task_stakeholders (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'stakeholder',  -- stakeholder, reviewer, collaborator
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, member_id)
);

CREATE INDEX idx_task_stakeholders_task ON task_stakeholders(task_id);
CREATE INDEX idx_task_stakeholders_member ON task_stakeholders(member_id);

COMMENT ON TABLE task_stakeholders IS '任务干系人关联表';
COMMENT ON COLUMN task_stakeholders.role IS '干系人角色: stakeholder-干系人, reviewer-评审人, collaborator-协作者';

-- ============================================
-- 6. 任务状态变更历史表 (task_status_history)
-- ============================================
CREATE TABLE task_status_history (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by INT REFERENCES members(id) ON DELETE SET NULL,
    comment TEXT,  -- 变更说明
    
    -- 评审相关字段
    review_type VARCHAR(50),  -- task_review(任务评审), result_review(成果评审)
    review_result VARCHAR(20),  -- passed(通过), rejected(打回)
    review_feedback TEXT,  -- 评审意见
    
    changed_at TIMESTAMP DEFAULT NOW()
);

-- 任务状态变更历史索引
CREATE INDEX idx_task_status_history_task ON task_status_history(task_id);
CREATE INDEX idx_task_status_history_time ON task_status_history(changed_at);

-- 任务状态变更历史注释
COMMENT ON TABLE task_status_history IS '任务状态变更历史表';

-- ============================================
-- 7. 每日工作记录表 (daily_work_logs)
-- ============================================
CREATE TABLE daily_work_logs (
    id SERIAL PRIMARY KEY,
    member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- 冗余字段，便于查询
    
    work_date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),  -- 该任务消耗的时间
    description TEXT NOT NULL,  -- 具体做了什么工作
    
    -- 工作类型标签（可选）
    work_type VARCHAR(50),  -- development, debugging, meeting, documentation, research等
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 每日工作记录索引
CREATE INDEX idx_daily_work_logs_member ON daily_work_logs(member_id);
CREATE INDEX idx_daily_work_logs_task ON daily_work_logs(task_id);
CREATE INDEX idx_daily_work_logs_project ON daily_work_logs(project_id);
CREATE INDEX idx_daily_work_logs_date ON daily_work_logs(work_date);
CREATE INDEX idx_daily_work_logs_member_date ON daily_work_logs(member_id, work_date);

-- 每日工作记录注释
COMMENT ON TABLE daily_work_logs IS '每日工作记录表（日报核心数据）';
COMMENT ON COLUMN daily_work_logs.hours IS '工作时长（小时），范围0-24';
COMMENT ON COLUMN daily_work_logs.description IS '工作内容描述';
COMMENT ON COLUMN daily_work_logs.work_type IS '工作类型标签';

-- ============================================
-- 8. 每日总结表 (daily_summaries)
-- ============================================
CREATE TABLE daily_summaries (
    id SERIAL PRIMARY KEY,
    member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    problems TEXT,  -- 今日遇到的问题
    tomorrow_plan TEXT,  -- 明日计划
    notes TEXT,  -- 其他备注
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(member_id, summary_date)
);

-- 每日总结索引
CREATE INDEX idx_daily_summaries_member ON daily_summaries(member_id);
CREATE INDEX idx_daily_summaries_date ON daily_summaries(summary_date);

-- 每日总结注释
COMMENT ON TABLE daily_summaries IS '每日总结表（问题、计划等非任务内容）';

-- ============================================
-- 9. AI生成周报表 (weekly_reports)
-- ============================================
CREATE TABLE weekly_reports (
    id SERIAL PRIMARY KEY,
    
    -- 周报类型：personal（个人）或 project（项目）
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('personal', 'project')),
    
    -- 根据类型，二选一
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 周报时间范围
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    
    -- AI生成的内容
    summary TEXT,  -- 本周总结
    achievements TEXT,  -- 主要成果
    issues TEXT,  -- 问题与风险
    next_week_plan TEXT,  -- 下周计划
    
    -- 原始数据快照（JSON格式，便于追溯）
    raw_data JSONB,
    
    -- AI模型信息
    ai_model VARCHAR(50),
    
    -- 是否已审核/编辑
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by INT REFERENCES members(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    
    -- 编辑后的内容（如果用户修改了AI生成的内容）
    edited_summary TEXT,
    edited_achievements TEXT,
    edited_issues TEXT,
    edited_next_week_plan TEXT,
    
    generated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 约束：确保report_type与对应ID匹配
    CONSTRAINT chk_report_type_member CHECK (
        (report_type = 'personal' AND member_id IS NOT NULL) OR
        (report_type = 'project' AND project_id IS NOT NULL)
    )
);

-- 周报表索引
CREATE INDEX idx_weekly_reports_type ON weekly_reports(report_type);
CREATE INDEX idx_weekly_reports_member ON weekly_reports(member_id);
CREATE INDEX idx_weekly_reports_project ON weekly_reports(project_id);
CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start, week_end);

-- 周报表注释
COMMENT ON TABLE weekly_reports IS 'AI生成周报表';
COMMENT ON COLUMN weekly_reports.report_type IS '周报类型: personal-个人周报, project-项目周报';
COMMENT ON COLUMN weekly_reports.raw_data IS '生成周报时的原始数据快照（JSON）';
COMMENT ON COLUMN weekly_reports.is_reviewed IS '是否已人工审核';

-- ============================================
-- 10. 视图 (Views)
-- ============================================

-- 任务工时汇总视图
CREATE VIEW v_task_hours_summary AS
SELECT 
    t.id AS task_id,
    t.title,
    t.project_id,
    p.name AS project_name,
    t.assignee_id,
    m.name AS assignee_name,
    t.estimated_hours,
    COALESCE(SUM(dwl.hours), 0) AS actual_hours,
    CASE 
        WHEN t.estimated_hours > 0 
        THEN ROUND(COALESCE(SUM(dwl.hours), 0) / t.estimated_hours * 100, 2)
        ELSE NULL
    END AS progress_percentage,
    t.status,
    t.due_date
FROM tasks t
LEFT JOIN daily_work_logs dwl ON t.id = dwl.task_id
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN members m ON t.assignee_id = m.id
GROUP BY t.id, p.name, m.name;

COMMENT ON VIEW v_task_hours_summary IS '任务工时汇总视图';

-- 个人工作汇总视图
CREATE VIEW v_member_work_summary AS
SELECT 
    m.id AS member_id,
    m.name AS member_name,
    p.id AS project_id,
    p.name AS project_name,
    DATE_TRUNC('week', dwl.work_date)::DATE AS week_start,
    SUM(dwl.hours) AS total_hours,
    COUNT(DISTINCT dwl.task_id) AS task_count,
    COUNT(dwl.id) AS log_count
FROM members m
JOIN daily_work_logs dwl ON m.id = dwl.member_id
JOIN projects p ON dwl.project_id = p.id
GROUP BY m.id, m.name, p.id, p.name, DATE_TRUNC('week', dwl.work_date);

COMMENT ON VIEW v_member_work_summary IS '个人工作汇总视图（按周、按项目）';

-- 项目进度视图
CREATE VIEW v_project_progress AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.code AS project_code,
    p.status AS project_status,
    COUNT(t.id) AS total_tasks,
    COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_tasks,
    COUNT(CASE WHEN t.status = 'todo' THEN 1 END) AS todo_tasks,
    ROUND(
        COUNT(CASE WHEN t.status = 'done' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(t.id), 0) * 100, 2
    ) AS completion_rate,
    COALESCE(SUM(t.estimated_hours), 0) AS total_estimated_hours,
    COALESCE(SUM(t.actual_hours), 0) AS total_actual_hours
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id AND t.parent_task_id IS NULL  -- 只统计主任务
GROUP BY p.id, p.name, p.code, p.status;

COMMENT ON VIEW v_project_progress IS '项目进度视图';

-- 每日工时统计视图
CREATE VIEW v_daily_hours_stats AS
SELECT 
    dwl.member_id,
    m.name AS member_name,
    dwl.work_date,
    SUM(dwl.hours) AS total_hours,
    COUNT(DISTINCT dwl.task_id) AS task_count,
    COUNT(DISTINCT dwl.project_id) AS project_count
FROM daily_work_logs dwl
JOIN members m ON dwl.member_id = m.id
GROUP BY dwl.member_id, m.name, dwl.work_date;

COMMENT ON VIEW v_daily_hours_stats IS '每日工时统计视图';

-- ============================================
-- 11. 触发器函数 (Trigger Functions)
-- ============================================

-- 更新任务实际工时的触发器函数
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE tasks 
        SET actual_hours = (
            SELECT COALESCE(SUM(hours), 0) 
            FROM daily_work_logs 
            WHERE task_id = NEW.task_id
        ),
        updated_at = NOW()
        WHERE id = NEW.task_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tasks 
        SET actual_hours = (
            SELECT COALESCE(SUM(hours), 0) 
            FROM daily_work_logs 
            WHERE task_id = OLD.task_id
        ),
        updated_at = NOW()
        WHERE id = OLD.task_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trg_update_task_actual_hours
AFTER INSERT OR UPDATE OR DELETE ON daily_work_logs
FOR EACH ROW
EXECUTE FUNCTION update_task_actual_hours();

COMMENT ON FUNCTION update_task_actual_hours() IS '自动更新任务实际工时';

-- 更新updated_at字段的通用触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表创建updated_at触发器
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_daily_work_logs_updated_at BEFORE UPDATE ON daily_work_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_weekly_reports_updated_at BEFORE UPDATE ON weekly_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. 初始数据 (可选)
-- ============================================

-- 插入管理员账号（密码需要在应用层hash处理）
-- INSERT INTO members (name, email, password_hash, role, job_title, status) VALUES
-- ('管理员', 'admin@example.com', 'HASHED_PASSWORD_HERE', 'admin', '系统管理员', 'active');

-- ============================================
-- END OF SCHEMA
-- ============================================
