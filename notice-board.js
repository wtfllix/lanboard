const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'noticeboard.db');
const PORT = process.env.PORT || 3007;

// 初始化数据库
const db = new sqlite3.Database(DB_FILE);

// 创建表结构和索引
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 创建索引优化查询性能
    db.run('CREATE INDEX IF NOT EXISTS idx_created_at ON notices(created_at)');
});

// 获取最新的一条记录
function getLatestNotice(callback) {
    db.get('SELECT * FROM notices ORDER BY id DESC LIMIT 1', callback);
}

// 添加新的记录
function addNotice(content, callback) {
    db.run('INSERT INTO notices (content) VALUES (?)', [content], function(err) {
        callback(err, this.lastID);
    });
}

// 获取历史记录（添加分页和性能优化）
function getHistory(limit = 20, offset = 0, callback) {
    db.all('SELECT * FROM notices ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset], callback);
}

// 删除单条记录
function deleteNotice(id, callback) {
    db.run('DELETE FROM notices WHERE id = ?', [id], callback);
}

// 批量删除记录
function deleteMultipleNotices(ids, callback) {
    const placeholders = ids.map(() => '?').join(',');
    db.run('DELETE FROM notices WHERE id IN (' + placeholders + ')', ids, callback);
}

// 删除所有记录
function deleteAllNotices(callback) {
    db.run('DELETE FROM notices', callback);
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>局域网告示板</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
        }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 10px;
            background: #f5f5f5;
            min-height: 100vh;
            -webkit-tap-highlight-color: transparent;
        }
        
        .container { 
            display: flex;
            gap: 15px;
            max-width: 1200px;
            margin: 0 auto;
            height: calc(100vh - 20px);
        }
        
        .left-panel, .right-panel {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        
        .left-panel {
            flex: 1;
            min-width: 0;
        }
        
        .right-panel {
            width: 40%;
            min-width: 0;
            max-width: 400px;
        }
        
        h1 { 
            color: #333; 
            text-align: center; 
            margin: 0 0 15px 0;
            font-size: 22px;
            font-weight: 600;
        }
        
        h2 {
            color: #333; 
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        textarea { 
            width: 100%; 
            flex: 1;
            padding: 12px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            font-size: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            resize: none;
            line-height: 1.5;
            -webkit-appearance: none;
        }
        
        textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        
        button { 
            background: #007bff; 
            color: white; 
            padding: 12px 20px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 16px;
            font-weight: 500;
            margin-top: 12px;
            align-self: stretch;
            -webkit-tap-highlight-color: rgba(0,0,0,0.1);
            transition: background-color 0.2s ease;
        }
        
        button:active {
            transform: scale(0.98);
        }
        
        button:hover { 
            background: #0056b3; 
        }
        
        .info {
            color: #666;
            font-size: 14px;
            text-align: center;
            margin-top: 8px;
        }
        
        .history-content {
            flex: 1;
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 12px;
            background: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
        }
        
        /* 移动端批量操作按钮 */
        .mobile-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        
        .mobile-controls button {
            margin: 0;
            padding: 8px 12px;
            font-size: 12px;
            flex: 1;
            min-width: fit-content;
        }
        
        /* 移动端适配 */
        @media (max-width: 768px) {
            body {
                padding: 5px;
                background: #fff;
            }
            
            .container {
                flex-direction: column;
                height: auto;
                gap: 10px;
            }
            
            .left-panel, .right-panel {
                padding: 15px;
                border-radius: 0;
                box-shadow: none;
                border-bottom: 1px solid #eee;
            }
            
            .right-panel {
                width: 100%;
                max-width: none;
            }
            
            h1 {
                font-size: 20px;
                margin-bottom: 12px;
            }
            
            h2 {
                font-size: 16px;
                margin-bottom: 10px;
            }
            
            textarea {
                font-size: 16px; /* 防止iOS缩放 */
                padding: 10px;
                min-height: 200px;
            }
            
            button {
                font-size: 16px;
                padding: 14px 20px;
                border-radius: 8px;
            }
            
            .history-content {
                max-height: 300px;
                font-size: 15px;
                padding: 10px;
            }
            
            .mobile-controls {
                gap: 6px;
            }
            
            .mobile-controls button {
                font-size: 13px;
                padding: 10px 8px;
            }
        }
        
        /* 小屏幕优化 */
        @media (max-width: 480px) {
            body {
                padding: 0;
            }
            
            .left-panel, .right-panel {
                padding: 12px;
                margin: 0;
            }
            
            h1 {
                font-size: 18px;
            }
            
            h2 {
                font-size: 16px;
            }
            
            .mobile-controls {
                flex-direction: column;
                gap: 6px;
            }
            
            .mobile-controls button {
                width: 100%;
                margin: 2px 0;
            }
        }
        
        /* 触摸优化 */
        @media (hover: none) {
            button:hover {
                background: #007bff;
            }
            
            button:active {
                background: #0056b3;
            }
        }
        
        /* 滚动条优化 */
        .history-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .history-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        
        .history-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        .history-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="left-panel">
            <h1>📝 新告示编辑</h1>
            <textarea id="notice" placeholder="在这里输入新的告示内容..."></textarea>
            <button onclick="saveNotice(true)">💾 保存</button>
            <div class="info">提示：点击保存按钮后内容会记录到历史记录中</div>
        </div>
        
        <div class="right-panel">
            <h2>📜 历史记录</h2>
            <div class="mobile-controls">
                <button onclick="selectAll()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">全选</button>
                <button onclick="clearSelection()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">取消选择</button>
                <button onclick="deleteSelected()" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">删除选中</button>
                <button onclick="deleteAll()" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">清空全部</button>
                <span id="selectionCount" style="font-size: 12px; color: #666;">已选择 0 条</span>
            </div>
            <div class="history-content" id="history">历史记录将这里显示...</div>
        </div>

    <script>
        function loadNotice() {
            fetch('/api/notice')
                .then(res => res.text())
                .then(text => {
                    document.getElementById('notice').value = text;
                    lastSavedContent = text.trim(); // 初始化最后保存的内容
                });
        }

        function loadHistory() {
            fetch('/api/history')
                .then(res => res.json())
                .then(history => {
                    const historyDiv = document.getElementById('history');
                    if (history.length === 0) {
                        historyDiv.innerHTML = '<div style="color: #999; text-align: center;">暂无历史记录</div>';
                        return;
                    }

                    historyDiv.innerHTML = '';
                    history.forEach((item, index) => {
                        const div = document.createElement('div');
                        div.style.cssText = 'margin-bottom: 15px; padding: 15px; border-bottom: 1px solid #eee; background: white; border-radius: 5px;';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'history-checkbox';
                        checkbox.value = item.id;
                        checkbox.onchange = updateSelection;
                        checkbox.style.cssText = 'margin-right: 8px; cursor: pointer;';

                        const time = document.createElement('div');
                        time.style.cssText = 'color: #666; font-size: 12px; margin-bottom: 8px; font-weight: bold; display: inline-block;';
                        time.textContent = new Date(item.created_at).toLocaleString('zh-CN');

                        const content = document.createElement('div');
                        content.style.cssText = 'white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.5; margin-bottom: 8px;';
                        content.textContent = item.content; // 使用textContent自动转义

                        const buttonGroup = document.createElement('div');
                        buttonGroup.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;';

                        // 移动端优化：更大的按钮
                        const mobileBtnStyle = 'background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; flex: 1; min-width: 60px;';

                        const copyBtn = document.createElement('button');
                        copyBtn.textContent = '📋 复制';
                        copyBtn.style.cssText = mobileBtnStyle;
                        copyBtn.onclick = () => copyToClipboard(item.content, copyBtn);

                        const headerDiv = document.createElement('div');
                        headerDiv.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
                        headerDiv.appendChild(checkbox);
                        headerDiv.appendChild(time);

                        buttonGroup.appendChild(copyBtn);

                        div.appendChild(headerDiv);
                        div.appendChild(content);
                        div.appendChild(buttonGroup);
                        
                        // 最新的一条高亮显示
                        if (index === 0) {
                            div.style.borderLeft = '3px solid #007bff';
                            div.style.paddingLeft = '12px';
                        }
                        
                        historyDiv.appendChild(div);
                    });
                });
        }

        let lastSavedContent = '';
        
        function deleteNotice(id, element) {
            if (confirm('确定要删除这条记录吗？此操作不可恢复。')) {
                fetch('/api/delete/' + id, {
                    method: 'DELETE'
                }).then(response => {
                    if (response.ok) {
                        element.style.transform = 'scale(0.8)';
                        element.style.opacity = '0.5';
                        element.style.transition = 'all 0.3s ease';
                        setTimeout(() => {
                            element.remove();
                            loadHistory(); // 重新加载历史记录
                        }, 300);
                    }
                });
            }
        }

        function saveNotice(force = false) {
            const text = document.getElementById('notice').value.trim();
            if (!text) return;

            // 只有当内容真正变化时才保存，或者强制保存
            if (!force && text === lastSavedContent) {
                return; // 内容没有变化，不保存
            }

            fetch('/api/notice', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: text
            }).then(() => {
                lastSavedContent = text; // 更新最后保存的内容
                loadHistory(); // 保存后刷新历史记录
            });
        }

        let selectedIds = [];

        function copyToClipboard(text, button) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    // 临时改变按钮文字和样式
                    const originalText = button.textContent;
                    const originalStyle = button.style.background;
                    
                    button.textContent = '✅ 已复制';
                    button.style.background = '#20c997';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = originalStyle;
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                });
            } else {
                // 降级方案：使用传统方法
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    button.textContent = '✅ 已复制';
                    button.style.background = '#20c997';
                    setTimeout(() => {
                        button.textContent = '📋 复制';
                        button.style.background = '#28a745';
                    }, 2000);
                } catch (err) {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                }
                document.body.removeChild(textArea);
            }
        }

        function selectAll() {
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            updateSelection();
        }

        function clearSelection() {
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectedIds = [];
            updateSelection();
        }

        function updateSelection() {
            selectedIds = Array.from(document.querySelectorAll('.history-checkbox:checked')).map(cb => parseInt(cb.value));
            document.getElementById('selectionCount').textContent = '已选择 ' + selectedIds.length + ' 条';
        }

        function deleteSelected() {
            if (selectedIds.length === 0) {
                alert('请先选择要删除的记录');
                return;
            }

            if (confirm('确定要删除选中的 ' + selectedIds.length + ' 条记录吗？此操作不可恢复。')) {
                fetch('/api/delete-batch', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds })
                }).then(response => {
                    if (response.ok) {
                        loadHistory();
                        selectedIds = [];
                        updateSelection();
                    }
                });
            }
        }

        function deleteAll() {
            if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
                fetch('/api/delete-all', {
                    method: 'DELETE'
                }).then(response => {
                    if (response.ok) {
                        loadHistory();
                        selectedIds = [];
                        updateSelection();
                    }
                });
            }
        }

        // 手动控制保存，无自动保存

        // 初始加载
        loadNotice();
        loadHistory();
    </script>
