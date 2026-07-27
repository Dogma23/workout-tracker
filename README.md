# Lift Tracker

A mobile-first workout tracker for the **Fat Loss & Core Strength** plan. Log the
weight you use, run a rest timer between sets with an interval you choose, and see
a dashboard of your progress. Works offline and installs to your phone's home
screen (it's a PWA). No accounts, no server — your data lives on your device.

## Features

- **Four workout days built in** — Push, Pull, Full Body + Core, Core + Conditioning — with your exact exercises, sets, reps and injury notes.
- **Weight + reps logging** per set, with your last-used weight pre-filled next time.
- **Rest timer** that auto-starts when you tick a set complete. Pick the interval (30 / 45 / 60 / 90 / 120 / 180s or a custom value), ±15s on the fly, and the screen stays awake during rest.
- **Timer sounds** — a soft start cue, a 3·2·1 countdown blip, and an ascending finish chime (plus vibrate). All generated in-app with the Web Audio API, so nothing to download and it works offline. Toggle in Settings.
- **Progression prompts** — follows the plan's "every ~2 weeks, if it's easy, nudge it up" rule. When you've held a weight for 2+ sessions while hitting the top of the rep range, the dashboard flags the lift as *Ready to progress* and the workout screen shows a one-tap button to load the suggested next weight (+2.5 kg / +5 lb, or +1 rep / +5s for bodyweight moves and holds).
- **Dashboard graphs** — a workout-volume bar chart over your recent sessions, and a per-exercise weight-progress line chart with an exercise picker. Drawn as inline SVG (no chart libraries), so they work offline too.
- **Dashboard stats** — total workouts, this-week count, day streak, total volume lifted, recent sessions, and personal bests per exercise.
- **Customize exercises** — from the home screen, edit any day: add your own exercises, edit sets/reps/notes/type, reorder them, delete, or reset a day to the default plan. Changes stick for future workouts.
- **Edit past workouts** — tap any recent session to fix a logged weight or rep, toggle whether a set counts, or delete the session. Volume and stats update automatically.
- **Rotating warm-ups** — a pool of five joint-friendly warm-ups; you get a different one each session, cycling back to the first at the start of each week.
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

- **Hydration reminders** — nudge to drink water at a regular interval during a
  session (configurable, e.g. every 10–15 min), with a gentle sound/vibrate.
- **Total workout time** — a live elapsed-time clock on the active workout
  screen, plus a cumulative "total time trained" stat on the dashboard.
  (Per-session duration is already recorded — this surfaces it live and in total.)
- Per-set RPE / "felt easy?" tagging to sharpen the progression suggestions
- Add-exercise on the fly during a workout (one-off, without editing the plan)
- Cloud sync / backup

---

> ⚠️ Get your GP or physio to sign off on the specific knee/shoulder movements
> before you start. This plan avoids overhead pressing, bench press, pull-ups and
> deep unsupported squats, but only a professional who's seen your joint move can
> confirm what's safe for you.
