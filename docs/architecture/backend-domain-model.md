# Backend Domain Model for AI-Powered Text RPG Platform

## Purpose

This document defines the backend architecture and domain model for the AI-powered text RPG platform.

It is meant to be used together with:

- [mysql-schema.md](D:\AGATE\Projekan\AI-Chatbot-Rolepay\docs\architecture\mysql-schema.md)

This file explains:

- service boundaries
- domain responsibilities
- runtime engine flow
- turn processing pipeline
- AI prompt assembly pipeline
- validation and reducer architecture
- module integration strategy

## Core Product Model

The platform is a combination of:

1. **World Builder**
   - creators define world content, mechanics, maps, NPCs, and UI composition
2. **Game Runtime**
   - players play through a persistent session with canonical state
3. **AI Director Layer**
   - AI assists narration, dialogue, interpretation, and summarization
4. **Deterministic Engine Layer**
   - validates actions, applies rules, and persists state changes

The most important principle is:

**AI generates proposals. The engine decides truth.**

---

## Architectural Principles

- Keep canonical game state in MySQL.
- Use Redis only for transient coordination, caching, and queues.
- Treat every player action as a turn processed through a deterministic pipeline.
- Separate authored content from runtime state.
- Keep AI behind a domain boundary, never as the state authority.
- Make all extensibility flow through modules with clear contracts.
- Log all significant state transitions for debugging and replayability.

---

## Bounded Contexts

The backend should be split mentally into these domains, even if phase 1 is implemented inside a single Node.js app.

### 1. Identity Domain

Responsibility:

- user registration and login
- session management
- account verification
- roles and permissions
- profile and preferences

Primary tables:

- `users`
- `user_profiles`
- `sessions`
- `oauth_accounts`
- `verification_tokens`
- `roles`
- `user_role_assignments`
- `user_preferences`

Primary services:

- `AuthService`
- `SessionService`
- `PermissionService`

### 2. World Builder Domain

Responsibility:

- world CRUD
- room and map editing
- lore and codex editing
- NPC, item, and quest design
- event and ruleset definition
- UI layout configuration

Primary tables:

- `worlds`
- `world_settings`
- `world_versions`
- `world_regions`
- `world_rooms`
- `world_room_exits`
- `world_lore_entries`
- `world_characters`
- `world_items`
- `world_quests`
- `world_events`
- `rule_modules`
- `world_rule_modules`
- `ui_modules`
- `world_ui_layouts`

Primary services:

- `WorldService`
- `MapBuilderService`
- `LoreService`
- `CharacterBuilderService`
- `QuestBuilderService`
- `RulesetService`
- `UILayoutService`

### 3. Runtime Session Domain

Responsibility:

- start/load/save game sessions
- maintain current room, NPC state, quest state, inventory, flags
- own authoritative runtime state
- expose state snapshots to the game client

Primary tables:

- `save_slots`
- `game_sessions`
- `session_participants`
- `session_player_states`
- `session_npc_states`
- `session_room_states`
- `session_inventory_items`
- `session_quest_states`
- `session_quest_step_states`
- `session_flags`
- `session_turns`
- `session_memory_summaries`

Primary services:

- `SessionService`
- `SessionStateService`
- `SaveLoadService`
- `SessionProjectionService`

### 4. Turn Engine Domain

Responsibility:

- interpret player commands
- resolve intent
- validate action legality
- execute deterministic state changes
- call AI only where useful
- persist final turn result

Primary services:

- `TurnEngine`
- `ActionParser`
- `RuleValidator`
- `StateReducer`
- `TurnLogger`

### 5. AI Orchestration Domain

Responsibility:

- prompt assembly
- model selection
- structured tool/action calling
- narration generation
- NPC dialogue generation
- memory summarization
- token/cost logging

Primary tables:

- `ai_providers`
- `ai_models`
- `ai_model_presets`
- `world_ai_configs`
- `prompt_blocks`
- `inference_requests`
- `inference_usage_logs`

Primary services:

- `AIService`
- `PromptAssemblyService`
- `NarrationService`
- `DialogueService`
- `SummarizationService`
- `InferenceLoggingService`

### 6. Module Runtime Domain

Responsibility:

- register world-enabled mechanics
- declare custom fields and actions
- plug module rules into validation and reduction
- expose module UI metadata

Primary tables:

- `rule_modules`
- `world_rule_modules`
- `world_rule_fields`
- `world_rule_actions`
- `ui_modules`
- `world_ui_layout_modules`

Primary services:

- `ModuleRegistry`
- `ModuleConfigService`
- `ModuleReducerRegistry`
- `ModuleUIContractService`

### 7. Media Domain

Responsibility:

- upload handling
- file metadata persistence
- secure file access
- image purpose validation

Primary tables:

- `media_files`

Primary services:

- `MediaService`
- `UploadService`
- `StoragePathService`

### 8. Moderation and Audit Domain

Responsibility:

- reporting
- moderator actions
- audit logs
- content safety enforcement

Primary tables:

- `reports`
- `moderation_actions`
- `audit_logs`

Primary services:

- `ReportService`
- `ModerationService`
- `AuditService`

---

## Recommended App Structure

For phase 1, a modular monolith is the right choice.

Suggested backend structure:

```text
src/
  app/
  modules/
    auth/
    users/
    worlds/
    maps/
    lore/
    characters/
    items/
    quests/
    rules/
    ui-layouts/
    sessions/
    turns/
    ai/
    media/
    moderation/
    audit/
  shared/
    db/
    cache/
    queue/
    events/
    validation/
    errors/
    utils/
```

Even if all code runs in one deployable app, treat each module as a domain boundary.

---

## Core Runtime Concepts

### World Definition

Static authored content created by a builder.

Examples:

- room definitions
- exits
- lore
- NPC templates
- quest templates
- items
- ruleset config

This data is reusable by many sessions.

### Session State

Mutable game state tied to a specific playthrough.

Examples:

- player current room
- opened doors
- NPC current location
- quest progress
- inventory
- discovered lore
- reputation
- current flags

### Turn

A turn is the smallest atomic unit of gameplay processing.

A turn may include:

- player input
- parsed action
- validation result
- deterministic state changes
- AI narration
- final persisted log entry

### Action

An action is a normalized engine-readable intent.

Examples:

- `move`
- `inspect_room`
- `inspect_object`
- `talk_to_npc`
- `take_item`
- `use_item`
- `start_quest`
- `custom_module_action`

### Reducer

A reducer is a deterministic function that transforms session state from one valid form to another.

Example:

- input: `move north`
- output:
  - current room changes
  - hidden exit becomes discovered
  - room visit timestamp updates
  - entry event gets enqueued

### Projection

A projection is a player-facing snapshot of state prepared for UI consumption.

Examples:

- current room card
- visible exits
- visible NPCs
- visible interactables
- player inventory summary
- quest tracker panel

---

## Request Types

The client should interact with the backend using these high-level flows:

### Builder Requests

- create world
- update room
- connect rooms
- edit lore
- create NPC
- configure ruleset
- save UI layout
- publish version

### Runtime Requests

- start new session
- load save slot
- submit turn
- regenerate narration
- move to room
- inspect object
- talk to NPC
- fetch session snapshot
- fetch turn history

### AI-Assisted Builder Requests

- generate room description
- rewrite lore for tone
- suggest NPC traits
- generate quest draft
- summarize world notes

These should be clearly separated in code, even if they share AI infrastructure.

---

## Turn Processing Pipeline

This is the most important backend flow in the whole system.

### High-Level Flow

1. Accept player input
2. Acquire session lock
3. Load authoritative session state
4. Build runtime context
5. Parse or classify action
6. Validate action legality
7. Apply deterministic reducers
8. Trigger event resolution
9. Request AI narration/dialogue if needed
10. Persist turn log and updated state
11. Release lock
12. Return updated projection to client

### Detailed Turn Pipeline

#### Step 1: Input Reception

Input payload should include:

