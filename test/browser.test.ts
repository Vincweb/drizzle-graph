import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pageOrigin } from '../src/server/browser'

test('the printed URL is one a browser can visit', () => {
  assert.equal(pageOrigin('127.0.0.1', 4600), 'http://127.0.0.1:4600')
  // A wildcard bind is where to listen, not where to go.
  assert.equal(pageOrigin('0.0.0.0', 4600), 'http://localhost:4600')
  assert.equal(pageOrigin('::', 4600), 'http://localhost:4600')
  assert.equal(pageOrigin('::1', 4600), 'http://[::1]:4600')
})
