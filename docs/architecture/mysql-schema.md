# MySQL Schema Draft for AI-Powered Text RPG Platform

## Purpose

This document defines the initial MySQL data model for a web-based AI-powered roleplaying text game platform with:

- creator-built worlds
- modular game systems
- MUD-style room traversal
- AI-assisted narration and NPC behavior
- persistent player sessions
- reusable runtime state

This schema is meant to be the **source of truth for backend implementation** when development starts.

## Product Model

The platform has two major surfaces:

1. **Builder**
   - creators design worlds, maps, lore, NPCs, items, quests, rule modules, and UI layouts
2. **Runtime**
   - players start a game session, traverse the world, trigger events, talk to NPCs, and progress game state

The LLM is **not** the source of truth.

The source of truth is:

- MySQL for canonical persistent state
- Redis for ephemeral runtime helpers
- backend validators/reducers for legal game state transitions

## Design Principles

- Use relational tables for canonical entities and runtime state.
- Use JSON columns only for flexible per-module payloads, not for core foreign-keyed relationships.
- Prefer append-only logs for turns, AI calls, and audit trails.
- Separate **world definition** from **session state**.
- Support creator extensibility through module and schema tables.
- Keep storage paths in DB, but store actual files on the native hosting filesystem.

## Naming Conventions

- Table names are plural snake_case.
- Primary keys use `BIGINT UNSIGNED` unless noted.
- Foreign keys follow `<entity>_id`.
- Timestamps use:
  - `created_at DATETIME(3) NOT NULL`
  - `updated_at DATETIME(3) NOT NULL`
- Soft deletes use:
  - `deleted_at DATETIME(3) NULL`
- Public UUIDs should be stored in `CHAR(36)` or `VARCHAR(36)` as `public_id`.

## Recommended Shared Columns

Most content tables should include:

- `id`
- `public_id`
- `created_at`
- `updated_at`
- `deleted_at` where soft deletion is useful

## High-Level Domains

- Identity and access
- Creator organizations
- World definitions
- Maps and traversal
- Characters and NPC behavior
- Items and inventory
- Quests and events
- Modular rule systems
- Modular UI layouts
- Runtime sessions and state
- AI configuration and prompt assembly
- Files and native storage
- Safety, moderation, and audit

---

## 1. Identity and Access

### `users`

Core account table.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | Internal ID |
| public_id | CHAR(36) UNIQUE | Public UUID |
| email | VARCHAR(255) UNIQUE | Login email |
| username | VARCHAR(50) UNIQUE | Public handle |
| password_hash | VARCHAR(255) NULL | Null for OAuth-only accounts |
| email_verified_at | DATETIME(3) NULL | Verification timestamp |
| status | ENUM('active','suspended','pending_deletion') | Account status |
| display_name | VARCHAR(100) | User-facing name |
| avatar_file_id | BIGINT UNSIGNED NULL FK -> media_files.id | Avatar |
| last_login_at | DATETIME(3) NULL | Last auth activity |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `email`
- unique: `username`
- index: `status`

### `user_profiles`

Extended profile and preferences that do not belong in auth core.

| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT UNSIGNED PK FK -> users.id | One-to-one |
| bio | TEXT NULL | Creator/player bio |
| locale | VARCHAR(16) NULL | `en`, `id`, etc. |
| timezone | VARCHAR(64) NULL | Olson timezone |
| content_rating_preference | ENUM('safe','mature','adult') | Viewer preference |
| profile_visibility | ENUM('public','private') | Public profile toggle |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `sessions`

Database-backed sessions if using cookie/session auth.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| user_id | BIGINT UNSIGNED FK -> users.id | Owner |
| session_token | VARCHAR(255) UNIQUE | Secure opaque token |
| expires_at | DATETIME(3) | Expiry |
| ip_address | VARCHAR(64) NULL | Optional |
| user_agent | VARCHAR(512) NULL | Optional |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `session_token`
- index: `(user_id, expires_at)`

### `oauth_accounts`

