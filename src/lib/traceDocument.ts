import { z } from 'zod'

const laneSchema = z.enum(['agent', 'http', 'llm', 'system', 'tool'])
const statusSchema = z.enum(['ok', 'warning', 'error', 'missing'])
const kindSchema = z.enum(['markdown', 'code', 'json', 'text'])

const panelSchema = z.object({
  label: z.string().min(1),
  kind: kindSchema.optional(),
  content: z.unknown(),
  language: z.string().optional(),
  defaultExpanded: z.boolean().optional(),
})

const stageSchema = z.object({
  id: z.string().min(1),
  lane: laneSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  status: statusSchema,
  panels: z.array(panelSchema).min(1),
})

const traceDocumentSchema = z.object({
  meta: z.record(z.string(), z.unknown()),
  summary: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
  }),
  stages: z.array(stageSchema),
  metrics: z.object({
    model: z.string().min(1),
    latencyMs: z.number().nonnegative(),
    usage: z
      .object({
        inputTokens: z.number().nonnegative().optional(),
        outputTokens: z.number().nonnegative().optional(),
        totalTokens: z.number().nonnegative(),
      })
      .passthrough(),
    outcome: z.string().min(1),
  }),
  raw: z.unknown().optional(),
})

const rawMessageSchema = z.object({
  role: z.string(),
  content: z.unknown(),
})

const rawToolSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
})

const rawAgentRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(rawMessageSchema),
  system: z.unknown().optional(),
  tools: z.array(rawToolSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  max_tokens: z.number().optional(),
  thinking: z.unknown().optional(),
  output_config: z.unknown().optional(),
  stream: z.boolean().optional(),
})

export type RequestItemKind = 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'system'

export type RequestBreakdownItem = {
  id: string
  messageIndex: number
  partIndex: number
  role: string
  kind: RequestItemKind
  title: string
  text: string
}

export type InjectedPromptGroup = {
  id: string
  title: string
  preview: string
  count: number
  items: RequestBreakdownItem[]
}

export type RequestBreakdown = {
  summary: {
    currentInputCount: number
    historyConversationCount: number
    injectedGroupCount: number
    assistantHistoryCount: number
    toolTraceCount: number
  }
  currentInput: RequestBreakdownItem[]
  historyConversation: RequestBreakdownItem[]
  assistantHistory: RequestBreakdownItem[]
  toolTrace: RequestBreakdownItem[]
  injectedPromptGroups: InjectedPromptGroup[]
  requestEnvelope: {
    model: string
    stream: boolean
    maxTokens: number | null
    messageCount: number
    toolCount: number
  }
}

export type TraceLane = z.infer<typeof laneSchema>
export type TraceStatus = z.infer<typeof statusSchema>
export type PanelKind = z.infer<typeof kindSchema>
export type TracePanel = z.infer<typeof panelSchema> & { kind: PanelKind }
export type TraceStage = Omit<z.infer<typeof stageSchema>, 'panels'> & {
  panels: TracePanel[]
}
export type TraceMeta = Record<string, unknown> & {
  requestType?: 'raw-agent-request'
  requestBreakdown?: RequestBreakdown
}
export type TraceDocument = Omit<z.infer<typeof traceDocumentSchema>, 'meta' | 'stages'> & {
  meta: TraceMeta
  stages: TraceStage[]
}

export type TraceParseResult =
  | { ok: true; data: TraceDocument }
  | { ok: false; message: string; issues?: string[] }

function inferPanelKind(content: unknown): PanelKind {
  if (Array.isArray(content) || (typeof content === 'object' && content !== null)) {
    return 'json'
  }

  if (typeof content === 'string') {
    return content.includes('\n') ? 'text' : 'text'
  }

  return 'text'
}

