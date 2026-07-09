// Queue persistence. Curated items live in the committed data/queue.json;
// runtime state (status overrides + suppressions) lives in the gitignored
// data/queue-state.json, written atomically via tmp+rename.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.3, 9.

import fs from 'node:fs/promises'
import path from 'node:path'
import type { QueueItem, QueueState } from '@/lib/types'

export interface QueueStoreResult<T> {
  value: T
  warning: string | null
}

export const EMPTY_STATE: QueueState = { statusOverrides: {}, suppressed: [] }

async function readJsonWithBackup(
  filePath: string
): Promise<{ parsed: unknown; missing: boolean; warning: string | null }> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return { parsed: null, missing: true, warning: null }
  }
  try {
    return { parsed: JSON.parse(raw), missing: false, warning: null }
  } catch {
    const backup = `${filePath}.bad-${Date.now()}`
    try {
      await fs.rename(filePath, backup)
    } catch {
      // If the backup rename fails we still continue with the fallback.
    }
    return {
      parsed: null,
      missing: false,
      warning: `${path.basename(filePath)} was malformed; backed up to ${path.basename(backup)}`,
    }
  }
}

export async function readCurated(
  filePath: string
): Promise<QueueStoreResult<QueueItem[]>> {
  const { parsed, missing, warning } = await readJsonWithBackup(filePath)
  if (missing || warning) return { value: [], warning }
  if (!Array.isArray(parsed)) {
    return { value: [], warning: `${path.basename(filePath)} is not an array` }
  }
  return { value: parsed as QueueItem[], warning: null }
}

export async function readState(
  filePath: string
): Promise<QueueStoreResult<QueueState>> {
  const { parsed, missing, warning } = await readJsonWithBackup(filePath)
  if (missing || warning) return { value: EMPTY_STATE, warning }
  const raw = parsed as Partial<QueueState> | null
  return {
    value: {
      statusOverrides:
        raw && typeof raw.statusOverrides === 'object' && raw.statusOverrides !== null
          ? raw.statusOverrides
          : {},
      suppressed: Array.isArray(raw?.suppressed) ? raw.suppressed : [],
    },
    warning: null,
  }
}

export async function writeState(
  filePath: string,
  state: QueueState
): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}
