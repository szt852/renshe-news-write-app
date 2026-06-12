import pymysql

# ============================================================
# 数据库配置切换说明
# ============================================================
# 本项目支持三种部署环境，请根据实际场景取消对应配置的注释。
# 注意：同一时间只能启用一组配置！
# ============================================================

# ----------------------------------------------------------
# 1. 本地开发环境（直接运行 main.py，无 Docker）
#    适用场景：本地 PyCharm/VSCode 开发调试
# ----------------------------------------------------------
# DB_CONFIG = {
# 	'host': '127.0.0.1',
# 	'user': 'root',
# 	'password': '0000',
# 	'database': 'aitools',
# 	'connect_timeout': 5,
# 	'read_timeout': 5,
# 	'write_timeout': 5,
# 	'charset': 'utf8mb4',
# 	'cursorclass': pymysql.cursors.DictCursor
# }

# ----------------------------------------------------------
# 2. 本地 Docker 部署（MySQL 跑在宿主机，服务跑在容器内）
#    适用场景：本地 docker build / docker-compose up
#    说明：host.docker.internal 是 Docker 提供的特殊 DNS，
#          用于容器内访问宿主机服务
# ----------------------------------------------------------
# DB_CONFIG = {
# 	'host': 'host.docker.internal',
# 	'user': 'root',
# 	'password': '0000',
# 	'database': 'aitools',
# 	'connect_timeout': 5,
# 	'read_timeout': 5,
# 	'write_timeout': 5,
# 	'charset': 'utf8mb4',
# 	'cursorclass': pymysql.cursors.DictCursor
# }

# ----------------------------------------------------------
# 3. 服务器生产环境（远程 MySQL）
#    适用场景：正式服务器部署
# ----------------------------------------------------------
DB_CONFIG = {
	'host': '',
	'user': '',
	'password': '',
	'database': 'aitools',
	'connect_timeout': 5,
	'read_timeout': 5,
	'write_timeout': 5,
	'charset': 'utf8mb4',
	'cursorclass': pymysql.cursors.DictCursor
}