function normalizePanels(panels: z.infer<typeof panelSchema>[]): TracePanel[] {
  return panels.map((panel) => ({
    ...panel,
    kind: panel.kind ?? inferPanelKind(panel.content),
  }))
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (typeof item === 'object' && item !== null) {
          const record = item as Record<string, unknown>

          if (typeof record.text === 'string') {
            return record.text
          }

          if (typeof record.thinking === 'string') {
            return record.thinking
          }

          return JSON.stringify(item, null, 2)
        }

        return String(item)
      })
      .join('\n\n')
  }

  if (typeof content === 'object' && content !== null) {
    return JSON.stringify(content, null, 2)
  }

  return String(content)
}

function isInjectedText(text: string) {
  const normalized = text.trim()
  return normalized.startsWith('<system-reminder>') || normalized.includes('claudeMd')
}

function createItem(
  messageIndex: number,
  partIndex: number,
  role: string,
  kind: RequestItemKind,
  text: string,
  title?: string,
): RequestBreakdownItem {
  return {
    id: `${messageIndex}-${partIndex}-${role}-${kind}`,
    messageIndex,
    partIndex,
    role,
    kind,
    title: title ?? `${role} ${kind}`,
    text: text.trim(),
  }
}

function getToolText(record: Record<string, unknown>) {
  const name = typeof record.name === 'string' ? record.name : 'tool'
  const payload =
    'input' in record
      ? record.input
      : 'content' in record
        ? record.content
        : 'result' in record
          ? record.result
          : record

  return `${name}\n${stringifyContent(payload)}`
}

function classifyInjectedPrompt(item: RequestBreakdownItem) {
  const normalized = item.text.replace(/\s+/g, ' ').trim()

  if (item.messageIndex === -1) {
    return {
      id: 'top-level-system',
      title: 'Top-level system prompt',
    }
  }

  if (normalized.includes('The following skills are available')) {
    return {
      id: 'skills-reminder',
      title: 'Skills reminder',
    }
  }

  if (normalized.includes('claudeMd')) {
    return {
      id: 'claude-md-reminder',
      title: 'Workspace context reminder',
    }
  }

  if (normalized.includes('Called the') && normalized.includes('tool')) {
    return {
      id: 'tool-call-reminder',
      title: 'Tool call reminder',
    }
  }

  if (normalized.includes('Result of calling the') && normalized.includes('tool')) {
    return {
      id: 'tool-result-reminder',
      title: 'Tool result reminder',
    }
  }

  return {
    id: 'generic-system-reminder',
    title: item.title,
  }
}

function summarizeInjectedPromptGroup(group: InjectedPromptGroup) {
  const messageIndexes = group.items
    .map((item) => item.messageIndex)
    .filter((index) => index >= 0)
  const messageSpan =
    messageIndexes.length > 0
      ? `messages ${[...new Set(messageIndexes)].slice(0, 4).join(', ')}${messageIndexes.length > 4 ? ', ...' : ''}`
      : 'top-level request settings'

  return `${group.title} across ${group.count} prompt fragment(s), sourced from ${messageSpan}.`
}

