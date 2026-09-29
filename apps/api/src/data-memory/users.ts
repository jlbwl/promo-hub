import type { User } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Users ============

export async function readUsers(): Promise<User[]> {
  return readFileData<User>('users')
}

export async function writeUsers(users: User[]): Promise<void> {
  writeFileData('users', users)
}

export async function readUser(id: string): Promise<User | null> {
  const users = await readUsers()
  return users.find((u) => u.id === id) || null
}

export async function insertUser(u: User): Promise<void> {
  const users = await readUsers()
  users.push(u)
  await writeUsers(users)
}

export async function updateUser(id: string, fields: Record<string, unknown>): Promise<void> {
  const users = await readUsers()
  const index = users.findIndex((u) => u.id === id)
  if (index !== -1) {
    users[index] = { ...users[index], ...fields }
    await writeUsers(users)
  }
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsers()
  const filtered = users.filter((u) => u.id !== id)
  await writeUsers(filtered)
}
