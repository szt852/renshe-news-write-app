from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
import datetime
from database import Base


class NewsItem(Base):
    __tablename__ = "news_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(500), index=True)
    category = Column(String(100), index=True)
    publish_date = Column(String(100))
    source = Column(String(200))
    url = Column(String(500))
    content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GeneratedContent(Base):
    __tablename__ = "generated_contents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(String(100), index=True)
    content = Column(Text)
    news_items = Column(JSON)  # 存储用于生成内容的新闻ID列表
    model_used = Column(String(100))  # 使用的模型名称
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200))
    content = Column(Text)
    generated_contents = Column(JSON)  # 存储各板块生成内容的ID
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    export_path = Column(String(500), nullable=True)