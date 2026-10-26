# Publishing to the Chrome Web Store

Everything the store asks for, ready to paste, and the order to do it in. The listing is meant to
go out **Unlisted** first (only people with the link can install); switching to Public later needs
Google's OAuth verification (see the end).

## Assets in this repo

| Store field | File | Size |
|---|---|---|
| Package | `yearly-grid-<version>.zip` from `npm run package` | — |
| Store icon | `public/icons/icon-128.png` (96 px artwork, 16 px transparent padding) | 128×128 |
| Screenshots | `docs/img/1-year-hover.png`, `2-edit.png`, `3-dark-settings.png`, `4-focused.png` | 1280×800 |
| Small promo tile | `store/promo-440x280.png` | 440×280 |
| Homepage | https://vkotaru.github.io/yearly-grid/ | — |
| Privacy policy | https://vkotaru.github.io/yearly-grid/privacy.html | — |
| Support | https://github.com/vkotaru/yearly-grid/issues | — |

The screenshots come from `npm run dev` (sample data), so they show no real calendar.

## Steps

1. **Developer account.** Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   accept the agreement and pay the one-time US$5 fee. The contact email you set there is shown
   publicly on the listing — use one you're happy to publish.
2. **First upload.** `npm run package`, then *New item* → upload the zip. This creates a draft and
   assigns the extension's permanent store ID.
3. **Make local builds use the store ID.** On the draft's *Package* tab, *View public key*. Join the
   lines between `BEGIN PUBLIC KEY` and `END PUBLIC KEY` into one line and set it as
   `EXTENSION_KEY` in `.env` (on every machine you build on). Your unpacked builds now have the same
   ID as the store version, so one OAuth client serves both.
4. **OAuth client for that ID.** Google Cloud Console → Google Auth Platform → *Clients* → *Create
   client* → *Chrome Extension*, item ID = the store ID. Put the new client ID in `.env` as
   `OAUTH_CLIENT_ID`. (The old client, for the self-generated ID, can then be deleted.)
5. **Consent screen.**
   - *Branding*: app name "Yearly Grid", support email, homepage and privacy-policy URLs above.
     Don't upload a logo — that alone triggers Google's verification.
   - *Audience*: *Publish app* (status *In production*). In *Testing* only listed test users can
     sign in and everyone re-signs every 7 days. Unverified apps in production show an "unverified
     app" screen once and are capped at 100 users — fine for an unlisted release.
6. **Second upload.** `npm run package` again (now with the client ID) and upload it on the
   *Package* tab. If the dashboard insists on a new version, `npm version patch` first (the
   manifest takes its version from `package.json`).
7. **Fill in the tabs** using the text below, set *Distribution → Visibility* to **Unlisted**, and
   *Submit for review*. Review usually takes a few days.
8. **After approval**, install from the store link, sign in, and check the extension ID on
   `chrome://extensions` matches.

## Releasing updates

After the first release, pushing a version tag publishes automatically
(`.github/workflows/release.yml`):

```bash
npm version patch          # 0.1.0 → 0.1.1: bumps package.json, commits, tags v0.1.1
git push --follow-tags     # the tag starts the workflow
```

The workflow checks the tag matches `package.json`, runs the tests, builds the store zip, uploads
it and submits it for review. Google still reviews every version; installs update within a few
hours of approval. Pushes without a tag publish nothing. Watch a run under the repo's *Actions* tab.

### One-time setup

