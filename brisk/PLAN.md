# Brisk: standalone web client and rebranding plan

As of 2026-11-21. Living version: the "Brisk: standalone web client and rebranding plan" Claude Doc in the project. This file is a snapshot.

## Summary

*Revised 2026-11-21: Eric chose a web deployment with a Brisk-hosted proxy. Brisk lives on its own domain; the Mattermost server can be anywhere and needs no setting changes. Username/password login only for v1. Claude generates the brand assets. Logo direction: Breeze (concept 1), chosen for now.*

Brisk ships as a static web build plus a small proxy on Brisk's own domain that forwards API, websocket and file requests to one Mattermost server. To the browser everything is one origin, so the client runs with no connectivity code changes, keeps today's HttpOnly session cookie, and loads images and files as it does now. The rename to Brisk is still required by the license and trademark policy, and is now most of the work.

- **Proxy:** nginx (or Caddy, or an edge worker) serves Brisk's files and forwards `/api` (with websocket), `/plugins`, `/static/plugins` and `/files` to the upstream server. It rewrites the websocket `Origin` header so the server's origin check passes without config.
- **Server:** unchanged and unconfigured. Optional: set its Site URL to Brisk so emails and permalink previews point at Brisk.
- **Client changes:** branding, hidden SSO buttons, and a few Mattermost-only screens turned off.
- **Branding:** Claude draws SVG masters and a script renders every PNG size the client needs.
- **Later:** the same build can go into an Electron shell for an installed, multi-server app.

This is an engineering reading of the license files, not legal advice. Points marked **Check with counsel** are where we're least certain. Open questions are at the end.

## Deployment options compared

CORS can be avoided. Both a Brisk-owned proxy and an Electron app make the client look same-origin with the server, which removes the server settings, the token-storage risk and the image-loading risk at once. Chosen: **a small Brisk-hosted proxy for the web**, with Electron as a later wrapper around the same build.

| | Web, cross-origin | Web + Brisk-hosted proxy | Electron desktop app | Tauri desktop app |
| --- | --- | --- | --- | --- |
| How it avoids CORS | Doesn't; server must allow Brisk's origin | Proxy on Brisk's domain forwards `/api`, websocket and files to the server, so the browser sees one origin | Main process answers requests for the server's URL with Brisk's local files (`protocol.handle('https')`) and passes `/api` through with `net.fetch`, so the page runs as if served by the server | Can't intercept https in the system webview on macOS; API and images must be rerouted through Rust |
| Server settings needed | `AllowCorsFrom`, `CorsExposedHeaders`, ideally Site URL | None (optionally `TrustedProxyIPHeader` for per-user rate limits) | None | None |
| Client code changes for connectivity | Large: two URLs, token session, websocket auth, service worker, downloads | None; same as Mattermost's own dev server | None for v1 | Large: custom fetch, websocket and image layer |
| Images, files, downloads | Service worker (riskiest part) | Work as today (cookies) | Work as today (cookies) | Custom protocol rewrite of every media URL |
| Session security | Token readable by page scripts | HttpOnly cookie as today | HttpOnly cookie in the app's session; can add OS keychain | Depends on rework |
| Connect to any server | Only servers that add Brisk to CORS | One server per proxy; several needs an allowlist | Yes, user types a URL | Yes |
| SSO later | Hard | Works if the proxy forwards `/oauth` and `/login/sso` | Possible with a sign-in window | Hard |
| Reaches | Any browser, phones | Any browser, phones | Windows, macOS, Linux; users must install | Same, smaller download |
| Main costs | Most client work; spike may fail in Safari or private windows | One small always-on component (nginx, Caddy or an edge worker) on Brisk's domain | Code signing (Apple Developer ID, Windows certificate), notarisation, auto-updates, about 100 MB download, Electron upgrades every 8 weeks | WebKit differences on macOS and Linux, most new code |

Why the proxy first: it is the only web option with no server settings and no connectivity code, so effort goes into branding and UX instead. The proxy is Brisk's own component, not the Mattermost server, so the Mattermost server can live on any domain. The same build later drops into an Electron shell unchanged for users who want an installed, multi-server app.

