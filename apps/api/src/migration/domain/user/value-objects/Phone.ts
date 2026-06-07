import { ValueObject } from '../../shared/ValueObject'
import { ValidationError } from '../../shared/errors/DomainError'

/**
 * 手机号值对象
 */
export class Phone extends ValueObject {
  private readonly _value: string

  private constructor(value: string) {
    super()
    this._value = value
  }

  public static create(value: string): Phone {
    const phone = value.trim()
    if (!Phone.isValid(phone)) {
      throw new ValidationError('无效的手机号格式')
    }
    return new Phone(phone)
  }

  public static isValid(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(phone)
  }

  get value(): string {
    return this._value
  }

  public equals(other?: ValueObject): boolean {
    if (!(other instanceof Phone)) {
      return false
    }
    return this._value === other._value
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value]
  }

  public toString(): string {
    return this._value
  }

  /**
   * 脱敏显示
   */
  public mask(): string {
    return this._value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }
}
