# Lift Tracker

A mobile-first workout tracker for the **Fat Loss & Core Strength** plan. Log the
weight you use, run a rest timer between sets with an interval you choose, and see
a dashboard of your progress. Works offline and installs to your phone's home
screen (it's a PWA). No accounts, no server — your data lives on your device.

## Features (v1)

- **Four workout days built in** — Push, Pull, Full Body + Core, Core + Conditioning — with your exact exercises, sets, reps and injury notes.
- **Weight + reps logging** per set, with your last-used weight pre-filled next time.
- **Rest timer** that auto-starts when you tick a set complete. Pick the interval (30 / 45 / 60 / 90 / 120 / 180s or a custom value), ±15s on the fly, beep + vibrate when it ends, and the screen stays awake during rest.
- **Dashboard** — total workouts, this-week count, day streak, total volume lifted, recent sessions, and personal bests per exercise.
- **Offline-first PWA** — add to home screen; it runs with no signal in the gym.
- **Your data, exportable** — everything is stored locally; export to JSON from Settings.

## Run it locally

It's plain static files — no build step. Either open `index.html` directly, or
serve the folder (needed for the service worker / offline to activate):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080` on your phone (same Wi-Fi) or computer.

## Host it on GitHub Pages

This repo already includes the same auto-deploy workflow as your other sites
(`.github/workflows/deploy.yml`). Once pushed:

```bash
git remote add origin git@github.com:Dogma23/workout-tracker.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions.**
Every push to `main` republishes automatically. Your site will be at
`https://dogma23.github.io/workout-tracker/`. Open that on your phone and
**Add to Home Screen**.

## Editing your program

All exercises live in [`js/plan.js`](js/plan.js) — edit the names, sets, reps or
notes there and the app updates. Bump the `CACHE` version in `sw.js` after any
change so the offline copy refreshes.

## Roadmap ideas

- Progress charts per exercise (weight over time)
- Progression prompts from your "+1 rep / +2.5% every 2 weeks" rule
- Custom exercises and reordering
- Cloud sync / backup

---

> ⚠️ Get your GP or physio to sign off on the specific knee/shoulder movements
> before you start. This plan avoids overhead pressing, bench press, pull-ups and
> deep unsupported squats, but only a professional who's seen your joint move can
> confirm what's safe for you.
