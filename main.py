from fastapi import FastAPI, Request, Depends, HTTPException, Form
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import httpx

from database import get_db, engine, Base
from models import NewsItem, GeneratedContent, WeeklyReport
# 添加PDF生成相关的导入
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

import re
from datetime import datetime

from docx import Document
from docx.shared import Pt, Inches
from docx.oxml.ns import qn
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

# 添加中文字体支持
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 运行时地址
# run_ip = 'host.docker.internal'
run_ip = '127.0.0.1'
# run_ip = ''

# 添加获取环境变量中的API密钥
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
# 修改 DeepSeek API 配置
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"  # 正确的 API 端点
DEEPSEEK_MODEL_MAP = {
    "deepseek-v3": "deepseek-chat",  # 映射到正确的模型名称
    "deepseek-r1": "deepseek-coder"  # 根据实际情况调整
}

# 注册中文字体（确保系统中有中文字体，或者提供字体文件路径）
try:
    # 尝试注册中文字体，这里使用系统默认字体，您可能需要根据实际情况调整
    pdfmetrics.registerFont(TTFont('SimSun', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
except:
    # 如果注册失败，使用默认字体
    print("Warning: Chinese font not found, using default font")


# 创建FastAPI应用
app = FastAPI(title="每周人社资讯生成器")

# 挂载静态文件和模板
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# 初始化数据库
# 在应用启动时注册中文字体
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 注册中文字体
    try:
        # 尝试注册中文字体，您需要提供中文字体文件路径
        # 例如：将SimSun.ttf字体文件放在项目根目录的fonts文件夹中
        font_path1 = os.path.join(os.path.dirname(__file__), "fonts", "仿宋_GB2312.TTF")
        font_path2 = os.path.join(os.path.dirname(__file__), "fonts", "方正小标宋简体.TTF")
        if os.path.exists(font_path1):
            pdfmetrics.registerFont(TTFont('仿宋_GB2312', font_path1))
        if os.path.exists(font_path2):
            pdfmetrics.registerFont(TTFont('方正小标宋简体', font_path2))
        else:
            # 如果找不到字体文件，尝试使用系统字体
            print("警告：未找到中文字体文件，尝试使用系统字体")
            # 可以尝试其他常见中文字体名称
            chinese_fonts = ['SimSun', 'SimHei', 'KaiTi', 'MicrosoftYaHei', 'STSong']
            for font_name in chinese_fonts:
                try:
                    pdfmetrics.registerFont(TTFont(font_name, font_name))
                    break
                except:
                    continue
    except Exception as e:
        print(f"注册中文字体失败: {str(e)}")



# 首页路由
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# 生成页面路由
@app.get("/generate", response_class=HTMLResponse)
async def generate_page(request: Request):
    return templates.TemplateResponse("generate.html", {"request": request})


# 导出页面路由
@app.get("/export", response_class=HTMLResponse)
async def export_page(request: Request):
    return templates.TemplateResponse("export.html", {"request": request})



# 修改获取新闻数据函数，减少不必要的数据库操作
@app.get("/api/news/{category}")
async def get_news(category: str, news_count: int = 5, db: AsyncSession = Depends(get_db)):
    # 首先检查数据库中是否已有该分类的新闻
    result = await db.execute(
        select(NewsItem)
        .where(NewsItem.category == category)
        .order_by(NewsItem.publish_date.desc())
        .limit(news_count)
    )
    existing_news = result.scalars().all()

    # 如果数据库中有足够的数据，直接返回
    if len(existing_news) >= news_count:
        return {
            "result_str": f"从数据库查询到新闻数据 {len(existing_news)} 条！",
            "result": [
                {
                    "新闻标题": item.title,
                    "所属板块": item.category,
                    "发布时间": item.publish_date,
                    "新闻来源": item.source,
                    "新闻链接": item.url
                }
                for item in existing_news
            ]
        }

    # 定义不同类别的API URL
    category_urls = {
        "rensheyaowen": "http://" + str(run_ip) + ":4399/get_rensheyaowen_news",
        "yewudongtai": "http://" + str(run_ip) + ":4399/get_yewudongtai_news",
        "yvlunshengying": "http://" + str(run_ip) + ":4399/get_yvlunshengying_news",
        "shengneidongxiang": "http://" + str(run_ip) + ":4399/get_shengneidongxiang_news"
    }

    if category not in category_urls:
        raise HTTPException(status_code=404, detail="Category not found")

    url = f"{category_urls[category]}?news_count={news_count}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            news_data = response.json()

            # 保存新闻到数据库
            for item in news_data.get("result", []):
                # 检查是否已存在相同URL的新闻
                result = await db.execute(
                    select(NewsItem).where(NewsItem.url == item["新闻链接"])
                )
                existing_news = result.scalar_one_or_none()

                if existing_news is None:
                    news_item = NewsItem(
                        title=item["新闻标题"],
                        category=item["所属板块"],
                        publish_date=item["发布时间"],
                        source=item["新闻来源"],
                        url=item["新闻链接"]
                    )
                    db.add(news_item)
            await db.commit()

            return news_data
    except httpx.RequestError as e:
        # 如果API调用失败，但数据库中有数据，返回数据库中的数据
        if existing_news:
            return {
                "result_str": f"API调用失败，从数据库查询到新闻数据 {len(existing_news)} 条！",
                "result": [
                    {
                        "新闻标题": item.title,
                        "所属板块": item.category,
                        "发布时间": item.publish_date,
                        "新闻来源": item.source,
                        "新闻链接": item.url
                    }
                    for item in existing_news
                ]
            }
        raise HTTPException(status_code=500, detail=f"Error fetching news: {str(e)}")




# 获取新闻内容 - 修改为使用 URL
@app.get("/api/news_content")
async def get_news_content(url: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsItem).where(NewsItem.url == url))
    news_item = result.scalar_one_or_none()

    if not news_item:
        raise HTTPException(status_code=404, detail="News item not found")

    # 如果内容为空，尝试从URL获取内容
    if not news_item.content:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(news_item.url)
                response.raise_for_status()

                # 这里应该使用更复杂的HTML解析来提取正文内容
                # 简化版：直接返回部分HTML
                content = response.text[:10000] + "..."  # 限制内容长度
                news_item.content = content
                await db.commit()
        except Exception as e:
            news_item.content = f"无法获取内容: {str(e)}"
            await db.commit()

    return {"content": news_item.content}



# 修改生成内容函数 - 实现真实的DeepSeek API调用
@app.post("/api/generate")
async def generate_content(
        category: str = Form(...),
        news_urls: str = Form(...),
        model: str = Form("deepseek-v3"),
        db: AsyncSession = Depends(get_db)
):
    category_names = {
        "rensheyaowen": "人社要闻",
        "yewudongtai": "业务动态",
        "yvlunshengying": "舆论声音",
        "shengneidongxiang": "省内动向"
    }

    # 解析新闻URL
    try:
        news_url_list = news_urls.split(",")
    except:
        raise HTTPException(status_code=400, detail="Invalid news URLs format")

    # 获取新闻内容
    news_contents = []
    generated_text = ''
    try:
        index = 1
        for news_url in news_url_list:

            result = await db.execute(select(NewsItem).where(NewsItem.url == news_url))
            news_item = result.scalar_one_or_none()

            # 新闻标题
            news_title = str(news_item.title)

            # 新闻时间
            print(type(news_item.publish_date)) # datetime对象
            # 将字符串转换为
            # date_obj = datetime.strptime(news_item.publish_date, '%Y-%m-%d %H:%M:%S')
            # 格式化为指定的格式
            formatted_date = news_item.publish_date.strftime('%Y年%m月%d日')
            print(formatted_date)  # 输出: 2025年09月12日

            # 新闻来源
            news_laiyuan = str(news_item.source)



            if news_item:
                if not news_item.content:
                    # 如果内容为空，尝试获取
                    content_response = await get_news_content(news_url, db)
                    news_item.content = content_response["content"] # 获取新闻网页内容
                    await db.commit()
                news_contents.append(news_item.content)

            # 构建提示词
            # 构建DeepSeek API请求:cite[1]:cite[4]:cite[7]
            prompt = f"""
            你是一个专业的人社资讯生成器，能够根据用户提供新闻内容的内容，生成人社资讯的{category_names[category]}板块的内容，以新闻播报者的角度，详细讲述新闻具体情况，生成过程汇总不要换行或者分段，直接生成一整段新闻内容，确保字数在400字左右，不少于300字。
    
            新闻内容如下：
            {" ".join(news_contents)}
    
            请按照以下文风参考生成内容：
            {category_names[category]}仿照以下文本风格：
            1.人社部举办2024年全国人力资源市场高校毕业生就业服务专项行动。为贯彻党中央、国务院关于促进高质量充分就业决策部署，人社部将于12月1日至31日举办全国人力资源市场高校毕业生就业服务专项行动，为2025届高校毕业生、往届离校未就业高校毕业生及"三支一扶"计划等基层服务项目人员提供就业服务。专项行动期间，各地人社部门、各类人力资源服务机构、国家级人力资源服务产业园和人才市场将广泛开拓市场化招聘岗位、创新开展大规模线上招聘、直播带岗宣讲、就业指导和职业体验、线上测评和考试服务、人力资源服务进校园以及线下招聘活动，积极促进高校毕业生就业创业和成长成才。
            """

            # 修改生成内容函数中的 API 调用部分

            headers = {
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }

            # 使用正确的模型名称
            api_model = DEEPSEEK_MODEL_MAP.get(model, "deepseek-chat")

            data = {
                "model": api_model,  # 使用映射后的模型名称
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的人社资讯撰写专家，擅长生成符合政府公文风格的新闻内容。请确保生成的内容专业、准确、符合政府公文格式，字数在400字左右。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 200,  # 减少 token 数量，20000 可能过多
                "stream": False
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    DEEPSEEK_API_URL,
                    headers=headers,
                    json=data,
                    timeout=60.0  # 增加超时时间
                )

                if response.status_code == 200:
                    result = response.json()
                    # 确保响应结构正确
                    if "choices" in result and len(result["choices"]) > 0:
                        temp_generated_text = result["choices"][0]["message"]["content"]
                        temp_generated_text = "    " + str(index) + '.' + news_title + '。' + temp_generated_text + '(来源：' + news_laiyuan + "  " + formatted_date + '）\n'
                        # temp_generated_text = "    __" + str(index) + '.' + news_title + '。__' + temp_generated_text + '(来源：' + news_laiyuan + "  " + formatted_date + '）\n'
                        # temp_generated_text = "    **" + str(index) + '.' + news_title + '。**' + temp_generated_text + '(来源：' + news_laiyuan + "  " + formatted_date + '）\n'

                    else:
                        raise HTTPException(status_code=500, detail="Invalid response format from DeepSeek API")
                else:
                    error_detail = f"DeepSeek API error: {response.status_code} - {response.text}"
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=error_detail
                    )

                generated_text = generated_text + temp_generated_text
                index=index+1


    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Network error while calling DeepSeek API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calling DeepSeek API: {str(e)}"
        )
    generated_text = f'【{category_names[category]}】\n'+generated_text
    # 保存生成的内容
    gen_content = GeneratedContent(
        category=category,
        content=generated_text,
        news_items=news_url_list,  # 存储新闻URL列表
        model_used=model
    )
    db.add(gen_content)
    await db.commit()
    await db.refresh(gen_content)

    return {"id": gen_content.id, "content": gen_content.content}






