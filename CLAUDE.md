# Sol — Project Brief for Claude Code

---

## What is Sol

Sol is a **daily recovery app**. Not a mental health app. Not a wellness app.

> Sol helps people rebuild daily life — one small thing at a time.

For people recovering from depression, anxiety, burnout, grief, illness,
breakup, job loss, or simply feeling stuck.

**Name:** Sol — means sun in multiple languages
**Tagline:** Every day, it rises.
**Screens:** Exactly three. No more will ever be added.
**Pricing:** 14 days free. Then £2.99/month. Cancel anytime.
**Platform:** Android first, iOS later. React Native + Expo.

---

## Core Rules — Read Before Writing Any Code

- TypeScript only — no .js files
- No `any` types
- StyleSheet.create() only — no inline styles
- Import colours from constants/colors.ts only
- Import spacing from constants/spacing.ts only
- One component per file, default export always
- try/catch on every database operation
- Never add a feature not in this file without asking
- When in doubt — do less, not more
- Build and test one step at a time — never skip ahead

---

## Colour Scheme

```
Background:      #F9F7F4   warm off-white — every screen
Surface:         #FFFFFF   card backgrounds
Border:          #E8E4DC   all borders — always 0.5 width
Text primary:    #1A1714   headings and important text
Text secondary:  #6B6760   body text and descriptions
Text tertiary:   #9E9B95   hints, labels, timestamps

Amber:           #BA7517   Sol's ONLY accent colour
Amber light:     #FAEEDA   task card background
Amber mid:       #EF9F27   particle burst and highlights
Amber dark:      #633806   task titles, icon background
Amber border:    #FAC775   borders on amber surfaces
Task text:       #854F0B   task description text on card
```

---

## Typography

```
Heading:    fontSize 17, fontWeight 600, letterSpacing -0.2
Task title: fontSize 15, fontWeight 600, letterSpacing -0.2
Body:       fontSize 13, fontWeight 400, lineHeight 20
Task desc:  fontSize 12, fontWeight 400, lineHeight 18
Small:      fontSize 11, fontWeight 400, lineHeight 16
Tiny:       fontSize 10, fontWeight 400, letterSpacing 0.5
Wordmark:   fontSize 14, fontWeight 600, letterSpacing -0.2
```

---

## Spacing and Radius

```
Screen padding:  16
Card padding:    18
Gap:             12
Gap large:       20
Card radius:     16
Input radius:    10
Pill radius:     20
Icon radius:     6
```

---

## Project Structure

```
sol-app/
├── app/
│   └── index.tsx              entry point — routes to correct screen
├── screens/
│   ├── OnboardingScreen.tsx   screen 1 — first launch only
│   ├── TodayScreen.tsx        screen 2 — the main screen
│   └── GoodNightScreen.tsx    screen 3 — after task completion
├── components/
│   ├── SolHeader.tsx          sol icon mark + wordmark — shared
│   ├── TaskCard.tsx           the amber task card
│   ├── HoldGesture.tsx        expand fill + wiggle + burst logic
│   └── CrisisModal.tsx        crisis detection modal
├── store/
│   ├── database.ts            all SQLite operations
│   ├── phaseLogic.ts          pure functions — phase transitions and task selection
│   ├── recoveryArc.ts         arc progression + return task logic
│   └── notifications.ts       push notification scheduling
├── data/
│   ├── tasks.json             20 tasks — the task library
│   ├── messages.json          80 screen 3 messages
│   └── arcs.json              recovery arc sequences
├── constants/
│   ├── colors.ts              sol colour system
│   ├── spacing.ts             spacing and radius values
│   └── fonts.ts               typography scale
└── types/
    └── index.ts               all shared TypeScript types
```

---

## Packages Required

```
expo-sqlite
expo-haptics
expo-notifications
expo-speech
react-native-svg
react-native-reanimated
react-native-gesture-handler
@react-navigation/native
@react-navigation/stack
react-native-screens
react-native-safe-area-context
@react-native-async-storage/async-storage
uuid
react-native-get-random-values
```

---

## TypeScript Types — types/index.ts

