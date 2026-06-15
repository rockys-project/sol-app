<div align="center">

<br />

<img src="https://img.shields.io/badge/platform-Android%20%7C%20iOS-black?style=flat-square" />
<img src="https://img.shields.io/badge/built%20with-Expo%2054-blue?style=flat-square" />
<img src="https://img.shields.io/badge/React%20Native-New%20Architecture-green?style=flat-square" />
<img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square" />
<img src="https://img.shields.io/badge/AI-Claude%203.5%20Haiku-orange?style=flat-square" />

<br /><br />

# Sol

**Every day, it rises.**

*A daily recovery app that helps people rebuild life — one small thing at a time.*

<br />

</div>

---

## What is Sol

Sol is not a mental health app. It is not a wellness tracker. It does not send motivational quotes or ask you to rate your mood on a scale.

Sol gives you **one small task each day**. You hold your finger on it. It fills with light. You did a thing.

Built for people recovering from depression, anxiety, burnout, grief, illness, job loss, heartbreak — or simply feeling stuck and not knowing where to start.

> The name means sun in multiple languages. The tagline writes itself.

---

## How it works

**Three screens. No more will ever be added.**

### Screen 1 — Onboarding
Two questions. No account. No email. Sol learns what is hard right now and assigns a starting task that matches.

### Screen 2 — Today
Your task fills the screen. Press and hold anywhere on the card. An amber fill expands from your fingertip. A ring closes around it. At 85% — the card wiggles. At 100% — a burst of light, a haptic thud, and it is done.

No buttons. No menus. Just the card and your hand.

### Screen 3 — Good night
A single quiet message. Then back to tomorrow.

---

## The phase system

Sol watches without telling you it is watching.

| Phase | Unlocks after | Cards per day |
|---|---|---|
| 1 | Day one | 1 card |
| 2 | 7 days of consistent completion | Up to 2 cards |
| 3 | 14 days, including Meaningful tasks | Up to 3 cards |

When you move to phase 2, you wake up the next morning and there are two cards. Sol says nothing about it. It trusts you to notice.

Card 1 is always a phase 1 task — the foundation never leaves. Card 2 is always a phase 2 task. Card 3 is always phase 3. Pull up on the active card to peek at what is waiting below.

---

## Design

Everything in Sol is deliberately minimal.

```
Background    #F9F7F4   warm off-white
Amber         #BA7517   the only accent colour — ever
Amber dark    #633806   task titles, the icon mark
```

One accent colour. One gesture. One task. The constraint is the point.

---

## AI integrations

Sol uses Claude 3.5 Haiku across four features. Every integration degrades gracefully — if the API is unavailable, the app continues with its rule-based fallbacks without error.

| Feature | What it does | Fallback |
|---|---|---|
| **AI intake** | After the two onboarding questions, Claude selects the most appropriate first task from the library and writes a warm, personalised intake summary stored against the user | Rule-based task mapping |
| **Voice task edit** | Tap the mic → type what you want ("something easier", "I want fresh air", "something to eat") → Claude matches it to the best task from the library with a brief explanation | User dismisses and keeps current task |
| **Personalised completion message** | Claude writes a unique closing sentence for GoodNightScreen based on the task completed, outcome, phase, and time of day — displayed with a typewriter animation | Random pick from 80 static messages |
| **AI crisis detection** | Claude classifies free-text input for acute distress signals with nuanced understanding of indirect language, hopelessness, and finality — not just keyword matching | Keyword list fallback |

**Also:** long-press the mic button to hear the current task read aloud via `expo-speech` (text-to-speech, en-GB).

### Setup