# 保存生成的内容
@app.post("/api/save_content/{content_id}")
async def save_content(
        content_id: int,
        content: str = Form(...),
        db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(GeneratedContent).where(GeneratedContent.id == content_id))
    gen_content = result.scalar_one_or_none() # 执行查询并返回查询结果的第一行第一列的值。当查询结果存在多个时，该方法会抛出异常；当查询结果为空时，返回 None。

    if not gen_content:
        raise HTTPException(status_code=404, detail="Content not found")

    if gen_content.content != content:
        gen_content.content = content
        await db.commit()

    return {"status": "success"}




# 保存生成的内容到weekly_report
# @app.post("/api/save_report/{report_id}")
# async def save_report(
#         report_id: int,
#         content: str = Form(...),
#         db: AsyncSession = Depends(get_db)
# ):
#     result = await db.execute(select(WeeklyReport).where(WeeklyReport.id == report_id))
#
#     report_content = result.scalar_one_or_none() # 执行查询并返回查询结果的第一行第一列的值。当查询结果存在多个时，该方法会抛出异常；当查询结果为空时，返回 None。
#
#     if not report_content:
#         raise HTTPException(status_code=404, detail="Content not found")
#
#     if report_content.content != content:
#         report_content.content = content
#         await db.commit()
#
#     return {"status": "success"}









