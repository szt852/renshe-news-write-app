import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 导入 sql_set.py 中的数据库配置
from sql_set import DB_CONFIG

# 从 DB_CONFIG 构建 SQLAlchemy 连接 URL
# 注意：密码中包含 @ 符号时，需将 @ 编码为 %40
_password = DB_CONFIG['password'].replace('@', '%40')
SQLALCHEMY_DATABASE_URL = (
    f"mysql+pymysql://{DB_CONFIG['user']}:{_password}"
    f"@{DB_CONFIG['host']}:3306/{DB_CONFIG['database']}"
    f"?charset={DB_CONFIG.get('charset', 'utf8mb4')}"
)

# 环境变量优先级最高（便于服务器部署时不改源码）
# 若设置了 DATABASE_URL 环境变量，则覆盖 sql_set.py 中的配置
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", SQLALCHEMY_DATABASE_URL)

# 创建同步引擎
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True,
    pool_size=10,
    max_overflow=20
)

# 创建同步会话工厂
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# 声明基类
Base = declarative_base()

# 依赖项，用于获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