Linked third-party accounts.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| provider | VARCHAR(50) | `google`, `discord` |
| provider_account_id | VARCHAR(255) | External user ID |
| access_token | TEXT NULL | Encrypted at app layer if stored |
| refresh_token | TEXT NULL | Encrypted at app layer if stored |
| token_expires_at | DATETIME(3) NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(provider, provider_account_id)`

### `verification_tokens`

Email verification, passwordless login, password reset, etc.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| identifier | VARCHAR(255) | Usually email |
| token_hash | VARCHAR(255) UNIQUE | Store hash, not raw token |
| purpose | ENUM('email_verify','password_reset','magic_link') | Token use |
| expires_at | DATETIME(3) |  |
| consumed_at | DATETIME(3) NULL | One-time usage |
| created_at | DATETIME(3) |  |

Indexes:

- unique: `token_hash`
- index: `(identifier, purpose, expires_at)`

### `roles`

System roles.

| Column | Type | Notes |
|---|---|---|
| id | SMALLINT UNSIGNED PK |  |
| code | VARCHAR(50) UNIQUE | `admin`, `moderator`, `creator`, `user` |
| name | VARCHAR(100) | Human label |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `user_role_assignments`

Many-to-many between users and roles.

| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| role_id | SMALLINT UNSIGNED FK -> roles.id |  |
| assigned_by_user_id | BIGINT UNSIGNED NULL FK -> users.id |  |
| created_at | DATETIME(3) |  |

Primary key:

- `(user_id, role_id)`

### `user_preferences`

Non-critical app settings.

| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT UNSIGNED PK FK -> users.id |  |
| theme | VARCHAR(32) NULL | UI theme |
| default_editor_mode | VARCHAR(32) NULL | Builder preference |
| autosave_enabled | TINYINT(1) | Boolean |
| default_model_preset_id | BIGINT UNSIGNED NULL FK -> ai_model_presets.id | Preferred AI preset |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

---

## 2. Creator Organizations

Optional but useful if worlds are co-built by teams.

### `organizations`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| owner_user_id | BIGINT UNSIGNED FK -> users.id |  |
| name | VARCHAR(150) |  |
| slug | VARCHAR(100) UNIQUE | URL-safe |
| description | TEXT NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `organization_members`

| Column | Type | Notes |
|---|---|---|
| organization_id | BIGINT UNSIGNED FK -> organizations.id |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| membership_role | ENUM('owner','admin','editor','viewer') | Team capability |
| created_at | DATETIME(3) |  |

Primary key:

- `(organization_id, user_id)`

---

## 3. Worlds and Game Definitions

### `worlds`

Top-level game/project table.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| owner_user_id | BIGINT UNSIGNED FK -> users.id | Creator owner |
| organization_id | BIGINT UNSIGNED NULL FK -> organizations.id | Optional team ownership |
| title | VARCHAR(200) | Game/world title |
| slug | VARCHAR(150) UNIQUE | Public URL slug |
| short_description | VARCHAR(500) NULL | Summary |
| description | MEDIUMTEXT NULL | Long form |
| visibility | ENUM('private','unlisted','public') | Discovery visibility |
| publication_status | ENUM('draft','playtest','published','archived') | Lifecycle |
| content_rating | ENUM('safe','mature','adult') | Content classification |
| default_start_room_id | BIGINT UNSIGNED NULL | Set after room creation |
| default_ruleset_id | BIGINT UNSIGNED NULL | Default ruleset |
| cover_file_id | BIGINT UNSIGNED NULL FK -> media_files.id | Cover art |
| icon_file_id | BIGINT UNSIGNED NULL FK -> media_files.id | Icon |
| version_number | INT UNSIGNED | Increment when published |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |
| deleted_at | DATETIME(3) NULL |  |

Indexes:

- unique: `slug`
- index: `(owner_user_id, publication_status)`
- index: `(visibility, publication_status, content_rating)`

### `world_collaborators`

Access control for a world.

| Column | Type | Notes |
|---|---|---|
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| role | ENUM('owner','admin','editor','writer','tester','viewer') |  |
| invited_by_user_id | BIGINT UNSIGNED NULL FK -> users.id |  |
| created_at | DATETIME(3) |  |

Primary key:

- `(world_id, user_id)`

### `world_versions`

Snapshot-based versioning for published or saved revisions.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| version_label | VARCHAR(100) | `v0.3-playtest` |
| version_number | INT UNSIGNED | Incrementing integer |
| change_summary | TEXT NULL | Release notes |
| snapshot_manifest_json | JSON | References included entities |
| is_published | TINYINT(1) | Boolean |
| published_at | DATETIME(3) NULL |  |
| created_by_user_id | BIGINT UNSIGNED FK -> users.id |  |
| created_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, version_number)`
- index: `(world_id, is_published, created_at)`

### `world_settings`

One-to-one operational settings for a world.

| Column | Type | Notes |
|---|---|---|
| world_id | BIGINT UNSIGNED PK FK -> worlds.id |  |
| turn_mode | ENUM('freeform','turn_based','hybrid') | Core interaction style |
| allow_player_authored_actions | TINYINT(1) | Allow arbitrary text actions |
| max_party_size | SMALLINT UNSIGNED | For future multiplayer support |
| max_active_sessions_per_user | SMALLINT UNSIGNED | Limit saves |
| autosummarize_turn_interval | SMALLINT UNSIGNED | AI memory summarization cadence |
| allow_branching_regenerations | TINYINT(1) | Support alternate turns |
| default_ui_layout_id | BIGINT UNSIGNED NULL | Builder-selected layout |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `world_lore_entries`