function getRequestBreakdown(raw: z.infer<typeof rawAgentRequestSchema>): RequestBreakdown {
  const currentInputCandidates: RequestBreakdownItem[] = []
  const historyConversation: RequestBreakdownItem[] = []
  const assistantHistory: RequestBreakdownItem[] = []
  const toolTrace: RequestBreakdownItem[] = []
  const injectedItems: RequestBreakdownItem[] = []
  let partCounter = 0

  const topLevelSystem = stringifyContent(raw.system ?? '').trim()
  if (topLevelSystem) {
    injectedItems.push(
      createItem(-1, partCounter++, 'system', 'system', topLevelSystem, 'Top-level system prompt'),
    )
  }

  raw.messages.forEach((message, messageIndex) => {
    const pushTextItem = (text: string, kind: RequestItemKind) => {
      if (message.role === 'assistant') {
        assistantHistory.push(
          createItem(
            messageIndex,
            partCounter++,
            message.role,
            kind,
            text,
            kind === 'thinking' ? 'Thinking' : 'Assistant text',
          ),
        )
        return
      }

      if (kind === 'tool_result') {
        toolTrace.push(createItem(messageIndex, partCounter++, message.role, kind, text, 'Tool result'))
        return
      }

      if (kind === 'system' || isInjectedText(text)) {
        injectedItems.push(
          createItem(messageIndex, partCounter++, message.role, 'system', text, 'Injected prompt'),
        )
        return
      }

      currentInputCandidates.push(
        createItem(messageIndex, partCounter++, message.role, 'text', text, 'User text'),
      )
    }

    if (typeof message.content === 'string') {
      pushTextItem(message.content, 'text')
      return
    }

    if (!Array.isArray(message.content)) {
      pushTextItem(stringifyContent(message.content), 'text')
      return
    }

    message.content.forEach((entry) => {
      if (typeof entry === 'string') {
        pushTextItem(entry, 'text')
        return
      }

      if (typeof entry !== 'object' || entry === null) {
        pushTextItem(String(entry), 'text')
        return
      }

      const record = entry as Record<string, unknown>
      const type = typeof record.type === 'string' ? record.type : 'text'

      if (type === 'thinking') {
        pushTextItem(typeof record.thinking === 'string' ? record.thinking : stringifyContent(record), 'thinking')
        return
      }

      if (type === 'tool_use') {
        toolTrace.push(
          createItem(messageIndex, partCounter++, message.role, 'tool_use', getToolText(record), 'Tool use'),
        )
        return
      }

      if (type === 'tool_result') {
        pushTextItem(getToolText(record), 'tool_result')
        return
      }

      const text = typeof record.text === 'string' ? record.text : stringifyContent(record)
      pushTextItem(text, type === 'system' ? 'system' : 'text')
    })
  })

  const currentInput = currentInputCandidates.slice(-1)
  currentInputCandidates.slice(0, -1).forEach((item) => historyConversation.push(item))

  const injectionMap = new Map<string, InjectedPromptGroup>()
  injectedItems.forEach((item) => {
    const groupMeta = classifyInjectedPrompt(item)
    const existing = injectionMap.get(groupMeta.id)
    if (existing) {
      existing.count += 1
      existing.items.push(item)
      return
    }

    injectionMap.set(groupMeta.id, {
      id: groupMeta.id,
      title: groupMeta.title,
      preview: '',
      count: 1,
      items: [item],
    })
  })

  const injectedPromptGroups = [...injectionMap.values()].map((group) => ({
    ...group,
    preview: summarizeInjectedPromptGroup(group),
  }))

  return {
    summary: {
      currentInputCount: currentInput.length,
      historyConversationCount: historyConversation.length,
      injectedGroupCount: injectionMap.size,
      assistantHistoryCount: assistantHistory.length,
      toolTraceCount: toolTrace.length,
    },
    currentInput,
    historyConversation,
    assistantHistory,
    toolTrace,
    injectedPromptGroups,
    requestEnvelope: {
      model: raw.model,
      stream: !!raw.stream,
      maxTokens: raw.max_tokens ?? null,
      messageCount: raw.messages.length,
      toolCount: raw.tools?.length ?? 0,
    },
  }
}

function getStatsSummary(breakdown: RequestBreakdown) {
  return `Current input ${breakdown.summary.currentInputCount}, history ${breakdown.summary.historyConversationCount}, injected prompt groups ${breakdown.summary.injectedGroupCount}, assistant items ${breakdown.summary.assistantHistoryCount}, tool events ${breakdown.summary.toolTraceCount}.`
}

