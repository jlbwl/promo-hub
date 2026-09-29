import type { Manager } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Managers ============

export async function readManagers(): Promise<Manager[]> {
  return readFileData<Manager>('managers')
}

export async function writeManagers(managers: Manager[]): Promise<void> {
  writeFileData('managers', managers)
}

export async function readManager(id: string): Promise<Manager | null> {
  const managers = await readManagers()
  return managers.find((m) => m.id === id) || null
}

export async function readManagerByPhone(phone: string): Promise<Manager | null> {
  const managers = await readManagers()
  return managers.find((m) => m.phone === phone) || null
}

export async function deleteManager(id: string): Promise<void> {
  const managers = await readManagers()
  const filtered = managers.filter((m) => m.id !== id)
  await writeManagers(filtered)
}
