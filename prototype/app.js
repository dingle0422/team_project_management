/**
 * 算法团队项目管理系统 - 原型交互脚本
 */

// ============================================
// 页面切换功能
// ============================================

function switchPage(pageId) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
    
    // 滚动到顶部
    window.scrollTo(0, 0);
}

// 导航点击事件
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = item.dataset.page;
        if (pageId) {
            switchPage(pageId);
        }
    });
});

// ============================================
// 弹窗功能
// ============================================

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ESC键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            hideModal(modal.id);
        });
    }
});

// ============================================
// Tab切换功能
// ============================================

document.querySelectorAll('.tab-nav').forEach(tabNav => {
    tabNav.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            // 更新Tab状态
            tabNav.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 切换Tab内容（如果有）
            const tabId = tab.dataset.tab;
            if (tabId) {
                const tabContainer = tabNav.closest('.page');
                tabContainer.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                const targetContent = tabContainer.querySelector(`#tab-${tabId}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    });
});

// ============================================
// 筛选Tab切换
// ============================================

document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const parent = tab.closest('.filter-tabs');
        parent.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// ============================================
// 任务复选框交互
// ============================================

document.querySelectorAll('.task-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskItem = checkbox.closest('.task-item');
        taskItem.classList.toggle('completed');
        checkbox.classList.toggle('checked');
        
        if (checkbox.classList.contains('checked')) {
            checkbox.innerHTML = '✓';
            checkbox.style.background = 'var(--success)';
            checkbox.style.borderColor = 'var(--success)';
            checkbox.style.color = 'white';
        } else {
            checkbox.innerHTML = '';
            checkbox.style.background = '';
            checkbox.style.borderColor = '';
            checkbox.style.color = '';
        }
    });
});

// ============================================
// 看板卡片拖拽（简化版）
// ============================================

let draggedCard = null;

document.querySelectorAll('.kanban-card').forEach(card => {
    card.draggable = true;
    
    card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedCard = null;
    });
});

document.querySelectorAll('.column-content').forEach(column => {
    column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
    });
    
    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });
    
    column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        if (draggedCard) {
            column.appendChild(draggedCard);
            updateColumnCounts();
        }
    });
});

function updateColumnCounts() {
    document.querySelectorAll('.kanban-column').forEach(column => {
        const count = column.querySelectorAll('.kanban-card').length;
        const countEl = column.querySelector('.column-count');
        if (countEl) {
            countEl.textContent = count;
        }
    });
}

// ============================================
// 任务状态管理
// ============================================

// 状态定义 - 流程：待办 → 任务评审 → 进行中 → 成果评审 → 已完成
const TASK_STATUSES = {
    todo: { name: '待办', icon: '📋', color: 'gray', nextActions: ['task_review'] },
    task_review: { name: '任务评审', icon: '📝', color: 'yellow', nextActions: ['todo', 'in_progress'] },
    in_progress: { name: '进行中', icon: '🔄', color: 'blue', nextActions: ['task_review', 'result_review'] },
    result_review: { name: '成果评审', icon: '🔍', color: 'purple', nextActions: ['in_progress', 'done'] },
    done: { name: '已完成', icon: '✅', color: 'green', nextActions: [] }
};

// 切换状态菜单
function toggleStatusMenu() {
    const menu = document.getElementById('status-menu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// 点击外部关闭菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-dropdown')) {
        const menu = document.getElementById('status-menu');
        if (menu) {
            menu.classList.remove('active');
        }
    }
});

// 改变任务状态
function changeTaskStatus(newStatus) {
    const statusInfo = TASK_STATUSES[newStatus];
    if (!statusInfo) return;
    
    // 关闭菜单
    const menu = document.getElementById('status-menu');
    if (menu) {
        menu.classList.remove('active');
    }
    
    // 更新状态徽章
    const badge = document.querySelector('.status-dropdown .task-status-badge');
    if (badge) {
        badge.className = `task-status-badge ${newStatus}`;
        badge.innerHTML = `${statusInfo.name} <span class="dropdown-icon">▾</span>`;
    }
    
    // 更新状态操作栏
    updateStatusActionBar(newStatus);
    
    // 显示通知
    let message = '';
    switch(newStatus) {
        case 'task_review':
            message = '已提交任务评审，等待评审人审核需求/方案';
            break;
        case 'in_progress':
            message = '任务评审通过，开始开发！💪';
            break;
        case 'result_review':
            message = '已提交成果评审，等待评审人审核代码/功能';
            break;
        case 'done':
            message = '🎉 任务已完成！';
            break;
        case 'todo':
            message = '任务已打回待办，请根据反馈修改方案';
            break;
    }
    showNotification(message, newStatus === 'done' ? 'success' : 'info');
}

// 更新状态操作栏 - 流程：待办 → 任务评审 → 进行中 → 成果评审 → 已完成
function updateStatusActionBar(status) {
    const bar = document.getElementById('status-action-bar');
    if (!bar) return;
    
    const statusInfo = TASK_STATUSES[status];
    let html = '';
    let barClass = 'status-action-bar';
    
    switch(status) {
        case 'todo':
            html = `
                <div class="action-info">
                    <span class="action-icon">📋</span>
                    <span class="action-text">当前状态：<strong>待办</strong>，请先提交需求/方案进行评审</span>
                </div>
                <div class="action-buttons-inline">
                    <button class="btn btn-primary" onclick="changeTaskStatus('task_review')">📝 提交任务评审</button>
                </div>
            `;
            break;
        case 'task_review':
            barClass = 'status-action-bar review';
            html = `
                <div class="action-info">
                    <span class="action-icon">📝</span>
                    <span class="action-text">当前状态：<strong>任务评审中</strong>，等待评审人审核需求/方案</span>
                </div>
                <div class="action-buttons-inline">
                    <button class="btn btn-secondary" onclick="changeTaskStatus('todo')">↩️ 打回修改</button>
                    <button class="btn btn-primary" onclick="changeTaskStatus('in_progress')">✓ 评审通过，开始开发</button>
                </div>
            `;
            break;
        case 'in_progress':
            html = `
                <div class="action-info">
                    <span class="action-icon">🔄</span>
                    <span class="action-text">当前状态：<strong>进行中</strong>，开发完成后提交成果评审</span>
                </div>
                <div class="action-buttons-inline">
                    <button class="btn btn-secondary" onclick="changeTaskStatus('task_review')">📝 重新提交任务评审</button>
                    <button class="btn btn-primary" onclick="changeTaskStatus('result_review')">🔍 提交成果评审</button>
                </div>
            `;
            break;
        case 'result_review':
            barClass = 'status-action-bar result-review';
            html = `
                <div class="action-info">
                    <span class="action-icon">🔍</span>
                    <span class="action-text">当前状态：<strong>成果评审中</strong>，等待评审人审核代码/功能</span>
                </div>
                <div class="action-buttons-inline">
                    <button class="btn btn-secondary" onclick="changeTaskStatus('in_progress')">↩️ 打回修改</button>
                    <button class="btn btn-primary" onclick="changeTaskStatus('done')">✓ 评审通过，完成任务</button>
                </div>
            `;
            break;
        case 'done':
            html = `
                <div class="action-info">
                    <span class="action-icon">✅</span>
                    <span class="action-text">当前状态：<strong>已完成</strong>，任务已结束</span>
                </div>
            `;
            break;
    }
    
    bar.className = barClass;
    bar.innerHTML = html;
}

// ============================================
// 视图切换
// ============================================

document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const parent = btn.closest('.view-toggle');
        parent.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// ============================================
// 工时计算
// ============================================

function updateTotalHours() {
    const modal = document.getElementById('daily-modal');
    if (!modal) return;
    
    let total = 0;
    modal.querySelectorAll('.log-entry input[type="number"]').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const summaryEl = modal.querySelector('.summary-hours');
    if (summaryEl) {
        summaryEl.textContent = `${total} 小时`;
    }
}

// 监听工时输入变化
document.querySelectorAll('.log-entry input[type="number"]').forEach(input => {
    input.addEventListener('input', updateTotalHours);
});

// ============================================
// 日期导航
// ============================================

document.querySelectorAll('.date-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // 这里只是模拟效果，实际项目中需要真正的日期切换逻辑
        const animation = btn.textContent.includes('上') ? 'slideRight' : 'slideLeft';
        const dailyList = document.querySelector('.daily-list');
        if (dailyList) {
            dailyList.style.animation = 'none';
            dailyList.offsetHeight; // 触发重排
            dailyList.style.animation = `${animation} 0.3s ease`;
        }
    });
});

// ============================================
// 动态时间显示
// ============================================

function updateGreeting() {
    const greeting = document.querySelector('.greeting h1');
    if (!greeting) return;
    
    const hour = new Date().getHours();
    let greetingText = '早上好';
    
    if (hour >= 12 && hour < 14) {
        greetingText = '中午好';
    } else if (hour >= 14 && hour < 18) {
        greetingText = '下午好';
    } else if (hour >= 18) {
        greetingText = '晚上好';
    }
    
    greeting.textContent = `${greetingText}，张三 👋`;
}

// ============================================
// 项目卡片悬停效果
// ============================================

document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ============================================
// 通知提示
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="notification-message">${message}</span>
    `;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? '#D1FAE5' : type === 'error' ? '#FEE2E2' : '#DBEAFE'};
        color: ${type === 'success' ? '#059669' : type === 'error' ? '#DC2626' : '#1D4ED8'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        z-index: 1001;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// 按钮点击反馈
// ============================================

document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', () => {
        // 添加点击效果
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 100);
    });
});