Structured lore/codex records.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| title | VARCHAR(200) |  |
| slug | VARCHAR(180) | Unique within world |
| category | VARCHAR(80) NULL | `history`, `religion`, `magic`, etc. |
| body_markdown | MEDIUMTEXT | Source body |
| body_rich_json | JSON NULL | Rich editor representation |
| visibility | ENUM('creator_only','player_discoverable','always_visible') | Gameplay visibility |
| discovery_condition_json | JSON NULL | Flags, quest gates, room gates |
| embedding_status | ENUM('pending','ready','failed','disabled') | For future retrieval |
| created_by_user_id | BIGINT UNSIGNED FK -> users.id |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, slug)`
- index: `(world_id, category)`
- index: `(world_id, visibility)`

### `world_parameters`

Global configurable world variables.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| key_name | VARCHAR(100) | Stable key |
| display_name | VARCHAR(150) | Builder label |
| value_type | ENUM('string','text','integer','decimal','boolean','json') |  |
| default_value_string | TEXT NULL | Canonical default storage |
| validation_rules_json | JSON NULL | Min/max/regex/options |
| is_runtime_editable | TINYINT(1) | Whether play can change it |
| description | TEXT NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`

---

## 4. Map and Traversal

### `world_regions`

Logical grouping of rooms.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| name | VARCHAR(150) |  |
| slug | VARCHAR(150) | Unique within world |
| description | TEXT NULL |  |
| sort_order | INT |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, slug)`

### `world_rooms`

MUD-style traversable rooms.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| region_id | BIGINT UNSIGNED NULL FK -> world_regions.id |  |
| key_name | VARCHAR(100) | Stable internal identifier |
| title | VARCHAR(200) | Room title |
| short_description | VARCHAR(500) NULL | Brief text |
| long_description | MEDIUMTEXT | Full room description |
| map_x | INT NULL | Editor coordinate |
| map_y | INT NULL | Editor coordinate |
| map_z | INT NULL | Optional floor/level |
| entry_text | TEXT NULL | Optional first-enter text |
| ambient_prompt_block | MEDIUMTEXT NULL | Extra AI context |
| is_start_room | TINYINT(1) | Boolean |
| is_discoverable | TINYINT(1) | Show on map or not |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`
- index: `(world_id, region_id)`
- index: `(world_id, is_start_room)`

### `world_room_exits`

Directed exits between rooms.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| source_room_id | BIGINT UNSIGNED FK -> world_rooms.id |  |
| target_room_id | BIGINT UNSIGNED FK -> world_rooms.id |  |
| direction | VARCHAR(32) | `north`, `south`, `up`, `enter`, etc. |
| label | VARCHAR(100) NULL | Custom text |
| travel_text | TEXT NULL | Narrative shown on move |
| is_hidden | TINYINT(1) | Discovery-based exit |
| is_locked | TINYINT(1) | Default lock state |
| lock_condition_json | JSON NULL | Key, flag, quest, stat gate |
| traversal_rule_json | JSON NULL | Cost, checks, permissions |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(source_room_id, direction)`
- index: `(world_id, source_room_id)`
- index: `(world_id, target_room_id)`

### `world_room_interactables`

Static objects or interactable points in a room.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| room_id | BIGINT UNSIGNED FK -> world_rooms.id |  |
| key_name | VARCHAR(100) | Stable key |
| title | VARCHAR(150) |  |
| description | TEXT NULL |  |
| interaction_schema_json | JSON | Action definitions |
| visibility_condition_json | JSON NULL | Conditional reveal |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(room_id, key_name)`

---

## 5. NPCs, Factions, and Characters

### `world_factions`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| key_name | VARCHAR(100) | Stable key |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| alignment | VARCHAR(80) NULL | Optional semantic label |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`

### `world_characters`

Defines NPCs, companions, enemies, and optionally prebuilt player archetypes.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| faction_id | BIGINT UNSIGNED NULL FK -> world_factions.id |  |
| key_name | VARCHAR(100) | Stable internal key |
| role_type | ENUM('npc','companion','enemy','merchant','trainer','player_archetype') |  |
| display_name | VARCHAR(150) |  |
| short_description | VARCHAR(500) NULL |  |
| profile_markdown | MEDIUMTEXT NULL | Character lore |
| personality_prompt | MEDIUMTEXT NULL | AI role instruction |
| goals_prompt | MEDIUMTEXT NULL | Motivations |
| speech_style_prompt | MEDIUMTEXT NULL | Dialogue style |
| memory_rules_json | JSON NULL | What this character should retain |
| avatar_file_id | BIGINT UNSIGNED NULL FK -> media_files.id |  |
| default_room_id | BIGINT UNSIGNED NULL FK -> world_rooms.id | Spawn/home room |
| is_unique | TINYINT(1) | One instance or many |
| is_recruitable | TINYINT(1) | Party mechanic hook |
| is_hidden | TINYINT(1) | Reveal condition driven |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`
- index: `(world_id, role_type)`
- index: `(world_id, faction_id)`

### `world_character_stats`

Template stats for a character.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| character_id | BIGINT UNSIGNED FK -> world_characters.id |  |
| stat_key | VARCHAR(100) | `health`, `trust`, `mana` |
| base_value_number | DECIMAL(18,4) NULL | Numeric stat |
| base_value_string | TEXT NULL | String stat |
| value_type | ENUM('integer','decimal','string','boolean') |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(character_id, stat_key)`

