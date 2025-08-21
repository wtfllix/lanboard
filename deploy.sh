#!/bin/bash

# 容器化部署脚本

echo "🚀 开始容器化部署..."

# 停止并清理旧容器
echo "📦 清理旧容器..."
docker-compose down --remove-orphans
docker-compose rm -f

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose build --no-cache

# 启动服务
echo "▶️ 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 测试服务
echo "🧪 测试服务..."
curl -f http://localhost:3007/ && echo "✅ 服务启动成功" || echo "❌ 服务启动失败"

echo "🎉 部署完成！"
echo "访问地址: http://localhost:3007"
echo "查看日志: docker-compose logs -f"