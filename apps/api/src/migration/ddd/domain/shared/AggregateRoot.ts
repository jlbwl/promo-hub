import { Entity } from './Entity.js'
import { DomainEvent } from './DomainEvent.js'

/**
 * 聚合根基类 - 维护一致性边界，处理领域事件
 */
export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = []

  get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents]
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
    this.updateTimestamp()
  }

  public clearDomainEvents(): void {
    this._domainEvents = []
  }

  protected removeDomainEvent(event: DomainEvent): void {
    const index = this._domainEvents.indexOf(event)
    if (index > -1) {
      this._domainEvents.splice(index, 1)
    }
  }
}