### `world_character_relationships`

Pre-authored relationships between characters or factions.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| source_character_id | BIGINT UNSIGNED FK -> world_characters.id |  |
| target_character_id | BIGINT UNSIGNED FK -> world_characters.id |  |
| relationship_type | VARCHAR(80) | `ally`, `enemy`, `sibling` |
| strength_value | DECIMAL(10,2) NULL | Optional weight |
| notes | TEXT NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(source_character_id, target_character_id, relationship_type)`

---

## 6. Items, Inventory, and Economy

### `world_items`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| key_name | VARCHAR(100) | Stable key |
| item_type | ENUM('equipment','consumable','quest','currency','misc') |  |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| rarity | VARCHAR(50) NULL | Optional label |
| stackable | TINYINT(1) | Boolean |
| max_stack_size | INT UNSIGNED NULL | For stackables |
| base_value | DECIMAL(18,4) NULL | Economy support |
| weight_value | DECIMAL(18,4) NULL | Inventory support |
| item_rules_json | JSON NULL | Equippable, usable, etc. |
| icon_file_id | BIGINT UNSIGNED NULL FK -> media_files.id |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`
- index: `(world_id, item_type)`

### `world_item_stats`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| item_id | BIGINT UNSIGNED FK -> world_items.id |  |
| stat_key | VARCHAR(100) |  |
| value_number | DECIMAL(18,4) NULL |  |
| value_string | TEXT NULL |  |
| value_type | ENUM('integer','decimal','string','boolean') |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(item_id, stat_key)`

### `world_room_items`

Spawn definitions for items in rooms.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| room_id | BIGINT UNSIGNED FK -> world_rooms.id |  |
| item_id | BIGINT UNSIGNED FK -> world_items.id |  |
| quantity | INT UNSIGNED |  |
| spawn_rule_json | JSON NULL | Respawn logic, conditional logic |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(room_id, item_id)`

### `world_character_items`

Starting inventory for NPCs.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| character_id | BIGINT UNSIGNED FK -> world_characters.id |  |
| item_id | BIGINT UNSIGNED FK -> world_items.id |  |
| quantity | INT UNSIGNED |  |
| equip_slot | VARCHAR(50) NULL | Optional |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(character_id, item_id)`

---

## 7. Quests, Events, and Story Logic

### `world_quests`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| key_name | VARCHAR(100) | Stable key |
| title | VARCHAR(200) |  |
| description | MEDIUMTEXT NULL |  |
| category | VARCHAR(80) NULL | Main, side, hidden |
| start_condition_json | JSON NULL | Trigger logic |
| completion_condition_json | JSON NULL | Goal logic |
| failure_condition_json | JSON NULL | Failure logic |
| rewards_json | JSON NULL | XP, items, flags, etc. |
| repeatable | TINYINT(1) | Boolean |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`
- index: `(world_id, category)`

### `world_quest_steps`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| quest_id | BIGINT UNSIGNED FK -> world_quests.id |  |
| step_key | VARCHAR(100) | Stable key |
| title | VARCHAR(200) |  |
| description | TEXT NULL |  |
| sequence_order | INT |  |
| activation_condition_json | JSON NULL |  |
| completion_condition_json | JSON NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(quest_id, step_key)`
- index: `(quest_id, sequence_order)`

### `world_events`

Reusable authored event definitions.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| key_name | VARCHAR(100) | Stable key |
| title | VARCHAR(200) |  |
| event_type | ENUM('room_enter','room_exit','interaction','dialogue','combat','timer','custom') |  |
| trigger_condition_json | JSON |  |
| effect_definition_json | JSON | Deterministic effects |
| ai_assist_mode | ENUM('none','narration_only','narration_and_choices') | AI involvement level |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, key_name)`
- index: `(world_id, event_type)`

### `world_event_bindings`

Attach events to rooms, NPCs, items, or quests.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| event_id | BIGINT UNSIGNED FK -> world_events.id |  |
| target_type | ENUM('world','region','room','exit','character','item','quest','quest_step') |  |
| target_id | BIGINT UNSIGNED | Polymorphic target |
| binding_context | VARCHAR(80) NULL | Extra semantic hook |
| created_at | DATETIME(3) |  |

Indexes:

- index: `(event_id, target_type, target_id)`
- index: `(world_id, target_type, target_id)`

---

## 8. Modular Rule System

### `rule_modules`

Global module catalog for reusable mechanics.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| key_name | VARCHAR(100) UNIQUE | `inventory`, `combat`, `reputation` |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| version | VARCHAR(50) | Module version |
| schema_json | JSON | Config schema |
| runtime_contract_json | JSON | Expected state shape |
| ui_contract_json | JSON NULL | Supported UI widgets |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `world_rule_modules`

