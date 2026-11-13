import { Request, Response, NextFunction } from 'express'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail } from '../utils/auditDetail.js'
import {
  readCustomersPaged,
  readCustomersForExport,
  readCustomerById,
  readCustomerByGroupName,
  readCustomersByGroupNames,
  insertCustomer,
  updateCustomer,
  deleteCustomer,
  applyCustomerImport,
  type CustomerListParams,
  type CustomerRecord,
} from '../data/index.js'
import {
  buildCustomerImportPlan,
  normalizePayMethod,
  parseSearchCount,
  MAX_IMPORT_ROWS,
  PAY_METHOD_LABELS,
  type ImportMode,
} from '../utils/customerImport.js'

const CUSTOMER_STATUSES = new Set(['active', 'disabled'])
const STATUS_LABELS: Record<string, string> = { active: '启用', disabled: '停用' }

const toText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim())
const payMethodLabel = (value?: string): string => PAY_METHOD_LABELS[value as keyof typeof PAY_METHOD_LABELS] || value || '-'
const statusLabel = (value?: string): string => STATUS_LABELS[value || ''] || value || '-'

function readFilters(req: Request): CustomerListParams {
  const keyword = toText(req.query.keyword)
  const payMethod = toText(req.query.payMethod)
  const status = toText(req.query.status)
  return {
    keyword: keyword || undefined,
    payMethod: payMethod ? normalizePayMethod(payMethod) || undefined : undefined,
    status: CUSTOMER_STATUSES.has(status) ? status : undefined,
  }
}

interface CustomerPayload {
  groupName: string
  contactName: string
  payMethod: string
  cardNo: string
  status: string
  searchCount: number
}