function adaptRawAgentRequest(raw: z.infer<typeof rawAgentRequestSchema>): TraceDocument {
  const assistantTurnCount = raw.messages.filter((message) => message.role === 'assistant').length
  const userTurnCount = raw.messages.filter((message) => message.role === 'user').length
  const breakdown = getRequestBreakdown(raw)

  return {
    meta: {
      requestType: 'raw-agent-request',
      messageCount: raw.messages.length,
      toolCount: raw.tools?.length ?? 0,
      requestBreakdown: breakdown,
      ...raw.metadata,
    },
    summary: {
      title: `${raw.model} request with ${raw.messages.length} conversation messages`,
      subtitle: `Adapted from a raw agent request body with ${userTurnCount} user turns and ${assistantTurnCount} assistant turns.`,
    },
    metrics: {
      model: raw.model,
      latencyMs: 0,
      usage: {
        totalTokens: raw.max_tokens ?? 0,
      },
      outcome: 'Request payload only; response payload not included',
    },
    stages: [
      {
        id: 'agent-context',
        lane: 'agent',
        title: 'Context assembled',
        summary: getStatsSummary(breakdown),
        status: 'ok',
        panels: normalizePanels([
          {
            label: 'Explain',
            kind: 'markdown',
            content: `# Request composition\n\n- Model: \`${raw.model}\`\n- Messages: ${raw.messages.length}\n- Tools advertised: ${raw.tools?.length ?? 0}\n- Streaming enabled: ${raw.stream ? 'yes' : 'no'}\n\nUse the request structure page to separate current input, history, injected prompts, assistant history, and tool traffic.`,
          },
          {
            label: 'Request structure summary',
            kind: 'json',
            content: breakdown.summary,
          },
          {
            label: 'Request envelope',
            kind: 'json',
            content: breakdown.requestEnvelope,
          },
        ]),
      },
      {
        id: 'http-request',
        lane: 'http',
        title: 'HTTP payload ready',
        summary: 'The raw request envelope is preserved so the transport configuration can still be inspected.',
        status: 'warning',
        panels: normalizePanels([
          {
            label: 'Explain',
            kind: 'markdown',
            content:
              'This sample contains the outbound request body. Transport headers and endpoint metadata are not included, so the page emphasizes the request envelope itself.',
          },
          {
            label: 'Request body',
            kind: 'json',
            content: {
              model: raw.model,
              max_tokens: raw.max_tokens,
              stream: raw.stream,
              thinking: raw.thinking,
              output_config: raw.output_config,
              metadata: raw.metadata,
            },
          },
          {
            label: 'Tools',
            kind: 'json',
            content: raw.tools ?? [],
          },
        ]),
      },
      {
        id: 'llm-response',
        lane: 'llm',
        title: 'Response missing',
        summary: 'The uploaded document does not include the actual model response, so the final lane is rendered as absent evidence.',
        status: 'missing',
        panels: normalizePanels([
          {
            label: 'Explain',
            kind: 'markdown',
            content:
              'No response payload was captured in this file. The visualization keeps the LLM lane visible to show that the trace is incomplete rather than silently pretending the request succeeded.',
          },
          {
            label: 'Raw request snapshot',
            kind: 'code',
            language: 'json',
            content: JSON.stringify(
              {
                model: raw.model,
                messageCount: raw.messages.length,
                requestBreakdown: breakdown.summary,
              },
              null,
              2,
            ),
          },
        ]),
      },
    ],
    raw,
  }
}

export function parseTraceDocument(value: unknown): TraceParseResult {
  const rawRequest = rawAgentRequestSchema.safeParse(value)
  if (rawRequest.success) {
    return {
      ok: true,
      data: adaptRawAgentRequest(rawRequest.data),
    }
  }

  const result = traceDocumentSchema.safeParse(value)
  if (!result.success) {
    const missingSummaryOrMetrics = result.error.issues.some(
      (issue) =>
        issue.path[0] === 'summary' ||
        issue.path[0] === 'metrics' ||
        issue.path.includes('summary') ||
        issue.path.includes('metrics'),
    )

    return {
      ok: false,
      message: missingSummaryOrMetrics
        ? 'Trace schema is incomplete. Missing required fields for summary or metrics.'
        : 'Trace schema is invalid. Check the required fields and try again.',
      issues: result.error.issues.map((issue) => issue.message),
    }
  }

  return {
    ok: true,
    data: {
      ...result.data,
      meta: result.data.meta as TraceMeta,
      stages: result.data.stages.map((stage) => ({
        ...stage,
        panels: normalizePanels(stage.panels),
      })),
    },
  }
}
