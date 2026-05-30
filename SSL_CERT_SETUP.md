# SSL 证书安装指南

## 📋 当前状态

您已在阿里云申请了免费的DigiCert证书，证书信息如下：
- **域名**: www.jlbtg.cn 和 jlbtg.cn
- **颁发者**: DigiCert
- **有效期**: 2026-05-01 至 2026-07-30

---

## 🚨 紧急：网站当前无法访问？

如果您的网站因为SSL证书问题无法访问，请先执行以下步骤快速恢复：

### 快速恢复HTTP访问

```bash
# SSH连接到服务器
ssh root@www.jlbtg.cn

# 下载并运行清理脚本
cd /tmp
curl -O https://raw.githubusercontent.com/jlbwl/promo-hub/main/scripts/cleanup-server.sh
chmod +x cleanup-server.sh
bash cleanup-server.sh
```

这会：
1. ✅ 备份旧证书
2. ✅ 清理Nginx配置
3. ✅ 部署HTTP-only配置
4. ✅ 重载Nginx让网站可以通过HTTP访问

恢复后，您可以通过 **http://www.jlbtg.cn** 访问网站！

---

## 🎯 第一步：从阿里云下载证书

1. 登录阿里云控制台
2. 访问 **数字证书管理服务** → **SSL证书**
3. 找到您的证书 `cert-9di705`
4. 点击右侧的 **下载** 按钮
5. 在弹出的对话框中选择 **Nginx** 服务器类型
6. 点击 **下载**

下载后您会获得一个压缩包，解压后包含两个文件：
- `证书文件.pem` 或 `fullchain.pem`
- `私钥文件.key` 或 `privkey.pem`

## 📦 第二步：在本地准备证书文件

将下载的文件重命名为：
- 证书文件：`www.jlbtg.cn.pem`
- 私钥文件：`www.jlbtg.cn.key`

将这两个文件放在同一个文件夹中，例如 `~/Downloads/`

## 🚀 第三步：上传证书到服务器

### 方法一：使用自动脚本（推荐）

在项目根目录运行：

```bash
bash scripts/upload-ssl-cert.sh \
  ~/Downloads/www.jlbtg.cn.pem \
  ~/Downloads/www.jlbtg.cn.key
```

脚本会自动：
1. 验证证书格式
2. 上传到服务器
3. 备份旧证书
4. 安装新证书
5. 重载 Nginx

### 方法二：手动上传

如果您想手动操作：

```bash
# 上传证书到服务器
scp ~/Downloads/www.jlbtg.cn.pem root@www.jlbtg.cn:/tmp/
scp ~/Downloads/www.jlbtg.cn.key root@www.jlbtg.cn:/tmp/

# SSH 连接服务器
ssh root@www.jlbtg.cn

# 在服务器上执行
mkdir -p /etc/nginx/ssl
mv -f /tmp/www.jlbtg.cn.pem /etc/nginx/ssl/
mv -f /tmp/www.jlbtg.cn.key /etc/nginx/ssl/

# 设置正确的权限
chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
chmod 644 /etc/nginx/ssl/www.jlbtg.cn.pem

# 重新部署（会自动检测证书并启用HTTPS）
cd /tmp
curl -O https://raw.githubusercontent.com/jlbwl/promo-hub/main/scripts/server-deploy.sh
chmod +x server-deploy.sh
bash server-deploy.sh
```

## ✅ 第四步：验证安装

1. 在浏览器访问 `https://www.jlbtg.cn`
2. 查看地址栏的锁图标是否显示为绿色
3. 点击锁图标，查看证书信息，确认颁发者是 DigiCert
4. 检查证书有效期是否正确显示为 2026-05-01 至 2026-07-30

---

## 🔧 文件说明

| 文件 | 用途 |
|------|------|
| [scripts/cleanup-server.sh](file:///Users/sunkai/Documents/projects/self-promotion/scripts/cleanup-server.sh) | ⭐ 清理脚本：快速恢复HTTP访问 |
| [scripts/upload-ssl-cert.sh](file:///Users/sunkai/Documents/projects/self-promotion/scripts/upload-ssl-cert.sh) | 证书上传和安装脚本 |
| [scripts/server-deploy.sh](file:///Users/sunkai/Documents/projects/self-promotion/scripts/server-deploy.sh) | 智能部署：自动检测证书，选择HTTP/HTTPS模式 |
| [config/nginx-http-only.conf](file:///Users/sunkai/Documents/projects/self-promotion/config/nginx-http-only.conf) | HTTP-only配置模板 |
| [config/nginx.conf](file:///Users/sunkai/Documents/projects/self-promotion/config/nginx.conf) | 完整HTTPS配置模板 |

## 📂 证书在服务器上的位置

- 证书文件: `/etc/nginx/ssl/www.jlbtg.cn.pem`
- 私钥文件: `/etc/nginx/ssl/www.jlbtg.cn.key`
- 备份目录: `/etc/nginx/ssl/backup/`

## ⚠️ 重要提示

1. **证书过期时间**: 2026-07-30，请提前30天更新
2. **文件权限**: 私钥文件权限必须为 600，否则 Nginx 无法读取
3. **HTTP→HTTPS迁移**: 有证书后，部署脚本会自动配置HTTP重定向到HTTPS

## 🐛 常见问题

### Q: Nginx 启动失败，提示找不到证书文件
A: 先运行 `cleanup-server.sh` 恢复HTTP访问，然后再上传证书

### Q: 浏览器显示证书不受信任
A: 确认您使用的是从阿里云下载的真实证书，而非自签名证书

### Q: 如何备份当前证书
A: 证书已自动备份到 `/etc/nginx/ssl/backup/` 目录

### Q: 可以先用HTTP，等证书准备好了再开HTTPS吗？
A: 可以！使用 `cleanup-server.sh` 部署HTTP-only模式，之后随时上传证书并运行 `server-deploy.sh` 切换到HTTPS

## 📞 需要帮助？

运行 `bash scripts/upload-ssl-cert.sh --help` 查看帮助信息
