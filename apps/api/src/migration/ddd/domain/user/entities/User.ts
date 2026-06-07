import { AggregateRoot } from '../../shared/AggregateRoot.js'
import { Phone } from '../value-objects/Phone.js'
import { Password } from '../value-objects/Password.js'
import { UserRole, UserStatus } from '../value-objects/UserRole.js'
import {
  UserRegistered,
  UserLoggedIn,
  UserPasswordChanged,
  UserBanned
} from '../events/UserRegistered.js'
import { BusinessRuleError, ValidationError } from '../../shared/errors/DomainError.js'

/**
 * 用户聚合根 - 用户上下文的核心聚合
 * 包含完整的业务逻辑，充血模型
 */
export class User extends AggregateRoot<string> {
  private _nickname: string
  private _phone: Phone
  private _password: Password
  private _avatar?: string
  private _role: UserRole
  private _status: UserStatus
  private _teamName?: string
  private _managerId?: string
  private _loginMethods: string[]

  private constructor(
    id: string,
    nickname: string,
    phone: Phone,
    password: Password,
    role: UserRole,
    status: UserStatus,
    avatar?: string,
    teamName?: string,
    managerId?: string,
    loginMethods?: string[],
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt)
    this._nickname = nickname
    this._phone = phone
    this._password = password
    this._role = role
    this._status = status
    this._avatar = avatar
    this._teamName = teamName
    this._managerId = managerId
    this._loginMethods = loginMethods || []
  }

  /**
   * 工厂方法：注册新用户
   */
  public static register(
    id: string,
    nickname: string,
    phone: string,
    password: string,
    role: UserRole = UserRole.USER,
    teamName?: string,
    managerId?: string,
    loginMethod: string = 'password',
  ): User {
    const phoneVO = Phone.create(phone)
    const passwordVO = Password.createSync(password)

    const user = new User(
      id,
      nickname,
      phoneVO,
      passwordVO,
      role,
      UserStatus.ACTIVE,
      undefined,
      teamName,
      managerId,
      [loginMethod],
    )

    // 发布领域事件
    user.addDomainEvent(
      new UserRegistered(id, phoneVO.value, role, nickname)
    )

    return user
  }

  /**
   * 从数据库重建用户对象（与现有数据结构兼容）
   */
  public static fromPersistence(dbUser: any): User {
    return new User(
      dbUser.id,
      dbUser.nickname || dbUser.name,
      Phone.create(dbUser.phone),
      Password.fromHash(dbUser.password),
      (dbUser.role as UserRole) || UserRole.USER,
      (dbUser.status as UserStatus) || UserStatus.ACTIVE,
      dbUser.avatar,
      dbUser.teamName,
      dbUser.managerId,
      dbUser.loginMethods || [],
      dbUser.createdAt ? new Date(dbUser.createdAt) : undefined,
      dbUser.updatedAt ? new Date(dbUser.updatedAt) : undefined,
    )
  }

  // ============== Getters ==============

  get nickname(): string {
    return this._nickname
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

  get loginMethods(): readonly string[] {
    return [...this._loginMethods]
  }

  // ============== 业务方法 ==============

  /**
   * 登录验证
   */
  public async login(password: string, loginMethod: string = 'password'): Promise<boolean> {
    const isValid = await this._password.verifyAsync(password)
    if (isValid) {
      this.addLoginMethod(loginMethod)
      this.addDomainEvent(
        new UserLoggedIn(this.id, this._phone.value, loginMethod)
      )
    }
    return isValid
  }

  /**
   * 更新用户昵称
   */
  public updateNickname(nickname: string): void {
    if (!nickname || nickname.trim().length === 0) {
      throw new ValidationError('用户昵称不能为空')
    }
    this._nickname = nickname.trim()
    this.updateTimestamp()
  }

  /**
   * 修改密码
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const isValid = await this._password.verifyAsync(oldPassword)
    if (!isValid) {
      throw new BusinessRuleError('原密码不正确')
    }
    this._password = await Password.createAsync(newPassword)
    this.addDomainEvent(new UserPasswordChanged(this.id))
    this.updateTimestamp()
  }

  /**
   * 重置密码（管理员操作）
   */
  public async resetPassword(newPassword: string): Promise<void> {
    this._password = await Password.createAsync(newPassword)
    this.addDomainEvent(new UserPasswordChanged(this.id))
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
    this.addDomainEvent(new UserBanned(this.id, reason))
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
   * 更新团队名称
   */
  public updateTeamName(teamName: string): void {
    if (!teamName || teamName.trim().length === 0) {
      throw new ValidationError('团队名称不能为空')
    }
    this._teamName = teamName.trim()
    this.updateTimestamp()
  }

  /**
   * 更改用户角色
   */
  public changeRole(newRole: UserRole): void {
    if (this._role === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
      throw new BusinessRuleError('不能降级管理员账户')
    }
    this._role = newRole
    this.updateTimestamp()
  }

  /**
   * 添加登录方式
   */
  public addLoginMethod(method: string): void {
    if (!this._loginMethods.includes(method)) {
      this._loginMethods.push(method)
      this.updateTimestamp()
    }
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

  /**
   * 转换为旧格式的数据（向后兼容）
   */
  public toLegacyFormat(): any {
    return {
      id: this.id,
      name: this._nickname,
      nickname: this._nickname,
      phone: this._phone.value,
      password: this._password.hashedValue,
      role: this._role,
      status: this._status,
      avatar: this._avatar,
      teamName: this._teamName,
      managerId: this._managerId,
      loginMethods: this._loginMethods,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt?.toISOString(),
    }
  }

  /**
   * 转换为安全格式（不包含密码）
   */
  public toSafeFormat(): any {
    return {
      id: this.id,
      name: this._nickname,
      nickname: this._nickname,
      phone: this._phone.mask(),
      role: this._role,
      status: this._status,
      avatar: this._avatar,
      teamName: this._teamName,
      managerId: this._managerId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt?.toISOString(),
    }
  }
}