**Uncertain:** Electron's docs show `protocol.handle('https', …)` with `net.fetch(req, {bypassCustomProtocolHandlers: true})` but don't state whether websockets are affected. They should go straight to the server with the session cookie; a one-day spike would confirm. Sources: [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol), [Electron net](https://www.electronjs.org/docs/latest/api/net).

## What the licenses allow

The whole of `webapp/` is Apache 2.0, separate from the AGPL server, so Brisk can be forked, modified and distributed. Name and logo are the binding constraint. All quotes are from the repo at commit `aa22f040` or the live trademark page.

| Source | What it says | What it means for Brisk |
| --- | --- | --- |
| `LICENSE.txt`, top section | "You are licensed to use the source code in Admin Tools and Configuration Files (server/templates/, server/i18n/, server/public/, webapp/ and all subdirectories thereof) under the Apache License v2.0." | Brisk's code is Apache 2.0. AGPL copyleft does not reach it. `webapp/channels/LICENSE.txt` is the same Apache text. |
| `LICENSE.txt`, top section | Server source is AGPL v3.0 or commercial. Mattermost will not enforce copyleft on apps that do not link the platform and only use the Apache parts. | Brisk talks to the server over HTTP and does not link it. Keep running the **unmodified** server. Patching the server would bring AGPL §13 (offer source to network users). |
| Apache 2.0 §6 Trademarks | "This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor, except as required for reasonable and customary use in describing the origin of the Work and reproducing the content of the NOTICE file." | The code license gives no right to call the product Mattermost or show its logo. Saying where the code came from is allowed. |
| `LICENSE.txt`, "Mattermost Trademark Guidelines" | "Your use of the mark Mattermost is subject to Mattermost, Inc's prior written approval" and the Trademark Standards of Use. | Any use of the name beyond describing origin needs written approval. |
| [Trademark policy](https://mattermost.com/trademark-standards-of-use/), Standards for Use, rule 2 | Marks "may not be applied to products or services provided by anyone other than Mattermost, Inc., except as authorized in writing". | Brisk cannot ship under the Mattermost name or logo. Rename is required. |
| Same, rule 14 and "Domain Names" | No trademark, trade name, logo or domain name containing the word "Mattermost", in whole or in part. | No "Brisk for Mattermost" product name and no `mattermost` in Brisk's domains. |
| Same, "Services Related to Mattermost Products" | Allows "truthful statements about your service that do not use our logo, such as 'This service is implemented using Mattermost software.'" Must not imply Mattermost evaluated or approved it. | An origin line in About or the README is fine without the logo. |
| Same, rule 6 | Include "[TRADEMARK] is a trademark of Mattermost, Inc." when the mark is used. | Add this line wherever Brisk mentions Mattermost, for example in About. |
| Apache 2.0 §4(a), (c) | Give recipients a copy of the License. Retain all copyright, patent, trademark and attribution notices from the Source form. | Keep `LICENSE.txt` and all `Copyright (c) 2015-present Mattermost, Inc.` headers (about 4,500 files). Do **not** rename these to Brisk. |
| Apache 2.0 §4(b) | "You must cause any modified files to carry prominent notices stating that You changed the files." | Add a top-level `NOTICE`/`MODIFICATIONS` statement that Brisk modified the files, plus git history. **Check with counsel** whether per-file notices are needed. |
| Apache 2.0 §4(d) | If the Work includes a NOTICE file, derivative works must include its attribution notices. | Ship a NOTICE with the third-party list for the web bundle. `webapp/channels/build/notice-file/config.yaml` generates one today; retitle it "Brisk" but keep the dependency entries and Mattermost attribution. |

Third-party packages to check:

- `@mattermost/compass-icons` 0.1.64 is MIT. Keep it; icon glyphs are not the logo.
- `@mattermost/compass-ui` 0.1.0-alpha.28 has **no license field** in its npm package. **Check with counsel** or ask Mattermost before shipping; replacing it may be safer.
- `@mattermost/calls-common` 0.27.2 is under the Mattermost AGPL/commercial dual license. It is only imported with `import type` in `selectors/calls.ts`, so nothing from it lands in the bundle. Keep it that way.
- `@mattermost/desktop-api` 6.3.0-2 is MIT.

## Proxy deployment design

One host on Brisk's domain serves the Brisk build and forwards server routes to a single upstream Mattermost server. The webapp already works this way in development: `channels/webpack.config.js` proxies `/api`, `/plugins` and `/static/plugins` to `MM_SERVICESETTINGS_SITEURL`.

### Routes

| Path | Goes to | Notes |
| --- | --- | --- |
| `/static/plugins/*` | Upstream server | Plugin web bundles. Must be matched before `/static/`. |
| `/static/*` | Brisk build (`webapp/channels/dist/`) | Hashed JS, CSS, images, emoji. Cache for a year. |
| `/api/*` | Upstream server | REST API, plus websocket upgrade on `/api/v4/websocket`. |
| `/plugins/*` | Upstream server | Plugin HTTP endpoints. |
| `/files/*` | Upstream server | Public file links. |
| everything else (GET) | Brisk `root.html` | Client-side routes. `no-cache`. |

SSO routes (`/oauth/*`, `/login/sso/saml`, `/login/*/complete`) are not forwarded in v1. They can be added later together with pointing Site URL at Brisk.

### What the proxy must do

- **Upstream fixed in config** (`MM_UPSTREAM=https://chat.example.com`), never taken from the request, so it can't be used as an open proxy.
- **Host and TLS:** send the upstream's own `Host`, and `X-Forwarded-Proto: https`. The server marks cookies `Secure` only when it sees https (`app/login.go` `GetProtocol`).
- **Websocket Origin:** the server's default origin check requires the browser's `Origin` to match its Site URL (`app/server.go` `OriginChecker`). The proxy rewrites `Origin` on the upgrade to the upstream's URL, so no server setting is needed. Long read timeout (for example 1 hour) on the websocket.
- **Cookies:** the server sets host-only cookies by default, which the browser stores for Brisk's domain. If the server has `AllowCookiesForSubdomains` on, strip the `Domain` attribute (`proxy_cookie_domain`).
- **Uploads:** body size limit at least the server's `MaxFileSize` (100 MB by default), with request buffering off for large uploads.
- **Client IPs:** add `X-Forwarded-For`. Without the optional server setting `TrustedProxyIPHeader`, the server sees every user as the proxy's IP, which affects rate limiting and audit logs.
- **Security headers:** a Content-Security-Policy (`script-src 'self'`, plus plugin bundles if allowed), `robots.txt`, HSTS.

### Packaging

1. `cd webapp && npm ci && npm run build` (Node 24.11.1, npm 11.6.2). Output is `webapp/channels/dist/`.
2. `deploy/nginx/brisk.conf.template` with `MM_UPSTREAM` substituted at start, plus an optional `Caddyfile` and a `Dockerfile` (nginx base image + `dist/`). Edge workers (for example Cloudflare) can host the same routes later.
3. Release artifact: a versioned tarball of `dist/` and the container image, both tagged with the supported Mattermost version.

### Optional server settings

None are required. If the server is administered by us, these improve things:

| Setting | Value | Effect |
| --- | --- | --- |
| `ServiceSettings.SiteURL` | Brisk's URL | Password-reset, invite and notification emails link to Brisk; permalink previews work for Brisk links; email logos load from Brisk. The server's own web UI stops being the link target. |
| `TeamSettings.SiteName` | `Brisk` | Server-written text (emails, notifications, tab title) says Brisk. |
| `ServiceSettings.TrustedProxyIPHeader` | `X-Forwarded-For` | Real client IPs in rate limits and audit logs. |

### Version compatibility

- The client and server share version 12.2.0 today. Pin each Brisk release to one Mattermost minor (start with 12.2.x) and say so in release notes.
- Rebase onto each upstream release tag we support and run Jest and Playwright through the proxy against that server. Only 8 places gate on `isMinimumServerVersion`, so older servers are not really supported.
- On a server upgrade the version bar asks users to reload, which reloads the same Brisk build. Ship a matching Brisk release before upgrading the server.

### What Brisk gives up in v1

- SSO (buttons hidden).
- One server per Brisk deployment. Multi-server comes with the later Electron shell or a proxy allowlist.
- Server-rendered link previews (OpenGraph tags) for Brisk URLs.
- Emails link to the server's own Mattermost UI unless Site URL points at Brisk.

## Branding inventory

Everything below is in `webapp/channels/` unless noted. "Required" means the item presents Mattermost's name or logo as Brisk's own product; "Keep" means it is an attribution notice or an internal identifier users never see.

### Logos and images (required)

| Asset | Path | Used by | Action |
| --- | --- | --- | --- |
| Loading animation | `src/components/initial_loading_screen/initial_loading_screen_template.html` (778 KB inline SVG) | First screen on every load | Replace the compass-and-needle mark with the Brisk mark. Background art optional. |
| Header logo (SVG component) | `src/components/common/svg_images_components/logo_dark_blue_svg.tsx` | Global header product branding, login/signup header, workspace setup screens | Replace with Brisk SVG. |
| Mattermost logo icon | `src/components/widgets/icons/mattermost_logo.tsx` | System message avatar, About dialogs, system notices, cloud preview | Replace with Brisk icon; rename component `BriskLogo`. |
| `logo.png`, `logo.svg`, `logoWhite.png` | `src/images/` | Create team, claim account, MFA, select team, deep-link landing | Replace. |
| Email logos | `src/images/logo-email.png`, `logo_email_blue.png`, `logo_email_dark.png`, `logo_email_gray.png` | Server email templates via `{SiteURL}/static/images/`, formatting help | Replace (same filenames so server emails pick them up). |
| App icons | `src/images/icon50x50.png`, `icon64x64.png` | Desktop notifications, OAuth authorize page, security settings | Replace. (`appIcons.png` is a sprite of OS logos and stays.) |
| Favicons | `src/images/favicon/` (default, mentions and unread badges, apple-touch, android-chrome) | Browser tab, PWA, unread badge (`unreads_status_handler.tsx`) | Replace all. |
| Deep-link art | `src/images/deep-linking/deeplinking-desktop-img.png`, `deeplinking-mobile-img.png` | "Open in app" landing page | Replace or remove the page (see below). |
| Other illustrations | `src/images/` onboarding, invite, cloud and purchase art | Various | Review each for the logo. Likely fine as generic art. |

### Generating the Brisk asset set

Claude draws the Brisk mark as SVG and a script renders every file above, so the set can be regenerated when the mark changes.

1. **Concepts.** Four green directions, shown side by side on light and dark backgrounds and at favicon sizes (`brisk/logo-concepts/`). Breeze chosen for now.
2. **Masters.** Filled-outline SVGs (no live text or strokes): mark, mono mark, app tile, small-size tile with heavier strokes, badge variants, and lockups with the wordmark (Inter Display Bold outlines, SIL OFL 1.1).
3. **Render script.** Renders each PNG at the exact pixel size and filename of the file it replaces, so server email templates and the PWA manifest pick them up unchanged.
4. **Code assets.** Regenerate `logo_dark_blue_svg.tsx` and `mattermost_logo.tsx` (renamed `BriskLogo`) from the masters, and swap the compass-and-needle in the loading animation for a simple Brisk mark animation.
5. **Optional theme.** A default green Brisk theme, so the app doesn't look like Mattermost's Denim theme.
6. **Check.** A contact sheet of every rendered file, plus screenshots of login, header, loading screen and favicon in light and dark, before merging.

### Product name in text (required)

| Where | Count | Action |
| --- | --- | --- |
| `src/i18n/en.json` strings containing "Mattermost" | 438 of 8,931 (265 admin console, 27 About, 16 user settings, 13 cloud preview, 11 help, rest spread) | Replace with "Brisk" where it names the product. Keep it where it names the server or its license (see Keep). |
| Other locales in `src/i18n/` | 29 of 33 files | Same edit per file, or drop locales Brisk won't maintain. |
| Hardcoded strings in `.ts`/`.tsx` | 84 lines in ~25 files; biggest: license panels (12), `linking_landing_page.tsx` (7), `cloud_preview_modal` data (6), `billing_summary.tsx` (5), About modals (6), `help/formatting.tsx` (4) | Move to i18n or replace. |
| `src/root.html` | `<title>Mattermost</title>`, `application-name` meta | Change to Brisk. |
| `src/components/no_script/no_script_template.html` | "To use Mattermost, please enable JavaScript." | Change. |
| `webpack.config.js` PWA manifest | `name`, `short_name`, `description` ("Mattermost is an open source, self-hosted Slack-alternative") | Change. |
| `build/notice-file/config.yaml` | Title "Mattermost Web App" | Retitle Brisk; keep Mattermost copyright line. |
| `webapp/package.json` name `@mattermost/webapp`, `channels/package.json` name `mattermost-webapp` | 2 | Optional rename; not user-visible. |
| `README.md` files | `webapp/README.md` and others | Rewrite for Brisk with an origin line. |

### Links out to mattermost.com (decide)

The client has about 300 links to `mattermost.com` (183), `docs.mattermost.com` (56), `support.`, `forum.`, `hub.` and `customers.` subdomains. Linking to Mattermost docs is a truthful reference, not branding, but it sends Brisk users to Mattermost support. Recommend: route the user-facing ones (help menu, "learn more", get apps, report a problem) through `SupportSettings` links or a Brisk docs site, and keep admin-console doc links as they are.

### Features that only make sense as Mattermost (decide)

- **Deep-link landing page** (`linking_landing_page.tsx`, `mattermost://` scheme, `setLandingPreferenceToMattermostApp`): offers to open the Mattermost desktop/mobile app. Hide it, since there is no Brisk app.
- **Cloud, billing, trial and purchase screens** (`admin_console/billing`, `cloud_preview_modal`, `license_settings`): these sell Mattermost licenses. Hide them in Brisk, or keep the text as "Mattermost" because it truly describes the server's license.
- **About dialog** (`about_build_modal`): show Brisk version, plus "Connected to a Mattermost server, version X" and the trademark line from rule 6.
- **Default themes and colours** (Denim, Onyx, etc.): not trademarks, but they make Brisk look like Mattermost. Optional new default theme.

### Keep as is

- `Copyright (c) 2015-present Mattermost, Inc.` headers in about 4,500 source files, `LICENSE.txt`, and Mattermost entries in the NOTICE (Apache §4(c), (d)).
- Internal identifiers: `@mattermost/*` packages, `mattermost-redux`, Redux action names, cookie names (`MMAUTHTOKEN`, `MMCSRF`), API paths. Users don't see them and renaming would break plugins and the server contract.
- Admin-console text that names the server or its license ("Mattermost Enterprise", "Mattermost server version"), using the name as an adjective per trademark rule 4.

### Outside the client

Server i18n has 269 strings mentioning Mattermost (emails, push notifications, system messages, errors). Brisk can't change them without patching the AGPL server. Setting `SiteName` to Brisk covers the ones that use `{{.SiteName}}`. Plugin UIs (Calls, Boards, Playbooks) bring their own branding.

## Work plan

Six steps, each a separate PR on the fork. Steps 1 and 3 start now and run in parallel.

1. **Proxy.** nginx template, optional Caddyfile and Dockerfile, runbook. Check through the proxy against a local 12.2 server: login, MFA, websocket, uploads, downloads, images, plugins.
2. **Brand layer.** One `brand.ts` (name, short name, description, links, SSO-hidden flag) and a `brand/` asset folder. Point `root.html`, the PWA manifest, the no-script page and the logo components at it.
3. **Brand assets.** Masters from the Breeze concept, render script, code assets, optional green default theme.
4. **Strings.** Scripted en.json rename with a reviewed allowlist, 84 hardcoded strings, locales, Jest snapshots.
5. **Trims.** Hide SSO buttons, the desktop-app deep-link page, billing and trial screens; settle which plugins to allow.
6. **Legal and release.** NOTICE, modifications statement, trademark line in About, Brisk README, release tarball and image pinned to 12.2.x.

Keep Brisk changes in the brand layer and i18n so upstream releases can still be merged. An Electron shell can follow later without touching these steps.

### Open questions

- [ ] **Site URL:** if we administer the server, point its Site URL at Brisk? (Optional; improves email links and permalink previews.)
- [ ] **Plugins:** they work through the proxy but bring Mattermost branding. Allow all, some, or none in v1?
- [x] **Logo:** Breeze (concept 1) chosen for now, 2026-11-21.
- [ ] **Locales:** keep all 33 or ship English only at first?
- [ ] **Links:** keep Mattermost docs links, or a small Brisk help site?
- [ ] **Trademark:** email trademark@mattermost.com to confirm "works with Mattermost servers" wording?
- [ ] **`@mattermost/compass-ui`** has no stated license: ask Mattermost, or plan to replace it?

### Sources

- `LICENSE.txt`, `NOTICE.txt`, `webapp/channels/LICENSE.txt` in this repository at `aa22f040`
- [Mattermost Trademark Policy](https://mattermost.com/trademark-standards-of-use/), read 2026-11-21
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
