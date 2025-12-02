import { describe, it, expect } from 'vitest'
import { getT, DEFAULT_LOCALE } from './translations'

describe('i18n getT', () => {
  it('returns projects meta for default locale', () => {
    const t = getT(DEFAULT_LOCALE)
    const meta = t('projects.meta') as any
    expect(meta?.title).toBeDefined()
    expect(typeof meta?.title).toBe('string')
  })

  it('returns books meta for default locale', () => {
    const t = getT(DEFAULT_LOCALE)
    const meta = t('books.meta') as any
    expect(meta?.description).toBeDefined()
    expect(typeof meta?.description).toBe('string')
  })

  it('returns reading meta for default locale', () => {
    const t = getT(DEFAULT_LOCALE)
    const meta = t('reading.meta') as any
    expect(meta?.title).toBeDefined()
    expect(typeof meta?.title).toBe('string')
  })
})
