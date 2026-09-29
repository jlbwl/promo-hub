/**
 * useUserList 单元测试：列表加载、筛选参数拼装、分页、角色/状态启停、删除短信确认、团队名编辑
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserList, type UserItem } from '../useUserList'

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

const makeUser = (overrides: Partial<UserItem> = {}): UserItem => ({
  id: 'u1',
  name: '张三',
  phone: '13800138000',
  teamName: '团队A',
  role: 'user',
  status: 1,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const okPage = (list: UserItem[], total = list.length) => ({
  code: 0,
  message: 'ok',
  data: { list, total, page: 1, pageSize: 10 },
})

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('useUserList - loadData', () => {
  it('加载成功：填充列表与分页总数并关闭 loading', async () => {
    get.mockResolvedValue(okPage([makeUser(), makeUser({ id: 'u2' })], 25))
    const { loadData, tableData, pagination, loading } = useUserList()

    await loadData()

    expect(tableData.value).toHaveLength(2)
    expect(pagination.total).toBe(25)
    expect(get).toHaveBeenCalledWith('/users', {
      page: 1,
      pageSize: 10,
      status: undefined,
      keyword: undefined,
    })
    expect(loading.value).toBe(false)
  })

  it('加载失败：提示错误且不抛出未捕获异常', async () => {
    get.mockRejectedValue(new Error('网络错误'))
    const { loadData, tableData } = useUserList()

    await expect(loadData()).resolves.toBeUndefined()

    expect(msgError).toHaveBeenCalledWith('网络错误')
    expect(tableData.value).toEqual([])
  })
})

describe('筛选与分页参数拼装', () => {
  it('关键词与状态筛选拼进请求参数', async () => {
    get.mockResolvedValue(okPage([]))
    const { loadData, searchKeyword, searchStatus, pagination } = useUserList()
    searchKeyword.value = 'abc'
    searchStatus.value = 1
    pagination.page = 2

    await loadData()

    expect(get).toHaveBeenCalledWith('/users', {
      page: 2,
      pageSize: 10,
      status: 1,
      keyword: 'abc',
    })
  })

  it('handleSearch 重置到第 1 页再请求', async () => {
    get.mockResolvedValue(okPage([]))
    const { handleSearch, pagination } = useUserList()
    pagination.page = 5

    await handleSearch()

    expect(pagination.page).toBe(1)
    expect(get).toHaveBeenCalledWith('/users', {
      page: 1,
      pageSize: 10,
      status: undefined,
      keyword: undefined,
    })
  })
})

describe('角色切换', () => {
  it('角色相同：不弹确认不发请求', async () => {
    const { handleToggleUserRole } = useUserList()

    await handleToggleUserRole(makeUser({ role: 'user' }), 'user')

    expect(boxConfirm).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('确认切换：调用 put 修改角色并刷新列表', async () => {
    get.mockResolvedValue(okPage([]))
    boxConfirm.mockResolvedValue('confirm')
    const { handleToggleUserRole } = useUserList()

    await handleToggleUserRole(makeUser({ id: 'u1', role: 'user' }), 'vip')

    expect(put).toHaveBeenCalledWith('/users/u1/role', { role: 'vip' })
    expect(msgSuccess).toHaveBeenCalledWith('角色设置成功')
    expect(get).toHaveBeenCalled()
  })

  it('取消切换：不请求也不报错', async () => {
    boxConfirm.mockRejectedValue('cancel')
    const { handleToggleUserRole } = useUserList()

    await expect(handleToggleUserRole(makeUser(), 'vip')).resolves.toBeUndefined()

    expect(put).not.toHaveBeenCalled()
    expect(msgError).not.toHaveBeenCalled()
  })
})

describe('状态启停', () => {
  it('状态相同：不弹确认不发请求', async () => {
    const { handleToggleUserStatus } = useUserList()

    await handleToggleUserStatus(makeUser({ status: 1 }), 1)

    expect(boxConfirm).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('确认禁用：调用 put 修改状态并刷新列表', async () => {
    get.mockResolvedValue(okPage([]))
    boxConfirm.mockResolvedValue('confirm')
    const { handleToggleUserStatus } = useUserList()

    await handleToggleUserStatus(makeUser({ id: 'u1', status: 1 }), 0)

    expect(put).toHaveBeenCalledWith('/users/u1/status', { status: 0 })
    expect(msgSuccess).toHaveBeenCalledWith('禁用成功')
    expect(get).toHaveBeenCalled()
  })

  it('请求失败：提示错误信息', async () => {
    boxConfirm.mockResolvedValue('confirm')
    put.mockRejectedValue(new Error('服务器错误'))
    const { handleToggleUserStatus } = useUserList()

    await handleToggleUserStatus(makeUser({ status: 1 }), 0)

    expect(msgError).toHaveBeenCalledWith('服务器错误')
  })
})

describe('删除（短信确认）', () => {
  it('确认弹窗取消：不进入短信验证步骤', async () => {
    boxConfirm.mockRejectedValue('cancel')
    const { handleDelete, deleteSmsDialogVisible } = useUserList()

    await expect(handleDelete(makeUser())).resolves.toBeUndefined()

    expect(deleteSmsDialogVisible.value).toBe(false)
    expect(del).not.toHaveBeenCalled()
  })

  it('确认删除：打开短信验证弹窗', async () => {
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, deleteSmsDialogVisible } = useUserList()

    await handleDelete(makeUser({ id: 'u9' }))

    expect(deleteSmsDialogVisible.value).toBe(true)
  })

  it('验证码为空：提示警告且不请求', async () => {
    const { confirmDelete } = useUserList()

    await confirmDelete()

    expect(msgWarning).toHaveBeenCalledWith('请输入验证码')
    expect(del).not.toHaveBeenCalled()
  })

  it('验证码正确且删除成功：清空状态并刷新列表', async () => {
    get.mockResolvedValue(okPage([]))
    del.mockResolvedValue({ code: 0, message: 'ok', data: null })
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, confirmDelete, smsCode, deleteSmsDialogVisible } = useUserList()

    await handleDelete(makeUser({ id: 'u9' }))
    smsCode.value = '123456'
    await confirmDelete()

    expect(del).toHaveBeenCalledWith('/users/u9?smsCode=123456')
    expect(msgSuccess).toHaveBeenCalledWith('删除成功')
    expect(deleteSmsDialogVisible.value).toBe(false)
    expect(smsCode.value).toBe('')
    expect(get).toHaveBeenCalled()
  })

  it('业务失败（code≠0）：提示后端 message 且弹窗保持打开', async () => {
    del.mockResolvedValue({ code: 1, message: '验证码错误', data: null })
    boxConfirm.mockResolvedValue('confirm')
    const { handleDelete, confirmDelete, smsCode, deleteSmsDialogVisible } = useUserList()

    await handleDelete(makeUser({ id: 'u9' }))
    smsCode.value = '000000'
    await confirmDelete()

    expect(msgError).toHaveBeenCalledWith('验证码错误')
    expect(deleteSmsDialogVisible.value).toBe(true)
  })
})

describe('团队名编辑', () => {
  it('名称为空（纯空白）：提示警告且不请求', async () => {
    const { handleEditTeamName, handleSaveTeamName, teamNameForm } = useUserList()
    handleEditTeamName(makeUser({ id: 'u1', teamName: '团队A' }))
    teamNameForm.teamName = '   '

    await handleSaveTeamName()

    expect(msgWarning).toHaveBeenCalledWith('请输入团队名称')
    expect(put).not.toHaveBeenCalled()
  })

  it('保存成功：trim 后提交、关闭弹窗并刷新列表', async () => {
    get.mockResolvedValue(okPage([]))
    const { handleEditTeamName, handleSaveTeamName, teamNameForm, editRow, teamNameDialogVisible } =
      useUserList()
    handleEditTeamName(makeUser({ id: 'u1', teamName: '旧团队' }))
    expect(editRow.value?.id).toBe('u1')
    teamNameForm.teamName = '  新团队  '

    await handleSaveTeamName()

    expect(put).toHaveBeenCalledWith('/users/u1/team-name', { teamName: '新团队' })
    expect(msgSuccess).toHaveBeenCalledWith('修改成功')
    expect(teamNameDialogVisible.value).toBe(false)
    expect(get).toHaveBeenCalled()
  })
})

describe('发送短信验证码', () => {
  it('本地缺少管理员手机号：提示重新登录且不请求', async () => {
    const { sendSmsCode } = useUserList()

    await sendSmsCode()

    expect(msgError).toHaveBeenCalledWith('未获取到管理员手机号，请重新登录')
    expect(post).not.toHaveBeenCalled()
  })

  it('发送成功：进入冷却状态', async () => {
    vi.useFakeTimers()
    localStorage.setItem('admin_info', JSON.stringify({ phone: '13700000000' }))
    localStorage.setItem('token', 't1')
    post.mockResolvedValue({ code: 0, message: 'ok', data: null })
    const { sendSmsCode, smsCooldown } = useUserList()

    await sendSmsCode()

    expect(post).toHaveBeenCalledWith('/admin/sms/send', { phone: '13700000000' })
    expect(msgSuccess).toHaveBeenCalledWith('验证码已发送')
    expect(smsCooldown.value).toBe(60)

    vi.advanceTimersByTime(61000)
    expect(smsCooldown.value).toBe(0)
  })
})