```
TaskCategory:    'Pleasant' | 'Mastery' | 'Meaningful'
TaskOutcome:     'completed' | 'skipped'
Phase:           1 | 2 | 3
TimeOfDay:       'morning' | 'afternoon' | 'evening' | 'any'

RecoveryDomain:
  light_environment
  body_movement
  food_water
  hygiene_appearance
  space_order
  social_connection
  work_responsibility
  future_identity

Task:
  id             string
  title          string
  description    string
  category       TaskCategory
  difficulty     number (1-10)
  phase          Phase
  time_of_day    TimeOfDay
  neuroscience   string
  domain         RecoveryDomain
  family_id      string — groups related tasks together
  family_level   number (1-10) — position within the family

  NOTE: No fallback_id or fallback fields on the task.
  Fallbacks are resolved at runtime from the same family.
  See fallback logic section below.

TaskLog:
  id, user_id, task_id, task_title
  task_difficulty, task_category, task_domain
  outcome, logged_at, time_of_day

User:
  id, intake_summary, current_phase
  preferred_hour, created_at, last_active
  active_arc_id, arc_position

RecoveryArc:
  id, name, domain, task_sequence (string[])
```

---

## Fallback Logic — How It Works

When a user cannot complete a task, the app never shows a blank screen
or gives up. It finds a simpler version from within the same task family.

**Rule 1 — Look within the same family first**
Find all tasks with the same family_id as the current task.
Find the one with the highest family_level that is still lower
than the current task's family_level.
Serve that task.

**Rule 2 — If no lower family member exists**
This happens when the task is already at family_level 1,
or when the library is still small (20 tasks MVP).
Fall back to the lowest difficulty task in the current phase.

**Rule 3 — Same phase always**
Fallback tasks must always be within the user's current phase.
Never serve a phase 2 fallback to a phase 1 user.

**Example with current 20-task library:**

```
User skips T09 (outside_001, level 3, diff 4)
→ Look in outside_001 for level < 3
→ Find T07 (outside_001, level 1, diff 3)
→ Serve T07

User skips T19 (movement_001, level 6, diff 8)
→ Look in movement_001 for level < 6
→ Find T11 (movement_001, level 3, diff 5)
→ Serve T11

User skips T16 (social_001, level 5, diff 6)
→ Look in social_001 for level < 5
→ Find T15 (level 4), T14 (level 3), T12 (level 2)
→ Serve highest level below 5 → T15 (level 4)

User skips T01 (light_001, level 1, diff 2)
→ Look in light_001 for level < 1
→ Nothing found
→ Secondary fallback: lowest difficulty phase 1 task
→ Serve T02 (difficulty 1)

User skips T02 (breath_001, level 1, diff 1)
→ Look in breath_001 for level < 1
→ Nothing found
→ Secondary fallback: lowest difficulty phase 1 task
→ T02 is already that task — serve T03 (next lowest)
```

**As the library grows from 20 → 60 → 120 → 300 tasks,
this logic automatically gets smarter because more family
members appear at lower levels. No code changes needed.**

**getFallbackTask function — store/phaseLogic.ts**
```
getFallbackTask(
  currentTask: Task,
  allTasks: Task[],
  currentPhase: Phase
): Task

Logic:
1. Filter allTasks to same family_id as currentTask
2. Filter those to family_level < currentTask.family_level
3. Filter those to phase <= currentPhase
4. If any found: return the one with highest family_level
5. If none found: return lowest difficulty task
   where phase <= currentPhase, excluding currentTask
```

---

## Database Schema — SQLite

**users**
- id TEXT PRIMARY KEY
- intake_summary TEXT DEFAULT ''
- current_phase INTEGER DEFAULT 1
- preferred_hour INTEGER DEFAULT 9
- created_at TEXT
- last_active TEXT
- active_arc_id TEXT (nullable)
- arc_position INTEGER DEFAULT 0

