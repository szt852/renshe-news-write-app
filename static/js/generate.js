document.addEventListener('DOMContentLoaded', function() {
    const selectedNews = JSON.parse(sessionStorage.getItem('selectedNews') || '{}');
    const categories = ['rensheyaowen', 'yewudongtai', 'yvlunshengying', 'shengneidongxiang'];
    let currentCategoryIndex = 0;
    let generatedContents = {};

    // 弹窗相关元素
    const newsContentModalEl = document.getElementById('newsContentModal');
    const newsContentModal = new bootstrap.Modal(newsContentModalEl);
    const scrapedContentTextarea = document.getElementById('scrapedContentTextarea');
    const saveScrapedContentBtn = document.getElementById('saveScrapedContentBtn');
    let currentEditingUrl = null;

    // 初始化页面
    initPage();

    // 模型选择切换：控制 API Key 输入框显示/隐藏
    const modelSelect = document.getElementById('modelSelect');
    const apiKeyBox = document.getElementById('apiKeyBox');

    function updateApiKeyBoxVisibility() {
        if (modelSelect.value === 'deepseek') {
            apiKeyBox.style.display = 'block';
        } else {
            apiKeyBox.style.display = 'none';
        }
    }

    // 页面加载时立即根据当前选中值设置状态
    updateApiKeyBoxVisibility();

    modelSelect.addEventListener('change', updateApiKeyBoxVisibility);

    // 从 localStorage 恢复已保存的 API Key
    const savedApiKey = localStorage.getItem('deepseek_api_key');
    if (savedApiKey) {
        document.getElementById('userApiKey').value = savedApiKey;
    }

    // 显示/隐藏密码
    document.getElementById('toggleApiKeyBtn').addEventListener('click', function() {
        const input = document.getElementById('userApiKey');
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('bi-eye');
            icon.classList.add('bi-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('bi-eye-slash');
            icon.classList.add('bi-eye');
        }
    });

    // 保存 API Key 到 localStorage
    document.getElementById('saveApiKeyBtn').addEventListener('click', function() {
        const apiKey = document.getElementById('userApiKey').value.trim();
        if (apiKey) {
            localStorage.setItem('deepseek_api_key', apiKey);
        } else {
            localStorage.removeItem('deepseek_api_key');
        }
        const status = document.getElementById('apiKeySaveStatus');
        status.style.display = 'block';
        setTimeout(function() {
            status.style.display = 'none';
        }, 2000);
    });

    // 返回按钮事件
    document.getElementById('backBtn').addEventListener('click', function() {
        // 清空所有选择
        sessionStorage.removeItem('selectedNews');
        sessionStorage.removeItem('allGeneratedContents');
        sessionStorage.removeItem('generatedContents');

        // 返回首页
        window.location.href = '/';
    });

    function initPage() {
        // 检查是否有选中的新闻
        let hasNews = false;
        for (const cat of categories) {
            if (selectedNews[cat] && selectedNews[cat].length > 0) {
                hasNews = true;
                break;
            }
        }

        if (!hasNews) {
            alert('没有选择任何新闻，请返回首页选择新闻');
            window.location.href = '/';
            return;
        }

        // 显示第一个有新闻的类别
        while (currentCategoryIndex < categories.length) {
            const category = categories[currentCategoryIndex];
            if (selectedNews[category] && selectedNews[category].length > 0) {
                showCategory(category);
                break;
            }
            currentCategoryIndex++;
        }

        // 如果没有更多类别，跳转到导出页面
        if (currentCategoryIndex >= categories.length) {
            finishGeneration();
        }
    }

    function updateGenerateButtonState() {
        const category = categories[currentCategoryIndex];
        const hasItems = selectedNews[category] && selectedNews[category].length > 0;
        document.getElementById('generateContentBtn').disabled = !hasItems;
    }

    function showCategory(category) {
        const categoryNames = {
            'rensheyaowen': '人社要闻',
            'yewudongtai': '业务动态',
            'yvlunshengying': '舆论声音',
            'shengneidongxiang': '省内动向'
        };

        document.getElementById('currentCategory').textContent = categoryNames[category];

        // 显示选中的新闻
        const newsList = document.getElementById('selectedNewsList');
        newsList.innerHTML = '';

        // 修改后的函数，从数据库获取新闻信息
        selectedNews[category].forEach(newsUrl => {
            // 创建新闻项容器
            const item = document.createElement('div');
            item.className = 'border-bottom pb-2 mb-2';
            item.id = `news-item-${encodeURIComponent(newsUrl)}`;

            // 添加加载中的占位符
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <span class="text-muted">加载新闻信息...</span>
                    </div>
                    <div class="d-flex">
                        <button type="button" class="btn btn-sm btn-outline-info ms-2 btn-view-content" data-news-url="${newsUrl}">
                            <i class="bi bi-file-text"></i> 查看正文
                        </button>
                        <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                            <i class="bi bi-box-arrow-up-right"></i> 查看原文
                        </a>
                        <button type="button" class="btn btn-sm btn-outline-danger ms-2 btn-delete-news" data-news-url="${newsUrl}">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </div>
                </div>
            `;

            newsList.appendChild(item);

            // 从数据库获取新闻详细信息
            fetchNewsInfo(newsUrl, item);
        });

        updateGenerateButtonState();

        // 新增函数：从数据库获取新闻信息
        async function fetchNewsInfo(newsUrl, itemElement) {
            try {
                const response = await fetch(`/api/get_news_info?url=${encodeURIComponent(newsUrl)}`);
                if (!response.ok) {
                    throw new Error(`获取新闻信息失败: ${response.statusText}`);
                }

                const newsInfo = await response.json();

                // 更新新闻项显示
                itemElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="fw-bold">${newsInfo.title || '未知标题'}</div>
                            <div class="small text-muted">${newsInfo.source || '未知来源'} | ${newsInfo.publish_date || '未知日期'}</div>
                        </div>
                        <div class="d-flex">
                            <button type="button" class="btn btn-sm btn-outline-info ms-2 btn-view-content" data-news-url="${newsUrl}">
                                <i class="bi bi-file-text"></i> 查看正文
                            </button>
                            <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                                <i class="bi bi-box-arrow-up-right"></i> 查看
                            </a>
                            <button type="button" class="btn btn-sm btn-outline-danger ms-2 btn-delete-news" data-news-url="${newsUrl}">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('获取新闻信息失败:', error);
                itemElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="text-muted">无法获取新闻信息: ${newsUrl}</div>
                        <div class="d-flex">
                            <button type="button" class="btn btn-sm btn-outline-info ms-2 btn-view-content" data-news-url="${newsUrl}">
                                <i class="bi bi-file-text"></i> 查看正文
                            </button>
                            <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                                <i class="bi bi-box-arrow-up-right"></i> 查看原文
                            </a>
                            <button type="button" class="btn btn-sm btn-outline-danger ms-2 btn-delete-news" data-news-url="${newsUrl}">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        // 清空内容区域
        document.getElementById('generatedContent').value = '';
    }

    // 事件委托：查看正文、删除
    document.getElementById('selectedNewsList').addEventListener('click', function(e) {
        const viewBtn = e.target.closest('.btn-view-content');
        const deleteBtn = e.target.closest('.btn-delete-news');
        if (viewBtn) {
            e.preventDefault();
            openContentModal(viewBtn.dataset.newsUrl);
        }
        if (deleteBtn) {
            e.preventDefault();
            deleteNews(deleteBtn.dataset.newsUrl);
        }
    });

    async function openContentModal(newsUrl) {
        currentEditingUrl = newsUrl;
        scrapedContentTextarea.value = '正在加载正文内容...';
        saveScrapedContentBtn.disabled = true;
        newsContentModal.show();

        try {
            const response = await fetch(`/api/news_content?url=${encodeURIComponent(newsUrl)}`);
            if (!response.ok) {
                throw new Error(`加载正文失败: ${response.statusText}`);
            }
            const data = await response.json();
            scrapedContentTextarea.value = data.content || '';
            saveScrapedContentBtn.disabled = false;
        } catch (error) {
            console.error('加载正文失败:', error);
            scrapedContentTextarea.value = '无法加载正文内容，您可以直接在此处粘贴内容并保存。';
            saveScrapedContentBtn.disabled = false;
        }
    }

    saveScrapedContentBtn.addEventListener('click', async function() {
        if (!currentEditingUrl) {
            alert('未选择新闻');
            return;
        }

        const content = scrapedContentTextarea.value;
        saveScrapedContentBtn.disabled = true;

        try {
            const response = await fetch('/api/news_content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'url': currentEditingUrl,
                    'content': content
                })
            });

            if (!response.ok) {
                throw new Error(`保存失败: ${response.statusText}`);
            }

            alert('正文内容已保存，将以您输入的内容参与生成。');
            newsContentModal.hide();
        } catch (error) {
            console.error('保存正文失败:', error);
            alert('保存正文失败，请稍后重试');
        } finally {
            saveScrapedContentBtn.disabled = false;
        }
    });

    function deleteNews(newsUrl) {
        if (!confirm('确定要删除这条新闻吗？删除后将不再参与生成。')) {
            return;
        }

        const category = categories[currentCategoryIndex];
        const index = selectedNews[category].indexOf(newsUrl);
        if (index > -1) {
            selectedNews[category].splice(index, 1);
            sessionStorage.setItem('selectedNews', JSON.stringify(selectedNews));
        }

        const itemElement = document.getElementById(`news-item-${encodeURIComponent(newsUrl)}`);
        if (itemElement) {
            itemElement.remove();
        }

        const newsList = document.getElementById('selectedNewsList');
        if (!selectedNews[category] || selectedNews[category].length === 0) {
            newsList.innerHTML = `
                <div class="text-muted text-center py-3">
                    当前分类没有新闻，请点击“下一个板块”继续。
                </div>
            `;
        }

        updateGenerateButtonState();
    }

    // 生成内容按钮事件
    document.getElementById('generateContentBtn').addEventListener('click', async function() {
        const category = categories[currentCategoryIndex];
        const modelProvider = document.getElementById('modelSelect').value;
        const userApiKey = document.getElementById('userApiKey').value;

        if (!selectedNews[category] || selectedNews[category].length === 0) {
            alert('当前分类没有新闻可供生成');
            return;
        }

        const news_urls = selectedNews[category].join(',');

        // 校验：选择 deepseek 时必须输入 API Key
        if (modelProvider === 'deepseek' && !userApiKey.trim()) {
            alert('使用 DeepSeek 模型需要输入 API Key，或联系管理员配置环境变量');
            return;
        }

        // 显示加载指示器
        document.getElementById('loadingIndicator').style.display = 'block';
        document.getElementById('generatedContent').style.display = 'none';
        document.getElementById('generateContentBtn').disabled = true;

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'category': category,
                    'news_urls': news_urls,
                    'model_provider': modelProvider,
                    'user_api_key': userApiKey
                })
            });

            if (!response.ok) {
                throw new Error(`生成失败: ${response.statusText}`);
            }

            const data = await response.json();
            document.getElementById('generatedContent').value = data.content;
            generatedContents[category] = data.id;

            // 保存生成的内容到sessionStorage，用于预览
            const allGeneratedContents = JSON.parse(sessionStorage.getItem('allGeneratedContents') || '{}');
            allGeneratedContents[category] = data.content;
            sessionStorage.setItem('allGeneratedContents', JSON.stringify(allGeneratedContents));

        } catch (error) {
            console.error('生成内容失败:', error);
            alert('生成内容失败，请稍后重试: ' + error.message);
        } finally {
            // 隐藏加载指示器
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('generatedContent').style.display = 'block';
            updateGenerateButtonState();
        }
    });

    // 保存内容按钮事件
    document.getElementById('saveContentBtn').addEventListener('click', async function() {
        const contentId = generatedContents[categories[currentCategoryIndex]];
        const content = document.getElementById('generatedContent').value;

        if (!contentId) {
            alert('请先生成内容');
            return;
        }

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

            alert('内容保存成功');
        } catch (error) {
            console.error('保存内容失败:', error);
            alert('保存内容失败，请稍后重试');
        }
    });

    // 下一个类别按钮事件
    document.getElementById('nextCategoryBtn').addEventListener('click', function() {
        // 移动到下一个有新闻的类别
        currentCategoryIndex++;
        while (currentCategoryIndex < categories.length) {
            const category = categories[currentCategoryIndex];
            if (selectedNews[category] && selectedNews[category].length > 0) {
                showCategory(category);
                return;
            }
            currentCategoryIndex++;
        }

        // 如果没有更多类别，完成生成
        finishGeneration();
    });

    function finishGeneration() {
        sessionStorage.setItem('generatedContents', JSON.stringify(generatedContents));
        window.location.href = '/export';
    }
});
