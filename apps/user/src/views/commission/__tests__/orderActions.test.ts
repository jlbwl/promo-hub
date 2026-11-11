/**
 * 订单操作可用性测试：按钮可见/可用必须与订单状态匹配
 */
import { describe, it, expect } from 'vitest'
import {
  canDeleteOrder,
  canPurgeOrder,
  canSubmitFundAccount,
  orderActionHint,
  purgeDisabledReason,
} from '../orderActions'
import type { Order } from '@promo/shared/types'

type Status = Order['status']

describe('canSubmitFundAccount', () => {
  it.each<[Status, boolean]>([
    ['pending', true],
    ['approved', false],
    ['pending_payment', false],
    ['settled', false],
    ['rejected', false],
  ])('状态 %s -> %s', (status, expected) => {
    expect(canSubmitFundAccount(status)).toBe(expected)
  })
})

describe('canDeleteOrder', () => {
  it.each<[Status, boolean]>([
    ['pending', true],
    ['approved', false],
    ['pending_payment', false],
    ['settled', false],
    ['rejected', false],
  ])('状态 %s -> %s', (status, expected) => {
    expect(canDeleteOrder(status)).toBe(expected)
  })
})

describe('canPurgeOrder', () => {
  it.each<[Status, boolean]>([
    ['pending', true],
    ['rejected', true],
    ['approved', false],
    ['pending_payment', false],
    ['settled', false],
  ])('状态 %s -> %s', (status, expected) => {
    expect(canPurgeOrder(status)).toBe(expected)
  })

  it('已进入结算流程的状态给出不可永久删除的原因', () => {
    expect(purgeDisabledReason('settled')).toBe('已进入结算流程的订单不可永久删除')
    expect(purgeDisabledReason('pending')).toBe('')
  })
})

describe('orderActionHint', () => {
  it('仅待审核状态返回空提示', () => {
    expect(orderActionHint('pending')).toBe('')
    expect(orderActionHint('approved')).not.toBe('')
    expect(orderActionHint('settled')).not.toBe('')
  })
})
