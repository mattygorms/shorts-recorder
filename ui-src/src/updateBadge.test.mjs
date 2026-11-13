import { strict as assert } from 'node:assert'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { updateView } from './updateBadge.js'

const up = updateView('3.3.2', '3.3.1', false)
assert.equal(up.hasUpdate, true)
assert.equal(up.badgeText, 'Update 3.3.2')
assert.equal(up.versionText, 'v3.3.1')
assert.equal(up.title, 'Update available: v3.3.2 — click to install')

const idle = updateView(null, '3.3.2', false)
assert.equal(idle.hasUpdate, false)
assert.equal(idle.versionText, 'v3.3.2')
assert.equal(idle.title, 'Check for updates')

const err = updateView(null, '3.3.2', true)
assert.equal(err.hasUpdate, false)
assert.equal(err.title, 'Couldn’t check for updates')

assert.equal(updateView('', '3.3.2', false).hasUpdate, false)
assert.equal(updateView(undefined, '3.3.2', false).hasUpdate, false)

// Render check: when an update is available, the badge text is in the markup
// and the current version label is not shown.
function UpdateStatus({ latest, version, error }) {
  const v = updateView(latest, version, error)
  return h('button', { id: 'updBtn', title: v.title },
    v.hasUpdate
      ? h('span', { id: 'badge' }, v.badgeText)
      : h('span', { id: 'ver' }, v.versionText)
  )
}

const withUpdate = renderToStaticMarkup(h(UpdateStatus, { latest: '3.3.2', version: '3.3.1', error: false }))
assert.match(withUpdate, />Update 3.3.2</)
assert.match(withUpdate, /id="badge"/)
assert.doesNotMatch(withUpdate, /v3.3.1/)
assert.match(withUpdate, /Update available: v3.3.2/)

const current = renderToStaticMarkup(h(UpdateStatus, { latest: null, version: '3.3.2', error: false }))
assert.match(current, />v3.3.2</)
assert.match(current, /id="ver"/)
assert.doesNotMatch(current, /Update 3\.3/)

console.log('updateBadge tests passed')
