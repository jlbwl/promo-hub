import type { CartItem } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Cart ============

export async function readCartItems(userId: string): Promise<CartItem[]> {
  const cart = await readFileData<CartItem>('cart')
  return cart.filter((item) => item.userId === userId).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function readCartByManagerId(managerId: string): Promise<CartItem[]> {
  const cart = await readFileData<CartItem>('cart')
  return cart.filter((item) => item.managerId === managerId).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<void> {
  const cart = await readFileData<CartItem>('cart')
  const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  cart.push({
    id,
    userId: item.userId,
    managerId: item.managerId || '',
    productId: item.productId,
    productName: item.productName || '',
    productPrice: item.productPrice || 0,
    coverImage: item.coverImage || '',
    optionLabel: item.optionLabel || '',
    redirectUrl: item.redirectUrl || '',
    addedAt: new Date().toISOString()
  })
  await writeFileData('cart', cart)
}

export async function removeFromCart(id: string): Promise<void> {
  const cart = await readFileData<CartItem>('cart')
  const filtered = cart.filter((item) => item.id !== id)
  await writeFileData('cart', filtered)
}

export async function removeFromCartByProductId(userId: string, productId: string): Promise<void> {
  const cart = await readFileData<CartItem>('cart')
  const filtered = cart.filter((item) => !(item.userId === userId && item.productId === productId))
  await writeFileData('cart', filtered)
}

export async function isInCart(userId: string, productId: string): Promise<boolean> {
  const cart = await readFileData<CartItem>('cart')
  return cart.some((item) => item.userId === userId && item.productId === productId)
}
