/**
 * 领域错误基类
 */
export abstract class DomainError extends Error {
  public readonly code: string

  constructor(message: string, code: string = 'DOMAIN_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with id ${id} not found`, 'NOT_FOUND')
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_ERROR')
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT')
  }
}