**task_log**
- id TEXT PRIMARY KEY
- user_id TEXT (foreign key → users)
- task_id TEXT
- task_title TEXT
- task_difficulty INTEGER
- task_category TEXT
- task_domain TEXT
- outcome TEXT
- logged_at TEXT
- time_of_day TEXT
- card_position INTEGER DEFAULT 1   (1, 2, or 3 — position in the day's stack)

**app_state** (key-value for things like last message index)
- key TEXT PRIMARY KEY
- value TEXT

---

## Database Functions Required — store/database.ts

```
initDatabase()
getOrCreateUser()
getTodayTask(userId)
logTaskOutcome(userId, taskId, task, outcome)
getRecentHistory(userId, days)
getUserPhase(userId)
updateUserPhase(userId, phase)
updateUserArc(userId, arcId, position)
updateLastActive(userId)
getDaysSinceLastActive(userId)
getLastMessageIndex(type)
setLastMessageIndex(type, index)
clearAllData()
```

---

## Phase Logic Rules — store/phaseLogic.ts

Pure functions only — no database calls inside.

**shouldProgressToPhase2(history)**
- 80% completion rate over last 7 days
- Only count entries with difficulty 1–3
- Minimum 7 entries required

**shouldProgressToPhase3(history)**
- 75% completion over last 14 days
- AND at least 2 completed Meaningful tasks
- Minimum 14 entries required

**shouldRegress(history)**
- Completion below 40% for last 3 consecutive days
- Minimum 3 entries — ONE bad day triggers nothing

**getNextTaskId(history, phase, tasks, timeOfDay, arcId, arcPosition, arcs)**
Priority order:
1. Active arc task if available and matches phase
2. Phase-appropriate tasks only
3. Avoid tasks seen in last 7 days
4. Balance domains — no same domain 3 days running
5. Balance categories — no same category 3 days running
6. Prefer tasks matching current time of day
7. Fallback: lowest difficulty task in current phase
8. Always return a valid task ID — never null

**getFallbackTask(currentTask, allTasks, currentPhase)**
As described in the fallback logic section above.

---

## Recovery Arc Logic — store/recoveryArc.ts

**getReturnTask(daysSinceLastActive, tasks)**
- 3–6 days away → difficulty 1–2 phase 1 task
- 7–13 days away → difficulty 1 only
- 14–29 days away → T02 relaxation sigh
- 30+ days away → T02, full soft reset

**getReturnMessage(daysSinceLastActive)**
- 3–6 days: Something small is ready.
- 7–13 days: Good to start again.
- 14–29 days: Let us start gently.
- 30+: Take one deeper breath.

---

## The 8 Recovery Domains

Internal only — user never sees these labels.
Never serve same domain 3 days in a row.

```
light_environment    mood, rhythm, circadian stability
body_movement        energy, exercise, nervous system
food_water           basic care, nutrition
hygiene_appearance   self-respect, readiness
space_order          control, calm, agency
social_connection    support, courage, belonging
work_responsibility  focus, usefulness, independence
future_identity      meaning, direction, hope
```

---

## The 20 Launch Tasks

No hardcoded fallbacks — fallbacks resolved from family at runtime.

```
ID   Title                                     Cat        Diff Phase Domain              Family         Level
T01  Wake up — open the curtains               Meaningful 2    1     light_environment   light_001      1
T02  The relaxation sigh                       Mastery    1    1     body_movement       breath_001     1
T03  Relax your jaw and forehead               Mastery    1    1     body_movement       body_001       1
T04  Find one thing going right                Meaningful 3    1     future_identity     gratitude_001  1
T05  Visit a happy memory                      Pleasant   2    1     future_identity     memory_001     1
T06  Brush your teeth and wash your face       Mastery    2    1     hygiene_appearance  hygiene_001    1
T07  Step outside the door                     Pleasant   3    1     body_movement       outside_001    1
T08  Make one small decision                   Mastery    4    1     space_order         decision_001   1
T09  Walk to a café and sit for a while        Pleasant   4    2     social_connection   outside_001    3
T10  Finish one tiny chore                     Mastery    4    2     space_order         order_001      2
T11  Go for a walk — no destination needed     Meaningful 5    2     body_movement       movement_001   3
T12  Text someone you trust                    Meaningful 5    2     social_connection   social_001     2
T13  Cook one simple meal                      Mastery    5    2     food_water          food_001       5
T14  Sit somewhere with people nearby          Pleasant   5    2     social_connection   social_001     3
T15  The 20-second hug                         Pleasant   5    2     social_connection   social_001     4
T16  Call someone — even for five minutes      Meaningful 6    3     social_connection   social_001     5
T17  Do something for someone else             Meaningful 6    3     social_connection   social_001     6
T18  Write about something you look forward to Meaningful 7    3     future_identity     future_001     3
T19  Move your body hard for 20 minutes        Mastery    8    3     body_movement       movement_001   6
T20  Sit with your own thoughts for 5 minutes  Meaningful 9    3     future_identity     future_001     5
```

**Family relationships — what fallback resolves to at MVP:**

```
T09 skipped → T07 (same family outside_001, level 1)
T11 skipped → secondary fallback — only member of movement_001 at lower level
T12 skipped → secondary fallback — lowest level in social_001 is T12 itself
T13 skipped → secondary fallback — only member of food_001
T14 skipped → T12 (social_001, level 2)
T15 skipped → T14 (social_001, level 3)
T16 skipped → T15 (social_001, level 4)
T17 skipped → T16 (social_001, level 5)
T18 skipped → T04 or T05 (future_identity, lower levels)
T19 skipped → T11 (movement_001, level 3)
T20 skipped → T18 (future_identity, level 3)
T01 skipped → secondary fallback (only in light_001)
T02 skipped → secondary fallback (only in breath_001)
T03 skipped → secondary fallback (only in body_001)
T04 skipped → secondary fallback (only in gratitude_001)
T05 skipped → secondary fallback (only in memory_001)
T06 skipped → secondary fallback (only in hygiene_001)
T07 skipped → secondary fallback (only level 1 in outside_001)
T08 skipped → secondary fallback (only in decision_001)
T10 skipped → secondary fallback (only in order_001)
```

As the library expands, more families gain multiple members
and the fallback system becomes richer automatically.

---

## Screen 3 Messages — data/messages.json

**Completed (40 messages):**
Good night. / Rest well. / That is enough. / You showed up.
Well done today. / You did something. / That mattered. / Rest now.
Today counted. / You were here. / Something shifted. / That was real.
Good. Rest. / You did that. / It all counts. / Sleep well.
That was brave. / You moved forward. / Today was enough. / That is everything.
You turned up. / That took something. / Quietly done. / That stays with you.
You did it. / Small and real. / That is yours. / Well done.
You kept going. / That was enough. / It counted. / Rest now.
You chose that. / That was real. / Good. Sleep. / You did well.
That is the thing. / Enough for today. / You were there. / Rest well now.

**Skipped (40 messages):**
That is okay. / Rest well. / You opened the app. / That matters.
No rush. / Be gentle tonight. / Still here. / Still okay.
That is fine. / You showed up. / Rest now. / Some days are harder.
That is allowed. / You are still here. / That is what counts. / Sleep well.
No pressure. / You opened it. / That was enough. / Still counts.
Just being here. / That is something. / Gentle tonight. / That is real.
You tried. / That counts. / Rest now. / No guilt here.
You are okay. / This is okay. / Rest well. / Tomorrow is there.
That is fine. / Be kind tonight. / You opened it. / That matters.
Still here. / That is enough. / Gentle now. / Rest.

---

## Recovery Arcs — data/arcs.json

```
arc_bed_to_outside    body_movement      T03 → T02 → T07 → T06 → T11 → T09
arc_eating_again      food_water         T08 → T06 → T10 → T13
arc_reconnecting      social_connection  T05 → T12 → T14 → T15 → T16 → T17
arc_restoring_order   space_order        T08 → T10 → T13
arc_finding_light     light_environment  T01 → T07 → T05 → T04 → T18
```

---

## Extra Card Logic — How Multiple Tasks Appear

This is one of the most important behaviours in Sol.
The user never sees a menu, a list, or a schedule.
Extra cards appear silently based on phase — nothing is announced.

### How many cards show per phase

```
Phase 1:  1 card only — always
Phase 2:  up to 2 cards
Phase 3:  up to 3 cards — permanent maximum, forever
```

### When a new card appears

A second or third card does NOT appear on the day the user
progresses to a new phase. It appears the NEXT morning quietly.
No message. No announcement. It is just there.

The user wakes up, opens Sol, and there are two cards.
Sol trusts them to notice. Nothing is said about it.

### How cards are ordered on screen

Cards stack vertically. The first card is always the
current active task — the one they need to hold to complete.

Phase 2 example:
```
Card 1 (active):  Step outside the door
Card 2 (next):    Text someone you trust
```

Phase 3 example:
```
Card 1 (active):  Step outside the door
Card 2:           Text someone you trust
Card 3:           Write about something you look forward to
```

Card 1 is always a phase 1 task — the foundation never leaves.
Card 2 is always a phase 2 task.
Card 3 is always a phase 3 task.

### How the user moves between cards

The user completes card 1 by holding it.
Burst fires. Card 1 dissolves.
Card 2 slides up and becomes the active card.
The user can then hold card 2 to complete it.

If they do not want to complete card 2 — they close the app.
Card 2 remains waiting for them tomorrow or when they return.

### The pull gesture

Before card 1 is completed, the user can pull up to peek
at the next card — but cannot complete it until card 1 is done.

Three amber dots at the bottom of the active card pulse gently.
These dots are ONLY visible when a next card exists.
In phase 1 — no dots. Ever.

Pulling up slides card 2 into partial view below card 1.
The user sees it is there. They can slide it back down.
This is not a notification or an obligation — just a glimpse.

### Completing all cards in a day

If a user completes all their cards in one session:
- Each card completes in sequence — burst, dissolve, next slides up
- After the final card completes — navigate to GoodNightScreen
- Screen 3 message is for the final completion of the day

### What happens if a card is not completed

Cards do not expire. If the user closes the app after completing
card 1 but not card 2, tomorrow they still have card 2 waiting
plus a fresh card 1 assigned for the new day.

The incomplete card is not flagged, not mentioned, not shamed.
It simply remains available.

### Notification and cards

The daily notification always refers to card 1 — the first task.
The notification never counts how many cards are waiting.
Title: Something small is ready.
Body: Whenever you feel like it.

### Database — how to track this

Each card is a separate row in task_log with its own task_id.
The position of the card (1, 2, or 3) is tracked by
the order tasks are assigned each day.

task_log needs a card_position column:
- card_position INTEGER DEFAULT 1

When fetching today's tasks, order by card_position ascending.
Card 1 is always the active card until completed.

---

## The Three Screens

### Screen 1 — OnboardingScreen
- Shows only on first launch — check AsyncStorage onboarding_complete
- If key exists: navigate immediately to TodayScreen
- Two tap questions with pill options:
  - How are things feeling right now? → Heavy / Okay-ish / Really hard
  - What feels most impossible right now? → Leaving the house / Being around people / Basic things like eating and sleeping
- Answer to task mapping:
  - Heavy + Leaving the house → T07
  - Heavy + Being around people → T05
  - Heavy + Basic things → T06
  - Okay-ish + anything → T08
  - Really hard + anything → T02
- Start button appears only when both questions answered
- On complete: create user in SQLite, save first_task_id to AsyncStorage, set onboarding_complete, navigate to TodayScreen
- Crisis detection runs on any voice input

### Screen 2 — TodayScreen
- Sol header at top
- Greeting: Good morning. / Good afternoon. / Good evening.
- Task card fills all remaining space between header and mic row
- Mic icon bottom right + edit via voice label
- NO buttons anywhere — gesture only

**Hold gesture:**
- Press and hold anywhere on card
- Amber fill expands from exact touch point outward
- SVG ring fills as secondary indicator
- At 85%: card wiggles using Reanimated rotation oscillation
- At 100%: haptic Heavy + particle burst from touch point + card dissolves
- Navigate to GoodNightScreen with outcome completed
- Release before 100%: smoothly reset fill and ring

**Pull gesture:**
- Three amber dots at bottom of card, pulsing gently
- Label: pull for next in 9px
- Only visible if second task exists today
- Upward swipe: next task slides up
- Never visible in phase 1

### Screen 3 — GoodNightScreen
- Background #F9F7F4
- Sol header at top
- Sol icon mark centred (44x44, borderRadius 12, background #633806)
- Message: 2–5 words from messages.json based on outcome
- Never same message twice in a row — track in SQLite app_state
- Tap after 3 seconds → TodayScreen
- Tap before 3 seconds → nothing
- Nothing else on this screen

---

## What Sol NEVER Does

- NO mood tracking or ratings
- NO streaks or day counters
- NO percentages or completion rates
- NO progress bars or charts
- NO badges or achievements
- NO phase labels shown to user
- NO calendar or schedule view
- NO upcoming task list
- NO tomorrow's task preview
- NO Done button or Not Today button
- NO second notification if first ignored
- NO animation between screens — instant transitions
- NO clinical language in any user-facing text
- NO mention of depression, anxiety, therapy in UI
- NO welcome back or mention of missed days

---

## Sol Voice — All User-Facing Text

Never write: Well done / Great job / You should feel proud /
Tomorrow will be better / You are making progress /
Do not give up / Welcome back / You missed X days /
Any clinical vocabulary

Always write: warm, brief, present, honest.
Maximum two sentences. Never promises outcomes.

---

## Crisis Detection

Runs before any other logic on voice input.
Never passes content to AI or logs it.

Keywords: harm, hurt myself, end it, ending it,
not want to be here, no point, hopeless, can't go on,
want to die, suicidal, kill myself, disappear forever,
nobody would care, no reason to live, better off without me

When triggered:
- Full screen CrisisModal — blocks everything
- Sol is here with you. Please reach out to someone who can help right now.
- Samaritans: 116 123
- Call now button → opens dialler to 116 123
- Does not continue normal flow

---

## Notification Rules

- One per task — never a second nudge
- Never outside 7am–9pm
- Title: Something small is ready.
- Body: Whenever you feel like it.
- Never mention task name
- preferred_hour: 9 / 14 / 18

---

## Dev Panel — Testing Only

Visible only when __DEV__ is true.
Five rapid taps on Sol wordmark → bottom sheet modal.

Controls:
- Set Phase 1 / 2 / 3
- Simulate 7 days completed
- Simulate 3 days low completion
- Simulate 14 days away
- Simulate 30 days away
- Complete today's task
- Skip today's task
- Full reset — clears all SQLite + AsyncStorage

State display: current phase, active arc, last 7 task_log entries.

---

## Build Steps

### Step 1 — Project setup
**Goal:** Fresh Expo project on D drive outside OneDrive.
**What to create:** Expo project using create-expo-app latest, run reset-project.
**Test:** app/index.tsx exists and is nearly empty. No errors in terminal.

### Step 2 — Sol splash screen
**Goal:** Replace default screen with Sol wordmark. Confirm on phone.
**What to create:** app/index.tsx with Sol wordmark centred on #F9F7F4 background.
**Test:** Phone shows warm background, Sol in #633806, tagline in #9E9B95.

### Step 3 — Folder structure and constants
**Goal:** All folders and design system constants in place. Packages installed.
**What to create:** All folders. constants/colors.ts, spacing.ts, fonts.ts. Install all packages.
**Test:** All folders exist. Constants importable. App still loads on phone.

### Step 4 — Types
**Goal:** All TypeScript types defined and exported.
**What to create:** types/index.ts with all types above. Note: Task has no fallback fields.
**Test:** No TypeScript errors. Types importable everywhere.

### Step 5 — Data files
**Goal:** Task library, messages, and arcs ready.
**What to create:** data/tasks.json with 20 tasks. data/messages.json with 40+40 messages. data/arcs.json with 5 arcs.
**Test:** Valid JSON — verify at jsonlint.com. tasks.json has 20 items, no fallback fields. messages.json has two arrays of 40. All task IDs in arcs exist in tasks.json.

### Step 6 — SQLite database
**Goal:** Database initialises. All operations work.
**What to create:** store/database.ts with all functions listed above.
**Test:** initDatabase runs cleanly. getOrCreateUser returns a User. logTaskOutcome inserts a row. getRecentHistory returns it. getUserPhase returns 1 for new user.

### Step 7 — Phase logic
**Goal:** Phase transitions and fallback task resolution work correctly.
**What to create:** store/phaseLogic.ts with shouldProgressToPhase2, shouldProgressToPhase3, shouldRegress, getNextTaskId, and getFallbackTask.
**Test:**
- shouldProgressToPhase2 true for 7 days 80%+ completion
- shouldProgressToPhase2 false for 5 days only
- shouldRegress true for 3 days below 40%
- shouldRegress false for single bad day
- getFallbackTask for T09 returns T07 (same family, lower level)
- getFallbackTask for T01 returns lowest difficulty phase 1 task
- getFallbackTask for T19 returns T11 (same family, lower level)
- getNextTaskId never returns wrong phase task, never null

### Step 8 — Recovery arc logic
**Goal:** Return task and arc progression work.
**What to create:** store/recoveryArc.ts with getReturnTask and getReturnMessage.
**Test:** 30 days returns T02. 14 days returns difficulty 1 task. 4 days returns phase 1 task.

### Step 9 — Sol header component
**Goal:** Reusable header ready for all three screens.
**What to create:** components/SolHeader.tsx. Icon mark in #633806. Sol wordmark next to it.
**Test:** Renders correctly when imported on any screen.

### Step 10 — Screen 3 Good Night
**Goal:** Simplest screen first. Builds confidence.
**What to create:** screens/GoodNightScreen.tsx. Header. Centred icon (44x44). Message text. Tap after 3 seconds navigates to TodayScreen.
**Test:** Background #F9F7F4. Message 2-5 words. Different for completed vs skipped. Tap before 3 seconds does nothing. Tap after navigates. No buttons. No mention of tomorrow.

### Step 11 — Screen 2 task card layout
**Goal:** Task card visible. No gesture yet.
**What to create:** screens/TodayScreen.tsx with header, greeting, amber task card, ring placeholder, mic row. Show T07 hardcoded for now.
**Test:** Card #FAEEDA background, 0.5px #FAC775 border. Title #633806 fontSize 15. Description #854F0B fontSize 12. Mic row bottom right. No buttons anywhere.

### Step 12 — Hold gesture and burst
**Goal:** The real interaction. Fill from touch point. Wiggle. Burst. Haptic. Navigate.
**What to create:** components/HoldGesture.tsx using Reanimated and GestureHandler. Fill expands from exact touch point. Ring fills simultaneously. Wiggle at 85%. Haptic Heavy at 100%. Particle burst. Card dissolves. Navigate to GoodNightScreen with outcome completed.
**Test:** Fill starts from exact finger position. Different positions produce different origins. Release resets smoothly. Wiggle near end. Haptic at burst. Feels satisfying on real phone.

### Step 13 — Screen 1 Onboarding
**Goal:** First launch flow. Two questions. Maps to first task. Crisis detection.
**What to create:** screens/OnboardingScreen.tsx. Two questions with pill options. Start only when both answered. Answer mapping. Save to SQLite and AsyncStorage. CrisisModal for voice input.
**Test:** Only shows first launch. Second launch skips to TodayScreen. Both questions required. Combinations map to correct tasks. Crisis words show modal. Modal shows 116 123.

### Step 14 — Navigation and full wiring
**Goal:** All screens connected. Correct routing. Phase and fallback logic connected.
**What to create:** app/index.tsx with NavigationContainer and Stack. Check AsyncStorage on launch. Route Onboarding or TodayScreen. Connect phase logic to TodayScreen. Connect getFallbackTask so skipping a task serves the correct family fallback. Connect return task logic for users away multiple days.
**Test:** Fresh install shows Onboarding. Completing shows TodayScreen. Completing task shows GoodNightScreen. GoodNightScreen navigates back. Skipping T09 serves T07 not a random task. Reopening app skips Onboarding. No tab bar. No back button. No screen animation.

### Step 15 — Notifications
**Goal:** One daily push at user's preferred time.
**What to create:** store/notifications.ts. Request permission after onboarding. Schedule one daily notification within 7am-9pm. Correct title and body.
**Test:** Permission prompt after onboarding. Title: Something small is ready. Body: Whenever you feel like it. No task name. Fires at correct hour.

### Step 16 — Dev panel
**Goal:** Hidden testing tool.
**What to create:** components/DevPanel.tsx. Five taps on Sol wordmark. __DEV__ only. All controls listed above.
**Test:** Five taps opens panel. Not visible in production. Simulate 7 days triggers phase check. Skipping a task in dev correctly serves family fallback. Full reset returns to first launch.

---

## Current Status

Step 1: Project created at D:\Projects\sol-app ✓
Step 2: Expo running, Expo Go on Android ✓
Step 3: Next to build
