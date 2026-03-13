import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { ValueRenderer } from './components/ValueRenderer'
import { exampleTrace } from './data/exampleTrace'
import {
  type RequestBreakdown,
  type TraceDocument,
  type TraceStage,
  parseTraceDocument,
} from './lib/traceDocument'

type NoticeTone = 'idle' | 'success' | 'error'
type Locale = 'zh' | 'en'
type AppRoute = 'overview' | 'request-structure'

type Notice = {
  tone: NoticeTone
  message: string
}

const laneOrder = ['agent', 'http', 'llm'] as const

const uiText = {
  zh: {
    brand: 'Agent Trace Studio',
    title: '一次请求，三条泳道，读懂一段 LLM 交互。',
    hero:
      '上传固定 schema 的 JSON，查看 agent 如何组织上下文、发起 HTTP 请求，以及如何接收和解释 LLM 返回。',
    upload: '上传 Trace JSON',
    loadExample: '加载示例',
    localeLabel: '界面语言',
    summaryEyebrow: '叙事摘要',
    metrics: {
      model: '模型',
      latency: '延迟',
      usage: '用量',
      outcome: '结果',
    },
    laneHeaders: {
      agent: '上下文与意图',
      http: '传输层',
      llm: '模型输出',
    },
    noticeIdle: '上传结构化 trace JSON，或加载示例来查看一次请求/响应流程。',
    noticeLoadedExample: '已加载内置示例 trace。',
    noticeLoadedFile: (name: string) => `已成功加载 ${name}。`,
    noticeParseError: 'JSON 解析失败，请检查文件格式后重试。',
    noticeSchemaIncomplete: 'Trace schema 不完整，缺少 summary 或 metrics 所需字段。',
    noticeSchemaInvalid: 'Trace schema 无效，请检查必填字段后重试。',
    schemaNote: '必需字段：',
    stageBoard: 'Trace 舞台',
    viewRequestStructure: '查看请求结构',
    requestStructureTitle: '请求结构',
    backToOverview: '返回总览',
    requestSummary: '本次请求摘要',
    currentInput: '当前输入',
    historyConversation: '历史对话',
    injectedPrompts: '系统注入',
    assistantHistory: 'Assistant 历史输出',
    toolTrace: '工具轨迹',
    finalEnvelope: '最终请求载荷',
    repeated: '重复',
    showItems: '展开条目',
    hideItems: '收起条目',
    statusLabel: {
      ok: '正常',
      warning: '注意',
      error: '错误',
      missing: '缺失',
    },
    emptyEyebrow: '等待导入',
    emptyTitle: '导入一份 trace 文档后，这里会生成可读的对话舞台。',
    emptyBody:
      '页面会保持语义阶段可读，并保留 Markdown、代码和原始 payload 的结构化展示。',
    rawInspector: '原始 JSON 检查器',
    summaryLabels: {
      current: '当前',
      history: '历史',
      injected: '注入分组',
      assistant: 'assistant',
      tools: '工具',
    },
  },
  en: {
    brand: 'Agent Trace Studio',
    title: 'One request. Three lanes. A readable LLM story.',
    hero:
      'Upload a fixed-schema JSON document and inspect how an agent assembled context, sent the HTTP request, and interpreted the LLM response.',
    upload: 'Upload trace JSON',
    loadExample: 'Load example trace',
    localeLabel: 'Interface language',
    summaryEyebrow: 'Narrative summary',
    metrics: {
      model: 'Model',
      latency: 'Latency',
      usage: 'Usage',
      outcome: 'Outcome',
    },
    laneHeaders: {
      agent: 'Context & intent',
      http: 'Transport',
      llm: 'Model output',
    },
    noticeIdle:
      'Upload a structured trace JSON or load the example to inspect one request/response cycle.',
    noticeLoadedExample: 'Loaded the built-in example trace.',
    noticeLoadedFile: (name: string) => `Loaded ${name} successfully.`,
    noticeParseError: 'Could not parse JSON. Check the file syntax and try again.',
    noticeSchemaIncomplete:
      'Trace schema is incomplete. Missing required fields for summary or metrics.',
    noticeSchemaInvalid: 'Trace schema is invalid. Check the required fields and try again.',
    schemaNote: 'Required blocks:',
    stageBoard: 'Trace stage board',
    viewRequestStructure: 'View request structure',
    requestStructureTitle: 'Request structure',
    backToOverview: 'Back to overview',
    requestSummary: 'Request summary',
    currentInput: 'Current input',
    historyConversation: 'History conversation',
    injectedPrompts: 'Injected prompts',
    assistantHistory: 'Assistant history',
    toolTrace: 'Tool trace',
    finalEnvelope: 'Final request envelope',
    repeated: 'Repeated',
    showItems: 'Show items',
    hideItems: 'Hide items',
    statusLabel: {
      ok: 'ok',
      warning: 'warning',
      error: 'error',
      missing: 'missing',
    },
    emptyEyebrow: 'Ready for import',
    emptyTitle: 'Bring in one trace document to populate the board.',
    emptyBody:
      'The page will keep semantic stages readable, preserve Markdown formatting, and let you inspect raw payloads only when you need them.',
    rawInspector: 'Raw JSON inspector',
    summaryLabels: {
      current: 'Current',
      history: 'History',
      injected: 'Injected groups',
      assistant: 'Assistant',
      tools: 'Tools',
    },
  },
} as const

