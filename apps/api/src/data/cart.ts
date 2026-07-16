
import { query } from '../db.js'

export async function readCartItems(userId: string): Promise<any[]> {
  return await query(
    'SELECT * FROM cart WHERE userId = ? ORDER BY addedAt DESC',
    [userId]
  )
}

export async function readCartByManagerId(managerId: string): Promise<any[]> {
  return await query(
    'SELECT * FROM cart WHERE managerId = ? ORDER BY addedAt DESC',
    [managerId]
  )
}

export async function addToCart(item: any): Promise<void> {
  const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  await query(
    `INSERT INTO cart (id, userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, item.userId, item.managerId || '', item.productId, item.productName || '', item.productPrice || 0, item.coverImage || '', item.optionLabel || '', item.redirectUrl || '']
  )
}

export async function removeFromCart(id: string): Promise<void> {
  await query('DELETE FROM cart WHERE id = ?', [id])
}

export async function removeFromCartByProductId(userId: string, productId: string): Promise<void> {
  await query('DELETE FROM cart WHERE userId = ? AND productId = ?', [userId, productId])
}

export async function isInCart(userId: string, productId: string): Promise<boolean> {
  const rows = await query(
    'SELECT id FROM cart WHERE userId = ? AND productId = ?',
    [userId, productId]
  )
  return (rows as any[]).length > 0
}
