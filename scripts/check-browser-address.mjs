import assert from 'node:assert/strict'
import { browserURL, resolveBrowserAddress } from '../src/main/browserAddress.ts'
for (const query of ['google', 'weather in Paris', 'how to use Slack', 'C++ tutorials', 'café & croissant', 'hello@example.com']) {
  assert.equal(resolveBrowserAddress(query), `https://www.google.com/search?q=${encodeURIComponent(query)}`)
}
for (const [input, expected] of [
  [' google.com ', 'https://google.com/'],
  ['www.google.com/search?q=hello', 'https://www.google.com/search?q=hello'],
  ['https://www.google.com/search?q=hello+world', 'https://www.google.com/search?q=hello+world'],
  ['localhost:9335/two', 'https://localhost:9335/two'],
  ['http://127.0.0.1:9335/one', 'http://127.0.0.1:9335/one'],
  ['[::1]:9335', 'https://[::1]:9335/'],
]) assert.equal(resolveBrowserAddress(input), expected)
for (const invalid of ['', '  ', null, 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test', 'https://user:password@example.com']) {
  assert.throws(() => resolveBrowserAddress(invalid))
}
assert.throws(() => browserURL('javascript:alert(1)'))
console.log('PASS: search terms, query encoding, URLs, local addresses, and blocked unsafe schemes.')
