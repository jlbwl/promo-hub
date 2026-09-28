import { Request, Response, NextFunction } from 'express'
import type { Manager } from '@promo/shared'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import logger from '../utils/logger.js'
import {
  readUsers,
  readUsersPaged,
  writeUsers,
  readManagers,
  writeManagers,
  query,
  withTransaction,
  type UserRecord,
} from '../data/index.js'
import { verifySmsCode } from '../utils/sms.js'

// ============================================
// 管理后台用户管理
// ============================================

/**
 * 获取用户列表
 */
export const getUsers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { page = '1', pageSize = '10', role, status, keyword, teamName } = req.query
    const pageNum = parseInt(page as string, 10)
    const pageSizeNum = parseInt(pageSize as string, 10)

    const result = await readUsersPaged({
      role: role as string,
      status: status !== undefined && status !== '' ? Number(status) : undefined,
      keyword: keyword as string,
      teamName: teamName as string,
      page: pageNum,
      pageSize: pageSizeNum,
    })

    const list = result.list.map((u: UserRecord) => ({
      id: u.id,
      name: u.nickname,
      phone: u.phone,
      teamName: u.teamName || '',
      role: u.role,
      status: u.status === 'active' ? 1 : 0,
      createdAt: u.createdAt,
    }))

    sendSuccess(res, { list, total: result.total, page: pageNum, pageSize: pageSizeNum }, 'success')
  }
)

/**
 * 获取单个用户详情
 */
export const getUserById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.params.id

    const managers = await readManagers()
    const manager = managers.find((m: Manager) => m.id === userId)
    if (manager) {
      return sendSuccess(res, {
        id: manager.id,
        name: manager.name,
        phone: manager.phone,
        teamName: manager.teamName || '',
        role: 'manager',
        status: manager.status === 'active' ? 1 : 0,
        createdAt: manager.createdAt,
      }, 'success')
    }

    const users = await readUsers()
    const user = users.find((u: UserRecord) => u.id === userId)
    if (user) {
      return sendSuccess(res, {
        id: user.id,
        name: user.nickname,
        phone: user.phone,
        teamName: user.teamName || '',
        role: user.role,
        status: user.status === 'active' ? 1 : 0,
        createdAt: user.createdAt,
      }, 'success')
    }

    throw new AppError('用户不存在', ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 删除用户
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const smsCode = req.query.smsCode as string

    if (!smsCode) {
      throw new AppError('验证码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    // 获取管理员信息（支持 session 和 JWT token）
    const adminInfo = req.session?.user || req.user
    if (!adminInfo || !adminInfo.phone) {
      throw new AppError('未登录', ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }

    // 验证短信验证码（验证后自动失效，确保一次性使用）
    const valid = verifySmsCode(adminInfo.phone, smsCode)
    if (!valid) {
      throw new AppError('验证码错误、已过期或已被使用', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }
    // 注意：verifySmsCode 内部已自动删除验证码，无需再次调用 deleteSmsCode

    // 检查用户是否存在
    const userId = req.params.id as string
    const users = await readUsers()
    const exists = users.some((u: UserRecord) => u.id === userId)
    if (!exists) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // 执行删除
    await deleteUserById(userId)

    logger.info('User deleted', { userId, deletedBy: adminInfo.phone })
    sendSuccess(res, null, '删除成功')
  }
)

async function deleteUserById(userId: string): Promise<void> {
  // 直接从数据库删除用户
  await query('DELETE FROM users WHERE id = ?', [userId])
}

/**
 * 切换用户状态
 */
export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { status } = req.body
    const userId = req.params.id as string

    let managers = await readManagers()
    const mgrIdx = managers.findIndex((m: Manager) => m.id === userId)
    if (mgrIdx !== -1) {
      managers[mgrIdx].status = (status ? 'active' : 'disabled') as 'active' | 'inactive' | 'banned'
      managers[mgrIdx].updatedAt = new Date().toISOString()

      if (!status) {
        // P1-4: 禁用经理时需要同时下架其产品，使用事务保证一致性
        // updatedAt 由数据库 NOW() 生成，避免 ISO 字符串写入 DATETIME 报错
        await withTransaction(async (conn) => {
          await conn.execute(
            'UPDATE managers SET status = ?, updatedAt = NOW() WHERE id = ?',
            ['disabled', userId]
          )
          await conn.execute(
            'UPDATE products SET status = ?, updatedAt = NOW() WHERE managerId = ? AND status = ?',
            ['offline', userId, 'published']
          )
        })
      } else {
        await writeManagers(managers)
      }
      logger.info('Manager status updated', { managerId: userId, status })
      return sendSuccess(res, null, '更新成功')
    }

    let users = await readUsers()
    const usrIdx = users.findIndex((u: UserRecord) => u.id === userId)
    if (usrIdx !== -1) {
      users[usrIdx].status = status ? 'active' : 'disabled'
      users[usrIdx].updatedAt = new Date().toISOString()
      await writeUsers(users)
      logger.info('User status updated', { userId, status })
      return sendSuccess(res, null, '更新成功')
    }

    throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 切换用户角色
 */
export const updateUserRole = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { role } = req.body
    const userId = req.params.id as string

    let managers = await readManagers()
    const mgrIdx = managers.findIndex((m: Manager) => m.id === userId)
    if (mgrIdx !== -1) {
      managers[mgrIdx].role = role
      managers[mgrIdx].updatedAt = new Date().toISOString()
      await writeManagers(managers)
      logger.info('Manager role updated', { managerId: userId, role })
      return sendSuccess(res, null, '更新成功')
    }

    let users = await readUsers()
    const usrIdx = users.findIndex((u: UserRecord) => u.id === userId)
    if (usrIdx !== -1) {
      users[usrIdx].role = role
      users[usrIdx].updatedAt = new Date().toISOString()
      await writeUsers(users)
      logger.info('User role updated', { userId, role })
      return sendSuccess(res, null, '更新成功')
    }

    throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 修改用户团队名称
 */
export const updateUserTeamName = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { teamName } = req.body
    const userId = req.params.id as string

    if (!teamName) {
      throw new AppError('团队名称不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    let users = await readUsers()
    let managers = await readManagers()

    const usrIdx = users.findIndex((u: UserRecord) => u.id === userId)
    const mgrIdx = managers.findIndex((m: Manager) => m.id === userId)

    if (usrIdx === -1 && mgrIdx === -1) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // 检查团队名称是否重复
    const isDuplicate =
      users.find((u: UserRecord) => u.id !== userId && u.teamName === teamName) ||
      managers.find((m: Manager) => m.id !== userId && m.teamName === teamName)

    if (isDuplicate) {
      throw new AppError('该团队名称已存在', ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT)
    }

    // P1-4: 更新团队名称时需要同时更新历史订单的 teamName，使用事务保证一致性
    // updatedAt 统一由数据库 NOW() 生成，避免 ISO 字符串时区/格式问题
    await withTransaction(async (conn) => {
      if (usrIdx !== -1) {
        await conn.execute(
          'UPDATE users SET teamName = ?, updatedAt = NOW() WHERE id = ?',
          [teamName, userId]
        )
      } else {
        await conn.execute(
          'UPDATE managers SET teamName = ?, updatedAt = NOW() WHERE id = ?',
          [teamName, userId]
        )
      }
      // 更新该用户的所有历史订单的团队名称
      await conn.execute(
        'UPDATE orders SET teamName = ?, updatedAt = NOW() WHERE userId = ?',
        [teamName, userId]
      )
    })

    logger.info('User team name updated', { userId, teamName })
    sendSuccess(res, null, '更新成功')
  }
)
