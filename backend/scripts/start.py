#!/usr/bin/env python
"""
应用启动脚本
"""
import subprocess
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def run_migrations():
    """运行数据库迁移"""
    print("🔄 运行数据库迁移...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"⚠️ 迁移警告: {result.stderr}")
    else:
        print("✅ 数据库迁移完成")


def init_db():
    """初始化数据库（创建表）"""
    print("🔄 初始化数据库...")
    from app.core.database import init_db as create_tables
    create_tables()
    print("✅ 数据库表创建完成")


def start_server(reload: bool = False):
    """启动服务器"""
    print("🚀 启动服务器...")
    cmd = [
        "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000"
    ]
    if reload:
        cmd.append("--reload")
    
    subprocess.run(cmd)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="项目管理系统启动脚本")
    parser.add_argument("--migrate", action="store_true", help="运行数据库迁移")
    parser.add_argument("--init-db", action="store_true", help="初始化数据库")
    parser.add_argument("--reload", action="store_true", help="开发模式（热重载）")
    
    args = parser.parse_args()
    
    if args.migrate:
        run_migrations()
    
    if args.init_db:
        init_db()
    
    if not args.migrate and not args.init_db:
        # 默认：初始化数据库并启动服务器
        init_db()
        start_server(reload=args.reload)
