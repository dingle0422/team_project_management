"""
AI服务 - 周报生成（阿里百炼 DashScope）
"""
import json
from typing import Optional
import dashscope
from dashscope import Generation
from app.core.config import settings
from app.schemas.weekly_report import PersonalWeeklyData, ProjectWeeklyData


class AIService:
    """AI服务类"""
    
    @staticmethod
    def _format_to_text(value) -> str:
        """将AI返回的列表/字典格式化为文本字符串"""
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            lines = []
            for item in value:
                if isinstance(item, dict):
                    # 处理如 issues 中的字典格式
                    parts = []
                    if 'description' in item:
                        parts.append(item['description'])
                    if 'impact' in item:
                        parts.append(f"影响: {item['impact']}")
                    if 'suggestion' in item:
                        parts.append(f"建议: {item['suggestion']}")
                    lines.append("- " + "; ".join(parts) if parts else str(item))
                else:
                    lines.append(f"- {item}")
            return "\n".join(lines)
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False, indent=2)
        return str(value)
    
    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.DASHSCOPE_MODEL
        if self.api_key:
            dashscope.api_key = self.api_key
    
    def is_available(self) -> bool:
        """检查AI服务是否可用"""
        return self.api_key is not None
    
    def generate_personal_weekly_report(self, data: PersonalWeeklyData) -> dict:
        """
        生成个人周报
        
        返回: {summary, achievements, issues, next_week_plan}
        """
        if not self.is_available():
            return self._generate_fallback_personal_report(data)
        
        prompt = self._build_personal_report_prompt(data)
        
        try:
            system_prompt = """你是一个专业的项目管理助手，擅长撰写工作周报。
请根据提供的工作数据生成一份结构清晰、内容专业的个人周报。
周报应该：
1. 总结本周主要工作内容和成果
2. 突出重要完成的任务和里程碑
3. 客观描述遇到的问题和风险
4. 规划下周的工作重点

请用JSON格式返回，包含以下字段：
- summary: 本周工作总结（2-3段落）
- achievements: 主要成果（列表形式，每项一行）
- issues: 问题与风险（如有）
- next_week_plan: 下周计划（列表形式）"""

            response = Generation.call(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                result_format='message',
                temperature=0.7,
            )
            
            if response.status_code != 200:
                raise Exception(f"DashScope API错误: {response.code} - {response.message}")
            
            content = response.output.choices[0].message.content
            # 尝试提取JSON内容（处理可能的markdown代码块）
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            result = json.loads(content)
            return {
                "summary": self._format_to_text(result.get("summary", "")),
                "achievements": self._format_to_text(result.get("achievements", "")),
                "issues": self._format_to_text(result.get("issues", "")),
                "next_week_plan": self._format_to_text(result.get("next_week_plan", "")),
            }
        except Exception as e:
            print(f"AI生成周报失败: {e}")
            return self._generate_fallback_personal_report(data)
    
    def generate_project_weekly_report(self, data: ProjectWeeklyData) -> dict:
        """
        生成项目周报
        
        返回: {summary, achievements, issues, next_week_plan}
        """
        if not self.is_available():
            return self._generate_fallback_project_report(data)
        
        prompt = self._build_project_report_prompt(data)
        
        try:
            system_prompt = """你是一个专业的项目管理助手，擅长撰写项目周报。
请根据提供的项目数据生成一份结构清晰、内容专业的项目周报。
周报应该：
1. 总结项目本周整体进展
2. 列出完成的重要任务和里程碑
3. 分析项目风险和问题
4. 规划下周工作重点

请用JSON格式返回，包含以下字段：
- summary: 项目周进展总结（2-3段落）
- achievements: 本周主要成果（列表形式）
- issues: 问题与风险（列表形式，包含影响和建议措施）
- next_week_plan: 下周计划（列表形式）"""

            response = Generation.call(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                result_format='message',
                temperature=0.7,
            )
            
            if response.status_code != 200:
                raise Exception(f"DashScope API错误: {response.code} - {response.message}")
            
            content = response.output.choices[0].message.content
            # 尝试提取JSON内容（处理可能的markdown代码块）
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            result = json.loads(content)
            return {
                "summary": self._format_to_text(result.get("summary", "")),
                "achievements": self._format_to_text(result.get("achievements", "")),
                "issues": self._format_to_text(result.get("issues", "")),
                "next_week_plan": self._format_to_text(result.get("next_week_plan", "")),
            }
        except Exception as e:
            print(f"AI生成项目周报失败: {e}")
            return self._generate_fallback_project_report(data)
    
    def _build_personal_report_prompt(self, data: PersonalWeeklyData) -> str:
        """构建个人周报提示词"""
        lines = [
            f"请为 {data.member_name} 生成 {data.week_start} 至 {data.week_end} 的个人周报。",
            "",
            f"## 本周工时统计",
            f"- 总工时: {data.total_hours} 小时",
            f"- 完成任务数: {data.completed_tasks_count}",
            f"- 进行中任务数: {data.in_progress_tasks_count}",
            "",
            "## 工作记录详情",
        ]
        
        # 按日期分组工作记录
        work_by_date = {}
        for log in data.work_logs:
            date_str = str(log.work_date)
            if date_str not in work_by_date:
                work_by_date[date_str] = []
            work_by_date[date_str].append(log)
        
        for date_str in sorted(work_by_date.keys()):
            logs = work_by_date[date_str]
            lines.append(f"\n### {date_str}")
            for log in logs:
                lines.append(f"- [{log.project_name}] {log.task_title}: {log.description} ({log.hours}h)")
        
        # 每日总结中的问题
        if data.daily_summaries:
            lines.append("\n## 每日记录的问题")
            for ds in data.daily_summaries:
                if ds.problems:
                    lines.append(f"- {ds.summary_date}: {ds.problems}")
        
        # 任务状态变更
        if data.tasks_worked:
            lines.append("\n## 任务进展")
            for task in data.tasks_worked:
                status_text = f"[{task.status}]"
                hours_text = f"{task.actual_hours}h" if task.actual_hours else ""
                lines.append(f"- {task.title} {status_text} {hours_text}")
        
        return "\n".join(lines)
    
    def _build_project_report_prompt(self, data: ProjectWeeklyData) -> str:
        """构建项目周报提示词"""
        lines = [
            f"请为项目「{data.project_name}」生成 {data.week_start} 至 {data.week_end} 的项目周报。",
            "",
            f"## 本周统计",
            f"- 总投入工时: {data.total_hours} 小时",
            f"- 完成任务数: {len(data.tasks_completed)}",
            f"- 进行中任务数: {len(data.tasks_in_progress)}",
            f"- 新增任务数: {len(data.new_tasks)}",
            "",
            "## 团队成员贡献",
        ]
        
        for contrib in data.member_contributions:
            lines.append(f"- {contrib['member_name']}: {contrib['hours']}h, {contrib['tasks_count']}个任务")
        
        if data.tasks_completed:
            lines.append("\n## 本周完成的任务")
            for task in data.tasks_completed:
                lines.append(f"- {task.title}")
        
        if data.tasks_in_progress:
            lines.append("\n## 进行中的任务")
            for task in data.tasks_in_progress:
                progress = ""
                if task.estimated_hours and task.actual_hours:
                    pct = min(100, int(task.actual_hours / task.estimated_hours * 100))
                    progress = f"(进度约{pct}%)"
                lines.append(f"- {task.title} {progress}")
        
        if data.meetings_held:
            lines.append("\n## 本周会议")
            for meeting in data.meetings_held:
                lines.append(f"- {meeting['date']}: {meeting['title']}")
                if meeting.get('summary'):
                    lines.append(f"  摘要: {meeting['summary'][:100]}...")
        
        return "\n".join(lines)
    
    def _generate_fallback_personal_report(self, data: PersonalWeeklyData) -> dict:
        """生成降级版个人周报（无AI时使用）"""
        # 构建工作摘要
        work_summary = []
        for log in data.work_logs[:10]:  # 取前10条
            work_summary.append(f"- [{log.project_name}] {log.task_title}: {log.description}")
        
        summary = f"""本周（{data.week_start} ~ {data.week_end}）共投入工时 {data.total_hours} 小时。

主要工作内容包括：
{chr(10).join(work_summary[:5]) if work_summary else '- 暂无工作记录'}

本周完成任务 {data.completed_tasks_count} 个，进行中任务 {data.in_progress_tasks_count} 个。"""
        
        achievements = "\n".join([
            f"- 完成任务: {t.title}" 
            for t in data.tasks_worked 
            if t.status == "done"
        ][:5]) or "- 本周暂无完成的任务"
        
        issues = ""
        for ds in data.daily_summaries:
            if ds.problems:
                issues += f"- {ds.summary_date}: {ds.problems}\n"
        issues = issues or "- 本周工作顺利，暂无重大问题"
        
        next_plan = ""
        for ds in data.daily_summaries:
            if ds.tomorrow_plan:
                next_plan = ds.tomorrow_plan
                break
        next_plan = next_plan or "- 继续推进当前任务"
        
        return {
            "summary": summary,
            "achievements": achievements,
            "issues": issues,
            "next_week_plan": next_plan,
        }
    
    def _generate_fallback_project_report(self, data: ProjectWeeklyData) -> dict:
        """生成降级版项目周报（无AI时使用）"""
        summary = f"""项目「{data.project_name}」本周（{data.week_start} ~ {data.week_end}）进展报告。

本周团队共投入 {data.total_hours} 小时，完成任务 {len(data.tasks_completed)} 个，当前进行中任务 {len(data.tasks_in_progress)} 个。

团队成员贡献：
""" + "\n".join([
            f"- {c['member_name']}: {c['hours']}h" 
            for c in data.member_contributions[:5]
        ])
        
        achievements = "\n".join([
            f"- {t.title}" 
            for t in data.tasks_completed[:5]
        ]) or "- 本周暂无完成的任务"
        
        issues = "- 请查看各任务详情了解具体问题"
        
        next_plan = "\n".join([
            f"- 继续推进: {t.title}" 
            for t in data.tasks_in_progress[:5]
        ]) or "- 待规划"
        
        return {
            "summary": summary,
            "achievements": achievements,
            "issues": issues,
            "next_week_plan": next_plan,
        }


# 全局AI服务实例
ai_service = AIService()
