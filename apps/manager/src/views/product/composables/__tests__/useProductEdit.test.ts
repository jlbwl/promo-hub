/**
 * useProductEdit 单元测试：编辑模式判定、选项行操作与描述校验规则
 * 路由与 element-plus 弹层 mock 掉，仅测纯交互逻辑
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { FormItemRule } from 'element-plus'
import { useProductEdit } from '../useProductEdit'

const routeState = vi.hoisted(() => ({ params: {} as Record<string, string> }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeState.params }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn(), prompt: vi.fn() },
}))

type DescValidator = (rule: unknown, value: string, callback: (error?: string | Error) => void) => void

beforeEach(() => {
  routeState.params = {}
  vi.clearAllMocks()
  // 屏蔽 bare 调用 composable 时 Vue 对 onMounted 无实例的告警
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isEdit 与选项行操作', () => {
  it('无路由 id 时为新建模式，选项行增删改复制清空正确', () => {
    const api = useProductEdit()
    expect(api.isEdit.value).toBe(false)

    api.addOption()
    api.updateOptionField(0, 'label', '套餐A')
    api.updateOptionField(0, 'limit', '限量100')
    expect(api.form.options[0]).toEqual({ label: '套餐A', limit: '限量100', redirectUrl: '' })

    api.copyOption(0)
    expect(api.form.options).toHaveLength(2)
    expect(api.form.options[1]).toEqual({ label: '套餐A', limit: '限量100', redirectUrl: '' })

    api.deleteOption(0)
    expect(api.form.options.map((o) => o.label)).toEqual(['套餐A'])

    api.clearOptions()
    expect(api.form.options).toHaveLength(0)

    api.pushOptionLabels(['a', 'b'])
    expect(api.form.options).toHaveLength(2)
    expect(api.form.options[0]).toEqual({ label: 'a', limit: '', redirectUrl: '' })
    expect(api.form.options[1]).toEqual({ label: 'b', limit: '', redirectUrl: '' })
  })

  it('路由带 id 时为编辑模式', () => {
    routeState.params = { id: '9' }
    const api = useProductEdit()
    expect(api.isEdit.value).toBe(true)
  })
})

describe('描述校验规则', () => {
  it('去除 HTML 标签后按 2~5000 字校验', async () => {
    const { formRules } = useProductEdit()
    const validator = (formRules.description as FormItemRule[])[1]?.validator as DescValidator | undefined
    if (!validator) throw new Error('描述校验规则缺失')

    const run = (value: string) => new Promise<string | Error | undefined>((resolve) => {
      validator({}, value, (error) => resolve(error))
    })

    const tooShort = await run('<p>a</p>')
    expect(tooShort).toBeInstanceOf(Error)
    expect((tooShort as Error).message).toBe('描述至少需要2个字符')

    const tooLong = await run('x'.repeat(5001))
    expect((tooLong as Error).message).toBe('描述不能超过5000个字符')

    expect(await run('<p>hello</p>')).toBeUndefined()
  })
})
