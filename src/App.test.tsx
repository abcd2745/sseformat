import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import App from './App'

const demoPayload = readFileSync('docs/demo.json', 'utf8')

describe('App', () => {
  test('keeps chinese chrome by default and switches only interface text to english', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/^EN$/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^EN$/ }))

    expect(screen.getByText(/upload trace json/i)).toBeInTheDocument()
    expect(screen.getByText(/interface language/i)).toBeInTheDocument()
  })

  test('shows structure stats for a raw request and navigates to a dedicated request details page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^EN$/ }))
    await user.upload(
      screen.getByLabelText(/upload trace json/i),
      new File([demoPayload], 'demo.json', { type: 'application/json' }),
    )

    const summaryCallout = screen.getByRole('region', { name: /request summary/i })
    expect(within(summaryCallout).getByText(/current:/i)).toBeInTheDocument()
    expect(within(summaryCallout).getByText(/injected groups:/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view request structure/i }))

    expect(screen.getByRole('heading', { name: /request structure/i })).toBeInTheDocument()
    expect(screen.getByText(/current input/i)).toBeInTheDocument()
    expect(screen.getByText(/assistant history/i)).toBeInTheDocument()
    expect(screen.getByText(/tool trace/i)).toBeInTheDocument()
    expect(screen.getByText(/injected prompts/i)).toBeInTheDocument()
  })

  test('assigns semantic section classes to request structure blocks for themed backgrounds', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^EN$/ }))
    await user.upload(
      screen.getByLabelText(/upload trace json/i),
      new File([demoPayload], 'demo.json', { type: 'application/json' }),
    )
    await user.click(screen.getByRole('button', { name: /view request structure/i }))

    expect(screen.getByRole('region', { name: /current input/i })).toHaveClass(
      'breakdown-section--current-input',
    )
    expect(screen.getByRole('region', { name: /history conversation/i })).toHaveClass(
      'breakdown-section--history-conversation',
    )
    expect(screen.getByRole('region', { name: /injected prompts/i })).toHaveClass(
      'breakdown-section--injected-prompts',
    )
    expect(screen.getByRole('region', { name: /assistant history/i })).toHaveClass(
      'breakdown-section--assistant-history',
    )
    expect(screen.getByRole('region', { name: /tool trace/i })).toHaveClass(
      'breakdown-section--tool-trace',
    )
    expect(screen.getByRole('region', { name: /final request envelope/i })).toHaveClass(
      'breakdown-section--final-envelope',
    )
    expect(screen.getByRole('main').querySelector('.request-page__content')).toHaveClass(
      'request-page__content--stacked',
    )
  })

  test('splits assistant content and keeps repeated injections collapsed by default', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^EN$/ }))
    await user.upload(
      screen.getByLabelText(/upload trace json/i),
      new File([demoPayload], 'demo.json', { type: 'application/json' }),
    )
    await user.click(screen.getByRole('button', { name: /view request structure/i }))

    const page = screen.getByRole('main')
    const assistantSection = within(page).getByRole('region', { name: /assistant history/i })
    expect(within(assistantSection).getAllByText(/text/i).length).toBeGreaterThan(0)
    expect(within(assistantSection).getAllByText(/thinking/i).length).toBeGreaterThan(0)

    const injectedSection = within(page).getByRole('region', { name: /injected prompts/i })
    expect(within(injectedSection).getAllByText(/repeated/i).length).toBeGreaterThan(0)
    expect(within(injectedSection).queryByText(/The following skills are available/i)).not.toBeInTheDocument()

    const skillsGroup = within(injectedSection).getAllByText(/^skills reminder$/i)[0]?.closest('article')
    expect(skillsGroup).not.toBeNull()
    if (!skillsGroup) {
      throw new Error('Expected injected prompt group for skills reminder')
    }

    await user.click(within(skillsGroup).getByRole('button', { name: /show items/i }))

    expect(within(injectedSection).getByText(/The following skills are available/i)).toBeInTheDocument()
  })

  test('returns from request details to the overview page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^EN$/ }))
    await user.upload(
      screen.getByLabelText(/upload trace json/i),
      new File([demoPayload], 'demo.json', { type: 'application/json' }),
    )
    await user.click(screen.getByRole('button', { name: /view request structure/i }))
    await user.click(screen.getByRole('button', { name: /back to overview/i }))

    expect(screen.getByRole('region', { name: /request summary/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /request structure/i })).not.toBeInTheDocument()
  })

  test('reports friendly validation and parsing errors in the active interface language', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^EN$/ }))

    const invalidFile = new File(['{'], 'broken-trace.json', {
      type: 'application/json',
    })

    await user.upload(screen.getByLabelText(/upload trace json/i), invalidFile)

    expect(
      await screen.findByText(/could not parse json\. check the file syntax and try again\./i),
    ).toBeInTheDocument()
  })
})
