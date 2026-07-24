/* =========================================================================
   plan.js — Your Fat Loss & Core Strength program, as data.
   Edit this file to change exercises, sets, reps or notes. The app reads
   from here, so tweaking your program is just editing this list.
   ========================================================================= */

// Shared 5-minute warm-up shown at the top of every session.
const WARMUP = [
  'Marching on the spot — 1 min',
  'Arm circles, small to large — 1 min',
  'Bodyweight glute bridges — 1 min',
  'Cat-cow (spine mobility) — 1 min',
  'Shoulder blade squeezes — 1 min',
];

/* Each day has an id, a name, a short subtitle and a list of exercises.
   Exercise fields:
     name     — what shows in the tracker
     sets     — how many sets to log (number of rows created)
     reps     — target rep string (free text: "12", "10–12", "10 each leg")
     notes    — coaching cue / injury note
     tracks   — 'weight' shows a weight field; 'bodyweight' hides it (still
                editable if you tap it); 'time' labels reps as seconds. */
const PLAN = {
  push: {
    id: 'push',
    name: 'Push',
    day: 'Day 1',
    subtitle: 'Chest, quads, triceps — joint-friendly',
    exercises: [
      { name: 'Leg Press', sets: 3, reps: '12', tracks: 'weight', notes: "Knee-friendly alt to squats. Don't lock knees hard at top." },
      { name: 'Chest Press Machine', sets: 3, reps: '10–12', tracks: 'weight', notes: 'Seated, controlled — replaces bench press.' },
      { name: 'Incline Machine Press (light)', sets: 2, reps: '12', tracks: 'weight', notes: 'Only if pain-free; else swap for Cable Chest Fly.' },
      { name: 'Cable Chest Fly', sets: 2, reps: '15', tracks: 'weight', notes: 'Light, controlled range, no overhead component.' },
      { name: 'Triceps Rope Pushdown', sets: 3, reps: '12', tracks: 'weight', notes: 'Keep elbows tucked.' },
      { name: 'Step-Ups (low box)', sets: 2, reps: '10 each leg', tracks: 'weight', notes: 'Shallow height, controlled.' },
    ],
  },

  pull: {
    id: 'pull',
    name: 'Pull',
    day: 'Day 2',
    subtitle: 'Back, hamstrings, biceps',
    exercises: [
      { name: 'Seated Cable Row', sets: 3, reps: '12', tracks: 'weight', notes: 'Main back builder, replaces pull-ups.' },
      { name: 'Lat Pulldown (neutral grip)', sets: 3, reps: '10–12', tracks: 'weight', notes: 'Neutral grip is easier on the shoulder.' },
      { name: 'Single-Arm Dumbbell Row', sets: 2, reps: '12 each', tracks: 'weight', notes: 'Supported on bench, good shoulder control.' },
      { name: 'Hamstring Curl Machine', sets: 3, reps: '12', tracks: 'weight', notes: 'Knee-safe, isolates hamstrings.' },
      { name: 'Glute Bridge', sets: 3, reps: '12', tracks: 'weight', notes: 'Bodyweight or light bar. Protects the knee.' },
      { name: 'Biceps Curl', sets: 2, reps: '12', tracks: 'weight', notes: 'Optional finisher.' },
    ],
  },

  fullbody: {
    id: 'fullbody',
    name: 'Full Body + Core',
    day: 'Day 4',
    subtitle: 'Lighter volume, core focus',
    exercises: [
      { name: 'Leg Press', sets: 3, reps: '12', tracks: 'weight', notes: 'Repeat from Day 1, lighter.' },
      { name: 'Seated Cable Row', sets: 2, reps: '12', tracks: 'weight', notes: 'Lighter volume.' },
      { name: 'Standing Cable Chop', sets: 3, reps: '10 each side', tracks: 'weight', notes: 'Keep below chest height — easy on the shoulder.' },
      { name: 'Dead Bug', sets: 3, reps: '10 each side', tracks: 'bodyweight', notes: 'Core stability, zero spinal load.' },
      { name: 'Bird Dog', sets: 3, reps: '10 each side', tracks: 'bodyweight', notes: 'Core + balance.' },
      { name: 'Plank', sets: 3, reps: '20–30 sec', tracks: 'time', notes: 'Knees down if needed. Build up over weeks.' },
      { name: 'Bike or Rower', sets: 1, reps: '10 min', tracks: 'time', notes: 'Low resistance. Fat-loss conditioning, no knee impact.' },
    ],
  },

  core: {
    id: 'core',
    name: 'Core + Conditioning',
    day: 'Day 6 (optional)',
    subtitle: 'Anti-rotation core + steady cardio',
    exercises: [
      { name: 'Dead Bug', sets: 3, reps: '12 each side', tracks: 'bodyweight', notes: 'Slow and controlled.' },
      { name: 'Side Plank', sets: 3, reps: '20 sec each side', tracks: 'time', notes: 'Knee-supported if needed.' },
      { name: 'Pallof Press (cable)', sets: 3, reps: '10 each side', tracks: 'weight', notes: 'Anti-rotation — resist the twist.' },
      { name: 'Bike / Walk', sets: 1, reps: '15–20 min', tracks: 'time', notes: 'Steady pace.' },
    ],
  },
};

// Order the day cards appear on the home screen.
const PLAN_ORDER = ['push', 'pull', 'fullbody', 'core'];
