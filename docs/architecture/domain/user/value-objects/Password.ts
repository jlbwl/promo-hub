import { ValueObject } from '../../shared/ValueObject'
import { ValidationError } from '../../shared/errors/DomainError'
import crypto from 'crypto'

/**
 * 密码值对象 - 处理密码加密和验证
 */
export class Password extends ValueObject {
  private readonly _hashedValue: string

  private constructor(hashedValue: string) {
    super()
    this._hashedValue = hashedValue
  }

  /**
   * 从明文密码创建（会自动加密）
   */
  public static create(plainPassword: string): Password {
    if (!plainPassword || plainPassword.length < 6) {
      throw new ValidationError('密码长度不能少于6位')
    }
    const hashed = Password.hash(plainPassword)
    return new Password(hashed)
  }

  /**
   * 从已加密的密码重建（用于从数据库读取）
   */
  public static fromHash(hashedValue: string): Password {
    return new Password(hashedValue)
  }

  /**
   * 简单的哈希实现 - 生产环境建议使用 bcrypt/argon2
   */
  private static hash(password: string): string {
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex')
  }

  get hashedValue(): string {
    return this._hashedValue
  }

  /**
   * 验证密码是否匹配
   */
  public verify(plainPassword: string): boolean {
    return Password.hash(plainPassword) === this._hashedValue
  }

  public equals(other?: ValueObject): boolean {
    if (!(other instanceof Password)) {
      return false
    }
    return this._hashedValue === other._hashedValue
  }

  protected getEqualityComponents(): unknown[] {
    return [this._hashedValue]
  }
}
