/**
 * 领域事件基类
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date
  public readonly eventId: string

  constructor() {
    this.occurredAt = new Date()
    this.eventId = this.generateId()
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  public abstract get eventName(): string
}
