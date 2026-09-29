import { readFileData, writeFileData } from './_shared.js'
import type { AdminRow } from './types.js'

// ============ Admins ============

export async function readAdminByPhone(phone: string): Promise<AdminRow | null> {
  const admins = readFileData<AdminRow>('admins')
  return admins.find((a) => a.phone === phone && a.status === 'active') || null
}

export async function readAdminById(id: string): Promise<AdminRow | null> {
  const admins = readFileData<AdminRow>('admins')
  return admins.find((a) => a.id === id) || null
}

export async function updateAdmin(id: string, fields: Record<string, unknown>): Promise<void> {
  const admins = readFileData<AdminRow>('admins')
  const index = admins.findIndex((a) => a.id === id)
  if (index !== -1) {
    admins[index] = { ...admins[index], ...fields, updatedAt: new Date().toISOString() }
    writeFileData('admins', admins)
  }
}
