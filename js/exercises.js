/* =========================================================================
   exercises.js — a curated exercise library you can pick from when adding
   an exercise to a day. Bundled as static data so it works fully offline.

   Each exercise can carry a `loads` array naming the joints/areas it stresses
   (knees, shoulders, lower back, elbows, hips). The app shows a ⚠ caution for
   an exercise ONLY when one of its `loads` areas is one the current profile
   chose to protect — so a healthy profile sees no warnings, and someone with a
   bad back sees deadlifts flagged instead of shoulder work.

   Entry: { name, group, tracks, sets, reps, notes, loads? }
     tracks: 'weight' | 'bodyweight' | 'time'
     loads:  subset of BODY_AREAS keys (omit for joint-friendly moves)
   ========================================================================= */

const LIBRARY_GROUPS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio'];

// Areas a profile can choose to protect. key -> label.
const BODY_AREAS = [
  { key: 'knees', label: 'Knees' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'lower back', label: 'Lower back' },
  { key: 'neck', label: 'Neck' },
  { key: 'elbows', label: 'Elbows' },
  { key: 'wrists', label: 'Wrists' },
  { key: 'hips', label: 'Hips' },
  { key: 'ankles', label: 'Ankles' },
];

const EXERCISE_LIBRARY = [
  /* ---------------- Legs ---------------- */
  { name: 'Leg Press', group: 'Legs', tracks: 'weight', sets: 3, reps: '10–12', notes: "Knee-friendly squat alternative. Don't lock out hard at the top." },
  { name: 'Recumbent-style Leg Press (feet high)', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Higher foot position shifts load to glutes/hams, off the knee.' },
  { name: 'Seated Leg Curl', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Hamstrings, knee-safe.' },
  { name: 'Lying Leg Curl', group: 'Legs', tracks: 'weight', sets: 3, reps: '12', notes: 'Hamstring isolation.' },
  { name: 'Romanian Deadlift', group: 'Legs', tracks: 'weight', sets: 3, reps: '10', notes: 'Hip hinge; keep the back neutral, soft knees.', loads: ['lower back'] },
  { name: 'Hip Thrust', group: 'Legs', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Big glute builder, easy on the knee.' },
  { name: 'Glute Bridge', group: 'Legs', tracks: 'bodyweight', sets: 3, reps: '12–15', notes: 'Posterior chain, knee-safe. Add a light bar to progress.' },
  { name: 'Box Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Sitting to a box controls depth — kinder to the knee.' },
  { name: 'Step-Ups (low box)', group: 'Legs', tracks: 'weight', sets: 3, reps: '10 each leg', notes: 'Shallow height, controlled.' },
  { name: 'Standing Calf Raise', group: 'Legs', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Full range, pause at the top.', loads: ['ankles'] },
  { name: 'Seated Calf Raise', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Soleus focus.' },
  { name: 'Hip Abduction (machine)', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Glute medius — good for knee tracking.' },
  { name: 'Hip Adduction (machine)', group: 'Legs', tracks: 'weight', sets: 3, reps: '15', notes: 'Inner thigh.' },
  { name: 'Leg Extension', group: 'Legs', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Quad isolation; go light and limit the range if needed.', loads: ['knees'] },
  { name: 'Goblet Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '10', notes: 'Upright squat pattern; keep depth pain-free.', loads: ['knees'] },
  { name: 'Bulgarian Split Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10 each', notes: 'Single-leg strength.', loads: ['knees', 'hips'] },
  { name: 'Walking Lunge', group: 'Legs', tracks: 'weight', sets: 3, reps: '10 each', notes: 'Dynamic single-leg.', loads: ['knees'] },
  { name: 'Hack Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Machine squat.', loads: ['knees'] },
  { name: 'Barbell Back Squat', group: 'Legs', tracks: 'weight', sets: 3, reps: '5–8', notes: 'Compound lower body under load.', loads: ['knees', 'lower back'] },
  { name: 'Conventional Deadlift', group: 'Legs', tracks: 'weight', sets: 3, reps: '5', notes: 'Full-body hinge; brace hard.', loads: ['lower back'] },

  /* ---------------- Chest ---------------- */
  { name: 'Chest Press Machine', group: 'Chest', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Seated, controlled — replaces the bench press.' },
  { name: 'Incline Chest Press Machine', group: 'Chest', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Upper chest, only if pain-free.' },
  { name: 'Cable Chest Fly', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Light, controlled range, no overhead component.' },
  { name: 'Pec Deck', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Chest isolation, supported.' },
  { name: 'Cable Crossover', group: 'Chest', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep the range comfortable for the shoulder.' },
  { name: 'Incline Push-Up (hands elevated)', group: 'Chest', tracks: 'bodyweight', sets: 3, reps: '10–15', notes: 'Hands on a bench — much easier on the shoulder.' },
  { name: 'Push-Up', group: 'Chest', tracks: 'bodyweight', sets: 3, reps: '8–15', notes: 'Classic bodyweight press.', loads: ['shoulders', 'wrists'] },
  { name: 'Dumbbell Bench Press', group: 'Chest', tracks: 'weight', sets: 3, reps: '8–12', notes: 'Free-weight horizontal press.', loads: ['shoulders'] },
  { name: 'Barbell Bench Press', group: 'Chest', tracks: 'weight', sets: 3, reps: '5–8', notes: 'Heavy horizontal press.', loads: ['shoulders'] },

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
  { name: 'T-Bar Row', group: 'Back', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Heavier mid-back row.', loads: ['lower back'] },
  { name: 'Pull-Up', group: 'Back', tracks: 'bodyweight', sets: 3, reps: 'AMRAP', notes: 'Vertical pull from a full hang.', loads: ['shoulders'] },

  /* ---------------- Shoulders ---------------- */
  { name: 'Cable Lateral Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '15', notes: 'Side delts, constant tension, controlled.' },
  { name: 'Dumbbell Lateral Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep it light, lead with the elbows.' },
  { name: 'Rear Delt Fly', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '15', notes: 'Rear delts; great for posture.' },
  { name: 'Shrugs', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Traps; no overhead component.', loads: ['neck'] },
  { name: 'Front Raise', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12', notes: 'Front delts; keep it light.', loads: ['shoulders'] },
  { name: 'Machine Shoulder Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Overhead press pattern.', loads: ['shoulders'] },
  { name: 'Dumbbell Shoulder Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Overhead press.', loads: ['shoulders'] },
  { name: 'Arnold Press', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '8–10', notes: 'Rotating overhead press.', loads: ['shoulders'] },
  { name: 'Upright Row', group: 'Shoulders', tracks: 'weight', sets: 3, reps: '12', notes: 'Delts/traps; a common impingement trigger.', loads: ['shoulders', 'neck'] },

  /* ---------------- Arms ---------------- */
  { name: 'Dumbbell Biceps Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Standard curl.' },
  { name: 'Cable Biceps Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '12', notes: 'Constant tension.' },
  { name: 'Hammer Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Neutral grip — brachialis/forearm.' },
  { name: 'Preacher Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Supported, strict — can stress the elbow.', loads: ['elbows'] },
  { name: 'EZ-Bar Curl', group: 'Arms', tracks: 'weight', sets: 3, reps: '10', notes: 'Wrist-friendly bar.' },
  { name: 'Triceps Rope Pushdown', group: 'Arms', tracks: 'weight', sets: 3, reps: '12–15', notes: 'Keep elbows tucked.' },
  { name: 'Triceps Cable Kickback', group: 'Arms', tracks: 'weight', sets: 3, reps: '15', notes: 'Squeeze at lockout.' },
  { name: 'Skull Crushers', group: 'Arms', tracks: 'weight', sets: 3, reps: '10–12', notes: 'Lying triceps extension.', loads: ['elbows'] },
  { name: 'Overhead Triceps Extension', group: 'Arms', tracks: 'weight', sets: 3, reps: '12', notes: 'Long-head triceps, overhead position.', loads: ['shoulders', 'elbows'] },
  { name: 'Dips', group: 'Arms', tracks: 'bodyweight', sets: 3, reps: '8–12', notes: 'Triceps/chest, deep shoulder stretch.', loads: ['shoulders'] },

  /* ---------------- Core ---------------- */
  { name: 'Plank', group: 'Core', tracks: 'time', sets: 3, reps: '30–45 sec', notes: 'Knees down if needed; build up over weeks.', loads: ['wrists'] },
  { name: 'Side Plank', group: 'Core', tracks: 'time', sets: 3, reps: '20–30 sec each', notes: 'Knee-supported version is fine.' },
  { name: 'Dead Bug', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '10 each side', notes: 'Core stability, zero spinal load.' },
  { name: 'Bird Dog', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '10 each side', notes: 'Core + balance.' },
  { name: 'Pallof Press', group: 'Core', tracks: 'weight', sets: 3, reps: '10 each side', notes: 'Anti-rotation — resist the twist.' },
  { name: 'Standing Cable Chop', group: 'Core', tracks: 'weight', sets: 3, reps: '10 each side', notes: 'Keep below chest height — easy on the shoulder.' },
  { name: 'Cable Crunch', group: 'Core', tracks: 'weight', sets: 3, reps: '15', notes: 'Loaded flexion; move from the abs.', loads: ['lower back'] },
  { name: 'Lying Leg Raise', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '12–15', notes: 'Lower abs; keep the low back down.', loads: ['lower back'] },
  { name: 'Russian Twist', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '20 total', notes: 'Loaded rotation.', loads: ['lower back'] },
  { name: 'Ab Wheel Rollout', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '8–10', notes: 'Advanced anti-extension; brace hard.', loads: ['lower back', 'wrists'] },
  { name: 'Hanging Knee Raise', group: 'Core', tracks: 'bodyweight', sets: 3, reps: '12', notes: 'Lower abs from a full hang.', loads: ['shoulders'] },

  /* ---------------- Cardio ---------------- */
  { name: 'Recumbent Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Very knee-friendly, back supported.' },
  { name: 'Upright Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Low knee impact.' },
  { name: 'Rowing Machine', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–15 min', notes: 'Low-impact full body; drive with the legs.' },
  { name: 'Elliptical', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–20 min', notes: 'Low impact, smooth stride.' },
  { name: 'Treadmill Walk (incline)', group: 'Cardio', tracks: 'time', sets: 1, reps: '15–20 min', notes: 'Steady pace, add incline instead of speed.' },
  { name: 'Swimming', group: 'Cardio', tracks: 'time', sets: 1, reps: '20 min', notes: 'Joint-friendly full-body cardio.' },
  { name: 'Assault Bike', group: 'Cardio', tracks: 'time', sets: 1, reps: '10 min', notes: 'Scalable intensity, low knee impact.' },
  { name: 'Stair Climber', group: 'Cardio', tracks: 'time', sets: 1, reps: '10–15 min', notes: 'Glutes + cardio, repetitive knee load.', loads: ['knees'] },
  { name: 'Jump Rope', group: 'Cardio', tracks: 'time', sets: 1, reps: '5–10 min', notes: 'Conditioning; high impact.', loads: ['knees', 'ankles'] },
];
