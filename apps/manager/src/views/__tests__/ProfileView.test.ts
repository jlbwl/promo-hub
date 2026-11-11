/**
 * 个人中心：用户信息缺失时不得用硬编码「张经理 / 13800138000」兜底，
 * 且改密与发验证码在缺少真实手机号时不得发出请求
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ProfileView from '../ProfileView.vue'
import { get, post } from '@promo/shared/utils/request'

const { msgSuccess, msgError } = vi.hoisted(() => ({
  msgSuccess: vi.fn(),
  msgError: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  clearAuthStorage: vi.fn(),
}))

vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: msgSuccess, error: msgError, warning: vi.fn() },
}))

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_props, { slots, expose }) {
    expose({
      validate: () => Promise.resolve(true),
      resetFields: () => undefined,
    })
    return () => h('div', slots.default?.())
  },
})

const mountProfile = () =>
  mount(ProfileView, {
    global: {
      stubs: {
        'el-form': ElFormStub,
        'el-input': true,
      },
    },
  })

const clickButton = async (wrapper: ReturnType<typeof mountProfile>, label: string) => {
  const button = wrapper.findAll('el-button').find(item => item.text().includes(label))
  expect(button, `未找到按钮：${label}`).toBeTruthy()
  await button!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: null } as never)
})

describe('个人中心经理信息', () => {
  it('取不到信息时不出现硬编码姓名与手机号，改为明确的缺失态', async () => {
    const wrapper = mountProfile()
    await flushPromises()

    const text = wrapper.text()
    expect(text).not.toContain('张经理')
    expect(text).not.toContain('13800138000')
    expect(text).toContain('未获取到')

    wrapper.unmount()
  })

  it('缺少手机号时发验证码不发请求并提示', async () => {
    const wrapper = mountProfile()
    await flushPromises()

    await clickButton(wrapper, '获取验证码')

    expect(post).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledTimes(1)
    expect(String(msgError.mock.calls[0][0])).toContain('手机号')

    wrapper.unmount()
  })

  it('缺少手机号时修改密码不发请求并提示', async () => {
    const wrapper = mountProfile()
    await flushPromises()

    await clickButton(wrapper, '修改密码')

    expect(post).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledTimes(1)
    expect(String(msgError.mock.calls[0][0])).toContain('手机号')

    wrapper.unmount()
  })

  it('有真实信息时展示真实值，发码使用真实手机号', async () => {
    localStorage.setItem(
      'manager_info',
      JSON.stringify({ id: 'm1', name: '李经理', phone: '13900000000', teamName: '华北渠道' })
    )

    const wrapper = mountProfile()
    await flushPromises()

    expect(wrapper.text()).toContain('华北渠道')
    expect(wrapper.text()).toContain('13900000000')

    await clickButton(wrapper, '获取验证码')

    expect(post).toHaveBeenCalledWith('/managers/sms/send', { phone: '13900000000' })

    wrapper.unmount()
  })
})