# 修改导出函数，确保使用最新的内容
@app.post("/api/export")
async def export_report(
        title: str = Form(...),
        content_ids: str = Form(...),
        format: str = Form("word"),
        db: AsyncSession = Depends(get_db)
):
    # 解析内容ID
    try:
        content_id_list = [int(id) for id in content_ids.split(",")]
    except:
        raise HTTPException(status_code=400, detail="Invalid content IDs format")

    # 获取所有内容（确保获取最新的内容）
    contents = []
    for content_id in content_id_list:
        result = await db.execute(select(GeneratedContent).where(GeneratedContent.id == content_id))
        content_item = result.scalar_one_or_none()
        if content_item:
            contents.append(content_item.content)

    if not contents:
        raise HTTPException(status_code=404, detail="No content found")

    # 合并内容
    full_content = "\n\n".join(contents)

    # 创建周报记录
    report = WeeklyReport(
        title=title,
        content=full_content,
        generated_contents=content_id_list
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # 根据格式生成不同的文件
    if format.lower() == "pdf":
        # 生成PDF文档
        filename = f"每周人社资讯_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = os.path.join("exports", filename)

        # 确保导出目录存在
        os.makedirs("exports", exist_ok=True)

        # 创建PDF
        doc = SimpleDocTemplate(filepath, pagesize=letter)
        styles = getSampleStyleSheet()

        # 创建自定义样式 - 使用中文字体
        try:
            # 尝试使用已注册的中文字体
            title_style = ParagraphStyle(
                'Title',
                parent=styles['Heading1'],
                fontName='方正小标宋简体',  # 使用中文字体
                fontSize=22,
                alignment=1,  # 居中
                leading = 28
            )

            content_style = ParagraphStyle(
                'Content',
                parent=styles['BodyText'],
                fontName='仿宋_GB2312',  # 使用中文字体
                fontSize=16,
                leading=28
            )
        except:
            # 如果中文字体不可用，使用默认字体
            title_style = ParagraphStyle(
                'Title',
                parent=styles['Heading1'],
                fontSize=22,
                alignment=1,  # 居中
                leading=28
            )

            content_style = ParagraphStyle(
                'Content',
                parent=styles['BodyText'],
                fontSize=16,
                leading=28, # 行高
                firstLineIndent=24  # 首行缩进2个字符
            )

        # 构建PDF内容
        story = []
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 12))

        for content in contents:
            # 将内容中的换行符转换为HTML换行标签
            # html_content = content.replace('\n', '<br/>')
            # story.append(Paragraph(html_content, content_style))
            # story.append(Spacer(1, 12))
            # 将内容按段落分割
            paragraphs = content.split('\n')
            for paragraph_text in paragraphs:
                if paragraph_text:  # 跳过空行
                # if paragraph_text.strip():  # 跳过空行
                    # 添加首行缩进
                    indented_text = "　　  " + paragraph_text  # 使用全角空格实现首行缩进
                    story.append(Paragraph(indented_text, content_style))
                    # story.append(Spacer(1, 6))  # 段落间的小间距

        # 生成PDF
        doc.build(story)
    else:
        # 生成Word文档
        filename = f"每周人社资讯_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        filepath = os.path.join("exports", filename)

        # 确保导出目录存在
        os.makedirs("exports", exist_ok=True)

        # 创建Word文档
        doc = Document()

        # 设置文档默认字体 - 使用自定义字体
        try:
            # 假设您的字体文件名为 "SimSun.ttf"，放在项目根目录的 fonts 文件夹中
            font_path1 = os.path.join(os.path.dirname(__file__), "fonts", "仿宋_GB2312.TTF")
            if os.path.exists(font_path1):
                # 设置中文字体
                doc.styles['Normal'].font.name = '仿宋_GB2312'
                doc.styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'), '仿宋_GB2312')
        except Exception as e:
            print(f"设置字体失败: {str(e)}")
            # 使用默认字体
            doc.styles['Normal'].font.name = '宋体'
            doc.styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')

        # 设置文档默认字号和行高
        doc.styles['Normal'].font.size = Pt(16)
        paragraph_format = doc.styles['Normal'].paragraph_format
        paragraph_format.line_spacing = Pt(28)  # 设置行高为28磅

        # 添加标题
        title_paragraph = doc.add_paragraph()
        title_run = title_paragraph.add_run(title)

        # 设置标题字体 - 使用不同的字体
        try:
            # 假设您的标题字体文件名为 "SimHei.ttf"，放在项目根目录的 fonts 文件夹中
            font_path2 = os.path.join(os.path.dirname(__file__), "fonts", "方正小标宋简体.TTF")
            if os.path.exists(font_path2):
                # 设置中文字体
                title_run.font.name = '方正小标宋简体'
                title_run._element.rPr.rFonts.set(qn('w:eastAsia'), '方正小标宋简体')
        except Exception as e:
            print(f"设置标题字体失败: {str(e)}")
            # 使用默认字体
            title_run.font.name = '黑体'
            title_run._element.rPr.rFonts.set(qn('w:eastAsia'), '黑体')

        # 设置标题格式
        title_run.font.size = Pt(22)
        # title_run.font.bold = True
        # title_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # 添加空行
        doc.add_paragraph()

        # 添加内容
        for content in contents:
            # 将内容按段落分割
            paragraphs = content.split('\n')
            for paragraph_text in paragraphs:
                if paragraph_text.strip():  # 跳过空行
                    p = doc.add_paragraph(paragraph_text)
                    # 设置段落格式
                    p.paragraph_format.line_spacing = Pt(28)  # 设置行高为28磅
                    # p.paragraph_format.space_after = Pt(28)  # 设置段后间距

        # 保存文档
        doc.save(filepath)

    report.export_path = filepath
    await db.commit()

    return {"filename": filename, "filepath": filepath, "format": format}