- `sessionId`
- `clientTurnIntent`
- `rawText`
- optional structured target info
- optional UI action context

Example:

```json
{
  "sessionId": "sess_123",
  "rawText": "go north and inspect the altar",
  "uiContext": {
    "selectedRoomObjectId": 88
  }
}
```

#### Step 2: Session Lock

Before mutating state:

- acquire Redis lock on `session:{sessionId}:lock`
- fail fast or retry briefly if already locked

This prevents:

- duplicate turn execution
- concurrent UI actions corrupting state
- double AI calls for the same move

#### Step 3: Load Runtime Aggregate

Load:

- `game_sessions`
- `session_player_states`
- `session_npc_states`
- `session_room_states`
- `session_inventory_items`
- `session_quest_states`
- `session_flags`
- current room definition
- visible NPC definitions
- visible room items/interactables
- relevant world rules/modules

This should be assembled into an in-memory aggregate:

`SessionAggregate`

#### Step 4: Build Runtime Context

Build a context object used by validators, reducers, and AI.

Suggested shape:

```ts
type RuntimeContext = {
  world: WorldDefinition;
  session: SessionAggregate;
  currentRoom: RoomDefinition;
  visibleNPCs: RuntimeNPC[];
  visibleItems: RuntimeItem[];
  activeQuests: RuntimeQuest[];
  enabledModules: RuntimeModule[];
};
```

#### Step 5: Action Parsing

The input must become a normalized action.

There are two parsing modes:

1. **Deterministic parser first**
   - regex/pattern/command mapping
   - handles common actions cheaply and reliably
2. **AI-assisted parser second**
   - only when input is ambiguous or freeform

Examples:

- `"north"` -> `{ type: "move", direction: "north" }`
- `"talk to innkeeper"` -> `{ type: "talk_to_npc", targetId: 52 }`
- `"offer the coin to the ferryman"` -> AI-assisted parse to structured action

Important:

AI action parsing should output structured JSON, not direct state mutations.

#### Step 6: Validation

Every parsed action must pass:

- permission validation
- state validation
- module validation
- world rule validation

Validation examples:

- can the player move through that exit?
- is the exit hidden or locked?
- is the NPC visible?
- does the player own the item they are trying to use?
- is combat required before leaving?
- does a module block this action?

Validation output:

```ts
type ValidationResult = {
  ok: boolean;
  errors: DomainError[];
  warnings: DomainWarning[];
  normalizedAction?: EngineAction;
};
```

If validation fails:

- optionally generate AI or templated failure narration
- persist a failed turn if useful for history
- do not mutate canonical state

#### Step 7: Deterministic Reduction

Reducers apply legal state changes.

Reducer responsibilities:

- update current room
- change flags
- update quest progress
- add/remove inventory
- mutate NPC state
- enqueue triggered events

Reducers must:

- be deterministic
- be testable without AI
- produce an explicit change set

Suggested output:

```ts
type StateChangeSet = {
  sessionUpdates: SessionUpdate[];
  playerUpdates: PlayerUpdate[];
  npcUpdates: NPCUpdate[];
  roomUpdates: RoomUpdate[];
  inventoryUpdates: InventoryUpdate[];
  questUpdates: QuestUpdate[];
  flagUpdates: FlagUpdate[];
  triggeredEvents: TriggeredEvent[];
};
```

#### Step 8: Event Resolution

Triggered events are resolved after the base action reduces.

Examples:

- entering room triggers trap
- opening chest triggers ambush
- talking to NPC advances quest
- item use unlocks hidden route

Event resolution rules:

- deterministic effects first
- AI narration second
- AI must not bypass event legality

#### Step 9: AI Narration / Dialogue

After deterministic changes are known, AI can generate:

- narration of what happened
- NPC dialogue
- flavor text
- optional suggested next hooks

AI receives:

- action summary
- relevant world lore
- room context
- NPC personality context
- visible consequences
- safety/system instructions

AI does **not** receive permission to invent canonical state changes outside its allowed schema.

#### Step 10: Persist State and Turn