function getRouteFromHash(): AppRoute {
  return window.location.hash === '#/request-structure' ? 'request-structure' : 'overview'
}

function formatLatency(latencyMs: number) {
  return `${new Intl.NumberFormat('en-US').format(latencyMs)} ms`
}

function formatUsage(totalTokens: number) {
  return `${new Intl.NumberFormat('en-US').format(totalTokens)} tokens`
}

function useLaneGroups(trace: TraceDocument | null) {
  return useMemo(() => {
    if (!trace) {
      return {}
    }

    return laneOrder.reduce<Record<string, TraceStage[]>>((accumulator, lane) => {
      accumulator[lane] = trace.stages.filter((stage) => stage.lane === lane)
      return accumulator
    }, {})
  }, [trace])
}

function BreakdownSection({
  title,
  items,
}: {
  title: string
  items: Array<{ id: string; title: string; text: string; kind?: string }>
}) {
  return (
    <section aria-label={title} className="breakdown-section">
      <div className="breakdown-section__header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      <div className="breakdown-list">
        {items.map((item) => (
          <article className="breakdown-item" key={item.id}>
            <div className="breakdown-item__header">
              <strong>{item.title}</strong>
              {item.kind ? <span>{item.kind}</span> : null}
            </div>
            <pre>{item.text}</pre>
          </article>
        ))}
      </div>
    </section>
  )
}

