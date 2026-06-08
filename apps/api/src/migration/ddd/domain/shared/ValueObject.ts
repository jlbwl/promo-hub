/**
 * 值对象基类 - DDD 中的值对象通过属性值判断相等性
 */
export abstract class ValueObject {
  public abstract equals(other?: ValueObject | null): boolean

  protected abstract getEqualityComponents(): unknown[]

  public static equals(left?: ValueObject | null, right?: ValueObject | null): boolean {
    if (left == null && right == null) {
      return true
    }
    if (left == null || right == null) {
      return false
    }
    if (left.constructor !== right.constructor) {
      return false
    }
    return left.equals(right)
  }
}
