document.addEventListener('DOMContentLoaded', function() {
    const selectedNews = JSON.parse(sessionStorage.getItem('selectedNews') || '{}');
    const categories = ['rensheyaowen', 'yewudongtai', 'yvlunshengying', 'shengneidongxiang'];
    let currentCategoryIndex = 0;
    let generatedContents = {};

    // 初始化页面
    initPage();

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
//                alert(selectedNews[cat]);
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
//        alert(111);
            const category = categories[currentCategoryIndex];
//            alert(currentCategoryIndex);
//            alert(category);
            if (selectedNews[category] && selectedNews[category].length > 0) {
//                alert(222);
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
//        alert(newsList);

//        selectedNews[category].forEach(newsUrl => {
//            alert(newsUrl)
//            // 查找新闻信息
//            const allNews = JSON.parse(sessionStorage.getItem('allNews') || '[]');
//            alert(allNews)
//            const news = allNews.find(n => n.新闻链接 === newsUrl);
//
//            if (news) {
//                const item = document.createElement('div');
//                item.className = 'border-bottom pb-2 mb-2';
//                item.innerHTML = `
//                    <div class="fw-bold">${news.新闻标题}</div>
//                    <div class="small text-muted">${news.新闻来源} | ${news.发布时间}</div>
//                    <a href="${news.新闻链接}" target="_blank" class="small">查看原文</a>
//                `;
//                newsList.appendChild(item);
//            } else {
//                const item = document.createElement('div');
//                item.className = 'border-bottom pb-2 mb-2';
//                item.textContent = `新闻URL: ${newsUrl}`;
//                newsList.appendChild(item);
//            }
//        });


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
                    <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">
                        <i class="bi bi-box-arrow-up-right"></i> 查看原文
                    </a>
                </div>
            `;

            newsList.appendChild(item);

            // 从数据库获取新闻详细信息
            fetchNewsInfo(newsUrl, item);
        });

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
                        <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                            <i class="bi bi-box-arrow-up-right"></i> 查看
                        </a>
                    </div>
                `;
            } catch (error) {
                console.error('获取新闻信息失败:', error);
                itemElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="text-muted">无法获取新闻信息: ${newsUrl}</div>
                        <a href="${newsUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">
                            <i class="bi bi-box-arrow-up-right"></i> 查看原文
                        </a>
                    </div>
                `;
            }
        }

        // 清空内容区域
        document.getElementById('generatedContent').value = '';
    }

    // 生成内容按钮事件
    document.getElementById('generateContentBtn').addEventListener('click', async function() {
        const category = categories[currentCategoryIndex];
        const model = document.getElementById('modelSelect').value;
        const news_urls = selectedNews[category].join(',');

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
                    'model': model
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
            document.getElementById('generateContentBtn').disabled = false;
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
//            console.log('内容保存成功')
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


