import { strict as assert } from 'node:assert'
import {
  isLockFile, nyDay, isTodayNY, isRecentNY, parseCreatedMs, isLockedName, shouldKeep,
  parseLocks, serializeLocks, clearLock, sortVisible, canDelete, LOCK_FILE
} from './scriptFilter.js'

const NY = 'America/New_York'
// Friday Nov 13, 2026 09:40 America/New_York = 14:40 UTC
const NOW = Date.parse('2026-11-13T14:40:00Z')

function ny(s) { return Date.parse(s) }

assert.equal(isLockFile('locked.json'), true)
assert.equal(isLockFile('LOCKED.JSON'), true)
assert.equal(isLockFile('locked.json.bak'), false)
assert.equal(isLockFile('harbor-rust-fallout-mad-max-survival.txt'), false)
assert.equal(LOCK_FILE, 'locked.json')

assert.equal(nyDay(NOW), '2026-11-13')
// 11:30 PM ET on Nov 12 is Nov 13 04:30 UTC
assert.equal(nyDay(Date.parse('2026-11-13T04:30:00Z')), '2026-11-12')
assert.equal(isTodayNY(NOW, NOW), true)
assert.equal(isTodayNY(Date.parse('2026-11-13T05:00:00Z'), NOW), true) // midnight ET
assert.equal(isTodayNY(Date.parse('2026-11-13T04:30:00Z'), NOW), false) // still Nov 12 ET
assert.equal(isTodayNY(Date.parse('2026-11-12T18:00:00Z'), NOW), false)
assert.equal(isTodayNY(null, NOW), false)
assert.equal(isTodayNY(undefined, NOW), false)
assert.equal(isTodayNY(NaN, NOW), false)

// created: header without seconds, parsed as local; box is America/New_York
const created = parseCreatedMs('2026-11-13T09:32')
assert.ok(created && isTodayNY(created, NOW))
assert.equal(isTodayNY(parseCreatedMs('2026-11-12T13:17:00'), NOW), false)
assert.equal(isTodayNY(parseCreatedMs('2026-11-13'), NOW), true)
assert.equal(parseCreatedMs(''), null)
assert.equal(parseCreatedMs(null, 123), 123)
assert.equal(parseCreatedMs('not-a-date', 456), 456)

const locks = { 'trollheim-gnomes-minecraft-devs.txt': true }
assert.equal(isLockedName(locks, 'trollheim-gnomes-minecraft-devs.txt'), true)
assert.equal(isLockedName(locks, 'Trollheim-Gnomes-Minecraft-Devs.txt'), true)
assert.equal(isLockedName(locks, 'other.txt'), false)
assert.equal(isLockedName({}, 'trollheim-gnomes-minecraft-devs.txt'), false)

// today + yesterday (ET) are kept; two days back is not
assert.equal(isRecentNY(parseCreatedMs('2026-11-12T00:05:00'), NOW), true)
assert.equal(isRecentNY(parseCreatedMs('2026-11-11T23:59:00'), NOW), false)
assert.equal(isRecentNY(null, NOW), false)
assert.equal(shouldKeep({ k: 'yday.txt', created: parseCreatedMs('2026-11-12T13:17:00') }, {}, NOW), true)
assert.equal(shouldKeep({ k: 'old.txt', created: parseCreatedMs('2026-11-11T13:17:00') }, {}, NOW), false)
assert.equal(shouldKeep({ k: 'old.txt', created: parseCreatedMs('2026-11-12T13:17:00') }, { 'old.txt': true }, NOW), true)
assert.equal(shouldKeep({ k: 'today.txt', created: parseCreatedMs('2026-11-13T09:32:00') }, {}, NOW), true)
assert.equal(shouldKeep({ k: 'nodate.txt', created: null }, {}, NOW), false)
assert.equal(shouldKeep({ k: 'OLD.TXT', created: parseCreatedMs('2026-11-10T05:00:00') }, { 'old.txt': true }, NOW), true)

assert.deepEqual(parseLocks('{"a.txt":true,"b.txt":false}'), { 'a.txt': true })
assert.deepEqual(parseLocks('["x.txt","locked.json"]'), { 'x.txt': true })
assert.deepEqual(parseLocks('{"locks":{"y.txt":true}}'), { 'y.txt': true })
assert.deepEqual(parseLocks('not json'), {})
assert.deepEqual(parseLocks(''), {})
assert.equal(serializeLocks({ 'b.txt': true, 'a.txt': true, 'locked.json': true, 'c.txt': false }),
  '{\n  "a.txt": true,\n  "b.txt": true\n}\n')
assert.deepEqual(clearLock({ 'Old.txt': true, 'keep.txt': true }, 'old.txt'), { 'keep.txt': true })

const sorted = sortVisible([
  { k: 'today-older.txt', created: 100, locked: false },
  { k: 'locked-older.txt', created: 50, locked: true },
  { k: 'today-newer.txt', created: 200, locked: false },
  { k: 'locked-newer.txt', created: 80, locked: true },
])
assert.deepEqual(sorted.map((r) => r.k), [
  'locked-newer.txt',
  'locked-older.txt',
  'today-newer.txt',
  'today-older.txt',
])

// Simulate a loadList pass: drop unlocked older rows, mark locks, sort.
function visible(rows, lockMap, now) {
  return sortVisible(
    rows
      .filter((r) => !isLockFile(r.k) && shouldKeep(r, lockMap, now))
      .map((r) => ({ ...r, locked: isLockedName(lockMap, r.k) }))
  )
}
const all = [
  { k: 'locked.json', created: NOW },
  { k: 'harbor-rust-fallout-mad-max-survival.txt', created: parseCreatedMs('2026-11-13T09:32:00') },
  { k: 'trollheim-gnomes-minecraft-devs.txt', created: parseCreatedMs('2026-11-12T13:18:00') },
  { k: 'stormforge-tornadoes-hunt-you.txt', created: parseCreatedMs('2026-11-11T09:26:30') },
  { k: 'growtopia-leaving-steam-december-1.txt', created: parseCreatedMs('2026-11-11T05:50:00') },
]
const vis = visible(all, {
  'trollheim-gnomes-minecraft-devs.txt': true,
  'stormforge-tornadoes-hunt-you.txt': true,
}, NOW)
assert.deepEqual(vis.map((r) => r.k), [
  'trollheim-gnomes-minecraft-devs.txt',
  'stormforge-tornadoes-hunt-you.txt',
  'harbor-rust-fallout-mad-max-survival.txt',
])
assert.equal(vis.every((r) => r.k !== 'locked.json' && r.k !== 'growtopia-leaving-steam-december-1.txt'), true)
assert.equal(vis[0].locked && vis[1].locked && !vis[2].locked, true)

// Files that would be wiped
const wiped = all.filter((r) => !isLockFile(r.k) && !shouldKeep(r, {
  'trollheim-gnomes-minecraft-devs.txt': true,
  'stormforge-tornadoes-hunt-you.txt': true,
}, NOW)).map((r) => r.k)
assert.deepEqual(wiped, ['growtopia-leaving-steam-december-1.txt'])


assert.equal(canDelete({ 'a.txt': true }, 'a.txt'), false)
assert.equal(canDelete({ 'a.txt': true }, 'A.TXT'), false)
assert.equal(canDelete({ 'a.txt': true }, 'b.txt'), true)
assert.equal(canDelete({}, 'a.txt'), true)
assert.equal(canDelete({ 'a.txt': true }, ''), false)
assert.equal(canDelete({ 'a.txt': true }, null), false)
assert.equal(canDelete(null, 'a.txt'), true)

console.log('scriptFilter tests passed')
