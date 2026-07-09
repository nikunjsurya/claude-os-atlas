// LaunchPlan → Warp launch-configuration YAML. Pure string building; the
// exec line contains only space-free forward-slash paths, never prompt
// content. cwd may contain spaces, so it is YAML-double-quoted.
// Spec: 2026-07-09-mission-control-v2-design.md section 6 step 4.

import type { LaunchPlan } from './plan'
import { toPosix } from './plan'

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function renderWarpConfig(plan: LaunchPlan, title: string): string {
  const cwd = yamlQuote(toPosix(plan.projectPath))
  return [
    '# Written by claude-os-atlas mission control. Overwritten on every launch.',
    'name: atlas-launch',
    'windows:',
    '  - tabs:',
    `      - title: ${yamlQuote(title)}`,
    '        layout:',
    `          cwd: ${cwd}`,
    '          commands:',
    `            - exec: node ${plan.shimPath} ${plan.promptFile}`,
    '',
  ].join('\n')
}
