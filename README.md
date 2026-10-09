# Next Level BMX Training

State Season 2026-27 training app. Same setup as the Team Hub: GitHub to Vercel, Asana as the data.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole app |
| `api/training.js` | The only server code. Talks to Asana with the token from Vercel |
| `img/` | Logo, header accent, home screen icons |
| `manifest.json` | Lets riders save it to their home screen |
| `package.json` | Tells Vercel which Node version to use |

## One-time setup

1. GitHub: new repo `Next-Level-Team-Training`. Upload everything in this folder, keeping the `api` and `img` folders.
2. Vercel: Add New > Project > import that repo. Name the project `next-level-team-training`. No build settings needed.
3. Vercel > Settings > Environment Variables: add `ASANA_TOKEN` with the same Asana token the Team Hub uses. Redeploy once after adding it.
4. Open the site, pick a name, enter the PIN. Every summer PIN still works.

## Where things live in Asana

Project: **Next Level BMX - Summer Training 2025** (wellbydesignfxn.com workspace)

| Thing | Where |
|---|---|
| Riders who show on the login screen | Section `ACTIVE ROSTER`. Move a rider to `INACTIVE ROSTER` to hide them |
| PIN and session log | Each rider's subtask `Session Log - Name`. PIN is the first line, `PIN:1234` |
| Sessions | Subtasks of `STATE SEASON SESSIONS`. One subtask per session |

**Reset a PIN:** delete the `PIN:1234` line from the rider's Session Log. They create a new one next time they sign in.

**Add a rider:** add a task in ACTIVE ROSTER with their name, plus a subtask named `Session Log - Name` containing the line `--- LOG STARTS BELOW ---`.

## Session format

Header block first, then `---` between every block.

```
SESSION_ID: S5
CATEGORY: Sprint            (Track, Sprint, Strength or Roller)
TITLE: Gate Sprints
TAGLINE: One line under the title
DURATION: 25 min
EQUIPMENT: What to bring
AGES: Over 11 only          (optional)
WARMUP:
- 5 min easy spin
COOLDOWN:
- 5 min easy spin
KEY_FOCUS: ...              (optional; also DAILY_GOAL, COACH_NOTE)
YOUNGER: Note for under 11  (optional)
OLDER: Note for 11 and over (optional)
SHOW: NO                    (optional; hides the session)
---
CIRCUIT: 1
CIRCUIT_LABEL: Sprints
ROUNDS: 6                   (a range like 2-3 starts at the top, riders can turn it down)
ROUND_WORD: Sprint          (optional: Lap, Sprint, Round...)
REST_BETWEEN: 50 sec        (the timer counts this between rounds)
REST_AFTER: 3 min           (the timer counts this before the next circuit)
OPTION: Downhill            (optional; circuits with different OPTIONs become a pick-one choice)
---
NAME: Sprint
REPS: 10 seconds            (seconds or minutes = a countdown timer)
FORM: How to do it
VIDEO: https://youtube.com/...
```

**How the timer behaves**

- Every move in a circuit timed (seconds or minutes): the circuit runs itself. One Start, beeps at each change, rest counted in between.
- Mixed circuit: one move per screen with **Done, next**. A timed move gets a Start timer button. Rest between rounds counts down on its own.
- Finishing a session logs it to that day automatically. Track sessions can also be logged by hand from the home screen or the Sessions list.

## Retiring the summer app

When this is live, put `netlify-redirect/index.html` up on the old Netlify site so the old link forwards here. Then move Westin, Maverick, Cameron, Davis and Noah into ACTIVE ROSTER.
