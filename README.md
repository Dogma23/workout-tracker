# Lift Tracker

A mobile-first workout tracker for the **Fat Loss & Core Strength** plan. Log the
weight you use, run a rest timer between sets with an interval you choose, and see
a dashboard of your progress. Works offline and installs to your phone's home
screen (it's a PWA). No accounts, no server — your data lives on your device.

## Features

- **Four workout days built in** — Push, Pull, Full Body + Core, Core + Conditioning — with your exact exercises, sets, reps and injury notes.
- **Weight + reps logging** per set, with your last-used weight pre-filled next time. Add or delete sets on the fly, and if a machine is taken you can **swap, add or remove an exercise mid-workout** (just for that session — your saved plan is untouched).
- **Rest timer** that auto-starts when you tick a set complete. Pick the interval (30 / 45 / 60 / 90 / 120 / 180s or a custom value), ±15s on the fly. The screen is kept awake for the whole workout so the phone won't auto-lock mid-session and miss the beep. You can also run the timer on its own — tap the ⏱ button on the home screen — for when you just want a timer without logging a workout.
- **Supersets** — in a day editor, tap **Link as superset** between two (or more) consecutive exercises to pair them. During the workout they render as one linked block and you log each move's sets on its own card — but the rest timer stays quiet between them and only fires after the last move in the group, so you go straight from one exercise into the next. Tap the connector again to unlink.

> **Note on sound while the phone is locked:** if you manually lock an iPhone (or leave the app), the browser suspends the page — timers and sound can't run in the background, and there's no web workaround for that. Keeping the app on-screen (the workout keeps the screen awake for you) means the beep fires on time, even with music playing in the background.
- **Timer sounds** — a soft start cue, a 3·2·1 countdown blip, and an ascending finish chime (plus vibrate). All generated in-app with the Web Audio API, so nothing to download and it works offline. Toggle in Settings.
- **Workout time** — a live elapsed clock ticks in the header while you train, and the dashboard shows your cumulative "total time trained".
- **Hydration reminders** — during a workout it nudges you to drink water at your chosen interval (default every 15 min) with a gentle sound, vibrate and on-screen prompt. Configurable / switch-off in Settings.
- **Progression prompts** — follows the plan's "every ~2 weeks, if it's easy, nudge it up" rule. When you've held a weight for 2+ sessions while hitting the top of the rep range, the dashboard flags the lift as *Ready to progress* and the workout screen shows a one-tap button to load the suggested next weight (+2.5 kg / +5 lb, or +1 rep / +5s for bodyweight moves and holds).
- **Dashboard graphs** — a workout-volume bar chart over your recent sessions, and a per-exercise weight-progress line chart with an exercise picker. Drawn as inline SVG (no chart libraries), so they work offline too.
- **Dashboard stats** — total workouts, this-week count, day streak, total volume lifted, recent sessions, and personal bests per exercise.
- **Customize exercises** — from the home screen, edit any day: add exercises, edit sets/reps/notes/type, reorder them, delete, or reset a day to the default plan. Changes stick for future workouts.
- **Exercise library** — an 80-strong, preloaded, searchable catalogue (Legs, Chest, Back, Shoulders, Arms, Core, Cardio) to add from with one tap; it pre-fills sensible sets/reps/type/notes. Bundled in the app, so it works offline. It's *joint-aware*: movements that load the knee or shoulder are flagged ⚠ with a caution, rather than dumping a generic list full of the exercises this plan avoids.
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

## Roadmap

Under analysis (paused):
- **PT plan sharing — Option A** — trainers set up a company profile and share a
  branded workout plan with clients via a link (no backend); clients import in one
  tap. Direction chosen (one-time unlock, target = beginner PTs on PDFs/WhatsApp,
  stay web not native). Paused pending demand validation. The full commercial SaaS
  version is shelved unless demand shows.

Ideas (not scheduled):
- Per-set RPE / "felt easy? / had pain?" tagging to sharpen and de-risk the progression suggestions
- Pick-a-plan starter templates (Full Body, Push/Pull/Legs, Upper/Lower, bodyweight)
- Auto-substitute risky exercises for safe alternatives based on the chosen injuries
- Cloud sync / backup

Recently shipped: light redesign · multi-profile · smart injury-aware cautions ·
1–7 custom training days (add/rename/remove) · exercise library · hydration
reminders · workout timer/clock · how-to links · mid-workout add/swap/reorder ·
supersets (grouping + smart rest).

---

> ⚠️ Get your GP or physio to sign off on the specific knee/shoulder movements
> before you start. This plan avoids overhead pressing, bench press, pull-ups and
> deep unsupported squats, but only a professional who's seen your joint move can
> confirm what's safe for you.
