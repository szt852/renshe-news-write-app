document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;
    const pageSize = 10;
    let deleteTargetId = null;
    let deleteModal = null;
    let selectedIds = new Set();

    // 初始化删除确认模态框
    deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

    // 加载文件列表
    async function loadReports(page = 1) {
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted mt-2">正在加载文件列表...</p>
                </td>
            </tr>
        `;

        try {
            const response = await fetch(`/api/reports?page=${page}&page_size=${pageSize}`);
            if (!response.ok) {
                throw new Error('加载失败');
            }

            const data = await response.json();
            renderTable(data.items);
            renderPagination(data.page, data.total_pages, data.total);
            updateStats(data.items);
        } catch (error) {
            console.error('加载文件列表失败:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-danger">
                        <i class="bi bi-exclamation-triangle display-6"></i>
                        <p class="mt-2">加载失败，请稍后重试</p>
                    </td>
                </tr>
            `;
        }
    }

    // 渲染表格
    function renderTable(items) {
        const tbody = document.getElementById('reportsTableBody');

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox display-6"></i>
                        <p class="mt-2">暂无导出文件</p>

                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        items.forEach((item, index) => {
            const formatIcon = item.format === 'pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-word';
            const formatLabel = item.format === 'pdf' ? 'PDF' : 'Word';
            const fileStatus = item.file_exists
                ? ''
                : '<span class="badge bg-warning text-dark ms-1" title="物理文件已丢失">缺失</span>';
            const isChecked = selectedIds.has(item.id) ? 'checked' : '';

            html += `
                <tr data-id="${item.id}">
                    <td>
                        <input type="checkbox" class="form-check-input row-checkbox" 
                               value="${item.id}" ${isChecked}>
                    </td>
                    <td>${item.id}</td>
                    <td>
                        <div class="fw-semibold">${escapeHtml(item.title)}</div>
                        <div class="small text-muted">${escapeHtml(item.filename)}${fileStatus}</div>
                    </td>
                    <td>
                        <span class="badge bg-${item.format_badge}">
                            <i class="bi ${formatIcon}"></i> ${formatLabel}
                        </span>
                    </td>
                    <td>${item.size_str}</td>
                    <td class="text-muted small">${item.created_at}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <a href="/download/${encodeURIComponent(item.filename)}" 
                               class="btn btn-outline-primary" 
                               title="下载"
                               ${!item.file_exists ? 'disabled' : ''}>
                                <i class="bi bi-download"></i>
                            </a>
                            <button class="btn btn-outline-danger" 
                                    title="删除"
                                    onclick="window.confirmDelete(${item.id}, '${escapeHtml(item.title)}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // 绑定行内复选框事件
        tbody.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', function() {
                const id = parseInt(this.value);
                if (this.checked) {
                    selectedIds.add(id);
                } else {
                    selectedIds.delete(id);
                }
                updateBatchToolbar();
            });
        });

        // 更新全选框状态
        const allIds = items.map(i => i.id);
        const allChecked = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
        document.getElementById('selectAllCheckbox').checked = allChecked;
    }

    // 更新批量操作工具栏显示状态
    function updateBatchToolbar() {
        const toolbar = document.getElementById('batchToolbar');
        const countEl = document.getElementById('selectedCount');
        countEl.textContent = selectedIds.size;
        toolbar.style.display = selectedIds.size > 0 ? 'block' : 'none';
    }

    // 渲染分页
    function renderPagination(current, totalPages, total) {
        const pagination = document.getElementById('pagination');
        const info = document.getElementById('paginationInfo');

        info.textContent = totalPages > 0
            ? `第 ${current} 页，共 ${totalPages} 页（共 ${total} 条）`
            : '暂无数据';

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';

        // 上一页
        html += `
            <li class="page-item ${current === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${current - 1}">上一页</a>
            </li>
        `;

        // 页码（最多显示5个）
        let startPage = Math.max(1, current - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === current ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // 下一页
        html += `
            <li class="page-item ${current === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${current + 1}">下一页</a>
            </li>
        `;

        pagination.innerHTML = html;

        // 绑定分页点击事件
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.getAttribute('data-page'));
                if (page >= 1 && page <= totalPages && page !== current) {
                    currentPage = page;
                    loadReports(page);
                }
            });
        });
    }

    // 更新统计卡片
    function updateStats(items) {
        const wordCount = items.filter(i => i.format === 'word').length;
        const pdfCount = items.filter(i => i.format === 'pdf').length;

        document.getElementById('wordCount').textContent = wordCount;
        document.getElementById('pdfCount').textContent = pdfCount;

        // 总数从分页信息更新
        const infoText = document.getElementById('paginationInfo').textContent;
        const match = infoText.match(/共 (\d+) 条/);
        if (match) {
            document.getElementById('totalCount').textContent = match[1];
        }
    }

    // HTML 转义，防止 XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 全选/取消全选
    document.getElementById('selectAllCheckbox').addEventListener('change', function() {
        const tbody = document.getElementById('reportsTableBody');
        const rowCheckboxes = tbody.querySelectorAll('.row-checkbox');

        rowCheckboxes.forEach(cb => {
            cb.checked = this.checked;
            const id = parseInt(cb.value);
            if (this.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
        });
        updateBatchToolbar();
    });

    // 批量删除按钮
    document.getElementById('batchDeleteBtn').addEventListener('click', function() {
        if (selectedIds.size === 0) return;
        deleteTargetId = 'batch';  // 标记为批量删除模式
        document.querySelector('#deleteModal .modal-body').innerHTML = `
            <p class="mb-0">确定要删除选中的 <strong>${selectedIds.size}</strong> 个文件吗？<br><span class="text-danger small">删除后不可恢复</span></p>
        `;
        deleteModal.show();
    });

    // 暴露给全局的单个删除确认函数
    window.confirmDelete = function(id, title) {
        deleteTargetId = id;
        document.querySelector('#deleteModal .modal-body').innerHTML = `
            <p class="mb-0">确定要删除 <strong>${escapeHtml(title)}</strong> 吗？<br><span class="text-danger small">删除后不可恢复</span></p>
        `;
        deleteModal.show();
    };

    // 确认删除按钮（支持单个和批量）
    document.getElementById('confirmDeleteBtn').addEventListener('click', async function() {
        if (!deleteTargetId) return;

        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 删除中...';

        try {
            let response;
            if (deleteTargetId === 'batch') {
                // 批量删除
                response = await fetch('/api/reports/batch_delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: Array.from(selectedIds) })
                });
            } else {
                // 单个删除
                response = await fetch(`/api/reports/${deleteTargetId}`, {
                    method: 'DELETE'
                });
            }

            if (response.ok) {
                deleteModal.hide();
                if (deleteTargetId === 'batch') {
                    selectedIds.clear();
                    updateBatchToolbar();
                }
                // 刷新当前页
                loadReports(currentPage);
            } else {
                const data = await response.json();
                alert('删除失败: ' + (data.detail || '未知错误'));
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败，请稍后重试');
        } finally {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-trash"></i> 确认删除';
            deleteTargetId = null;
        }
    });

    // 初始加载
    loadReports(currentPage);
});
