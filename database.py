from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# MySQL数据库连接URL
SQLALCHEMY_DATABASE_URL = "mysql+asyncmy://root:0000@127.0.0.1:3306/aitools"
# 本地docker
# SQLALCHEMY_DATABASE_URL = "mysql+asyncmy://root:0000@host.docker.internal:3306/aitools"
# 云端docker

# 创建异步引擎
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True,
    pool_size=10,
    max_overflow=20
)

# 创建异步会话工厂
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 声明基类
Base = declarative_base()

# 依赖项，用于获取数据库会话
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()