// ============================================
// 添加动画样式
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
    
    @keyframes slideRight {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideLeft {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    .kanban-card.dragging {
        opacity: 0.5;
        transform: rotate(3deg);
    }
    
    .column-content.drag-over {
        background: rgba(245, 158, 11, 0.1);
        border: 2px dashed #F59E0B;
        border-radius: 8px;
    }
    
    .task-item.completed .task-title {
        text-decoration: line-through;
        color: var(--gray-400);
    }
`;
document.head.appendChild(style);

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateGreeting();
    updateTotalHours();
    
    // 添加页面加载动画
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    console.log('🚀 算法团队项目管理系统原型已加载');
});

// ============================================
// 模拟数据交互
// ============================================

// 模拟提交日报
document.querySelectorAll('.modal-footer .btn-primary').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal');
        if (modal && modal.id === 'daily-modal') {
            e.preventDefault();
            hideModal('daily-modal');
            showNotification('日报提交成功！', 'success');
        } else if (modal && modal.id === 'task-modal') {
            e.preventDefault();
            hideModal('task-modal');
            showNotification('任务创建成功！', 'success');
        } else if (modal && modal.id === 'meeting-modal') {
            e.preventDefault();
            hideModal('meeting-modal');
            showNotification('会议纪要创建成功！', 'success');
        } else if (modal && modal.id === 'generate-weekly-modal') {
            e.preventDefault();
            
            // 显示加载状态
            btn.innerHTML = '🔄 生成中...';
            btn.disabled = true;
            
            setTimeout(() => {
                hideModal('generate-weekly-modal');
                btn.innerHTML = '🚀 开始生成';
                btn.disabled = false;
                showNotification('周报生成成功！AI已为您生成本周周报。', 'success');
            }, 2000);
        }
    });
});

// 模拟点击任务卡片
document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', () => {
        showModal('task-detail-modal');
    });
});

// ============================================
// 用户菜单交互
// ============================================

document.querySelector('.user-menu')?.addEventListener('click', () => {
    showNotification('用户设置功能开发中...', 'info');
});

document.querySelector('.notification-btn')?.addEventListener('click', () => {
    showNotification('您有 3 条未读通知', 'info');
});
