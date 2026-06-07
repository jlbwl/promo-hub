import { AggregateRoot } from '../../shared/AggregateRoot'
import { Phone } from '../value-objects/Phone'
import { Password } from '../value-objects/Password'
import { UserRole, UserStatus } from '../value-objects/UserRole'
import { UserRegistered } from '../events/UserRegistered'
import { BusinessRuleError, ValidationError } from '../../shared/errors/DomainError'

/**
 * 用户聚合根 - 用户上下文的核心聚合
 */
export class User extends AggregateRoot<string> {
  private _name: string
  private _phone: Phone
  private _password: Password
  private _avatar?: string
  private _role: UserRole
  private _status: UserStatus
  private _teamName?: string
  private _managerId?: string

  private constructor(
    id: string,
    name: string,
    phone: Phone,
    password: Password,
    role: UserRole,
    status: UserStatus,
    avatar?: string,
    teamName?: string,
    managerId?: string,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt)
    this._name = name
    this._phone = phone
    this._password = password
    this._role = role
    this._status = status
    this._avatar = avatar
    this._teamName = teamName
    this._managerId = managerId
  }

  /**
   * 工厂方法：注册新用户
   */
  public static register(
    id: string,
    name: string,
    phone: string,
    password: string,
    role: UserRole = UserRole.USER,
    teamName?: string,
    managerId?: string,
  ): User {
    const phoneVO = Phone.create(phone)
    const passwordVO = Password.create(password)

    const user = new User(
      id,
      name,
      phoneVO,
      passwordVO,
      role,
      UserStatus.ACTIVE,
      undefined,
      teamName,
      managerId,
    )

    // 发布领域事件
    user.addDomainEvent(
      new UserRegistered(id, phoneVO.value, role, name)
    )

    return user
  }

  /**
   * 从数据库重建用户对象
   */
  public static fromPersistence(
    id: string,
    name: string,
    phone: string,
    hashedPassword: string,
    role: UserRole,
    status: UserStatus,
    avatar?: string,
    teamName?: string,
    managerId?: string,
    createdAt?: Date,
    updatedAt?: Date,
  ): User {
    return new User(
      id,
      name,
      Phone.create(phone),
      Password.fromHash(hashedPassword),
      role,
      status,
      avatar,
      teamName,
      managerId,
      createdAt,
      updatedAt,
    )
  }

  // ============== Getters ==============

  get name(): string {
    return this._name
  }

  get phone(): Phone {
    return this._phone
  }

  get password(): Password {
    return this._password
  }

  get role(): UserRole {
    return this._role
  }

  get status(): UserStatus {
    return this._status
  }

  get avatar(): string | undefined {
    return this._avatar
  }

  get teamName(): string | undefined {
    return this._teamName
  }

  get managerId(): string | undefined {
    return this._managerId
  }

  // ============== 业务方法 ==============

  /**
   * 更新用户名称
   */
  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('用户名称不能为空')
    }
    this._name = name.trim()
    this.updateTimestamp()
  }

  /**
   * 修改密码
   */
  public changePassword(oldPassword: string, newPassword: string): void {
    if (!this._password.verify(oldPassword)) {
      throw new BusinessRuleError('原密码不正确')
    }
    this._password = Password.create(newPassword)
    this.updateTimestamp()
  }

  /**
   * 重置密码（管理员操作）
   */
  public resetPassword(newPassword: string): void {
    this._password = Password.create(newPassword)
    this.updateTimestamp()
  }

  /**
   * 更新头像
   */
  public updateAvatar(avatarUrl: string): void {
    this._avatar = avatarUrl
    this.updateTimestamp()
  }

  /**
   * 禁用用户
   */
  public ban(reason?: string): void {
    if (this._role === UserRole.ADMIN) {
      throw new BusinessRuleError('不能禁用管理员账户')
    }
    this._status = UserStatus.BANNED
    this.updateTimestamp()
  }

  /**
   * 启用用户
   */
  public activate(): void {
    if (this._status === UserStatus.ACTIVE) {
      return
    }
    this._status = UserStatus.ACTIVE
    this.updateTimestamp()
  }

  /**
   * 分配经理
   */
  public assignManager(managerId: string): void {
    if (this._role !== UserRole.USER) {
      throw new BusinessRuleError('只有普通用户才能分配经理')
    }
    this._managerId = managerId
    this.updateTimestamp()
  }

  /**
   * 检查是否被禁用
   */
  public isBanned(): boolean {
    return this._status === UserStatus.BANNED
  }

  /**
   * 检查是否为管理员
   */
  public isAdmin(): boolean {
    return this._role === UserRole.ADMIN
  }

  /**
   * 检查是否为经理
   */
  public isManager(): boolean {
    return this._role === UserRole.MANAGER
  }

  /**
   * 检查是否为普通用户
   */
  public isRegularUser(): boolean {
    return this._role === UserRole.USER
  }
}
