import { ValueObject } from '../../shared/ValueObject.js'
import { ValidationError } from '../../shared/errors/DomainError.js'
import bcrypt from 'bcryptjs'

/**
 * 密码值对象 - 处理密码加密和验证
 * 兼容现有 bcrypt 实现
 */
export class Password extends ValueObject {
  private readonly _hashedValue: string
  private static readonly SALT_ROUNDS = 12

  private constructor(hashedValue: string) {
    super()
    this._hashedValue = hashedValue
  }

  /**
   * 从明文密码创建（会自动加密）
   */
  public static async createAsync(plainPassword: string): Promise<Password> {
    if (!plainPassword || plainPassword.length < 6) {
      throw new ValidationError('密码长度不能少于6位')
    }
    const hashed = await bcrypt.hash(plainPassword, Password.SALT_ROUNDS)
    return new Password(hashed)
  }

  /**
   * 同步版本（用于现有代码兼容性）
   */
  public static createSync(plainPassword: string): Password {
    if (!plainPassword || plainPassword.length < 6) {
      throw new ValidationError('密码长度不能少于6位')
    }
    const hashed = bcrypt.hashSync(plainPassword, Password.SALT_ROUNDS)
    return new Password(hashed)
  }

  /**
   * 从已加密的密码重建（用于从数据库读取）
   */
  public static fromHash(hashedValue: string): Password {
    return new Password(hashedValue)
  }

  get hashedValue(): string {
    return this._hashedValue
  }

  /**
   * 验证密码是否匹配
   */
  public async verifyAsync(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this._hashedValue)
  }

  /**
   * 同步验证
   */
  public verifySync(plainPassword: string): boolean {
    try {
      return bcrypt.compareSync(plainPassword, this._hashedValue)
    } catch {
      return false
    }
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
