import type { Commission } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Commissions ============

export async function readCommissions(): Promise<Commission[]> {
  return readFileData<Commission>('commissions')
}

export async function writeCommissions(commissions: Commission[]): Promise<void> {
  writeFileData('commissions', commissions)
}
