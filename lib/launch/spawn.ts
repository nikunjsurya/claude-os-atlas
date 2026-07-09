// Executes a LaunchPlan: writes the prompt file + Warp config, then spawns
// the terminal. The only impure lib/ module in the launch path. Warp launch
// falls back to wt automatically; the prompt file is always kept so nothing
// typed is ever lost. Spec: 2026-07-09-mission-control-v2-design.md section 6.

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { LaunchPlan } from './plan'
import { renderWarpConfig } from './warpConfig'

export interface SpawnOutcome {
  launched: boolean
  terminal: 'warp' | 'wt'
  promptFile: string
  error?: string
}

function trySpawn(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}

export async function executeLaunch(
  plan: LaunchPlan,
  title: string
): Promise<SpawnOutcome> {
  await fs.mkdir(path.dirname(plan.promptFile), { recursive: true })
  await fs.writeFile(plan.promptFile, plan.promptContent, 'utf8')

  if (plan.terminal === 'warp' && plan.warpConfigPath && plan.warpUri) {
    await fs.mkdir(path.dirname(plan.warpConfigPath), { recursive: true })
    await fs.writeFile(plan.warpConfigPath, renderWarpConfig(plan, title), 'utf8')
    // `start` hands the URI to the registered warp: protocol handler.
    // The URI contains no user-controlled bytes (fixed config name).
    if (await trySpawn('cmd', ['/c', 'start', '', plan.warpUri])) {
      return { launched: true, terminal: 'warp', promptFile: plan.promptFile }
    }
  }

  if (await trySpawn(plan.wtArgv[0], plan.wtArgv.slice(1))) {
    return { launched: true, terminal: 'wt', promptFile: plan.promptFile }
  }

  return {
    launched: false,
    terminal: plan.terminal,
    promptFile: plan.promptFile,
    error:
      'failed to spawn both Warp and Windows Terminal; prompt file kept on disk',
  }
}