</body>
</html>`);
    } else if (req.url === '/api/notice') {
        if (req.method === 'GET') {
            getLatestNotice((err, row) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Database error');
                    return;
                }
                const content = row ? row.content : '';
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(content);
            });
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
                // 限制内容长度，防止大文本攻击
                if (body.length > 10000) {
                    res.writeHead(413, { 'Content-Type': 'text/plain' });
                    res.end('Content too large');
                    return;
                }
            });
            req.on('end', () => {
                if (!body.trim()) {
                    res.writeHead(400);
                    res.end('Content is empty');
                    return;
                }
                addNotice(body, (err, id) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Database error');
                        return;
                    }
                    res.writeHead(200);
                    res.end('Saved');
                });
            });
        }
    } else if (req.url === '/api/history') {
        if (req.method === 'GET') {
            getHistory(10, 0, (err, rows) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Database error');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(rows));
            });
        }
    } else if (req.url.startsWith('/api/delete/')) {
        if (req.method === 'DELETE') {
            const id = parseInt(req.url.split('/').pop());
            if (isNaN(id)) {
                res.writeHead(400);
                res.end('Invalid ID');
                return;
            }
            
            deleteNotice(id, (err) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Database error');
                    return;
                }
                res.writeHead(200);
                res.end('Deleted');
            });
        }
    } else if (req.url === '/api/delete-batch') {
        if (req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const ids = data.ids;
                    
                    if (!Array.isArray(ids) || ids.length === 0) {
                        res.writeHead(400);
                        res.end('Invalid IDs format');
                        return;
                    }
                    
                    deleteMultipleNotices(ids, (err) => {
                        if (err) {
                            res.writeHead(500);
                            res.end('Database error');
                            return;
                        }
                        res.writeHead(200);
                        res.end('Batch deleted');
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end('Invalid JSON');
                }
            });
        }
    } else if (req.url === '/api/delete-all') {
        if (req.method === 'DELETE') {
            deleteAllNotices((err) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Database error');
                    return;
                }
                res.writeHead(200);
                res.end('All deleted');
            });
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`文字告示板运行在 http://localhost:${PORT}`);
    console.log(`局域网访问: http://$(hostname -I | awk '{print $1}'):${PORT}`);
});

// 错误处理中间件
process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error('关闭数据库时出错:', err);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});