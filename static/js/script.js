// 全局变量
let selectedNews = {
    rensheyaowen: [],
    yewudongtai: [],
    yvlunshengying: [],
    shengneidongxiang: []
};

let currentPage = 1;
const pageSize = 10;
let totalNews = 0;
let allNews = [];

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化拖放功能
    initDragAndDrop();
    
    // 加载默认类别的新闻
    loadNews('rensheyaowen');
    
    // 事件监听
    document.getElementById('loadNewsBtn').addEventListener('click', function() {
        const category = document.getElementById('categorySelect').value;
        loadNews(category);
    });
    
    document.getElementById('generateBtn').addEventListener('click', function() {
        startGeneration();
    });
    
    document.getElementById('searchInput').addEventListener('input', function() {
        filterNews();
    });
    
    // 类别选择模态框事件
    const categoryLinks = document.querySelectorAll('#categoryModal .list-group-item');
    categoryLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.getAttribute('data-category');
            const newsUrl = this.getAttribute('data-news-url'); // 改为使用URL
            addNewsToCategory(newsUrl, category);
            bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        });
    });
});

// 初始化拖放功能
function initDragAndDrop() {
    const dropzones = document.querySelectorAll('.dropzone');

    dropzones.forEach(zone => {
        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });

        zone.addEventListener('dragleave', function() {
            this.classList.remove('dragover');
        });

        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');

            const newsUrl = e.dataTransfer.getData('newsUrl'); // 改为使用URL
            const category = this.getAttribute('data-category');

            if (newsUrl) {
                addNewsToCategory(newsUrl, category);
            }
        });
    });
}

// 加载新闻
async function loadNews(category) {
    try {
        const response = await fetch(`/api/news/${category}?news_count=20`);
        const data = await response.json();

        if (data.result) {
            allNews = data.result;
            totalNews = allNews.length;
            currentPage = 1;
            renderNewsList();
            renderPagination();
        }
    } catch (error) {
        console.error('加载新闻失败:', error);
//        alert('加载新闻失败，请稍后重试');
    }
}

// 渲染新闻列表
function renderNewsList() {
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = '';

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalNews);
    const pageNews = allNews.slice(startIndex, endIndex);

    pageNews.forEach(news => {
        const row = document.createElement('tr');
        row.className = 'news-item';
        row.draggable = true;
        row.setAttribute('data-news-url', news.新闻链接); // 改为使用URL

        row.innerHTML = `
            <td>
                <div class="news-title">${news.新闻标题}</div>
                <div class="news-meta">来源: ${news.新闻来源}</div>
            </td>
            <td>${news.新闻来源}</td>
            <td>${news.发布时间}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary select-news" data-news-url="${news.新闻链接}">
                    选择
                </button>

            </td>
        `;

        // 添加拖拽事件
        row.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('newsUrl', this.getAttribute('data-news-url')); // 改为使用URL
        });

        // 添加点击查看事件
        row.addEventListener('click', function() {
            window.open(news.新闻链接, '_blank');
        });

        // 添加选择按钮事件
        const selectBtn = row.querySelector('.select-news');
        selectBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const newsUrl = this.getAttribute('data-news-url'); // 改为使用URL
            showCategoryModal(newsUrl);
        });

        newsList.appendChild(row);
    });
}

// 显示类别选择模态框
function showCategoryModal(newsUrl) {
    const modalLinks = document.querySelectorAll('#categoryModal .list-group-item');
    modalLinks.forEach(link => {
        link.setAttribute('data-news-url', newsUrl); // 改为使用URL
    });

    const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    modal.show();
}

// 添加新闻到指定类别
function addNewsToCategory(newsUrl, category) {
    // 检查是否已在其他类别中
    for (const cat in selectedNews) {
        const index = selectedNews[cat].indexOf(newsUrl);
        if (index > -1) {
            if (cat === category) {
                alert('该新闻已在此类别中');
                return;
            } else {
                // 从原类别中移除
                selectedNews[cat].splice(index, 1);
                updateSelectedNewsDisplay(cat);
            }
        }
    }

    // 添加到新类别
    selectedNews[category].push(newsUrl);
    updateSelectedNewsDisplay(category);
}

// 更新已选新闻显示
function updateSelectedNewsDisplay(category) {
    const box = document.getElementById(`${category}-box`);
    const newsList = box.querySelector('.selected-news-list');
    newsList.innerHTML = '';

    selectedNews[category].forEach(newsUrl => {
        // 查找新闻信息
        const news = allNews.find(n => n.新闻链接 === newsUrl);
        if (news) {
            const item = document.createElement('div');
            item.className = 'selected-news-item';
            item.innerHTML = `
                <button type="button" class="btn btn-sm btn-remove btn-outline-danger">
                    <i class="bi bi-x"></i>
                </button>
                <div class="news-title">${news.新闻标题}</div>
                <div class="news-meta">${news.新闻来源} | ${news.发布时间}</div>
            `;

            // 添加移除按钮事件
            const removeBtn = item.querySelector('.btn-remove');
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = selectedNews[category].indexOf(newsUrl);
                if (index > -1) {
                    selectedNews[category].splice(index, 1);
                    updateSelectedNewsDisplay(category);
                }
            });
            
            newsList.appendChild(item);
        }
    });
}

// 渲染分页控件
function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(totalNews / pageSize);
    
    // 上一页按钮
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#">上一页</a>`;
    prevLi.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderNewsList();
            renderPagination();
        }
    });
    pagination.appendChild(prevLi);
    
    // 页码按钮
    for (let i = 1; i <= totalPages; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${currentPage === i ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        pageLi.addEventListener('click', function(e) {
            e.preventDefault();
            currentPage = i;
            renderNewsList();
            renderPagination();
        });
        pagination.appendChild(pageLi);
    }
    
    // 下一页按钮
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#">下一页</a>`;
    nextLi.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderNewsList();
            renderPagination();
        }
    });
    pagination.appendChild(nextLi);
}

// 过滤新闻
function filterNews() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        // 如果没有搜索词，显示所有新闻
        renderNewsList();
        return;
    }
    
    const filteredNews = allNews.filter(news => 
        news.新闻标题.toLowerCase().includes(searchTerm)
    );
    
    // 临时保存过滤后的结果用于分页
    const tempAllNews = allNews;
    const tempTotalNews = totalNews;
    
    allNews = filteredNews;
    totalNews = filteredNews.length;
    currentPage = 1;
    
    renderNewsList();
    renderPagination();
    
    // 恢复原始数据
    allNews = tempAllNews;
    totalNews = tempTotalNews;
}

// 开始生成内容
function startGeneration() {
    // 检查是否至少每个类别有一条新闻
    const categories = ['rensheyaowen', 'yewudongtai', 'yvlunshengying', 'shengneidongxiang'];
    let hasSelectedNews = false;
    
    for (const cat of categories) {
        if (selectedNews[cat] && selectedNews[cat].length > 0) {
            hasSelectedNews = true;
            break;
        }
    }
    
    if (!hasSelectedNews) {
        alert('您未选择任何新闻，请在板块中添加新闻！');
        return;
    }
    
    // 跳转到生成页面
    sessionStorage.setItem('selectedNews', JSON.stringify(selectedNews));
    window.location.href = '/generate';
}