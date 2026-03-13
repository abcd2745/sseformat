import type { TraceDocument } from '../lib/traceDocument'

export const exampleTrace: TraceDocument = {
  meta: {
    traceId: 'trace-demo-001',
    provider: 'OpenAI',
    createdAt: '2026-03-13T09:15:00Z',
    environment: 'staging',
  },
  summary: {
    title: 'Order refund assistant checks policy and answers customer',
    subtitle: 'Single request/response trace with semantic staging.',
  },
  metrics: {
    model: 'gpt-4.1',
    latencyMs: 1820,
    usage: {
      inputTokens: 1450,
      outputTokens: 312,
      totalTokens: 1762,
    },
    outcome: 'Answered with policy-compliant guidance',
  },
  stages: [
    {
      id: 'agent-context',
      lane: 'agent',
      title: 'Context built',
      summary: 'Agent merged system policy, runtime constraints, and the customer message.',
      status: 'ok',
      panels: [
        {
          label: 'Explain',
          kind: 'markdown',
          content:
            '# Agent intent\n\n- Preserve policy language\n- Keep the response concise\n\n```txt\ncustomer asks for a refund\n```',
        },
        {
          label: 'Key fields',
          kind: 'json',
          content: {
            systemPrompt: 'Enforce the refund policy. Do not speculate.',
            userMessage: 'Can I get a refund after 40 days?',
            toolPolicy: 'No external tools required.',
          },
        },
      ],
    },
    {
      id: 'http-request',
      lane: 'http',
      title: 'Prompt sent',
      summary: 'HTTP request posted to the responses endpoint with one structured payload.',
      status: 'warning',
      panels: [
        {
          label: 'Explain',
          kind: 'markdown',
          content:
            'The application sends one compact payload to the LLM endpoint and marks the trace as noteworthy because the prompt is near the token budget.',
        },
        {
          label: 'Request body',
          kind: 'json',
          content: {
            model: 'gpt-4.1',
            input: [{ role: 'user', content: 'Can I get a refund after 40 days?' }],
            temperature: 0.2,
          },
        },
      ],
    },
    {
      id: 'llm-response',
      lane: 'llm',
      title: 'Model responded',
      summary: 'LLM produced a refusal-aware answer and stopped cleanly.',
      status: 'ok',
      panels: [
        {
          label: 'Explain',
          kind: 'markdown',
          content:
            'The model answered directly, cited the 30-day policy window, and did not attempt a tool call.',
        },
        {
          label: 'Response',
          kind: 'code',
          language: 'json',
          content: '{\n  "answer": "Refunds are allowed within 30 days."\n}',
        },
      ],
    },
  ],
  raw: {
    request: {
      url: 'https://api.openai.com/v1/responses',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    },
    response: {
      status: 200,
      finish_reason: 'stop',
    },
  },
}