Write all authoritative updates in a transaction:

- session state tables
- turn log
- inference log
- memory summary enqueue marker if needed
- audit log if necessary

#### Step 11: Projection Build

After commit, build the updated player-facing projection.

Projection includes:

- narration text
- current room
- visible exits
- room interactables
- visible NPCs
- player stats
- inventory summary
- quest summary
- UI module data

#### Step 12: Release Lock

Always release the Redis session lock, even after failure.

Use `try/finally` in implementation.

---

## Turn Processing Modes

Not all turns need the same AI involvement.

### Mode A: Engine-Only

For simple actions:

- move north
- inspect inventory
- look around
- equip sword

No AI required unless flavor text is requested.

### Mode B: Engine + AI Narration

For actions with deterministic outcome but expressive output:

- move into a dramatic room
- pick up cursed item
- finish quest step

### Mode C: AI-Assisted Parse + Engine Validation + AI Narration

For ambiguous freeform actions:

- convince the guard to let me pass
- threaten the merchant with my dagger
- pray to the moon shrine for guidance

### Mode D: AI Dialogue

For conversations:

- player speaks to NPC
- engine supplies NPC state and conversation constraints
- AI produces dialogue
- engine applies any approved relationship or quest changes

---

## AI Prompt Assembly Pipeline

Prompt assembly must be explicit and modular.

### Goal

Construct prompts from reliable layered context rather than dumping raw database rows.

### Prompt Layers

Suggested order:

1. System safety and output contract
2. World-level AI config
3. Active rules/module prompt blocks
4. Current room context
5. Relevant lore summary
6. Player persona summary
7. Relevant NPC context
8. Active quest state
9. Recent turn history
10. Runtime action summary
11. Output format instruction

### Prompt Types

#### Narration Prompt

Used after deterministic state changes.

Inputs:

- current room
- previous room if moved
- action taken
- results of action
- relevant flavor context

Output:

- narration text

#### Dialogue Prompt

Used for NPC responses.

Inputs:

- NPC personality
- current relationship state
- room context
- player utterance
- current quest context
- speech style

Output:

- NPC reply
- optional structured intent proposal

#### Action Parse Prompt

Used only when deterministic parsing cannot classify the intent confidently.

Inputs:

- player raw text
- visible affordances
- current room
- nearby NPCs/items/exits
- allowed action schema

Output:

- strict JSON action proposal

#### Summarization Prompt

Used periodically to compress turn history.

Inputs:

- previous summary
- recent turns
- state deltas

Output:

- concise memory summary

### Prompt Assembly Service Responsibilities

`PromptAssemblyService` should:

- choose relevant context
- prune irrelevant lore
- cap token size
- include only discoverable player-visible information unless engine purpose requires more
- include output format contract
- hash prompt composition for logging

### Retrieval Strategy

Do not dump the whole world lore into every prompt.

Use ranked selection:

- current room lore
- active quest lore
- referenced NPC lore
- region lore
- pinned global lore
- recent discoveries

---

## Validation Architecture

Validation should be layered.

### 1. Input Validation

Checks:

- payload shape
- authentication
- session ownership
- rate limit

### 2. Action Validation

Checks:

- action type known
- target present
- parameters complete

### 3. State Validation

Checks:

- is the target visible?
- is the path traversable?
- does inventory contain the item?
- is the quest active?

### 4. Module Validation

Checks:

- module-specific rules
- cooldowns
- energy cost
- combat turn order
- reputation locks

### 5. Cross-Entity Integrity Validation

Checks:

- state change does not violate world invariants
- room target belongs to world
- NPC belongs to session/world
- inventory mutation cannot create negative counts

### Validation Rules

- validators must be pure when possible
- validators return structured domain errors
- validators should not call AI
- validators run before reducers

---

## Reducer Architecture

Reducers are the heart of deterministic gameplay.

### Reducer Inputs

- `RuntimeContext`
- `EngineAction`
- enabled modules

### Reducer Outputs

- `StateChangeSet`
- triggered events
- optional narration hints

