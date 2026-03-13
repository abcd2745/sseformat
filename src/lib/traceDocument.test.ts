import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parseTraceDocument } from './traceDocument'

describe('parseTraceDocument', () => {
  test('normalizes panel kinds and preserves valid trace data', () => {
    const result = parseTraceDocument({
      meta: {
        traceId: 'trace-1',
      },
      summary: {
        title: 'Trace title',
      },
      metrics: {
        model: 'gpt-4.1',
        latencyMs: 980,
        usage: {
          totalTokens: 42,
        },
        outcome: 'Complete',
      },
      stages: [
        {
          id: 'agent',
          lane: 'agent',
          title: 'Context built',
          summary: 'Agent created the prompt.',
          status: 'ok',
          panels: [
            {
              label: 'Text block',
              content: 'line 1\nline 2',
            },
            {
              label: 'Structured',
              content: {
                foo: 'bar',
              },
            },
          ],
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected normalized trace')
    }

    expect(result.data.stages[0].panels[0].kind).toBe('text')
    expect(result.data.stages[0].panels[1].kind).toBe('json')
  })

  test('rejects documents that do not provide summary or metrics', () => {
    const result = parseTraceDocument({
      meta: {
        traceId: 'trace-1',
      },
      stages: [],
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected validation failure')
    }

    expect(result.message).toMatch(/summary or metrics/i)
  })

  test('adapts the real demo request payload into a presentable trace', () => {
    const demoPayload = JSON.parse(readFileSync('docs/demo.json', 'utf8'))

    const result = parseTraceDocument(demoPayload)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.data.metrics.model).toBe('qwen3.5-plus')
    expect(result.data.stages.some((stage) => stage.lane === 'agent')).toBe(true)
    expect(result.data.stages.some((stage) => stage.lane === 'http')).toBe(true)
    expect(result.data.stages.some((stage) => stage.status === 'missing')).toBe(true)
    const breakdown = result.data.meta.requestBreakdown
    expect(breakdown).toBeTruthy()
    if (!breakdown) {
      throw new Error('expected request breakdown to be present')
    }

    expect(breakdown.summary.currentInputCount).toBeGreaterThan(0)
    expect(breakdown.injectedPromptGroups.length).toBeGreaterThan(0)
    expect(breakdown.assistantHistory.some((item) => item.kind === 'thinking')).toBe(true)
  })
})