Enables a module for a given world.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| module_id | BIGINT UNSIGNED FK -> rule_modules.id |  |
| is_enabled | TINYINT(1) | Boolean |
| config_json | JSON NULL | World-specific config |
| sort_order | INT | Execution / display order |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, module_id)`

### `world_rule_fields`

Defines state fields introduced by modules.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_rule_module_id | BIGINT UNSIGNED FK -> world_rule_modules.id |  |
| field_key | VARCHAR(100) | Stable runtime key |
| scope | ENUM('session','player','character','room','item') | Where state lives |
| value_type | ENUM('string','text','integer','decimal','boolean','json') |  |
| default_value_string | TEXT NULL | Canonical storage |
| validation_rules_json | JSON NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_rule_module_id, field_key, scope)`

### `world_rule_actions`

Defines deterministic actions recognized by the engine.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_rule_module_id | BIGINT UNSIGNED FK -> world_rule_modules.id |  |
| action_key | VARCHAR(100) | `give_item`, `damage_target` |
| schema_json | JSON | Parameters schema |
| validator_json | JSON NULL | Rule constraints |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_rule_module_id, action_key)`

---

## 9. Modular UI Layout System

### `ui_modules`

Catalog of supported UI widgets/panels.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| key_name | VARCHAR(100) UNIQUE | `chat_panel`, `map_panel` |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| config_schema_json | JSON NULL | Config shape |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `world_ui_layouts`

Saved game layouts per world.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| is_default | TINYINT(1) | Boolean |
| layout_schema_json | JSON | Dock/panel arrangement |
| created_by_user_id | BIGINT UNSIGNED FK -> users.id |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(world_id, is_default)`

### `world_ui_layout_modules`

Modules enabled inside a layout.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| layout_id | BIGINT UNSIGNED FK -> world_ui_layouts.id |  |
| ui_module_id | BIGINT UNSIGNED FK -> ui_modules.id |  |
| placement_key | VARCHAR(100) | Stable slot/key |
| config_json | JSON NULL | Widget config |
| sort_order | INT |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(layout_id, placement_key)`
- index: `(layout_id, ui_module_id)`

---

## 10. Player Personas and Save Slots

### `player_personas`

Reusable player-defined character profiles for roleplay.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| user_id | BIGINT UNSIGNED FK -> users.id | Owner |
| world_id | BIGINT UNSIGNED NULL FK -> worlds.id | Optional world-specific persona |
| name | VARCHAR(150) |  |
| description | TEXT NULL |  |
| persona_prompt | MEDIUMTEXT NULL | AI-facing persona context |
| avatar_file_id | BIGINT UNSIGNED NULL FK -> media_files.id |  |
| is_default | TINYINT(1) | Boolean |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(user_id, world_id)`

### `player_persona_attributes`

Structured stats/traits for persona.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| persona_id | BIGINT UNSIGNED FK -> player_personas.id |  |
| attribute_key | VARCHAR(100) |  |
| value_type | ENUM('string','text','integer','decimal','boolean','json') |  |
| value_string | TEXT NULL | Canonical storage |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(persona_id, attribute_key)`

### `save_slots`

Named save slots per user per world.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| persona_id | BIGINT UNSIGNED NULL FK -> player_personas.id |  |
| slot_name | VARCHAR(150) |  |
| is_autosave | TINYINT(1) | Boolean |
| last_session_id | BIGINT UNSIGNED NULL | Latest session |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(user_id, world_id)`

---

## 11. Runtime Sessions and Persistent State

### `game_sessions`

Top-level playthrough instance.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| save_slot_id | BIGINT UNSIGNED NULL FK -> save_slots.id | Optional bind |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| world_version_id | BIGINT UNSIGNED NULL FK -> world_versions.id | Snapshot source |
| owner_user_id | BIGINT UNSIGNED FK -> users.id |  |
| persona_id | BIGINT UNSIGNED NULL FK -> player_personas.id | Active persona |
| status | ENUM('active','paused','completed','abandoned','archived') |  |
| current_room_id | BIGINT UNSIGNED NULL FK -> world_rooms.id | Current player room |
| session_name | VARCHAR(150) NULL | User-friendly title |
| started_at | DATETIME(3) |  |
| last_active_at | DATETIME(3) |  |
| ended_at | DATETIME(3) NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `public_id`
- index: `(owner_user_id, world_id, status)`
- index: `(save_slot_id, status)`

### `session_participants`

Supports future multiplayer or companion-controlled actors.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| participant_type | ENUM('player','npc','companion') |  |
| user_id | BIGINT UNSIGNED NULL FK -> users.id | For player participant |
| character_id | BIGINT UNSIGNED NULL FK -> world_characters.id | For NPC/companion |
| display_name | VARCHAR(150) | Runtime label |
| joined_at | DATETIME(3) |  |

Indexes:

- index: `(session_id, participant_type)`

### `session_player_states`

