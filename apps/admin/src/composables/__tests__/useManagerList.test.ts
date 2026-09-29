/**
 * useManagerList 单元测试：列表加载、搜索过滤、新增经理、启停切换、删除短信确认、团队名编辑
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useManagerList } from '../useManagerList'
import { UserRole, type Manager } from '@promo/shared/types'
import type { FormInstance } from 'element-plus'

const { get, post, put, del, msgSuccess, msgError, msgWarning, boxConfirm } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  msgSuccess: vi.fn(),
  msgError: vi.fn(),
  msgWarning: vi.fn(),
  boxConfirm: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({ get, post, put, del }))
vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('element-plus', () => ({
  ElMessage: { success: msgSuccess, error: msgError, warning: msgWarning },
  ElMessageBox: { confirm: boxConfirm },
}))

const makeManager = (overrides: Partial<Manager> = {}): Manager => ({
  id: 'm1',
  name: '渠道A',
  phone: '13800138000',
  role: UserRole.MANAGER,
  status: 'active',
  teamName: '渠道A',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const okList = (list: Manager[]) => ({ code: 0, message: 'ok', data: list })

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('useManagerList - loadData', () => {
  it('加载成功：写入表格数据并关闭 loading', async () => {
    get.mockResolvedValue(okList([makeManager(), makeManager({ id: 'm2', teamName: '渠道B' })]))
    const { loadData, filteredData, loading } = useManagerList()

    await loadData()

    expect(filteredData.value).toHaveLength(2)
    expect(loading.value).toBe(false)
  })

  it('加载失败：提示错误、保留空列表且不抛出未捕获异常', async () => {
    get.mockRejectedValue(new Error('网络错误'))
    const { loadData, filteredData, loading } = useManagerList()

    await expect(loadData()).resolves.toBeUndefined()

    expect(msgError).toHaveBeenCalledWith('网络错误')
    expect(filteredData.value).toEqual([])
    expect(loading.value).toBe(false)
  })
})

describe('搜索过滤', () => {
  it('按团队名（不区分大小写）与手机号过滤', async () => {
    get.mockResolvedValue(
      okList([
        makeManager({ id: 'm1', teamName: 'Alpha 团队', phone: '13811112222' }),
        makeManager({ id: 'm2', teamName: 'Beta 团队', phone: '13933334444' }),
      ])
    )
    const { loadData, searchKeyword, filteredData } = useManagerList()
    await loadData()

    searchKeyword.value = 'alpha'
    expect(filteredData.value.map((item) => item.id)).toEqual(['m1'])

    searchKeyword.value = '393333'
    expect(filteredData.value.map((item) => item.id)).toEqual(['m2'])

    searchKeyword.value = ''
    expect(filteredData.value).toHaveLength(2)
  })
})

describe('新增经理', () => {
  it('未挂载表单 ref：直接返回不发请求', async () => {
    const { handleAdd } = useManagerList()

    await handleAdd()

    expect(post).not.toHaveBeenCalled()
  })

  it('表单校验失败：不发起请求并提示错误', async () => {
    const { handleAdd, addFormRef } = useManagerList()
    addFormRef.value = {
      validate: vi.fn().mockRejectedValue(new Error('表单校验失败')),
    } as unknown as FormInstance

    await handleAdd()

    expect(post).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledWith('表单校验失败')
  })

  it('校验通过：提交表单、提示成功、关闭弹窗并刷新列表', async () => {
    get.mockResolvedValue(okList([]))
    const { handleAdd, addFormRef, addForm, addDialogVisible } = useManagerList()
    addFormRef.value = { validate: vi.fn().mockResolvedValue(true) } as unknown as FormInstance
    addForm.teamName = '新渠道'
    addForm.password = '123456'
    addForm.phone = '13900139000'

    await handleAdd()

    expect(post).toHaveBeenCalledWith('/managers', {
      teamName: '新渠道',
      password: '123456',
      phone: '13900139000',
    })
    expect(msgSuccess).toHaveBeenCalledWith('添加成功')
    expect(addDialogVisible.value).toBe(false)
    expect(get).toHaveBeenCalled()
  })
})

describe('启停切换', () => {
  it('状态相同：不弹确认、不发请求', async () => {
    const { handleToggleManagerStatus } = useManagerList()

    await handleToggleManagerStatus(makeManager({ status: 'active' }), 'active')

    expect(boxConfirm).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('确认禁用：按新状态调用 put 并刷新列表', async () => {
    get.mockResolvedValue(okList([]))
    boxConfirm.mockResolvedValue('confirm')
    const { handleToggleManagerStatus } = useManagerList()

    await handleToggleManagerStatus(makeManager({ id: 'm1', status: 'active' }), 'inactive')

    expect(put).toHaveBeenCalledWith('/managers/m1', { status: 'inactive' })
    expect(msgSuccess).toHaveBeenCalledWith('禁用成功')
    expect(get).toHaveBeenCalled()
  })

  it('取消操作：不请求也不报错', async () => {
    boxConfirm.mockRejectedValue('cancel')
    const { handleToggleManagerStatus } = useManagerList()

    await expect(handleToggleManagerStatus(makeManager(), 'inactive')).resolves.toBeUndefined()

    expect(put).not.toHaveBeenCalled()
    expect(msgError).not.toHaveBeenCalled()
  })

  it('请求失败：提示错误信息', async () => {
    boxConfirm.mockResolvedValue('confirm')
    put.mockRejectedValue(new Error('服务器错误'))
    const { handleToggleManagerStatus } = useManagerList()

    await handleToggleManagerStatus(makeManager(), 'inactive')

    expect(msgError).toHaveBeenCalledWith('服务器错误')
  })
})

describe('删除（短信确认）', () => {
  it('确认弹窗取消：不进入短信验证步骤', async () => {
    boxConfirm.mockRejectedValue('cancel')
    const { handleDelete, deleteSmsDialogVisible } = useManagerList()

    await expect(handleDelete(makeManager())).resolves.toBeUndefined()

    expect(deleteSmsDialogVisible.value).toBe(false)
    expect(del).not.toHaveBeenCalled()
  })

  it('确认删除：打开短信验证弹窗并记录目标行', async () => {
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, deleteSmsDialogVisible } = useManagerList()

    await handleDelete(makeManager({ id: 'm9' }))

    expect(deleteSmsDialogVisible.value).toBe(true)
  })

  it('验证码为空：提示警告且不请求', async () => {
    const { confirmDelete } = useManagerList()

    await confirmDelete()

    expect(msgWarning).toHaveBeenCalledWith('请输入验证码')
    expect(del).not.toHaveBeenCalled()
  })

  it('验证码正确且删除成功：清空状态并刷新列表', async () => {
    get.mockResolvedValue(okList([]))
    del.mockResolvedValue({ code: 0, message: 'ok', data: null })
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, confirmDelete, smsCode, deleteSmsDialogVisible } = useManagerList()

    await handleDelete(makeManager({ id: 'm9' }))
    smsCode.value = '123456'
    await confirmDelete()

    expect(del).toHaveBeenCalledWith('/managers/m9?smsCode=123456')
    expect(msgSuccess).toHaveBeenCalledWith('删除成功')
    expect(deleteSmsDialogVisible.value).toBe(false)
    expect(smsCode.value).toBe('')
    expect(get).toHaveBeenCalled()
  })

  it('业务失败（code≠0）：提示后端 message 且弹窗保持打开', async () => {
    del.mockResolvedValue({ code: 1, message: '验证码错误', data: null })
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, confirmDelete, smsCode, deleteSmsDialogVisible } = useManagerList()

    await handleDelete(makeManager({ id: 'm9' }))
    smsCode.value = '000000'
    await confirmDelete()

    expect(msgError).toHaveBeenCalledWith('验证码错误')
    expect(deleteSmsDialogVisible.value).toBe(true)
  })
})

describe('发送短信验证码', () => {
  it('本地缺少管理员手机号：提示重新登录且不请求', async () => {
    const { sendSmsCode } = useManagerList()

    await sendSmsCode()

    expect(msgError).toHaveBeenCalledWith('未获取到管理员手机号，请重新登录')
    expect(post).not.toHaveBeenCalled()
  })

  it('发送成功：进入 60s 冷却并随时间归零', async () => {
    vi.useFakeTimers()
    localStorage.setItem('admin_info', JSON.stringify({ phone: '13700000000' }))
    localStorage.setItem('token', 't1')
    post.mockResolvedValue({ code: 0, message: 'ok', data: null })
    const { sendSmsCode, smsCooldown, smsLoading } = useManagerList()

    await sendSmsCode()

    expect(post).toHaveBeenCalledWith('/admin/sms/send', { phone: '13700000000' })
    expect(msgSuccess).toHaveBeenCalledWith('验证码已发送')
    expect(smsCooldown.value).toBe(60)
    expect(smsLoading.value).toBe(false)

    vi.advanceTimersByTime(61000)
    expect(smsCooldown.value).toBe(0)
  })
})

describe('团队名编辑', () => {
  it('名称为空（纯空白）：提示警告且不请求', async () => {
    const { handleEditTeamName, handleSaveTeamName, teamNameForm } = useManagerList()
    handleEditTeamName(makeManager({ id: 'm1', teamName: '渠道A' }))
    teamNameForm.teamName = '   '

    await handleSaveTeamName()

    expect(msgWarning).toHaveBeenCalledWith('请输入渠道名称')
    expect(put).not.toHaveBeenCalled()
  })

  it('保存成功：trim 后提交、关闭弹窗并刷新列表', async () => {
    get.mockResolvedValue(okList([]))
    const { handleEditTeamName, handleSaveTeamName, teamNameForm, editRow, teamNameDialogVisible } =
      useManagerList()
    handleEditTeamName(makeManager({ id: 'm1', teamName: '旧名字' }))
    expect(editRow.value?.id).toBe('m1')
    expect(teamNameDialogVisible.value).toBe(true)
    teamNameForm.teamName = '  新名字  '

    await handleSaveTeamName()

    expect(put).toHaveBeenCalledWith('/managers/m1/team-name', { teamName: '新名字' })
    expect(msgSuccess).toHaveBeenCalledWith('修改成功')
    expect(teamNameDialogVisible.value).toBe(false)
    expect(get).toHaveBeenCalled()
  })

  it('保存失败：提示错误信息', async () => {
    put.mockRejectedValue(new Error('渠道名已存在'))
    const { handleEditTeamName, handleSaveTeamName } = useManagerList()
    handleEditTeamName(makeManager({ id: 'm1' }))

    await handleSaveTeamName()

    expect(msgError).toHaveBeenCalledWith('渠道名已存在')
  })
})
