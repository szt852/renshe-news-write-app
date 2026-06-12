document.addEventListener('DOMContentLoaded', function() {
    const generatedContents = JSON.parse(sessionStorage.getItem('generatedContents') || '{}');

    // 返回按钮事件
    document.getElementById('back2indexBtn').addEventListener('click', function() {
//        alert('back')
        // 清空所有选择
        sessionStorage.removeItem('selectedNews');
        sessionStorage.removeItem('allGeneratedContents');
        sessionStorage.removeItem('generatedContents');

        // 返回首页
        window.location.href = '/';
    });

    // 显示内容预览
    showContentPreview();

    // 导出Word按钮事件
    document.getElementById('exportWordBtn').addEventListener('click', async function() {
        await exportReport('word');
    });

    // 导出PDF按钮事件
    document.getElementById('exportPdfBtn').addEventListener('click', async function() {
        await exportReport('pdf');
    });





    async function showContentPreview() {
        const preview = document.getElementById('contentPreview');

        try {
            // 从数据库获取生成的内容
            const contentIds = Object.values(generatedContents).join(',');

            const response = await fetch(`/api/get_generated_contents?content_ids=${contentIds}`);
            if (!response.ok) {
                console.error(`获取内容失败: ${response.statusText}`);
                throw new Error(`获取内容失败: ${response.statusText}`);
            }

            const contents = await response.json();
//            alert(contents['rensheyaowen'])

            // 定义板块顺序
            const categoryOrder = ['rensheyaowen', 'yewudongtai', 'yvlunshengying', 'shengneidongxiang'];
            const categoryNames = {
                'rensheyaowen': '人社要闻',
                'yewudongtai': '业务动态',
                'yvlunshengying': '舆论声音',
                'shengneidongxiang': '省内动向'
            };

            // 创建可编辑的内容预览
            let fullContent = '';

            for (const category of categoryOrder) {
                if (contents[category]) {
                    fullContent += `<h5>${categoryNames[category]}</h5>`;
                    fullContent += `<div class="editable-content" data-category="${category}" contenteditable="true">${contents[category].replace(/\n/g, '<br>')}</div>`;
                    fullContent += '<hr>';
                }
            }

            if (fullContent) {
                preview.innerHTML = fullContent;

                // 添加内容变化监听器
                const editableElements = preview.querySelectorAll('.editable-content');
                editableElements.forEach(element => {
                    element.addEventListener('input', function() {
                        const category = this.getAttribute('data-category');
                        const contentId = generatedContents[category];
                        if (contentId) {
                            // 保存修改到数据库
                            saveContentChanges(contentId, this.innerText);
                        }
                    });
                });
            } else {
                preview.innerHTML = '<div class="alert alert-warning">没有可预览的内容，请先生成内容</div>';
            }
        } catch (error) {
            console.error('加载内容预览失败:', error);
            preview.innerHTML = '<div class="alert alert-danger">加载内容预览失败: ' + error.message + '</div>';
        }
    }

    // 保存内容修改
    async function saveContentChanges(contentId, content) {
        try {
            await fetch(`/api/save_content/${contentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'content': content
                })
            });

            console.log('内容修改已保存');
        } catch (error) {
            console.error('保存内容修改失败:', error);
        }
    }

    async function exportReport(format) {
        const title = document.getElementById('reportTitle').value;

        try {
            // 获取所有生成的内容ID
            const contentIds = Object.values(generatedContents).join(',');

            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'title': title,
                    'content_ids': contentIds,
                    'format': format
                })
            });

            if (!response.ok) {
                throw new Error(`导出失败: ${response.statusText}`);
            }

            const data = await response.json();

            // 下载文件
            window.location.href = `/download/${data.filename}`;
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请稍后重试: ' + error.message);
        }
    }
});