/* =========================================================================
   exercises.js — a curated exercise library you can pick from when adding
   an exercise to a day. Bundled as static data so it works fully offline.

   This is deliberately joint-aware for Sid's knee/shoulder history: the
   joint-friendly options come first, and load-sensitive movements carry a
   `caution` flag that the app surfaces with a ⚠ badge. It's not exhaustive —
   add your own via "Add custom exercise", and this list can be expanded any
   time (edit this file).

   Each entry: { name, group, tracks, sets, reps, notes, caution? }
     tracks: 'weight' | 'bodyweight' | 'time'   (matches plan.js)
   ========================================================================= */

const LIBRARY_GROUPS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio'];

const EXERCISE_LIBRARY = [
  /* ---------------- Legs ---------------- */
  { name: 'Leg Press', group: 'Legs', tracks: 'weight', sets: 3, reps: '10–12', notes: "Knee-friendly squat alternative. Don't lock out hard at the top." },
  { name: 'Recumbent-style Leg Press (feet high)', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Higher foot position shifts load to glutes/hams, off the knee.' },
  { name: 'Seated Leg Curl', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Hamstrings, knee-safe.' },
  { name: 'Lying Leg Curl', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Hamstring isolation.' },
  { name: 'Romanian Deadlift', group: 'Legs', tracks: 'weight', sets: 3, reps: '10', notes: 'Hip hinge; keep the back neutral, soft knees.' },
  { name: 'Hip Thrust', group: 'Legs', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Big glute builder, easy on the knee.' },
  { name: 'Glute Bridge', group: 'Legs', tracks: 'bodyweight', sets: 3, reps: '12–15', notes: 'Posterior chain, knee-safe. Add a light bar to progress.' },
  { name: 'Box Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Sitting to a box controls depth — kinder to the knee.' },
  { name: 'Step-Ups (low box)', group: 'Legs', tracks: 'weight', sets: 3, reps: '10 each leg', notes: 'Shallow height, controlled.' },
  { name: 'Standing Calf Raise', group: 'Legs', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Full range, pause at the top.' },
  { name: 'Seated Calf Raise', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Soleus focus.' },
  { name: 'Hip Abduction (machine)', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Glute medius — good for knee tracking.' },
  { name: 'Hip Adduction (machine)', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Inner thigh.' },
  { name: 'Leg Extension', group: 'Legs', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Quad isolation.', caution: 'Can stress the knee — go light / limit range' },
  { name: 'Goblet Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '10', notes: 'Upright squat pattern.', caution: 'Knee load — keep depth pain-free' },
  { name: 'Bulgarian Split Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10 each', notes: 'Single-leg strength.', caution: 'Knee load — physio sign-off first' },
  { name: 'Walking Lunge', group: 'Legs', tracks: 'weight', sets: 3, reps: '10 each', notes: 'Dynamic single-leg.', caution: 'Knee load — physio sign-off first' },
  { name: 'Hack Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Machine squat.', caution: 'Deep knee load — your plan avoids this' },
  { name: 'Barbell Back Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '5–8', notes: 'Compound lower body.', caution: 'Deep unsupported knee load — your plan avoids this' },
  { name: 'Conventional Deadlift', group: 'Legs', tracks: 'weight', sets: 3, reps: '5', notes: 'Full-body hinge; brace hard.', caution: 'Heavy spinal load — go cautiously' },

  /* ---------------- Chest ---------------- */
  { name: 'Chest Press Machine', group: 'Chest', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Seated, controlled — replaces the bench press.' },
  { name: 'Incline Chest Press Machine', group: 'Chest', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Upper chest, only if pain-free.' },
  { name: 'Cable Chest Fly', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Light, controlled range, no overhead component.' },
  { name: 'Pec Deck', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Chest isolation, supported.' },
  { name: 'Cable Crossover', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep the range comfortable for the shoulder.' },
  { name: 'Incline Push-Up (hands elevated)', group: 'Chest', tracks: 'bodyweight', sets: 3, reps: '10–15', notes: 'Hands on a bench — much easier on the shoulder.' },
  { name: 'Push-Up', group: 'Chest', tracks: 'bodyweight', sets: 3, reps: '8–15', notes: 'Classic bodyweight press.', caution: 'Shoulder load — stop if it pinches' },
  { name: 'Dumbbell Bench Press', group: 'Chest', tracks: 'weight', sets: 3, reps: '8–12', notes: 'Free-weight press.', caution: 'Flat pressing loads the shoulder — your plan avoids this' },
  { name: 'Barbell Bench Press', group: 'Chest', tracks: 'weight', sets: 3, reps: '5–8', notes: 'Heavy horizontal press.', caution: 'Your plan avoids bench pressing' },

  /* ---------------- Back ---------------- */
  { name: 'Seated Cable Row', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Main back builder — replaces pull-ups.' },
  { name: 'Lat Pulldown (neutral grip)', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Neutral grip is easiest on the shoulder.' },
  { name: 'Lat Pulldown (wide grip)', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Lats; keep it pain-free.' },
  { name: 'Chest-Supported Row', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Pad-supported — great control, spares the low back.' },
  { name: 'Single-Arm Dumbbell Row', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12 each', notes: 'Supported on a bench, good shoulder control.' },
  { name: 'Machine Row', group: 'Back', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Fixed path, easy to load.' },
  { name: 'Straight-Arm Pulldown', group: 'Back', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Lat isolation, shoulder-friendly.' },
  { name: 'Reverse Pec Deck', group: 'Back', tracks: 'weight', sets: 3, reps: '15', notes: 'Rear delts / upper back.' },
  { name: 'Face Pull', group: 'Back', tracks: 'weight', sets: 3, reps: '15', notes: 'Rear delts + rotator cuff — shoulder-healthy.' },
  { name: 'T-Bar Row', group: 'Back', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Heavier mid-back row.' },
  { name: 'Pull-Up', group: 'Back', tracks: 'bodyweight', sets: 3, reps: 'AMRAP', notes: 'Vertical pull.', caution: 'Full-hang shoulder load — your plan avoids this' },

  /* ---------------- Shoulders ---------------- */
  { name: 'Cable Lateral Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '15', notes: 'Side delts, constant tension, controlled.' },
  { name: 'Dumbbell Lateral Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep it light, lead with the elbows.' },
  { name: 'Rear Delt Fly', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '15', notes: 'Rear delts; great for posture.' },
  { name: 'Shrugs', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Traps; no overhead component.' },
  { name: 'Front Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12', notes: 'Front delts.', caution: 'Loaded shoulder flexion — keep it light' },
  { name: 'Machine Shoulder Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Overhead press pattern.', caution: 'Overhead loading — your plan avoids this' },
  { name: 'Dumbbell Shoulder Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Overhead press.', caution: 'Overhead loading — your plan avoids this' },
  { name: 'Arnold Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Rotating overhead press.', caution: 'Overhead + rotation — your plan avoids this' },
  { name: 'Upright Row', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12', notes: 'Delts/traps.', caution: 'Common impingement trigger — skip if shoulder flares' },

  /* ---------------- Arms ---------------- */
  { name: 'Dumbbell Biceps Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Standard curl.' },
  { name: 'Cable Biceps Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '12', notes: 'Constant tension.' },
  { name: 'Hammer Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Neutral grip — brachialis/forearm.' },
  { name: 'Preacher Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Supported, strict.' },
  { name: 'EZ-Bar Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10', notes: 'Wrist-friendly bar.' },
  { name: 'Triceps Rope Pushdown', group: 'Arms', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep elbows tucked.' },
  { name: 'Triceps Cable Kickback', group: 'Arms', tracks: 'weight', sets: 3, reps: '15', notes: 'Squeeze at lockout.' },
  { name: 'Skull Crushers', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Lying triceps extension.' },
  { name: 'Overhead Triceps Extension', group: 'Arms', tracks: 'weight', sets: 3, reps: '12', notes: 'Long-head triceps.', caution: 'Overhead shoulder position — keep light' },
  { name: 'Dips', group: 'Arms', tracks: 'bodyweight', sets: 3, reps: '8–12', notes: 'Triceps/chest.', caution: 'Deep shoulder load — your plan avoids this' },

  /* ---------------- Core ---------------- */
  { name: 'Plank', group: 'Core', tracks: 'time', sets: 3, reps: '30–45 sec', notes: 'Knees down if needed; build up over weeks.' },
  { name: 'Side Plank', group: 'Core', tracks: 'time', sets: 3, reps: '20–30 sec each', notes: 'Knee-supported version is fine.' },
  { name: 'Dead Bug', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '10 each side', notes: 'Core stability, zero spinal load.' },
  { name: 'Bird Dog', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '10 each side', notes: 'Core + balance.' },
  { name: 'Pallof Press', group: 'Core', tracks: 'weight', sets: 3, reps: '10 each side', notes: 'Anti-rotation — resist the twist.' },
  { name: 'Standing Cable Chop', group: 'Core', tracks: 'weight', sets: 3, reps: '10 each side', notes: 'Keep below chest height — easy on the shoulder.' },
  { name: 'Cable Crunch', group: 'Core', tracks: 'weight', sets: 3, reps: '15', notes: 'Loaded flexion; move from the abs.' },
  { name: 'Lying Leg Raise', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '12–15', notes: 'Lower abs; keep the low back down.' },
  { name: 'Russian Twist', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '20 total', notes: 'Rotational core.' },
  { name: 'Ab Wheel Rollout', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '8–10', notes: 'Advanced anti-extension; brace hard.' },
  { name: 'Hanging Knee Raise', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '12', notes: 'Lower abs.', caution: 'Full-hang shoulder load — use a captain’s chair instead' },

  /* ---------------- Cardio ---------------- */
  { name: 'Recumbent Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Very knee-friendly, back supported.' },
  { name: 'Upright Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Low knee impact.' },
  { name: 'Rowing Machine', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–15 min', notes: 'Low-impact full body; drive with the legs.' },
  { name: 'Elliptical', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Low impact, smooth stride.' },
  { name: 'Treadmill Walk (incline)', group: 'Cardio', tracks: 'time', sets: 1, reps: '15–20 min', notes: 'Steady pace, add incline instead of speed.' },
  { name: 'Swimming', group: 'Cardio', tracks: 'time', sets: 1, reps: '20 min', notes: 'Joint-friendly full-body cardio.' },
  { name: 'Assault Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10 min', notes: 'Scalable intensity, low knee impact.' },
  { name: 'Stair Climber', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–15 min', notes: 'Glutes + cardio.', caution: 'Repetitive knee load — monitor the knee' },
  { name: 'Jump Rope', group: 'Cardio', tracks: 'time', sets: 1, reps: '5–10 min', notes: 'Conditioning.', caution: 'High impact — hard on the knee' },
];