The workflow uses the [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
through [`chrome-webstore-upload-cli`](https://github.com/fregante/chrome-webstore-upload-cli).

1. **Enable the API.** In the Google Cloud project whose consent screen is *In production*, enable
   the *Chrome Web Store API*. (In a *Testing* project the refresh token expires after 7 days.)
2. **Desktop OAuth client.** Google Auth Platform → *Clients* → *Create client* → type
   **Desktop app**. Keep its client ID and client secret.
3. **Refresh token.** On your own machine, run `npx chrome-webstore-upload-keys`, enter the client
   ID and secret, and sign in with the Google account that owns the store listing. Approve the
   *Chrome Web Store* scope (an "unverified app" warning is expected). It prints a refresh token.
4. **Publisher ID.** It's in the Developer Dashboard URL when you're signed in
   (`chrome.google.com/webstore/devconsole/<publisher-id>/…`).
5. **GitHub.** Repo → *Settings* → *Secrets and variables* → *Actions*:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `CWS_CLIENT_ID` | the Desktop client's ID |
   | Secret | `CWS_CLIENT_SECRET` | the Desktop client's secret |
   | Secret | `CWS_REFRESH_TOKEN` | the refresh token from step 3 |
   | Variable | `EXTENSION_ID` | the store item ID |
   | Variable | `PUBLISHER_ID` | from step 4 |
   | Variable | `OAUTH_CLIENT_ID` | the *Chrome Extension* client ID (the one in your `.env`) |

The refresh token can publish to your store listing, so keep it only in GitHub secrets. To revoke
it, delete the Desktop client or remove the app at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Store listing tab

**Name** (from the manifest): Yearly Grid for Google Calendar

**Summary** (from the manifest): See and edit your whole Google Calendar year on one 12 × 31 grid.

**Category**: Productivity → Workflow & Planning · **Language**: English

**Description**:

```
See your whole Google Calendar year at once. Yearly Grid lays out every month as a row and every day as a column, so trips, work blocks, holidays and busy stretches stand out at a glance.

• Year at a glance — multi-day and cross-month events stay on one line, and each month row grows only as tall as it needs.
• Choose your calendars — show or hide any calendar in your Google account; your choice is remembered.
• Edit in place — click or drag across empty days to create an event; click an event to change its title, dates, times, description or calendar, or delete it. Changes go straight to Google Calendar.
• Peek without clicking — rest the mouse on an event to see its full title, time, location, calendar and notes.
• Make it yours — light, dark or system theme, accent colour, font, text size, and a filter to show everything, all-day plus multi-day events, or all-day events only.
• Fast and offline — the last synced year is cached on your computer, so the grid opens instantly and stays viewable offline.

Private by design: there is no server. The extension talks only to Google's Calendar API from your browser, and your calendar data is never sent anywhere else. No analytics, no ads, no tracking.

Open source: https://github.com/vkotaru/yearly-grid

Yearly Grid is not affiliated with or endorsed by Google. Google Calendar is a trademark of Google LLC.
```

## Privacy practices tab

**Single purpose**:

```
Shows the user's Google Calendar as a year-at-a-glance grid (12 months × 31 days) and lets them create, edit and delete their calendar events from that grid.
```

**Permission justifications**:

| Permission | Justification |
|---|---|
| `identity` | Signs the user in with their Google account through Chrome's built-in sign-in, to get an OAuth token for the Google Calendar API. The extension never handles passwords. |
| `storage` | Saves the user's preferences (which calendars are shown, theme, font, text size) and a local cache of their calendar list and events so the grid opens instantly and works offline. |
| `unlimitedStorage` | The local event cache holds a full year of events per calendar, which for busy calendars can exceed the default storage quota. |
| Host permission `https://www.googleapis.com/*` | Calls the Google Calendar API to list the user's calendars and to read, create, update and delete their events. No other host is contacted. |

**Remote code**: No, I am not using remote code. (Everything is bundled; MV3 forbids it anyway.)

**Data usage** — tick the data types the extension handles:
- *Personally identifiable information*: events can contain names and email addresses of attendees.
- *Personal communications*: event titles, descriptions and invitations.
- *Location*: only if you consider event locations location data; they are shown, never tracked.

Then tick all three certifications: not sold to third parties; not used or transferred for purposes
unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL**: https://vkotaru.github.io/yearly-grid/privacy.html

## Going Public later

Switch *Visibility* to Public, and submit the OAuth consent screen for verification (Google Auth
Platform → *Verification centre*). `calendar.events` is a *sensitive* scope, so Google asks for:
the homepage and privacy policy on a domain you've verified in Search Console, a justification for
each scope, and a short screen recording showing sign-in and how the calendar data is used. It's
free and takes days to weeks; once verified, the warning and the 100-user cap go away.
