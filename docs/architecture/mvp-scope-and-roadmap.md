# MVP Scope and Roadmap for AI-Powered Text RPG Platform

## Purpose

This document defines the MVP scope and phased development roadmap for the AI-powered text RPG platform.

It is meant to be used together with:

- [mysql-schema.md](D:\AGATE\Projekan\AI-Chatbot-Rolepay\docs\architecture\mysql-schema.md)
- [backend-domain-model.md](D:\AGATE\Projekan\AI-Chatbot-Rolepay\docs\architecture\backend-domain-model.md)

This file explains:

- what the MVP should include
- what the MVP should explicitly exclude
- the order we should build features
- technical milestones
- delivery risks
- validation checkpoints

## Product Goal

The MVP is not a generic chatbot website.

The MVP is:

**a web app where creators can build an AI-powered text-based RPG world and players can play it through persistent room-based sessions with AI narration**

The MVP must prove these three things:

1. creators can build a playable world
2. players can play through that world with persistent state
3. AI improves narration and interaction without controlling canonical game logic

---

## MVP Success Criteria

The MVP is successful if a creator can:

- create an account
- make a world
- create rooms and connect them with exits
- add lore, NPCs, items, and quests
- publish a playable version

And a player can:

- browse or open a published world
- start a session
- move through rooms
- inspect the world
- talk to NPCs
- pick up and use items
- make progress in at least a simple quest
- save and resume progress

And the system can:

- keep canonical state stable
- stream or return AI narration reliably
- log turns and AI usage
- recover from AI failure without corrupting the session

---

## Core MVP Experience

### Creator Experience

The creator should be able to:

- create a world
- write world title and summary
- create regions
- create rooms
- connect rooms via exits
- choose a start room
- write room descriptions
- add lore entries
- create NPCs with personality prompts
- create items
- create one or more quests
- configure a simple UI layout
- publish the world

### Player Experience

The player should be able to:

- sign in
- open a published world
- create or choose a persona
- start a new session
- see current room and visible exits
- submit freeform or quick actions
- move between rooms
- inspect room objects
- talk to NPCs
- view inventory
- view active quests
- see AI-generated narration
- save and resume

### Admin / Operator Experience

For MVP, minimal operator tools are enough:

- review reported worlds or content
- suspend abusive users manually
- inspect AI failures and session logs

---

## Explicit MVP Boundaries

To keep the project buildable, MVP should stay narrow.

### In Scope

- web-first app
- single-player sessions
- room/exit graph traversal
- AI narration
- AI NPC dialogue
- deterministic item, quest, and flag progression
- save/load
- creator builder for core world content
- modular UI layout in a limited form
- basic modular rules support

### Out of Scope

- real-time multiplayer sessions
- simultaneous collaborative world editing
- deep marketplace/community economy
- advanced combat simulator
- large-scale procedural world generation
- voice features
- mobile app
- advanced creator monetization
- in-browser scripting by users
- plugin marketplace

---

## MVP Feature Tiers

To keep decisions sharp, features are grouped by priority.

### Tier 1: Must Have

- auth
- world creation
- room creation
- exit linking
- start room config
- lore entries
- NPC creation
- item creation
- quest creation
- persona creation
- session start
- room traversal
- turn processing
- AI narration
- AI dialogue
- inventory basics
- quest progress basics
- save and resume
- turn history
- AI logging

### Tier 2: Should Have

- room interactables
- simple builder autosave
- UI layout presets
- simple event system
- AI-assisted content drafting in builder
- world tags and discovery
- reports/moderation basics

### Tier 3: Nice to Have

- branch/regenerate turn paths
- multiple world versions visible to creator
- reputation module
- survival module
- NPC memory tuning controls
- more advanced map visuals

---

## MVP Technical Strategy

### Backend Strategy

Use a modular monolith first.

Reason:

- fastest path to implementation
- easier coordination across game engine and builder
- simpler deployment on shared hosting
- lower operational complexity

### State Strategy

Use deterministic backend-owned state transitions.

Reason:

- stable saves
- testable engine
- easier debugging
- less AI state drift

### AI Strategy

Use AI for:

- narration
- NPC dialogue
- ambiguous action parsing
- summarization
- builder assistance

Do not use AI for:

- state authority
- authorization
- inventory truth
- room traversal legality
- quest completion truth

### Storage Strategy

Use:

- MySQL for canonical data
- Redis for locks, rate limits, queues, temporary streaming state
- native local file storage for uploads

---

## MVP Vertical Slices

Build the app in vertical slices, not in disconnected layers.

Each slice should produce something testable end to end.

### Slice 1: Account and World Shell

