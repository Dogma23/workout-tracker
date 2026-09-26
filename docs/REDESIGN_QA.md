# Redesign QA checklist

Manual pre-ship verification for the `redesign` branch (tabbed navigation, blue
theme with light/dark toggle, Kanit + Sarabun fonts, crisp corners, 8px spacing,
and the new "Felt" effort control). Run through this on a real phone and a
desktop browser before merging. Check each box only once you've actually seen it
work.

## Navigation & tabs

- [ ] The bottom tab bar shows all four tabs: **Home**, **Workout**, **History**, **You**.
- [ ] Each tab renders its own screen without errors (check the console).
- [ ] Tapping a tab switches to it; the active tab is visually highlighted.
- [ ] Switching tabs mid-task doesn't lose in-progress state (e.g. an active workout survives a trip to History and back).
- [ ] The tab bar stays fixed/reachable and doesn't overlap content or get hidden behind the phone's home indicator.
- [ ] Back/forward and reload land on a sensible tab (no blank screen).

## Workout flow

- [ ] Starting a workout from Home/Workout opens the correct day and exercises.
- [ ] Logging a set (weight + reps) saves, and the last-used weight pre-fills next time.
- [ ] Adding, editing and deleting a set on the fly all work.
- [ ] Mid-workout swap / add / remove exercise works for that session only (saved plan untouched).
- [ ] Rest timer auto-starts on ticking a set complete; interval selection and ±15s work.
- [ ] Timer sounds/vibrate fire (start cue, 3·2·1 countdown, finish chime); can be toggled in settings.
- [ ] Screen-wake, elapsed workout clock, and hydration reminders still behave.
- [ ] Pre / post-workout segment timers (warm-up / stretch / cardio) run.
- [ ] Finishing a workout saves the session and updates dashboard stats/volume.

## Felt (effort) control & pain flag

- [ ] The "Felt" ladder shows exactly three steps: **Easy / Just right / Hard**.
- [ ] Selecting a step records it against the set and is optional (logging never blocked).
- [ ] The optional **pain flag** appears only when enabled in settings; toggling the setting on/off shows/hides it.
- [ ] With pain enabled, flagging pain holds/does not push progression (progress nudge suppressed with the caution message).
- [ ] Felt values feed progression as expected (an "Easy" at top of rep range nudges sooner).
- [ ] Old-style effort tags on existing sessions still display correctly after migration.

## Theme toggle

- [ ] **Light** theme renders correctly across all four tabs.
- [ ] **Dark** theme renders correctly across all four tabs.
- [ ] **System** setting follows the OS light/dark preference and updates live when the OS changes.
- [ ] Chosen theme persists across reload and app restart.
- [ ] Text contrast is legible and the blue theme colours are consistent (no unstyled/flash-of-wrong-theme on load).

## Data migration safety (critical)

- [ ] An existing user's `localStorage` from the pre-redesign app loads with **no data loss**.
- [ ] All **profiles** load and are selectable.
- [ ] **Workout history** (all past sessions) loads intact with correct weights/reps/volume.
- [ ] The saved **plan** (days, exercises, sets/reps/notes/type, supersets) loads intact.
- [ ] **Warm-up / stretch / cardio** pre/post-workout routines load intact.
- [ ] **Settings** (timer interval, sounds, hydration, units, etc.) load intact.
- [ ] No exceptions in the console during first load on an upgraded data set.
- [ ] (If storage schema changed) migration runs once, is idempotent, and doesn't re-run or corrupt on second load.

## Offline / PWA

- [ ] Service worker registers and `lift-tracker-v19` cache activates.
- [ ] App loads with the network off (airplane mode) after first visit.
- [ ] "Add to Home Screen" install still works; installed app launches to the tabbed UI.
- [ ] After an update, the new version is picked up (old caches cleared).

## Mobile layout (~375px)

- [ ] No horizontal scroll anywhere at ~375px width.
- [ ] Tab bar, headers, cards and forms fit without clipping or overlap.
- [ ] Tap targets are large enough and not obscured by the tab bar.
- [ ] 8px spacing and crisp corners render as intended; fonts (Kanit + Sarabun) load.

## Editors & history editing

- [ ] Plan editor: add / edit / reorder / delete exercises, edit sets/reps/notes/type, reset a day to default.
- [ ] Superset link/unlink works in the day editor and persists.
- [ ] Profiles: create, rename, switch and delete profiles.
- [ ] Session history editing: fix a logged weight/rep, toggle whether a set counts, delete a session — stats update.
- [ ] JSON export from settings still produces a valid, complete file.
