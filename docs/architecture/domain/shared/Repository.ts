import { AggregateRoot } from './AggregateRoot'

/**
 * 仓储接口基类 - 定义聚合根的基本增删改查
 */
export interface IRepository<T extends AggregateRoot<TId>, TId> {
  save(aggregate: T): Promise<void>
  findById(id: TId): Promise<T | null>
  delete(id: TId): Promise<void>
  exists(id: TId): Promise<boolean>
}
