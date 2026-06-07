/**
 * 实体基类 - DDD 中的实体拥有唯一标识
 */
export abstract class Entity<TId> {
  protected readonly _id: TId
  protected _createdAt: Date
  protected _updatedAt?: Date

  constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    this._id = id
    this._createdAt = createdAt || new Date()
    if (updatedAt) {
      this._updatedAt = updatedAt
    }
  }

  get id(): TId {
    return this._id
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt
  }

  protected updateTimestamp(): void {
    this._updatedAt = new Date()
  }

  public equals(other?: Entity<TId>): boolean {
    if (other == null) {
      return false
    }
    if (this === other) {
      return true
    }
    if (!(other instanceof Entity)) {
      return false
    }
    return this._id === other._id
  }
}
