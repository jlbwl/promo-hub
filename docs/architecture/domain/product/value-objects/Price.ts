import { ValueObject } from '../../shared/ValueObject'
import { ValidationError } from '../../shared/errors/DomainError'

/**
 * 价格值对象
 */
export class Price extends ValueObject {
  private readonly _value: number

  private constructor(value: number) {
    super()
    this._value = value
  }

  public static create(value: number): Price {
    if (value < 0) {
      throw new ValidationError('价格不能为负数')
    }
    if (value > 999999.99) {
      throw new ValidationError('价格超出范围')
    }
    // 保留两位小数
    const rounded = Math.round(value * 100) / 100
    return new Price(rounded)
  }

  get value(): number {
    return this._value
  }

  /**
   * 计算折扣价
   */
  public discount(percentage: number): Price {
    if (percentage < 0 || percentage > 100) {
      throw new ValidationError('折扣比例无效')
    }
    const discountedPrice = this._value * (1 - percentage / 100)
    return Price.create(discountedPrice)
  }

  public equals(other?: ValueObject): boolean {
    if (!(other instanceof Price)) {
      return false
    }
    return this._value === other._value
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value]
  }

  public toString(): string {
    return `¥${this._value.toFixed(2)}`
  }
}