Outcome:

- users can sign up
- users can create a world
- users can open the world dashboard

Includes:

- auth
- dashboard shell
- world CRUD
- base navigation

### Slice 2: Map Builder and Traversal

Outcome:

- creators can build connected rooms
- players can move between rooms in a playable session

Includes:

- room CRUD
- exit CRUD
- start room config
- session creation
- movement turn processing
- room projection

### Slice 3: AI Narrated Exploration

Outcome:

- player movement and inspection produce AI-enhanced narration

Includes:

- prompt assembly
- inference logging
- narration generation
- failure fallback behavior

### Slice 4: NPCs and Dialogue

Outcome:

- worlds feel alive
- players can talk to NPCs with persistent context

Includes:

- NPC builder
- room NPC placement
- NPC runtime state
- dialogue turn flow

### Slice 5: Items, Inventory, and Quests

Outcome:

- players can collect things and progress goals

Includes:

- item builder
- inventory runtime state
- quest definitions
- quest progress state
- quest-driven events

### Slice 6: Builder Quality and Publish Flow

Outcome:

- creators can confidently prepare a playable release

Includes:

- autosave
- validation warnings
- publish workflow
- version snapshot
- simple world discovery metadata

---

## Phase-by-Phase Roadmap

## Phase 0: Foundation and Project Setup

Goal:

- make the codebase ready for rapid iteration

Deliverables:

- project scaffolding
- auth setup
- database connection
- Prisma setup
- Redis connection
- file upload foundation
- environment config
- shared error handling
- shared API response conventions

Definition of done:

- app boots locally
- auth works
- DB migrations run
- Redis available
- file upload path strategy defined

Risks:

- shared hosting Node constraints
- Redis support quirks
- file permission issues on uploads

Validation checkpoint:

- deployable hello-world with auth + DB + Redis ping

## Phase 1: World Builder Core

Goal:

- enable creators to define a world skeleton

Deliverables:

- world CRUD
- region CRUD
- room CRUD
- exit CRUD
- start room selection
- lore entry CRUD
- basic builder dashboard

Definition of done:

- creator can build a basic connected world without direct DB edits

Risks:

- map editor UX may become too ambitious too early

Validation checkpoint:

- internal test world with at least 10 connected rooms

## Phase 2: Runtime Session Backbone

Goal:

- make worlds playable

Deliverables:

- persona creation
- save slot creation
- session creation
- session projection API
- movement action
- room enter flow
- turn logging
- session lock handling

Definition of done:

- player can start a session and move through authored rooms with persistent state

Risks:

- session aggregate loading may become messy without good service boundaries

Validation checkpoint:

- playthrough can be saved, closed, and resumed without state loss

## Phase 3: AI Narration

Goal:

- add AI value without breaking state consistency

Deliverables:

- AI provider setup
- model preset config
- prompt assembly service
- narration prompt
- inference request logging
- AI fallback handling

Definition of done:

- every movement/inspection turn can return narration
- system still works when AI fails

Risks:

- prompt bloat
- latency
- cost
- malformed outputs

Validation checkpoint:

- 20-turn play session completes with stable room state and usable narration

## Phase 4: NPCs and Dialogue

Goal:

- support meaningful social interaction

Deliverables:

- NPC builder
- NPC room placement
- NPC runtime state
- dialogue action
- dialogue prompt
- relationship or disposition basics

Definition of done:

- player can speak to an NPC and receive contextual responses tied to world and room state

Risks:

- dialogue context getting too large
- NPC state inconsistency

Validation checkpoint:

- same NPC remembers immediate conversational context across several turns

## Phase 5: Items, Inventory, Quests

Goal:

- support progression loops

Deliverables:

- item builder
- room item placement
- take/drop/use actions
- inventory panel projection
- quest builder
- quest progress tracking
- event-triggered quest updates

Definition of done:

- player can complete at least one authored quest using item and room interactions

Risks:

- quest state becomes too ad hoc without structured conditions

Validation checkpoint:

- end-to-end test quest can be completed from fresh session start

## Phase 6: Publish Flow and MVP Hardening

Goal:

- make the platform safe enough to share with real testers

Deliverables:

- publish workflow
- world version snapshot
- basic moderation/report flow
- audit visibility
- builder validations
- error polish
- performance review

Definition of done:

- creator can publish a world and a tester can play it through the normal app flow

Risks:

- late discovery of content migration/versioning problems

Validation checkpoint:

- one curated demo world published and tested by external users

---

## MVP Demo Scenario

The MVP should be able to support one polished internal demo world.

### Demo Requirements

The demo world should include:

- 8 to 15 rooms
- 2 to 5 NPCs
- 5 to 10 items
- 1 main quest
- 2 or 3 side interactions
- at least one hidden or locked route
- at least one item-gated progression step

### Why This Matters

If the platform can support one high-quality demo world, it proves:

- builder usability
- runtime reliability
- AI usefulness
- session persistence

---

## MVP UI Scope

The UI should be intentionally limited but solid.

### Required Runtime Panels

- narration/chat panel
- room details panel
- exits/actions panel
- inventory panel
- quest log panel
- optional minimap or room graph panel

### Required Builder Screens

- world dashboard
- room editor
- exit editor
- lore editor
- NPC editor
- item editor
- quest editor
- publish screen

### Limited Modularity for MVP

For MVP, “modular UI” should mean:

- creators can choose from a few predefined layouts
- creators can enable/disable certain panels

It should **not** yet mean:

- full arbitrary drag-and-drop page-builder complexity

---

## MVP Module Scope

Modularity should start narrow.

### Core Modules for MVP

- room traversal
- inventory
- quests
- NPC dialogue

### Deferred Modules

- combat
- survival
- crafting
- reputation
- time simulation
- party tactics

These should be designed into the architecture, but not fully implemented in phase 1.

---

## Risks and Mitigations

### Risk 1: Overbuilding the Builder

Problem:

- the editor may become more complex than the runtime

Mitigation:

- prioritize functional CRUD over fancy editor UX
- use simple forms before advanced node/canvas editors where possible

### Risk 2: AI Controls Too Much

Problem:

- AI may drift into inventing state

Mitigation:

- enforce structured action proposals
- keep reducers deterministic
- never apply raw AI text as truth

### Risk 3: Shared Hosting Constraints

Problem:

- long-running Node processes and streaming may be limited

Mitigation:

- begin with standard request/response if SSE is unreliable
- keep workers lightweight
- avoid websocket-heavy architecture for MVP

### Risk 4: Prompt Explosion

Problem:

- world lore and session history can become too large

Mitigation:

- layered prompt assembly
- relevance filtering
- periodic memory summaries

### Risk 5: Schema Flexibility Becomes Chaos

Problem:

- too much JSON can make debugging hard

Mitigation:

- keep core relationships relational
- reserve JSON for module payloads and flexible configs only

### Risk 6: Quest Logic Gets Messy

Problem:

- quest conditions may become hard to reason about

Mitigation:

- keep MVP quests simple
- support only a constrained condition model in phase 1

---

## Testing Strategy by Phase

### Foundation Tests

- auth flow tests
- DB migration tests
- Redis connectivity test
- upload path validation

### Builder Tests

- world CRUD tests
- room/exits integrity tests
- publish validation tests

### Runtime Tests

- session creation tests
- movement reducer tests
- inventory reducer tests
- quest progression tests
- lock handling tests

### AI Tests

- prompt assembly tests
- structured action parse tests
- AI failure fallback tests
- token/cost logging tests

### End-to-End Tests

- create world -> publish -> start session -> play -> save -> resume

---

## Acceptance Criteria for MVP Launch

Before MVP is considered launch-ready:

1. a creator can build and publish a world without manual database intervention
2. a player can play for at least 30 turns without corrupted session state
3. AI narration and dialogue failures do not break gameplay
4. save/load works reliably
5. the demo world is fully playable
6. logs are sufficient to debug broken turns
7. moderators can hide abusive content manually

---

## Suggested Milestone Checklist

### Milestone A: Technical Foundation

- auth complete
- DB and Redis wired
- architecture folders in place

### Milestone B: Builder Alpha

- world/room/exit creation works
- basic map/world graph playable

### Milestone C: Runtime Alpha

- sessions and movement work
- turn logging works

### Milestone D: AI Alpha

- narration works
- AI logging works

### Milestone E: Gameplay Alpha

- NPCs, items, and quests work

### Milestone F: Closed MVP Beta

- publish flow works
- moderation basics work
- polished demo world ready

---

## Post-MVP Directions

These are intentionally postponed until the MVP is stable:

- richer module marketplace
- deeper map visualization
- collaborative creator editing
- multiplayer parties
- advanced combat engine
- monetization and subscriptions
- world analytics dashboard
- creator templates and cloning

---

## Recommended Next Development Artifact

After this roadmap, the next practical artifact should be one of:

- `docs/product/demo-world-spec.md`
- `docs/implementation/prisma-schema-plan.md`
- `docs/implementation/project-bootstrap-checklist.md`

Best next choice:

- `docs/implementation/project-bootstrap-checklist.md`

Reason:

- it converts architecture into the first build steps with minimal ambiguity