Canonical player state for a session.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| current_room_id | BIGINT UNSIGNED NULL FK -> world_rooms.id |  |
| display_name | VARCHAR(150) | Snapshot at runtime |
| stats_json | JSON | Structured player stats |
| resources_json | JSON NULL | HP, mana, gold, etc. |
| flags_json | JSON NULL | Small per-player flags |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, user_id)`

### `session_npc_states`

Canonical state for NPC instances within a session.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| character_id | BIGINT UNSIGNED FK -> world_characters.id |  |
| current_room_id | BIGINT UNSIGNED NULL FK -> world_rooms.id |  |
| disposition_to_players_json | JSON NULL | Trust, hostility, etc. |
| stats_json | JSON NULL | Runtime stat overrides |
| memory_summary | MEDIUMTEXT NULL | NPC runtime memory summary |
| flags_json | JSON NULL | Local flags |
| is_active | TINYINT(1) | Boolean |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, character_id)`
- index: `(session_id, current_room_id)`

### `session_room_states`

Per-session room mutations.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| room_id | BIGINT UNSIGNED FK -> world_rooms.id |  |
| state_json | JSON | Opened chests, revealed exits, etc. |
| last_visited_at | DATETIME(3) NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, room_id)`

### `session_inventory_items`

Runtime inventory ownership.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| owner_type | ENUM('player','npc','room') | Inventory container |
| owner_state_id | BIGINT UNSIGNED | References relevant runtime state row |
| item_id | BIGINT UNSIGNED FK -> world_items.id |  |
| quantity | INT UNSIGNED |  |
| item_state_json | JSON NULL | Durability, enchantment, metadata |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(session_id, owner_type, owner_state_id)`
- index: `(session_id, item_id)`

### `session_quest_states`

Player/session quest progression.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| quest_id | BIGINT UNSIGNED FK -> world_quests.id |  |
| status | ENUM('inactive','active','completed','failed') |  |
| progress_json | JSON NULL | Arbitrary tracked progress |
| started_at | DATETIME(3) NULL |  |
| completed_at | DATETIME(3) NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, quest_id)`
- index: `(session_id, status)`

### `session_quest_step_states`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_quest_state_id | BIGINT UNSIGNED FK -> session_quest_states.id |  |
| quest_step_id | BIGINT UNSIGNED FK -> world_quest_steps.id |  |
| status | ENUM('inactive','active','completed','failed') |  |
| progress_json | JSON NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_quest_state_id, quest_step_id)`

### `session_flags`

Fast deterministic key/value session flags.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| scope | ENUM('session','player','room','character','quest') |  |
| scope_ref_id | BIGINT UNSIGNED NULL | Optional target ID |
| flag_key | VARCHAR(120) |  |
| value_type | ENUM('string','integer','decimal','boolean','json') |  |
| value_string | TEXT NULL | Canonical storage |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, scope, scope_ref_id, flag_key)`
- index: `(session_id, flag_key)`

### `session_turns`

Append-only gameplay log. Core playback/debugging table.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| turn_number | INT UNSIGNED | Sequential order |
| actor_type | ENUM('player','system','npc','engine','ai') | Who initiated |
| actor_ref_id | BIGINT UNSIGNED NULL | Optional actor ref |
| input_text | MEDIUMTEXT NULL | Raw player action |
| parsed_action_json | JSON NULL | Deterministic parsed action |
| engine_result_json | JSON NULL | Applied changes |
| ai_response_text | MEDIUMTEXT NULL | Final narration |
| visibility | ENUM('normal','hidden_debug') | Hide internal turns from player |
| created_at | DATETIME(3) |  |

Indexes:

- unique: `(session_id, turn_number)`
- index: `(session_id, created_at)`

### `session_turn_branches`

Supports regenerate/retry branches without rewriting history.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| parent_turn_id | BIGINT UNSIGNED FK -> session_turns.id |  |
| branch_label | VARCHAR(100) NULL |  |
| created_by_user_id | BIGINT UNSIGNED FK -> users.id |  |
| created_at | DATETIME(3) |  |

### `session_memory_summaries`

Compressed memory for long sessions.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED FK -> game_sessions.id |  |
| summary_type | ENUM('global','npc','player','quest','region') |  |
| scope_ref_id | BIGINT UNSIGNED NULL | Optional target |
| source_turn_start | INT UNSIGNED | Inclusive |
| source_turn_end | INT UNSIGNED | Inclusive |
| summary_text | MEDIUMTEXT | AI or system summary |
| created_at | DATETIME(3) |  |

Indexes:

- index: `(session_id, summary_type, scope_ref_id)`

---

## 12. AI Providers, Models, and Prompt Assembly

### `ai_providers`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| key_name | VARCHAR(100) UNIQUE | `openai` |
| name | VARCHAR(150) |  |
| api_base_url | VARCHAR(255) NULL | Optional override |
| is_enabled | TINYINT(1) | Boolean |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `ai_models`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| provider_id | BIGINT UNSIGNED FK -> ai_providers.id |  |
| model_key | VARCHAR(150) | API model key |
| display_name | VARCHAR(150) | UI label |
| supports_streaming | TINYINT(1) | Boolean |
| supports_json_mode | TINYINT(1) | Boolean |
| context_window_tokens | INT UNSIGNED NULL |  |
| output_limit_tokens | INT UNSIGNED NULL |  |
| is_enabled | TINYINT(1) | Boolean |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(provider_id, model_key)`