### Reducer Categories

#### Core Reducers

- movement reducer
- inventory reducer
- interaction reducer
- quest reducer
- NPC state reducer
- flag reducer

#### Module Reducers

Examples:

- combat reducer
- survival reducer
- faction reputation reducer
- romance affinity reducer
- time progression reducer

### Reducer Rules

- never perform direct DB writes
- only produce intended mutations
- be deterministic and unit-testable
- avoid hidden side effects

### Commit Phase

Only a dedicated persistence layer applies the produced change set to the database.

This keeps:

- reducers pure
- persistence auditable
- rollback easier

---

## Event Resolution Model

Events should be handled as explicit domain objects.

### Event Sources

- room entry
- room exit
- item interaction
- NPC conversation
- quest progression
- timer progression
- module-generated triggers

### Event Lifecycle

1. reducer emits event trigger
2. `EventResolutionService` loads relevant event definitions
3. deterministic conditions are checked
4. deterministic effects are applied
5. AI narration may describe the result

### Event Design Rule

Authored event definitions should describe:

- trigger condition
- deterministic effect
- optional AI narration mode

This keeps narrative flexibility while preserving logical consistency.

---

## Session Projection Model

The frontend should not build game state directly from raw tables.

Instead the backend returns projections shaped for UI modules.

### Base Session Projection

Suggested shape:

```ts
type SessionProjection = {
  session: {
    id: string;
    status: string;
    turnNumber: number;
  };
  room: RoomProjection;
  player: PlayerProjection;
  npcs: NPCProjection[];
  exits: ExitProjection[];
  interactables: InteractableProjection[];
  quests: QuestProjection[];
  inventory: InventoryProjection;
  uiModules: ModuleProjection[];
  narration: {
    latest: string | null;
  };
};
```

### Why Projections Matter

- frontend complexity stays lower
- data exposure is controlled
- hidden state stays hidden
- module widgets get normalized inputs

---

## Module System Architecture

The module system is what makes the platform extensible.

### Module Responsibilities

A module may contribute:

- config schema
- state fields
- actions
- validators
- reducers
- prompt blocks
- UI widget contracts

### Module Contract

Each runtime module should implement something like:

```ts
type GameModule = {
  key: string;
  registerActions(): ActionDefinition[];
  registerValidators(): ValidatorFn[];
  registerReducers(): ReducerFn[];
  registerPromptBlocks(): PromptBlockDefinition[];
  registerProjectionMappers(): ProjectionMapperFn[];
};
```

### Example Modules

#### Inventory Module

Adds:

- inventory state
- take/drop/use actions
- inventory panel UI

#### Reputation Module

Adds:

- faction reputation state
- reputation gates
- reputation panel

#### Survival Module

Adds:

- hunger/thirst/fatigue stats
- periodic decay
- survival warnings

#### Combat Module

Adds:

- combat encounter state
- attack/defend/use-skill actions
- turn order validation

### Module Safety Rules

- modules may extend state, not bypass core invariants
- module reducers must return explicit changes
- module prompt blocks must not redefine canonical state rules

---

## Publish and Versioning Model

Creators need predictable publishing behavior.

### Recommended Model

Use draft worlds plus version snapshots.

#### Draft Data

Creators edit the latest working state in builder tables.

#### Published Snapshot

When publishing:

- create `world_versions` snapshot
- future sessions can bind to published version
- optionally allow sessions to continue on original version

### Why This Matters

- stable playthroughs
- easier debugging
- safer content updates
- reproducible AI context

### Runtime Rule

A session should know which world version it was started from.

This avoids content drift mid-playthrough.

---

## Background Jobs

Some tasks should be deferred through Redis-backed jobs.

### Good Candidates

- memory summarization
- embedding/lore indexing
- thumbnail generation
- heavy audit exports
- AI-assisted builder generation
- maintenance cleanup

### Job Principles

- jobs must be idempotent where possible
- job payloads should reference IDs, not massive documents
- canonical writes still go through services, not raw worker scripts

---

