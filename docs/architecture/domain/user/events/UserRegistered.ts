import { DomainEvent } from '../../shared/DomainEvent'
import { UserRole } from '../value-objects/UserRole'

export class UserRegistered extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly phone: string,
    public readonly role: UserRole,
    public readonly name: string,
  ) {
    super()
  }

  get eventName(): string {
    return 'UserRegistered'
  }
}