### `ai_model_presets`

Reusable generation presets.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| owner_type | ENUM('system','user','world') | Preset scope |
| owner_ref_id | BIGINT UNSIGNED NULL | Depends on owner type |
| provider_id | BIGINT UNSIGNED FK -> ai_providers.id |  |
| model_id | BIGINT UNSIGNED FK -> ai_models.id |  |
| name | VARCHAR(150) |  |
| temperature | DECIMAL(4,3) NULL |  |
| top_p | DECIMAL(4,3) NULL |  |
| max_output_tokens | INT UNSIGNED NULL |  |
| frequency_penalty | DECIMAL(4,3) NULL |  |
| presence_penalty | DECIMAL(4,3) NULL |  |
| extra_params_json | JSON NULL | Provider-specific options |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(owner_type, owner_ref_id)`

### `world_ai_configs`

Per-world AI defaults.

| Column | Type | Notes |
|---|---|---|
| world_id | BIGINT UNSIGNED PK FK -> worlds.id |  |
| default_model_preset_id | BIGINT UNSIGNED FK -> ai_model_presets.id |  |
| narration_prompt_template | MEDIUMTEXT NULL |  |
| npc_dialogue_prompt_template | MEDIUMTEXT NULL |  |
| action_parse_prompt_template | MEDIUMTEXT NULL |  |
| summarization_prompt_template | MEDIUMTEXT NULL |  |
| safety_prompt_template | MEDIUMTEXT NULL |  |
| tool_schema_json | JSON NULL | Structured actions exposed to model |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

### `prompt_blocks`

Reusable prompt snippets.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED NULL FK -> worlds.id | Null for system-global |
| block_key | VARCHAR(100) | Stable key |
| name | VARCHAR(150) |  |
| block_type | ENUM('system','safety','lore','character','room','module','formatter') |  |
| body_text | MEDIUMTEXT | Prompt content |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, block_key)`
- index: `(world_id, block_type)`

### `inference_requests`

One row per AI call.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| session_id | BIGINT UNSIGNED NULL FK -> game_sessions.id | Optional gameplay bind |
| world_id | BIGINT UNSIGNED NULL FK -> worlds.id |  |
| turn_id | BIGINT UNSIGNED NULL FK -> session_turns.id |  |
| provider_id | BIGINT UNSIGNED FK -> ai_providers.id |  |
| model_id | BIGINT UNSIGNED FK -> ai_models.id |  |
| request_type | ENUM('narration','dialogue','action_parse','summarization','builder_assist','moderation') |  |
| prompt_hash | CHAR(64) NULL | Dedup/debug hash |
| request_payload_json | JSON NULL | Sanitized metadata, not always full prompt |
| response_payload_json | JSON NULL | Structured provider output |
| output_text | MEDIUMTEXT NULL | Final extracted text |
| status | ENUM('pending','completed','failed','cancelled') |  |
| error_message | TEXT NULL |  |
| started_at | DATETIME(3) |  |
| completed_at | DATETIME(3) NULL |  |
| created_at | DATETIME(3) |  |

Indexes:

- index: `(session_id, request_type, started_at)`
- index: `(world_id, request_type, started_at)`
- index: `(turn_id)`

### `inference_usage_logs`

Token and cost tracking.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| inference_request_id | BIGINT UNSIGNED FK -> inference_requests.id |  |
| input_tokens | INT UNSIGNED NULL |  |
| output_tokens | INT UNSIGNED NULL |  |
| cached_tokens | INT UNSIGNED NULL |  |
| estimated_cost_usd | DECIMAL(12,6) NULL |  |
| created_at | DATETIME(3) |  |

Indexes:

- unique: `(inference_request_id)`

---

## 13. Files and Native Storage

### `media_files`

Stores metadata for files saved to native hosting storage.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| public_id | CHAR(36) UNIQUE |  |
| owner_user_id | BIGINT UNSIGNED NULL FK -> users.id | Uploader |
| storage_disk | VARCHAR(50) | Usually `local` |
| storage_path | VARCHAR(500) | Relative server path |
| original_name | VARCHAR(255) |  |
| mime_type | VARCHAR(150) |  |
| extension | VARCHAR(20) NULL |  |
| size_bytes | BIGINT UNSIGNED |  |
| sha256_hash | CHAR(64) NULL | Dedup/integrity |
| image_width | INT UNSIGNED NULL |  |
| image_height | INT UNSIGNED NULL |  |
| purpose | ENUM('avatar','cover','map','item_icon','character_avatar','attachment','other') |  |
| visibility | ENUM('private','world_shared','public') | Access control |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |
| deleted_at | DATETIME(3) NULL |  |

Indexes:

- unique: `public_id`
- index: `(owner_user_id, purpose)`
- index: `sha256_hash`

---

## 14. Discovery, Engagement, and Social

### `world_tags`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| key_name | VARCHAR(100) UNIQUE |  |
| display_name | VARCHAR(100) |  |
| created_at | DATETIME(3) |  |

