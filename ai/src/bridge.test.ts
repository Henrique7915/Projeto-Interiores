import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PUBLISHED_APP_ORIGIN, originAllowed } from './bridge.ts'

describe('origens aceitas pelo bridge', () => {
  it('aceita o app local, o app publicado e chamadas sem origem', () => {
    assert.ok(originAllowed(undefined))
    assert.ok(originAllowed('http://localhost:5173'))
    assert.ok(originAllowed('http://127.0.0.1:4173'))
    assert.ok(originAllowed(PUBLISHED_APP_ORIGIN))
  })
  it('recusa outros sites', () => {
    assert.ok(!originAllowed('https://exemplo.com'))
    assert.ok(!originAllowed('https://henrique7915.github.io.exemplo.com'))
    assert.ok(!originAllowed('http://henrique7915.github.io'))
    assert.ok(!originAllowed('nao-e-url'))
  })
})
