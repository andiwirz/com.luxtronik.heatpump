# Vendored `luxtronik2`

Source: <https://github.com/coolchip/luxtronik2> (npm `luxtronik2`), version
**2.7.2**, MIT licensed. The upstream `LICENSE` is kept alongside the sources.

## Why it is vendored

Upstream has not published a release since 2.7.2 (2024-02-26) and the issue
tracker is unattended, but the library needs a fix that is required for the app
to work at all on some controllers (see below). Vendoring keeps that fix in the
app instead of blocking on an upstream release.

Files are copied verbatim apart from the two changes listed below, so they can
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

## Remaining upstream dependency

`utils.js` still requires `humanize-duration`, which stays a normal dependency in
the app's `package.json`.