## Error Handling Model

Prefer domain-specific errors over generic failures.

### Error Categories

- `AuthError`
- `PermissionError`
- `ValidationError`
- `ConflictError`
- `InvariantError`
- `AIProviderError`
- `RateLimitError`

### Gameplay Failure Rule

When a player action fails validation:

- return clear feedback
- optionally generate flavored failure text
- do not partially mutate state

---

## Observability and Debugging

This kind of product will be hard to debug unless logs are deliberate.

### Log Important Things

- turn input
- parsed action
- validator decisions
- reducer change set summary
- triggered events
- AI request type and model
- token usage
- final response time

### Keep in Audit or Debug Tables

- `session_turns`
- `inference_requests`
- `inference_usage_logs`
- `audit_logs`

### Recommended Debug View Later

Build an internal session inspector that shows:

- current room
- flags
- quests
- inventory
- NPC state
- last parsed action
- last AI prompt hash

---

## Security and Safety Boundaries

### Never Trust the Client For

- current room
- quest completion
- item ownership
- NPC state
- reputation changes
- hidden content visibility

### Never Trust the LLM For

- direct database writes
- state legality
- authorization
- hidden state access rules
- moderator decisions

### Always Validate

- world ownership on builder actions
- save/session ownership on runtime actions
- file access permissions
- allowed module configuration

---

## API Design Guidance

Keep API design aligned with domains.

### Builder API Groups

- `/api/worlds`
- `/api/worlds/:worldId/rooms`
- `/api/worlds/:worldId/exits`
- `/api/worlds/:worldId/characters`
- `/api/worlds/:worldId/items`
- `/api/worlds/:worldId/quests`
- `/api/worlds/:worldId/rules`
- `/api/worlds/:worldId/ui-layouts`

### Runtime API Groups

- `/api/sessions`
- `/api/sessions/:sessionId`
- `/api/sessions/:sessionId/turns`
- `/api/sessions/:sessionId/projection`
- `/api/sessions/:sessionId/regenerate`

### AI Builder Assistance API Groups

- `/api/ai/world-assist/rooms`
- `/api/ai/world-assist/quests`
- `/api/ai/world-assist/npcs`
- `/api/ai/world-assist/lore`

---

## Recommended Implementation Sequence

### Step 1

Implement foundation:

- auth
- world CRUD
- rooms + exits
- personas
- save slots

### Step 2

Implement runtime backbone:

- session start/load
- session projection
- simple move action
- turn logging
- deterministic movement reducer

### Step 3

Add AI:

- narration after movement
- room description support
- AI action parsing fallback

### Step 4

Add gameplay systems:

- NPC dialogue
- inventory
- quests
- flags
- event triggers

### Step 5

Add modular systems:

- module registry
- module validators/reducers
- modular UI projections

---

## Non-Goals for Phase 1

Do not overbuild these too early:

- real-time multiplayer party play
- collaborative simultaneous world editing
- full CRDT editor sync
- tile-based combat engine
- unrestricted AI state control
- plugin marketplace

---

## Example End-to-End Turn

Input:

`"go north"`

Flow:

1. client sends turn request
2. backend locks session
3. session aggregate is loaded
4. deterministic parser maps input to `move north`
5. validator confirms north exit exists and is traversable
6. movement reducer updates `current_room_id`
7. room-entry event check runs
8. event resolver reveals hidden shrine inscription
9. narration prompt is assembled from:
   - world safety/system rules
   - room data
   - movement action result
   - revealed event details
10. AI returns descriptive narration
11. state changes and turn log commit in transaction
12. updated projection is returned to client

This is the reference pattern for all other actions.

---

## What This Document Should Guide

This file should guide:

- folder structure
- service boundaries
- turn engine implementation
- test strategy
- Prisma model mapping
- API route design

## Recommended Next Artifact

After this document, the next useful reference would be:

- `docs/architecture/mvp-scope-and-roadmap.md`

That file should define:

- phase 1 feature scope
- release slices
- technical milestones
- risk areas
- validation checkpoints