```bash
cp .env.example .env
# Add your Anthropic API key to .env
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

All AI calls live in `store/ai.ts`. The model is `claude-3-5-haiku-20241022` — fast enough for mobile, cheap enough for the £2.99/month price point.

---

## Tech stack

- **React Native** with Expo SDK 54 (New Architecture enabled)
- **expo-sqlite** — all data stored on-device, no server, no cloud sync
- **react-native-reanimated v3** — hold gesture fill, ring, burst, wiggle
- **react-native-gesture-handler v2** — `Gesture.Race()` for hold vs peek
- **react-native-svg** — animated SVG fill with ClipPath
- **@react-navigation/stack** — three screens, `animation: 'none'`
- **TypeScript** — strict, no `any`
- **expo-haptics** — one Heavy impact at completion
- Custom navigation entry via `registerRootComponent` (expo-router bypassed entirely)

---

## Architecture

```
sol-app/
├── app/
│   └── index.tsx              NavigationContainer — routes to correct screen
├── screens/
│   ├── OnboardingScreen.tsx   first launch only — two questions, task assignment
│   ├── TodayScreen.tsx        the main screen — multi-card logic
│   └── GoodNightScreen.tsx    post-completion — rotating quiet messages
├── components/
│   ├── SolHeader.tsx          icon mark + wordmark, 5-tap dev panel unlock
│   ├── HoldGesture.tsx        hold fill, ring, burst, wiggle, peek animation
│   ├── DevPanel.tsx           dev-only bottom sheet (DEV builds only)
│   └── CrisisModal.tsx        crisis keyword detection — Samaritans 116 123
├── store/
│   ├── database.ts            all SQLite operations — card slots, logs, user
│   ├── phaseLogic.ts          pure functions — phase transitions, task selection
│   ├── cardLogic.ts           card slot assignment (slot N = phase N tasks)
│   └── recoveryArc.ts         arc progression + return task logic
├── data/
│   ├── tasks.json             20 tasks — the starting library
│   ├── messages.json          80 screen 3 messages (40 completed, 40 skipped)
│   └── arcs.json              5 recovery arc sequences
├── constants/
│   ├── colors.ts              Sol colour system
│   ├── spacing.ts             spacing and radius values
│   └── fonts.ts               typography scale
└── types/
    └── index.ts               all shared TypeScript types
```

---

## The task library

20 tasks across 8 recovery domains:

| Domain | Examples |
|---|---|
| Light & environment | Open the blinds. Step outside the door. |
| Body movement | Stretch for two minutes. Walk to the end of the street. |
| Food & water | Drink a glass of water. Make something simple to eat. |
| Hygiene & appearance | Wash your face. Change into clean clothes. |
| Space & order | Clear one surface. Take out the rubbish. |
| Social connection | Text someone you trust. Reply to one message. |
| Work & responsibility | Open one thing you have been avoiding. |
| Future & identity | Write one sentence about something you look forward to. |

Each task has a phase (1–3), difficulty (1–10), a family group for fallback resolution, and a brief neuroscience note explaining why this task matters in recovery.

---

## Recovery arcs

Five optional narrative progressions that guide a user through a domain over several days:

- **Bed to outside** — light exposure and movement
- **Eating again** — food and water baseline
- **Reconnecting** — social re-entry, one message at a time
- **Restoring order** — reclaiming space
- **Finding light** — identity and future

Arcs run in the background. The user never sees the arc name.

---

## Getting started

```bash
git clone https://github.com/your-username/sol-app.git
cd sol-app
npm install
npx expo start --clear
```

Scan the QR code with Expo Go (Android) or your device camera (iOS).

### Prerequisites

- Node 20+
- Expo CLI
- Android device or emulator (Android first — iOS support coming)

---

## Running on device

Sol is built Android-first. For best results use a physical device with Expo Go.

```bash
# Start with cache clear (required after native module changes)
npx expo start --clear
```

The dev panel is available in development builds only. Tap the **Sol** wordmark five times quickly to open it. From there you can set phase, simulate history, and fast-forward through flows.

---

## Data and privacy

Everything stays on the device.

- No account required
- No server
- No analytics
- No tracking
- SQLite database stored locally via expo-sqlite
- Full reset available from the dev panel (dev builds) or by reinstalling

---

## Pricing

14 days free. Then **£2.99/month**. Cancel anytime.

No free tier with features locked. No dark patterns. If the app helps, you pay. If it stops helping, you leave.

---

## Status

Active development. Android MVP targeting Q3 2025.

---

## Licence

Private repository. All rights reserved.

---

<div align="center">

*Sol — Every day, it rises.*

</div>
