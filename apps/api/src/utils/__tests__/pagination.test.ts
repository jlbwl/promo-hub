import { describe, expect, it } from 'vitest'
import { MAX_PAGE_SIZE, parsePage, parsePageSize } from '../pagination.js'

describe('parsePage', () => {
  it('非法/缺省页码回退到第 1 页', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-3')).toBe(1)
  })

  it('合法页码原样返回（支持字符串与数字）', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage(12)).toBe(12)
  })
})

describe('parsePageSize', () => {
  it('非法/缺省每页条数回退到默认值', () => {
    expect(parsePageSize(undefined)).toBe(10)
    expect(parsePageSize('abc')).toBe(10)
    expect(parsePageSize('0')).toBe(10)
    expect(parsePageSize('-5', 20)).toBe(20)
  })

  it('超过上限时按上限截断', () => {
    expect(parsePageSize('999')).toBe(MAX_PAGE_SIZE)
    expect(parsePageSize(999, 20)).toBe(MAX_PAGE_SIZE)
    expect(parsePageSize(String(MAX_PAGE_SIZE + 1))).toBe(MAX_PAGE_SIZE)
  })

  it('未超过上限时保留原始值', () => {
    expect(parsePageSize('20')).toBe(20)
    expect(parsePageSize(100)).toBe(MAX_PAGE_SIZE)
  })
})
