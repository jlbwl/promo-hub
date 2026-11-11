/**
 * 经理端登录：密码/短信两个分支在未拿到真实 token 时都必须按登录失败处理，
 * 禁止写入伪 token 'logged_in'
 */
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import { post } from '@promo/shared/utils/request'

const { msgSuccess, msgError, msgWarning, push } = vi.hoisted(() => ({
  msgSuccess: vi.fn(),
  msgError: vi.fn(),
  msgWarning: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@promo/shared/utils/errors', () => ({
  getErrorMessage: (error: unknown, fallback: string) =>
    (error as Error | undefined)?.message || fallback,
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: msgSuccess, error: msgError, warning: msgWarning },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}))

// el-form 需要暴露 validate；el-input 需要支持 v-model 写入
const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_props, { slots, expose }) {
    expose({ validate: () => Promise.resolve(true) })
    return () => h('div', slots.default?.())
  },
})

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
  },
})

const mountLogin = () =>
  mount(LoginView, {
    global: {
      stubs: {
        'el-form': ElFormStub,
        'el-input': ElInputStub,
      },
    },
  })

// 点击第 index 个「登 录」按钮（0 = 密码登录，1 = 短信登录）
const clickLoginButton = async (wrapper: ReturnType<typeof mountLogin>, index: number) => {
  const loginButtons = wrapper
    .findAll('el-button')
    .filter(button => button.text().includes('登 录'))
  await loginButtons[index].trigger('click')
  await flushPromises()
}

const submitPasswordLogin = async (wrapper: ReturnType<typeof mountLogin>) => {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue('13911112222')
  await inputs[1].setValue('abc12345')
  await clickLoginButton(wrapper, 0)
}

const submitSmsLogin = async (wrapper: ReturnType<typeof mountLogin>) => {
  const inputs = wrapper.findAll('input')
  await inputs[2].setValue('13900000000')
  await inputs[3].setValue('123456')
  await clickLoginButton(wrapper, 1)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('经理端密码登录', () => {
  it('接口未返回 token 时不写伪 token，按登录失败提示且不跳转', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { manager: { id: 'm1', name: '李经理', phone: '13911112222' } },
    } as never)

    const wrapper = mountLogin()
    await submitPasswordLogin(wrapper)

    expect(post).toHaveBeenCalledWith('/managers/login', {
      phone: '13911112222',
      password: 'abc12345',
    })
    expect(localStorage.getItem('manager_token')).toBeNull()
    expect(localStorage.getItem('manager_info')).toBeNull()
    expect(msgSuccess).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledTimes(1)
    expect(String(msgError.mock.calls[0][0])).toContain('登录凭证')
    expect(push).not.toHaveBeenCalled()
  })

  it('接口返回真实 token 时正常写入并跳转', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        manager: { id: 'm1', name: '李经理', phone: '13911112222' },
        token: 'real-token',
        refreshToken: 'real-refresh',
      },
    } as never)

    const wrapper = mountLogin()
    await submitPasswordLogin(wrapper)

    expect(localStorage.getItem('manager_token')).toBe('real-token')
    expect(localStorage.getItem('manager_refresh_token')).toBe('real-refresh')
    expect(msgSuccess).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/dashboard')
  })
})

describe('经理端短信登录', () => {
  it('接口未返回 token 时不写伪 token，按登录失败提示且不跳转', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { manager: { id: 'm1', name: '李经理', phone: '13900000000' } },
    } as never)

    const wrapper = mountLogin()
    await submitSmsLogin(wrapper)

    expect(localStorage.getItem('manager_token')).toBeNull()
    expect(localStorage.getItem('manager_info')).toBeNull()
    expect(msgSuccess).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledTimes(1)
    expect(String(msgError.mock.calls[0][0])).toContain('登录凭证')
    expect(push).not.toHaveBeenCalled()
  })

  it('接口返回真实 token 时正常写入并跳转', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        manager: { id: 'm1', name: '李经理', phone: '13900000000' },
        token: 'real-token',
        refreshToken: 'real-refresh',
      },
    } as never)

    const wrapper = mountLogin()
    await submitSmsLogin(wrapper)

    expect(localStorage.getItem('manager_token')).toBe('real-token')
    expect(localStorage.getItem('manager_refresh_token')).toBe('real-refresh')
    expect(msgSuccess).toHaveBeenCalled()
    expect(msgError).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/dashboard')
  })
})
