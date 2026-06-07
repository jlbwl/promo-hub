import { DomainEvent } from '../../shared/DomainEvent.js'
import { UserRole } from '../value-objects/UserRole.js'

export class UserRegistered extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly phone: string,
    public readonly role: UserRole,
    public readonly nickname: string,
  ) {
    super()
  }

  get eventName(): string {
    return 'UserRegistered'
  }
}

export class UserLoggedIn extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly phone: string,
    public readonly loginMethod: string,
  ) {
    super()
  }

  get eventName(): string {
    return 'UserLoggedIn'
  }
}

export class UserPasswordChanged extends DomainEvent {
  constructor(
    public readonly userId: string,
  ) {
    super()
  }

  get eventName(): string {
    return 'UserPasswordChanged'
  }
}

export class UserBanned extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly reason?: string,
  ) {
    super()
  }

  get eventName(): string {
    return 'UserBanned'
  }
}
