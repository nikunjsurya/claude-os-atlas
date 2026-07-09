import { describe, expect, it } from 'vitest'
import { resolveN8nAuth } from './n8nAuth'

const claudeJson = JSON.stringify({
  mcpServers: {
    'n8n-mcp': {
      env: {
        N8N_API_URL: 'http://localhost:5678/api/v1',
        N8N_API_KEY: 'key-from-claude-json',
      },
    },
  },
})

describe('resolveN8nAuth', () => {
  it('prefers the N8N_API_KEY env var when set', () => {
    const auth = resolveN8nAuth(
      { N8N_API_KEY: 'env-key' } as unknown as NodeJS.ProcessEnv,
      claudeJson
    )
    expect(auth.apiKey).toBe('env-key')
  })

  it('falls back to the n8n-mcp server config in ~/.claude.json', () => {
    const auth = resolveN8nAuth({} as NodeJS.ProcessEnv, claudeJson)
    expect(auth.apiKey).toBe('key-from-claude-json')
    expect(auth.baseUrl).toBe('http://localhost:5678/api/v1')
  })

  it('returns a null key (unreachable-style handling) when neither source exists', () => {
    const auth = resolveN8nAuth({} as NodeJS.ProcessEnv, null)
    expect(auth.apiKey).toBeNull()
    expect(auth.baseUrl).toBe('http://localhost:5678/api/v1')
  })
})