### `world_tag_assignments`

| Column | Type | Notes |
|---|---|---|
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| tag_id | BIGINT UNSIGNED FK -> world_tags.id |  |
| created_at | DATETIME(3) |  |

Primary key:

- `(world_id, tag_id)`

### `world_favorites`

| Column | Type | Notes |
|---|---|---|
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| created_at | DATETIME(3) |  |

Primary key:

- `(world_id, user_id)`

### `world_reviews`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| world_id | BIGINT UNSIGNED FK -> worlds.id |  |
| user_id | BIGINT UNSIGNED FK -> users.id |  |
| rating | TINYINT UNSIGNED | 1-5 if used |
| review_text | TEXT NULL |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- unique: `(world_id, user_id)`

---

## 15. Safety, Moderation, and Audit

### `reports`

User-generated reports against content or users.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| reporter_user_id | BIGINT UNSIGNED FK -> users.id |  |
| target_type | ENUM('world','room','character','message','user') |  |
| target_id | BIGINT UNSIGNED |  |
| reason_code | VARCHAR(80) |  |
| details | TEXT NULL |  |
| status | ENUM('open','reviewing','resolved','rejected') |  |
| created_at | DATETIME(3) |  |
| updated_at | DATETIME(3) |  |

Indexes:

- index: `(target_type, target_id, status)`

### `moderation_actions`

Moderator action log.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| report_id | BIGINT UNSIGNED NULL FK -> reports.id | Optional origin |
| moderator_user_id | BIGINT UNSIGNED FK -> users.id |  |
| target_type | ENUM('world','room','character','message','user') |  |
| target_id | BIGINT UNSIGNED |  |
| action_type | ENUM('warn','hide','unpublish','suspend','delete','restore') |  |
| notes | TEXT NULL |  |
| created_at | DATETIME(3) |  |

Indexes:

- index: `(target_type, target_id, action_type)`

### `audit_logs`

Critical backend audit log.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK |  |
| actor_user_id | BIGINT UNSIGNED NULL FK -> users.id | Optional actor |
| action_key | VARCHAR(120) | `world.publish`, `session.rollback` |
| target_type | VARCHAR(80) NULL |  |
| target_id | BIGINT UNSIGNED NULL |  |
| metadata_json | JSON NULL | Safe audit metadata |
| ip_address | VARCHAR(64) NULL |  |
| created_at | DATETIME(3) |  |

Indexes:

- index: `(action_key, created_at)`
- index: `(target_type, target_id, created_at)`

---

## 16. Redis Responsibilities

Redis is not the source of truth. Use it for:

- session cache
- auth/session lookups
- AI response streaming buffers
- rate limiting
- builder autosave debounce
- background job queue
- temporary turn assembly state
- lock/mutex control for session mutation

Suggested Redis keys:

- `session:lock:{sessionId}`
- `ratelimit:user:{userId}:{bucket}`
- `stream:turn:{turnId}`
- `autosave:world:{worldId}:{userId}`
- `job:queue:ai`

---

## 17. MVP-Critical Tables

If implementation starts in phases, create these first:

- `users`
- `user_profiles`
- `sessions`
- `verification_tokens`
- `worlds`
- `world_settings`
- `world_rooms`
- `world_room_exits`
- `world_characters`
- `world_items`
- `world_quests`
- `world_events`
- `rule_modules`
- `world_rule_modules`
- `ui_modules`
- `world_ui_layouts`
- `player_personas`
- `save_slots`
- `game_sessions`
- `session_player_states`
- `session_npc_states`
- `session_room_states`
- `session_inventory_items`
- `session_quest_states`
- `session_flags`
- `session_turns`
- `session_memory_summaries`
- `ai_providers`
- `ai_models`
- `ai_model_presets`
- `world_ai_configs`
- `inference_requests`
- `inference_usage_logs`
- `media_files`
- `reports`
- `audit_logs`

---

## 18. Suggested Implementation Order

### Phase 1

- identity/auth
- worlds
- rooms and exits
- personas
- sessions
- turn log
- AI inference logging

### Phase 2

- NPC runtime state
- items and inventory
- quests and flags
- UI layouts
- local file uploads

### Phase 3

- modular rule fields and actions
- event bindings
- memory summaries
- world version snapshots
- moderation and discovery

---

## 19. Open Questions Before Coding

These decisions should be finalized before writing migrations:

1. Will the first release support only single-player sessions?
2. Will adult content be supported, or only safe/mature?
3. Should world publishing use immutable snapshots or live editing with draft/published copies?
4. Will AI-generated actions always be validated through a fixed tool/action schema?
5. Do we want player stats stored mostly as structured rows or mostly as module JSON payloads?
6. Will maps be graph-based only, or also support coordinate/tile overlays later?

---

## 20. Recommended Next Development Artifact

After this schema, the next document should be:

- `docs/architecture/backend-domain-model.md`

That file should define:

- service boundaries
- runtime engine flow
- turn processing pipeline
- AI prompt assembly pipeline
- validation and reducer architecture

