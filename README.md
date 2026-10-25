# 📅 Yearly Grid for Google Calendar

A Chrome extension that shows your whole Google Calendar year on one 12 × 31 grid — every month a row, every day a column — so trips, work blocks and busy stretches are visible at a glance.

- **Year at a glance**: multi-day and cross-month events stay on one line; timed events show their start time.
- **Peek without clicking**: rest the mouse on an event to see its full title, time, calendar, location and notes.
- **Choose your calendars**: show or hide any calendar in your Google account; the choice is remembered.
- **Edit in place**: click or drag across empty days to create an event, click an event to change its title, dates, times, description or calendar, or delete it. Changes go straight to Google Calendar.
- **Your view, your way**: hide the calendar sidebar, pick light/dark/system theme, an accent colour, font and text size, and choose whether the grid shows everything, all-day plus multi-day events, or all-day events only (⚙ in the header).
- **No server**: the extension talks to Google directly. The last synced year is cached on your machine, so the grid opens instantly and works offline (read-only while offline).

> Inspired by the grid in [yearly.app](https://github.com/vkotaru/yearly.app).

---

## 🚀 Install (from source)

You need Node 20+, Google Chrome 116+, and a Google Cloud project for the OAuth client (free).

### 1. Pin the extension ID

```bash
git clone https://github.com/vkotaru/yearly-grid.git
cd yearly-grid
npm install
cp .env.example .env
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | base64 -w0              # → EXTENSION_KEY in .env
openssl rsa -in key.pem -pubout -outform DER | sha256sum | head -c32 | tr 0-9a-f a-p   # → your extension ID
```

The key makes the extension ID stable, which the Google OAuth client needs. `key.pem` and `.env` are gitignored.

### 2. Set up Google Cloud

In [Google Cloud Console](https://console.cloud.google.com/):

1. **Enable the Google Calendar API** (APIs & Services → Library).
2. **Configure the OAuth consent screen** (Google Auth Platform): user type *External*, add yourself as a test user, and add these scopes under *Data access*:
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
3. **Create an OAuth client** (Credentials → Create credentials → OAuth client ID): application type **Chrome Extension**, item ID = your extension ID from step 1.
4. Put the client ID in `.env` as `OAUTH_CLIENT_ID`.

> If Google asks you to sign in again every week, that's the 7-day limit on apps in *Testing* status. Set the consent screen's publishing status to *In production* — for personal use you don't need Google's verification, you'll just see an "unverified app" notice once.

### 3. Build and load

```bash
npm run build
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist/` folder. Check the ID shown matches yours, then click the toolbar icon and sign in.

Sign-in uses the Google account you're signed into Chrome with, via `chrome.identity` — so it works in Google Chrome, not other Chromium browsers.

---

## 🧑‍💻 Development

```bash
npm run dev      # the UI in a normal browser tab, with sample data (no Google needed)
npm run watch    # rebuild dist/ on change; reload the extension in chrome://extensions
npm test         # unit tests (dates, event mapping, layout)
npm run build    # typecheck + production build
npm run package  # Chrome Web Store zip (no `key` field) — see store/README.md
```

Architecture and gotchas are in [AGENTS.md](AGENTS.md).

## 🔒 Privacy

Full policy: [vkotaru.github.io/yearly-grid/privacy.html](https://vkotaru.github.io/yearly-grid/privacy.html). In short: calendar data goes only between your browser and Google. Nothing is sent anywhere else, and there is no analytics. The extension caches calendars and events in Chrome's local extension storage; removing the extension deletes it.

## Limitations

- Editing needs a connection; offline, the grid is view-only.
- Editing one occurrence of a repeating event changes only that occurrence, and it can't be moved to another calendar.
- Attendees, reminders, location and other fields aren't editable here (they're kept unchanged on save) — use "Open in Google Calendar" for those.
- Guests aren't emailed when you change a meeting here.
- Birthdays, out-of-office, focus time and working-location entries are view-only.
- Timed events are edited in their own time zone; the editor says so when it differs from yours.
