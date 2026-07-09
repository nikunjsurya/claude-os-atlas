// n8n API key resolution: env N8N_API_KEY wins, else the key configured for
// the n8n-mcp MCP server in ~/.claude.json. The key never leaves the server.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5.

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_BASE_URL = 'http://localhost:5678/api/v1'

export interface N8nAuth {
  baseUrl: string
  apiKey: string | null
}

export function resolveN8nAuth(
  env: NodeJS.ProcessEnv,
  claudeJsonRaw: string | null
): N8nAuth {
  if (env.N8N_API_KEY) {
    return { baseUrl: env.N8N_API_URL ?? DEFAULT_BASE_URL, apiKey: env.N8N_API_KEY }
  }
  if (claudeJsonRaw) {
    try {
      const parsed = JSON.parse(claudeJsonRaw) as {
        mcpServers?: Record<string, { env?: Record<string, string> }>
      }
      const mcpEnv = parsed.mcpServers?.['n8n-mcp']?.env
      if (mcpEnv?.N8N_API_KEY) {
        return {
          baseUrl: mcpEnv.N8N_API_URL ?? DEFAULT_BASE_URL,
          apiKey: mcpEnv.N8N_API_KEY,
        }
      }
    } catch {
      // Malformed ~/.claude.json: treat as no key.
    }
  }
  return { baseUrl: DEFAULT_BASE_URL, apiKey: null }
}

export async function loadN8nAuth(): Promise<N8nAuth> {
  let raw: string | null = null
  try {
    raw = await fs.readFile(path.join(os.homedir(), '.claude.json'), 'utf8')
  } catch {
    raw = null
  }
  return resolveN8nAuth(process.env, raw)
}