function RequestStructurePage({
  breakdown,
  locale,
  onBack,
}: {
  breakdown: RequestBreakdown
  locale: Locale
  onBack: () => void
}) {
  const copy = uiText[locale]
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  return (
    <main className="request-page">
      <div className="request-page__header">
        <div>
          <p className="eyebrow">{copy.requestSummary}</p>
          <h2>{copy.requestStructureTitle}</h2>
        </div>
        <button className="secondary-button" onClick={onBack} type="button">
          {copy.backToOverview}
        </button>
      </div>

      <section aria-label={copy.requestSummary} className="request-summary-grid">
        <article className="metric-card">
          <span>{copy.summaryLabels.current}</span>
          <strong>{breakdown.summary.currentInputCount}</strong>
        </article>
        <article className="metric-card">
          <span>{copy.summaryLabels.history}</span>
          <strong>{breakdown.summary.historyConversationCount}</strong>
        </article>
        <article className="metric-card">
          <span>{copy.summaryLabels.injected}</span>
          <strong>{breakdown.summary.injectedGroupCount}</strong>
        </article>
        <article className="metric-card">
          <span>{copy.summaryLabels.assistant}</span>
          <strong>{breakdown.summary.assistantHistoryCount}</strong>
        </article>
        <article className="metric-card">
          <span>{copy.summaryLabels.tools}</span>
          <strong>{breakdown.summary.toolTraceCount}</strong>
        </article>
      </section>

      <div className="request-page__content">
        <BreakdownSection items={breakdown.currentInput} title={copy.currentInput} />
        <BreakdownSection items={breakdown.historyConversation} title={copy.historyConversation} />

        <section aria-label={copy.injectedPrompts} className="breakdown-section">
          <div className="breakdown-section__header">
            <h3>{copy.injectedPrompts}</h3>
            <span>{breakdown.injectedPromptGroups.length}</span>
          </div>
          <div className="breakdown-list">
            {breakdown.injectedPromptGroups.map((group) => {
              const isExpanded = expandedGroups.includes(group.id)

              return (
                <article className="breakdown-item" key={group.id}>
                  <div className="breakdown-item__header">
                    <div>
                      <strong>{group.title}</strong>
                      <span className="group-meta">
                        {copy.repeated} {group.count}x
                      </span>
                    </div>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        setExpandedGroups((current) =>
                          current.includes(group.id)
                            ? current.filter((id) => id !== group.id)
                            : [...current, group.id],
                        )
                      }
                      type="button"
                    >
                      {isExpanded ? copy.hideItems : copy.showItems}
                    </button>
                  </div>
                  <p className="group-preview">{group.preview}</p>
                  {isExpanded ? (
                    <div className="breakdown-sublist">
                      {group.items.map((item) => (
                        <pre key={item.id}>{item.text}</pre>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>

        <BreakdownSection items={breakdown.assistantHistory} title={copy.assistantHistory} />
        <BreakdownSection items={breakdown.toolTrace} title={copy.toolTrace} />
        <section aria-label={copy.finalEnvelope} className="breakdown-section">
          <div className="breakdown-section__header">
            <h3>{copy.finalEnvelope}</h3>
          </div>
          <ValueRenderer
            panel={{
              label: copy.finalEnvelope,
              kind: 'json',
              content: breakdown.requestEnvelope,
            }}
          />
        </section>
      </div>
    </main>
  )
}

function App() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [trace, setTrace] = useState<TraceDocument | null>(null)
  const [route, setRoute] = useState<AppRoute>(getRouteFromHash())
  const [notice, setNotice] = useState<Notice>({
    tone: 'idle',
    message: uiText.zh.noticeIdle,
  })
  const copy = uiText[locale]
  const laneGroups = useLaneGroups(trace)
  const requestBreakdown = trace?.meta.requestBreakdown

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (route === 'request-structure' && !requestBreakdown) {
      window.location.hash = '#/'
      setRoute('overview')
    }
  }, [requestBreakdown, route])

  function navigate(nextRoute: AppRoute) {
    window.location.hash = nextRoute === 'request-structure' ? '#/request-structure' : '#/'
    setRoute(nextRoute)
  }

  function localizeParseError(message: string) {
    if (message.includes('summary or metrics')) {
      return copy.noticeSchemaIncomplete
    }

    return copy.noticeSchemaInvalid
  }

  function loadTrace(nextTrace: TraceDocument, nextNotice: Notice) {
    setTrace(nextTrace)
    setNotice(nextNotice)
    navigate('overview')
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const result = parseTraceDocument(parsed)

      if (!result.ok) {
        setTrace(null)
        setNotice({
          tone: 'error',
          message: localizeParseError(result.message),
        })
        return
      }

      loadTrace(result.data, {
        tone: 'success',
        message: copy.noticeLoadedFile(file.name),
      })
    } catch {
      setTrace(null)
      setNotice({
        tone: 'error',
        message: copy.noticeParseError,
      })
    } finally {
      event.target.value = ''
    }
  }

  function handleLoadExample() {
    loadTrace(exampleTrace, {
      tone: 'success',
      message: copy.noticeLoadedExample,
    })
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{copy.brand}</p>
          <h1>{copy.title}</h1>
          <p className="hero-text">{copy.hero}</p>
        </div>

        <div className="upload-card">
          <div className="toolbar-row">
            <div className="upload-actions">
              <label className="upload-button" htmlFor="trace-upload">
                {copy.upload}
              </label>
              <input
                id="trace-upload"
                type="file"
                accept="application/json,.json"
                onChange={handleUpload}
              />
              <button className="secondary-button" onClick={handleLoadExample} type="button">
                {copy.loadExample}
              </button>
            </div>

            <div className="locale-box">
              <span className="locale-caption">{copy.localeLabel}</span>
              <div aria-label={copy.localeLabel} className="locale-switch" role="group">
                <button
                  aria-pressed={locale === 'zh'}
                  className={`locale-button ${locale === 'zh' ? 'locale-button--active' : ''}`}
                  onClick={() => {
                    setLocale('zh')
                    setNotice((current) =>
                      current.tone === 'idle' ? { ...current, message: uiText.zh.noticeIdle } : current,
                    )
                  }}
                  type="button"
                >
                  中文
                </button>
                <button
                  aria-pressed={locale === 'en'}
                  className={`locale-button ${locale === 'en' ? 'locale-button--active' : ''}`}
                  onClick={() => {
                    setLocale('en')
                    setNotice((current) =>
                      current.tone === 'idle' ? { ...current, message: uiText.en.noticeIdle } : current,
                    )
                  }}
                  type="button"
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <p className={`status-pill status-pill--${notice.tone}`}>{notice.message}</p>
          <p className="schema-note">
            {copy.schemaNote} <code>meta</code>, <code>summary</code>, <code>stages</code>,{' '}
            <code>metrics</code>.
          </p>
        </div>
      </header>

      {route === 'request-structure' && requestBreakdown ? (
        <RequestStructurePage breakdown={requestBreakdown} locale={locale} onBack={() => navigate('overview')} />
      ) : trace ? (
        <>
          <section aria-label="Trace summary" className="summary-strip">
            <div className="summary-headline">
              <p className="eyebrow">{copy.summaryEyebrow}</p>
              <h2>{trace.summary.title}</h2>
              {trace.summary.subtitle ? <p>{trace.summary.subtitle}</p> : null}
            </div>

            <div className="metric-grid">
              <article className="metric-card">
                <span>{copy.metrics.model}</span>
                <strong>{trace.metrics.model}</strong>
              </article>
              <article className="metric-card">
                <span>{copy.metrics.latency}</span>
                <strong>{formatLatency(trace.metrics.latencyMs)}</strong>
              </article>
              <article className="metric-card">
                <span>{copy.metrics.usage}</span>
                <strong>{formatUsage(trace.metrics.usage.totalTokens)}</strong>
              </article>
              <article className="metric-card">
                <span>{copy.metrics.outcome}</span>
                <strong>{trace.metrics.outcome}</strong>
              </article>
            </div>
          </section>

          <main className="workspace-main">
            {requestBreakdown ? (
              <section aria-label={copy.requestSummary} className="structure-callout">
                <div className="structure-callout__stats">
                  <span>
                    {copy.summaryLabels.current}: {requestBreakdown.summary.currentInputCount}
                  </span>
                  <span>
                    {copy.summaryLabels.history}: {requestBreakdown.summary.historyConversationCount}
                  </span>
                  <span>
                    {copy.summaryLabels.injected}: {requestBreakdown.summary.injectedGroupCount}
                  </span>
                  <span>
                    {copy.summaryLabels.assistant}: {requestBreakdown.summary.assistantHistoryCount}
                  </span>
                  <span>
                    {copy.summaryLabels.tools}: {requestBreakdown.summary.toolTraceCount}
                  </span>
                </div>
                <button className="secondary-button" onClick={() => navigate('request-structure')} type="button">
                  {copy.viewRequestStructure}
                </button>
              </section>
            ) : null}

            <section aria-label={copy.stageBoard} className="trace-board">
              {laneOrder.map((lane) => (
                <section className={`lane lane--${lane}`} key={lane}>
                  <div className="lane-header">
                    <p className="eyebrow">{lane.toUpperCase()}</p>
                    <h3>{copy.laneHeaders[lane]}</h3>
                  </div>

                  <div className="lane-stack">
                    {laneGroups[lane]?.map((stage) => (
                      <article className={`stage-card stage-card--${stage.status}`} key={stage.id}>
                        <div className="stage-card__top">
                          <span>{stage.title}</span>
                          <span className="stage-badge">{copy.statusLabel[stage.status]}</span>
                        </div>
                        <p>{stage.summary}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          </main>

          <section aria-label={copy.rawInspector} className="raw-inspector">
            <details>
              <summary>{copy.rawInspector}</summary>
              <ValueRenderer
                panel={{
                  label: 'Raw',
                  kind: 'json',
                  content: trace.raw ?? trace,
                }}
              />
            </details>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <div className="empty-state__card">
            <p className="eyebrow">{copy.emptyEyebrow}</p>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyBody}</p>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