# 修改下载函数
@app.get("/download/{filename}")
async def download_file(filename: str):
    filepath = os.path.join("exports", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    # 根据文件扩展名设置媒体类型
    if filename.endswith('.pdf'):
        media_type = "application/pdf"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(
        filepath,
        media_type=media_type,
        filename=filename
    )






# 添加获取新闻信息的API端点
@app.get("/api/get_news_info")
async def get_news_info(
        url: str,
        db: AsyncSession = Depends(get_db)
):
    try:
        # 从数据库查询新闻信息
        result = await db.execute(select(NewsItem).where(NewsItem.url == url))
        news_item = result.scalar_one_or_none()

        if news_item:
            return {
                "title": news_item.title,
                "source": news_item.source,
                "publish_date": news_item.publish_date,
                "url": news_item.url
            }
        else:
            # 如果数据库中不存在，尝试从URL获取信息
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
                    response.raise_for_status()

                    # 解析HTML获取标题（简化处理）
                    # 在实际应用中，您可能需要使用更复杂的HTML解析
                    title_match = re.search(r'<title>(.*?)</title>', response.text, re.IGNORECASE)
                    title = title_match.group(1) if title_match else "未知标题"

                    # 创建新的新闻项
                    news_item = NewsItem(
                        title=title,
                        category="未知",
                        publish_date=datetime.now().strftime("%Y-%m-%d"),
                        source=url.split('/')[2],  # 使用域名作为来源
                        url=url
                    )
                    db.add(news_item)
                    await db.commit()

                    return {
                        "title": title,
                        "source": url.split('/')[2],
                        "publish_date": datetime.now().strftime("%Y-%m-%d"),
                        "url": url
                    }

            except Exception as e:
                return {
                    "title": "无法获取标题",
                    "source": "未知来源",
                    "publish_date": "未知日期",
                    "url": url
                }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取新闻信息失败: {str(e)}"
        )


