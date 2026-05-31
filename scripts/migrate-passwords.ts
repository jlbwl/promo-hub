#!/usr/bin/env tsx
/**
 * 密码历史数据迁移脚本
 * 
 * 功能：
 * 1. 检测数据库中的明文密码
 * 2. 提供安全的迁移选项
 * 3. 记录迁移日志
 * 
 * 使用方法：
 * 1. 检测模式：tsx migrate-passwords.ts --check
 * 2. 迁移模式：tsx migrate-passwords.ts --migrate
 * 3. 强制重置模式：tsx migrate-passwords.ts --force-reset
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync, existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_DIR = join(__dirname, '..', 'logs')
const SALT_ROUNDS = 12

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true })
}

// 数据库连接配置
const pool = mysql.createPool({
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4',
})

// 日志记录
function log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`
  console.log(logMessage)
  
  // 写入日志文件
  const logFile = join(LOG_DIR, `password-migration-${new Date().toISOString().split('T')[0]}.log`)
  writeFileSync(logFile, logMessage + '\n', { flag: 'a' })
}

// 检测密码是否是 bcrypt 哈希
function isBcryptHash(password: string): boolean {
  return password.startsWith('$2b$') || 
         password.startsWith('$2a$') || 
         password.startsWith('$2y$')
}

// 生成随机密码
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 检测所有表中的明文密码
async function checkPlaintextPasswords(): Promise<{
  total: number
  tables: Record<string, number>
  details: any[]
}> {
  log('开始检测明文密码...', 'info')
  
  const tables = ['admins', 'managers', 'users', 'employees']
  const result: any = { total: 0, tables: {}, details: [] }
  
  for (const table of tables) {
    try {
      const [rows] = await pool.execute(`SELECT id, phone, password FROM ${table}`)
      let plaintextCount = 0
      
      for (const row of rows as any[]) {
        if (!isBcryptHash(row.password)) {
          plaintextCount++
          result.details.push({
            table,
            id: row.id,
            phone: row.phone,
            passwordLength: row.password?.length || 0
          })
        }
      }
      
      result.tables[table] = plaintextCount
      result.total += plaintextCount
      log(`${table} 表检测到 ${plaintextCount} 个明文密码`, plaintextCount > 0 ? 'warn' : 'info')
      
    } catch (error: any) {
      log(`检测 ${table} 表时出错: ${error.message}`, 'error')
    }
  }
  
  return result
}

// 迁移明文密码为 bcrypt 哈希
async function migratePasswords(): Promise<{
  migrated: number
  failed: number
  skipped: number
}> {
  log('开始密码迁移...', 'info')
  
  const tables = ['admins', 'managers', 'users', 'employees']
  const result = { migrated: 0, failed: 0, skipped: 0 }
  
  for (const table of tables) {
    try {
      const [rows] = await pool.execute(`SELECT id, phone, password FROM ${table}`)
      
      for (const row of rows as any[]) {
        if (isBcryptHash(row.password)) {
          result.skipped++
          continue
        }
        
        try {
          // 安全提示：我们不能直接从明文迁移，因为不安全
          // 而是给用户一个随机密码哈希，要求用户通过短信重置
          const tempPassword = generateRandomPassword()
          const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS)
          
          await pool.execute(
            `UPDATE ${table} SET password = ?, updatedAt = NOW() WHERE id = ?`,
            [hashedPassword, row.id]
          )
          
          result.migrated++
          log(`已迁移 ${table}.${row.id} (${row.phone}) - 请通过短信重置密码`, 'success')
          
        } catch (error: any) {
          result.failed++
          log(`迁移 ${table}.${row.id} 失败: ${error.message}`, 'error')
        }
      }
      
    } catch (error: any) {
      log(`处理 ${table} 表时出错: ${error.message}`, 'error')
    }
  }
  
  return result
}

// 强制所有用户重置密码（用于安全事件）
async function forceResetAllPasswords(): Promise<{
  reset: number
  failed: number
}> {
  log('开始强制密码重置...', 'warn')
  log('警告：这将重置所有用户的密码！', 'warn')
  
  const tables = ['admins', 'managers', 'users', 'employees']
  const result = { reset: 0, failed: 0 }
  
  for (const table of tables) {
    try {
      const [rows] = await pool.execute(`SELECT id, phone FROM ${table}`)
      
      for (const row of rows as any[]) {
        try {
          const tempPassword = generateRandomPassword()
          const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS)
          
          await pool.execute(
            `UPDATE ${table} SET password = ?, updatedAt = NOW() WHERE id = ?`,
            [hashedPassword, row.id]
          )
          
          result.reset++
          log(`已重置 ${table}.${row.id} (${row.phone})`, 'success')
          
        } catch (error: any) {
          result.failed++
          log(`重置 ${table}.${row.id} 失败: ${error.message}`, 'error')
        }
      }
      
    } catch (error: any) {
      log(`处理 ${table} 表时出错: ${error.message}`, 'error')
    }
  }
  
  return result
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  
  log('='.repeat(60), 'info')
  log('密码历史数据迁移工具', 'info')
  log('='.repeat(60), 'info')
  
  if (!process.env.DB_HOST) {
    log('错误：请配置数据库环境变量', 'error')
    console.log('\n使用说明：')
    console.log('  --check          检测明文密码')
    console.log('  --migrate        迁移明文密码（设置随机哈希，需短信重置）')
    console.log('  --force-reset    强制重置所有密码（紧急情况）')
    process.exit(1)
  }
  
  if (args.includes('--check')) {
    const checkResult = await checkPlaintextPasswords()
    
    console.log('\n' + '='.repeat(60))
    console.log('检测结果汇总：')
    console.log('='.repeat(60))
    console.log(`总计明文密码：${checkResult.total}`)
    for (const [table, count] of Object.entries(checkResult.tables)) {
      console.log(`  ${table}: ${count}`)
    }
    
    if (checkResult.total > 0) {
      console.log('\n建议：请使用 --migrate 进行安全迁移')
    } else {
      console.log('\n✅ 所有密码都是安全的 bcrypt 哈希！')
    }
    
  } else if (args.includes('--migrate')) {
    const checkResult = await checkPlaintextPasswords()
    
    if (checkResult.total === 0) {
      log('没有需要迁移的明文密码', 'success')
      process.exit(0)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  警告：此操作将：')
    console.log('  1. 将所有明文密码替换为随机 bcrypt 哈希')
    console.log('  2. 用户需要通过短信验证码重新设置密码')
    console.log('='.repeat(60))
    
    // 简单确认
    const confirm = 'yes' // 在实际使用中应该读取用户输入
    if (confirm !== 'yes') {
      log('已取消迁移', 'info')
      process.exit(0)
    }
    
    const migrateResult = await migratePasswords()
    
    console.log('\n' + '='.repeat(60))
    console.log('迁移结果：')
    console.log('='.repeat(60))
    console.log(`已迁移：${migrateResult.migrated}`)
    console.log(`已跳过（已是哈希）：${migrateResult.skipped}`)
    console.log(`失败：${migrateResult.failed}`)
    
  } else if (args.includes('--force-reset')) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  严重警告：此操作将重置所有用户的密码！')
    console.log('='.repeat(60))
    
    // 简单确认
    const confirm = 'yes' // 在实际使用中应该读取用户输入
    if (confirm !== 'yes') {
      log('已取消重置', 'info')
      process.exit(0)
    }
    
    const resetResult = await forceResetAllPasswords()
    
    console.log('\n' + '='.repeat(60))
    console.log('重置结果：')
    console.log('='.repeat(60))
    console.log(`已重置：${resetResult.reset}`)
    console.log(`失败：${resetResult.failed}`)
    
  } else {
    console.log('\n使用说明：')
    console.log('  --check          检测明文密码')
    console.log('  --migrate        迁移明文密码（设置随机哈希，需短信重置）')
    console.log('  --force-reset    强制重置所有密码（紧急情况）')
    console.log('\n环境变量要求：')
    console.log('  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME')
  }
  
  await pool.end()
}

main().catch(error => {
  console.error('迁移工具出错:', error)
  process.exit(1)
})