function validatePayload(body: Record<string, unknown>): CustomerPayload {
  const groupName = toText(body.groupName)
  const contactName = toText(body.contactName)
  const cardNo = toText(body.cardNo)
  const status = toText(body.status) || 'active'

  if (!groupName) {
    throw new AppError('群号简称不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  if (groupName.length > 200) {
    throw new AppError('群号简称最多 200 字', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  if (!contactName) {
    throw new AppError('对接人不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  if (contactName.length > 200) {
    throw new AppError('对接人最多 200 字', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  if (cardNo.length > 500) {
    throw new AppError('卡号/备注最多 500 字', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  const payMethod = normalizePayMethod(body.payMethod)
  if (!payMethod) {
    throw new AppError('收款方式仅支持支付宝/微信/USDT', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  if (!CUSTOMER_STATUSES.has(status)) {
    throw new AppError('客户状态不合法', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }
  const searchCount = parseSearchCount(body.searchCount)
  if (searchCount === undefined) {
    throw new AppError('使用次数必须是非负整数', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
  }

  return {
    groupName,
    contactName,
    payMethod,
    cardNo,
    status,
    searchCount: searchCount ?? 0,
  }
}

function toListItem(customer: CustomerRecord) {
  return {
    id: customer.id,
    groupName: customer.groupName,
    contactName: customer.contactName,
    payMethod: customer.payMethod,
    payMethodLabel: payMethodLabel(customer.payMethod),
    cardNo: customer.cardNo,
    hasQrCode: !!customer.qrCodeUrl,
    searchCount: customer.searchCount,
    status: customer.status,
    statusLabel: statusLabel(customer.status),
    source: customer.source,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  }
}

// ============================================
// 客户档案管理（仅管理端）
// ============================================

export const getCustomers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 10
    const result = await readCustomersPaged({ ...readFilters(req), page, pageSize })

    sendSuccess(
      res,
      {
        list: result.list.map(toListItem),
        total: result.total,
        page,
        pageSize,
      },
      '获取成功'
    )
  }
)

export const createCustomer = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const payload = validatePayload((req.body || {}) as Record<string, unknown>)

    const existing = await readCustomerByGroupName(payload.groupName)
    if (existing) {
      throw new AppError('该群号简称已存在', ErrorCode.CONFLICT, HttpStatus.CONFLICT)
    }

    const id = await insertCustomer({
      ...payload,
      source: 'manual',
      createdBy: req.user?.id || '',
    })

    await logAdminOperation(req, {
      operationType: 'create',
      targetType: 'customer',
      targetId: id,
      targetName: payload.groupName,
      detail: buildAuditDetail({
        summary: '新增客户档案',
        meta: {
          对接人: payload.contactName,
          收款方式: payMethodLabel(payload.payMethod),
          使用次数: payload.searchCount,
        },
      }),
    })

    sendSuccess(res, { id }, '新增成功')
  }
)

export const updateCustomerById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const id = req.params.id as string
    const current = await readCustomerById(id)
    if (!current) {
      throw new AppError('客户不存在', ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const body = (req.body || {}) as Record<string, unknown>
    // 更新允许只传变更字段；缺省字段沿用库中原值后再统一校验
    const payload = validatePayload({
      groupName: body.groupName ?? current.groupName,
      contactName: body.contactName ?? current.contactName,
      payMethod: body.payMethod ?? current.payMethod,
      cardNo: body.cardNo ?? current.cardNo,
      status: body.status ?? current.status,
      searchCount: body.searchCount ?? current.searchCount,
    })

    if (payload.groupName !== current.groupName) {
      const conflict = await readCustomerByGroupName(payload.groupName)
      if (conflict && conflict.id !== id) {
        throw new AppError('该群号简称已存在', ErrorCode.CONFLICT, HttpStatus.CONFLICT)
      }
    }

    await updateCustomer(id, {
      groupName: payload.groupName,
      contactName: payload.contactName,
      payMethod: payload.payMethod,
      cardNo: payload.cardNo,
      status: payload.status,
      searchCount: payload.searchCount,
    })

    await logAdminOperation(req, {
      operationType: 'update',
      targetType: 'customer',
      targetId: id,
      targetName: payload.groupName,
      detail: buildAuditDetail({
        summary: '编辑客户档案',
        changes: [
          { field: 'groupName', label: '群号简称', from: current.groupName, to: payload.groupName },
          { field: 'contactName', label: '对接人', from: current.contactName, to: payload.contactName },
          {
            field: 'payMethod',
            label: '收款方式',
            from: payMethodLabel(current.payMethod),
            to: payMethodLabel(payload.payMethod),
          },
          { field: 'cardNo', label: '卡号/备注', from: current.cardNo || '-', to: payload.cardNo || '-' },
          { field: 'searchCount', label: '使用次数', from: current.searchCount, to: payload.searchCount },
          { field: 'status', label: '状态', from: statusLabel(current.status), to: statusLabel(payload.status) },
        ],
      }),
    })

    sendSuccess(res, null, '更新成功')
  }
)

export const deleteCustomerById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const id = req.params.id as string
    const current = await readCustomerById(id)
    if (!current) {
      throw new AppError('客户不存在', ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    await deleteCustomer(id)

    await logAdminOperation(req, {
      operationType: 'delete',
      targetType: 'customer',
      targetId: id,
      targetName: current.groupName,
      detail: buildAuditDetail({
        summary: '删除客户档案',
        meta: { 对接人: current.contactName, 使用次数: current.searchCount },
      }),
    })

    sendSuccess(res, null, '删除成功')
  }
)

/**
 * 批量导入：dryRun=true 只返回预览统计，不落库。
 * 增量合并，不清空既有数据；按群号简称判重。
 */
export const importCustomers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const body = (req.body || {}) as {
      rows?: unknown
      mode?: unknown
      dryRun?: unknown
    }
    const rows = body.rows

    if (!Array.isArray(rows)) {
      throw new AppError('导入数据格式错误：rows 必须是数组', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }
    if (rows.length === 0) {
      throw new AppError('没有可导入的数据', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(`单次最多导入 ${MAX_IMPORT_ROWS} 行，请拆分文件后重试`, ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    const mode: ImportMode = body.mode === 'skip' ? 'skip' : 'overwrite'
    const dryRun = body.dryRun === true

    const groupNames = rows
      .map((row) => toText((row as { groupName?: unknown } | null)?.groupName))
      .filter(Boolean)
    const existing = await readCustomersByGroupNames(groupNames)
    const plan = buildCustomerImportPlan(rows, existing, mode)

    if (!dryRun) {
      await applyCustomerImport(
        {
          toCreate: plan.toCreate.map((row) => ({
            groupName: row.groupName,
            contactName: row.contactName,
            payMethod: row.payMethod,
            cardNo: row.cardNo,
            searchCount: row.searchCount ?? 0,
            source: 'import',
          })),
          toUpdate: plan.toUpdate.map((row) => ({
            id: row.id,
            contactName: row.contactName,
            payMethod: row.payMethod,
            cardNo: row.cardNo,
            searchCount: row.effectiveSearchCount,
          })),
        },
        req.user?.id || ''
      )

      await logAdminOperation(req, {
        operationType: 'create',
        targetType: 'customer',
        targetId: '',
        targetName: '客户档案批量导入',
        detail: buildAuditDetail({
          summary: `导入完成（${mode === 'skip' ? '跳过同名' : '覆盖同名'}）`,
          meta: {
            新增: plan.toCreate.length,
            更新: plan.toUpdate.length,
            跳过: plan.skipped.length,
            错误: plan.errors.length,
          },
        }),
      })
    }

    sendSuccess(
      res,
      {
        dryRun,
        mode,
        totalRows: plan.totalRows,
        created: plan.toCreate.length,
        updated: plan.toUpdate.length,
        skipped: plan.skipped.length,
        errors: plan.errors.length,
        errorRows: plan.errors,
        skippedRows: plan.skipped,
      },
      dryRun ? '预览完成' : '导入完成'
    )
  }
)

/** 导出：返回与列表同一套筛选条件下的全量数据（上限 10000 行），由前端生成 Excel */
export const exportCustomers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const result = await readCustomersForExport(readFilters(req))
    sendSuccess(
      res,
      {
        list: result.list.map((customer) => ({
          groupName: customer.groupName,
          contactName: customer.contactName,
          payMethod: customer.payMethod,
          payMethodLabel: payMethodLabel(customer.payMethod),
          cardNo: customer.cardNo,
          hasQrCode: !!customer.qrCodeUrl,
          searchCount: customer.searchCount,
        })),
        total: result.total,
        truncated: result.truncated,
      },
      '获取成功'
    )
  }
)