# 添加获取生成内容的API端点
@app.get("/api/get_generated_contents")
async def get_generated_contents(
        content_ids: str,
        db: AsyncSession = Depends(get_db)
):
    try:
        content_id_list = [int(id) for id in content_ids.split(",")]
    except:
        raise HTTPException(status_code=400, detail="Invalid content IDs format")

    # 获取所有生成的内容
    contents = {}
    for content_id in content_id_list:
        result = await db.execute(select(GeneratedContent).where(GeneratedContent.id == content_id))
        content_item = result.scalar_one_or_none()
        if content_item:
            contents[content_item.category] = content_item.content

    return contents


# 添加字体下载端点
@app.get("/download_font/{font_name}")
async def download_font(font_name: str):
    # 定义允许下载的字体列表
    allowed_fonts = {
        "仿宋_GB2312": "仿宋_GB2312.TTF",
        "方正小标宋简体": "方正小标宋简体.TTF"
    }

    if font_name not in allowed_fonts:
        raise HTTPException(status_code=404, detail="Font not found")

    # 获取字体文件名
    font_filename = allowed_fonts[font_name]
    font_path = os.path.join("fonts", font_filename)

    # 检查字体文件是否存在
    if not os.path.exists(font_path):
        raise HTTPException(status_code=404, detail="Font file not found")

    # 返回文件响应
    return FileResponse(
        font_path,
        media_type="application/octet-stream",
        filename=font_filename
    )

# if __name__ == "__main__":
#     import uvicorn
#
#     uvicorn.run(app, host="127.0.0.1", port=4405)