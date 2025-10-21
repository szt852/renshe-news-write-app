# 每周人社资讯生成器

一个用于自动生成《每周人社资讯》的系统，包含人社要闻、业务动态、舆论声音、省内动向四个板块。

## 功能特点

1. 从指定API获取新闻数据并展示
2. 支持拖拽或点击选择新闻到对应板块
3. 使用DeepSeek AI模型生成资讯内容
4. 支持内容编辑和保存
5. 导出Word和PDF文档

## 安装和运行

### 前提条件

- Python 3.8+
- MySQL 5.7+
- Node.js (可选，用于前端资源构建)

### 安装步骤

1. 克隆项目到本地
2. 创建并激活虚拟环境：
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # 或
   venv\Scripts\activate  # Windows
   
安装依赖：

bash
pip install -r requirements.txt
配置环境变量：
创建 .env 文件，包含以下内容：

text
DATABASE_URL=mysql+mysqlconnector://username:password@localhost/renshe_news
DEEPSEEK_API_KEY=your-deepseek-api-key
初始化数据库：

bash
python -c "from database import engine; from models import Base; Base.metadata.create_all(bind=engine)"
运行应用：

bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
在浏览器中访问 http://localhost:8000

使用说明
在左侧选择新闻板块和数量，点击"加载新闻"

浏览新闻列表，可以点击"查看原文"在新标签页打开新闻链接

通过拖拽或点击"选择板块"将新闻添加到右侧对应板块

选择AI模型后点击"一键生成"开始生成内容

在生成页面可以编辑、保存各板块内容

最后可以导出Word或PDF文档

API接口
系统提供以下API接口：

GET /api/news/{section} - 获取指定板块的新闻

POST /api/news/select - 选择新闻到指定板块

POST /api/generate/section - 生成指定板块的内容

GET /api/export/word - 导出Word文档

GET /api/export/pdf - 导出PDF文档

注意事项
确保MySQL服务已启动并正确配置

需要有效的DeepSeek API密钥才能使用内容生成功能

导出PDF功能需要安装wkhtmltopdf

text

## 使用说明

1. 首先确保已安装MySQL数据库，并创建相应的数据库
2. 安装所有Python依赖：`pip install -r requirements.txt`
3. 配置环境变量，设置数据库连接和DeepSeek API密钥
4. 运行应用：`uvicorn main:app --reload`
5. 访问 http://localhost:8000 使用系统

这个系统提供了完整的《每周人社资讯》生成功能，包括新闻获取、选择、AI内容生成和导出功能。界面采用左右布局，左侧浏览新闻，右侧放置四个板块区域，支持拖拽操作和多种导出格式。