# Vendored `luxtronik2`

Source: <https://github.com/coolchip/luxtronik2> (npm `luxtronik2`), version
**2.7.2**, MIT licensed. The upstream `LICENSE` is kept alongside the sources.

## Why it is vendored

Upstream has not published a release since 2.7.2 (2024-02-26) and the issue
tracker is unattended, but the library needs a fix that is required for the app
to work at all on some controllers (see below). Vendoring keeps that fix in the
app instead of blocking on an upstream release.

Files are copied verbatim apart from the three changes listed below, so they can
still be diffed against upstream if it ever revives.

## Local changes

### 1. Reassemble responses split across TCP segments (`luxtronik.js`)

The `data` handler only appended a follow-up segment while the receive buffer was
*exactly* 4 bytes long. Controllers that send the command echo and the value
count as two separate 4-byte segments therefore reached the third segment with an
8-byte buffer, the append was skipped, and that segment was dropped.

Observed on an Alpha Innotec L1H (firmware V1.90.0), whose `3003` response
arrives as `[4, 4, 1460, 1460, 1460, 416]`. The dropped 1460-byte segment left
`remaining` permanently 1460 short of zero, so `_nextJob()` never ran and
`read()` never invoked its callback: the app hung on "Testing connection"
forever, with no error.

Every segment is now accumulated while the header is being assembled, and an
incomplete header waits for more data instead of aborting the read. The parse
gate was raised from `> 4` to `>= 8` bytes so that reading the command echo and
the `3004` status field is always in range.

### 2. `require('net')` -> `require('node:net')`

`net` was declared as a dependency, but `require('net')` always resolves to the
Node builtin, so the package was never actually loaded. Made explicit so the
phantom dependency can be dropped.

### 3. Survive controllers that report fewer parameters (`luxtronik.js`, `utils.js`)

Both parse helpers index into `heatpumpParameters` without checking its length.
Controllers that report a shorter array yield `undefined`, and because
`processParameters` runs from `process.nextTick` the resulting exception is
*uncaught* — it takes the whole Homey app down rather than surfacing as a
callback error. It also cannot be patched from outside the library: the array is
an `Int32Array`, so filling the gaps from an `onProcessParameters` hook is a
silent no-op.

Two places threw:

- `luxtronik.js`, `typeSerial`: calls `.toString()` on parameters `874` and `875`.
  Now returns `null` when either is missing. Nothing in the app reads this field.
- `utils.js`, `secondsToTimeString()`: builds a `Date` from the timer-table
  parameters (`223`..`606`) and calls `.toISOString()`, which throws
  `RangeError: Invalid time value` on an invalid date. Now returns `'00:00'`,
  the same string an explicit `0` would produce.

The second one bites far more controllers than the first, and upstream's crash at
874 masked it. Verified against a protocol-level fake controller across parameter
counts from 0 to 950: upstream throws for every count below 876, the patched copy
reads cleanly at every size.

## Remaining upstream dependency

`utils.js` still requires `humanize-duration`, which stays a normal dependency in
the app's `package.json`.
