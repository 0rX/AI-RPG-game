"use client";

import {
  Archive,
  BookOpen,
  Box,
  Compass,
  Download,
  Flag,
  Hammer,
  KeyRound,
  Map,
  MessageSquareText,
  Plus,
  RefreshCw,
  Route,
  Save,
  Sparkles,
  Swords,
  Upload,
  UserRound,
  WandSparkles
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { demoWorld } from "@/lib/demo-world";
import { createInitialSession, getInventoryItems, getRoom, runTurn, visibleExits } from "@/lib/game-engine";
import type { Direction, Item, LoreEntry, Npc, Quest, Room, SessionState, World } from "@/lib/game-types";

const directions: Direction[] = ["north", "east", "south", "west", "up", "down"];
const storageKey = "relicforge.workspace.v1";
const llmSettingsKey = "relicforge.llm-settings.v1";
const byokSessionKey = "relicforge.byok-session-key.v1";

type LlmSettings = {
  enabled: boolean;
  model: string;
  baseUrl: string;
};

type StoredWorkspace = {
  world: World;
  session: SessionState;
};

const defaultLlmSettings: LlmSettings = {
  enabled: false,
  model: "gpt-4.1-mini",
  baseUrl: ""
};

export function GameWorkbench() {
  const [world, setWorld] = useState<World>(demoWorld);
  const [session, setSession] = useState(() => createInitialSession(demoWorld));
  const [mode, setMode] = useState<"play" | "builder">("play");
  const [builderTab, setBuilderTab] = useState<"map" | "cast" | "items" | "quests" | "lore">("map");
  const [selectedRoomId, setSelectedRoomId] = useState(world.startRoomId);
  const [selectedNpcId, setSelectedNpcId] = useState(world.npcs[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState(world.items[0]?.id ?? "");
  const [selectedQuestId, setSelectedQuestId] = useState(world.quests[0]?.id ?? "");
  const [selectedLoreId, setSelectedLoreId] = useState(world.lore[0]?.id ?? "");
  const [command, setCommand] = useState("");
  const [newExitTarget, setNewExitTarget] = useState(world.rooms[1]?.id ?? world.startRoomId);
  const [newExitDirection, setNewExitDirection] = useState<Direction>("north");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Local draft");
  const [isDirecting, setIsDirecting] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(defaultLlmSettings);
  const [byokDraftKey, setByokDraftKey] = useState("");
  const [byokSessionApiKey, setByokSessionApiKey] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const currentRoom = getRoom(world, session.currentRoomId);
  const selectedRoom = getRoom(world, selectedRoomId);
  const selectedNpc = world.npcs.find((npc) => npc.id === selectedNpcId) ?? world.npcs[0];
  const selectedItem = world.items.find((item) => item.id === selectedItemId) ?? world.items[0];
  const selectedQuest = world.quests.find((quest) => quest.id === selectedQuestId) ?? world.quests[0];
  const selectedLore = world.lore.find((entry) => entry.id === selectedLoreId) ?? world.lore[0];
  const inventory = getInventoryItems(world, session);
  const currentNpcs = world.npcs.filter((npc) => currentRoom.npcIds.includes(npc.id));
  const roomItems = world.items.filter((item) => currentRoom.itemIds.includes(item.id) && !session.inventoryItemIds.includes(item.id));
  const activeQuest = world.quests[0];
  const completedSteps = activeQuest.requiredFlags.filter((flag) => session.flags.includes(flag)).length;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const storedLlm = window.localStorage.getItem(llmSettingsKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredWorkspace;
        setWorld(parsed.world);
        setSession(parsed.session);
        setSelectedRoomId(parsed.session.currentRoomId || parsed.world.startRoomId);
        setSelectedNpcId(parsed.world.npcs[0]?.id ?? "");
        setSelectedItemId(parsed.world.items[0]?.id ?? "");
        setSelectedQuestId(parsed.world.quests[0]?.id ?? "");
        setSelectedLoreId(parsed.world.lore[0]?.id ?? "");
        setSaveStatus("Restored local draft");
      } catch {
        setSaveStatus("Draft restore failed");
      }
    }
    if (storedLlm) {
      try {
        const parsed = JSON.parse(storedLlm) as Partial<LlmSettings> & { apiKey?: string };
        setLlmSettings({
          enabled: Boolean(parsed.enabled),
          model: parsed.model || defaultLlmSettings.model,
          baseUrl: parsed.baseUrl || defaultLlmSettings.baseUrl
        });
      } catch {
        setLlmSettings(defaultLlmSettings);
      }
    }
    const sessionApiKey = window.sessionStorage.getItem(byokSessionKey);
    if (sessionApiKey) {
      setByokSessionApiKey(sessionApiKey);
      setLlmSettings((current) => ({ ...current, enabled: true }));
    }
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    window.localStorage.setItem(
      llmSettingsKey,
      JSON.stringify({
        enabled: llmSettings.enabled,
        model: llmSettings.model,
        baseUrl: llmSettings.baseUrl
      })
    );
  }, [hasLoadedStorage, llmSettings]);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, JSON.stringify({ world, session }));
      setSaveStatus(`Autosaved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hasLoadedStorage, world, session]);

  const mapLines = useMemo(() => {
    return world.rooms.flatMap((room) =>
      room.exits
        .map((exit) => {
          const target = world.rooms.find((candidate) => candidate.id === exit.targetRoomId);
          return target ? { source: room, target, locked: Boolean(exit.lockedByItemId) } : null;
        })
        .filter((line): line is { source: Room; target: Room; locked: boolean } => Boolean(line))
    );
  }, [world.rooms]);

  async function submitTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = runTurn(world, session, command);
    setSession(result.session);
    setSelectedRoomId(result.session.currentRoomId);
    setCommand("");

    if (llmSettings.enabled && byokSessionApiKey && result.narration && result.actionLabel !== "Freeform action") {
      setIsDirecting(true);
      try {
        const response = await fetch("/api/director/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            worldTitle: world.title,
            tone: world.tone,
            roomTitle: getRoom(world, result.session.currentRoomId).title,
            actionLabel: result.actionLabel,
            engineNarration: result.narration,
            model: llmSettings.model,
            apiKey: byokSessionApiKey,
            baseUrl: llmSettings.baseUrl
          })
        });
        const data = (await response.json()) as { narration?: string };
        if (data.narration) {
          setSession((current) => ({
            ...current,
            turns: current.turns.map((turn, index) =>
              index === current.turns.length - 1 ? { ...turn, text: data.narration ?? turn.text } : turn
            )
          }));
        }
      } finally {
        setIsDirecting(false);
      }
    }
  }

  function updateSelectedRoom(patch: Partial<Room>) {
    setWorld((current) => ({
      ...current,
      rooms: current.rooms.map((room) => (room.id === selectedRoomId ? { ...room, ...patch } : room))
    }));
  }

  function addRoom() {
    const nextNumber = world.rooms.length + 1;
    const id = `room-${nextNumber}`;
    const room: Room = {
      id,
      title: `New Room ${nextNumber}`,
      summary: "A fresh place waits for its first detail.",
      description: "Draft the room's sensory details, affordances, and secrets here.",
      x: 180 + (nextNumber % 4) * 130,
      y: 120 + Math.floor(nextNumber / 4) * 130,
      exits: [],
      itemIds: [],
      npcIds: [],
      tags: ["draft"]
    };
    setWorld((current) => ({ ...current, rooms: [...current.rooms, room] }));
    setSelectedRoomId(id);
    setNewExitTarget(world.rooms[0]?.id ?? id);
  }

  function connectRoom() {
    if (selectedRoomId === newExitTarget) return;
    setWorld((current) => ({
      ...current,
      rooms: current.rooms.map((room) => {
        if (room.id !== selectedRoomId) return room;
        const withoutDuplicate = room.exits.filter((exit) => exit.direction !== newExitDirection);
        return {
          ...room,
          exits: [...withoutDuplicate, { direction: newExitDirection, targetRoomId: newExitTarget }]
        };
      })
    }));
  }

  function addNpc() {
    const id = `npc-${world.npcs.length + 1}`;
    const npc: Npc = {
      id,
      name: `New NPC ${world.npcs.length + 1}`,
      role: "local witness",
      roomId: selectedRoomId,
      personality: "Observant, specific, and ready to become memorable.",
      greeting: "The new arrival studies the room before answering."
    };
    setWorld((current) => ({
      ...current,
      npcs: [...current.npcs, npc],
      rooms: current.rooms.map((room) =>
        room.id === selectedRoomId ? { ...room, npcIds: [...room.npcIds, id] } : room
      )
    }));
    setSelectedNpcId(id);
  }

  function addItem() {
    const id = `item-${world.items.length + 1}`;
    const item: Item = {
      id,
      name: `new relic ${world.items.length + 1}`,
      description: "A newly authored item with room for mechanical meaning.",
      portable: true
    };
    setWorld((current) => ({
      ...current,
      items: [...current.items, item],
      rooms: current.rooms.map((room) =>
        room.id === selectedRoomId ? { ...room, itemIds: [...room.itemIds, id] } : room
      )
    }));
    setSelectedItemId(id);
  }

  function addQuest() {
    const id = `quest-${world.quests.length + 1}`;
    const quest: Quest = {
      id,
      title: `New Quest ${world.quests.length + 1}`,
      summary: "A new progression loop waiting for flags and rewards.",
      steps: ["Define the first objective."],
      requiredFlags: []
    };
    setWorld((current) => ({ ...current, quests: [...current.quests, quest] }));
    setSelectedQuestId(id);
  }

  function addLore() {
    const id = `lore-${world.lore.length + 1}`;
    const lore: LoreEntry = {
      id,
      title: `New Lore ${world.lore.length + 1}`,
      body: "Write a piece of world knowledge, myth, rule, or history."
    };
    setWorld((current) => ({ ...current, lore: [...current.lore, lore] }));
    setSelectedLoreId(id);
  }

  function updateNpc(id: string, patch: Partial<Npc>) {
    setWorld((current) => ({
      ...current,
      npcs: current.npcs.map((npc) => (npc.id === id ? { ...npc, ...patch } : npc)),
      rooms: patch.roomId
        ? current.rooms.map((room) => ({
            ...room,
            npcIds:
              room.id === patch.roomId
                ? Array.from(new Set([...room.npcIds, id]))
                : room.npcIds.filter((npcId) => npcId !== id)
          }))
        : current.rooms
    }));
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setWorld((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function updateQuest(id: string, patch: Partial<Quest>) {
    setWorld((current) => ({
      ...current,
      quests: current.quests.map((quest) => (quest.id === id ? { ...quest, ...patch } : quest))
    }));
  }

  function updateLore(id: string, patch: Partial<LoreEntry>) {
    setWorld((current) => ({
      ...current,
      lore: current.lore.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    }));
  }

  function resetSession() {
    setSession(createInitialSession(world));
    setSelectedRoomId(world.startRoomId);
  }

  function saveNow() {
    window.localStorage.setItem(storageKey, JSON.stringify({ world, session }));
    setSaveStatus(`Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }

  function resetWorkspace() {
    setWorld(demoWorld);
    const nextSession = createInitialSession(demoWorld);
    setSession(nextSession);
    setSelectedRoomId(demoWorld.startRoomId);
    setSaveStatus("Demo restored");
  }

  function exportWorkspace() {
    const blob = new Blob([JSON.stringify({ world, session }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${world.id}-workspace.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as StoredWorkspace;
    setWorld(parsed.world);
    setSession(parsed.session);
    setSelectedRoomId(parsed.session.currentRoomId || parsed.world.startRoomId);
    setSaveStatus("Imported workspace");
  }

  function startByokSession() {
    const trimmedKey = byokDraftKey.trim();
    if (!trimmedKey) {
      setSaveStatus("Enter an API key first");
      return;
    }
    window.sessionStorage.setItem(byokSessionKey, trimmedKey);
    setByokSessionApiKey(trimmedKey);
    setByokDraftKey("");
    setLlmSettings((current) => ({ ...current, enabled: true }));
    setSaveStatus("BYOK session started");
  }

  function endByokSession() {
    window.sessionStorage.removeItem(byokSessionKey);
    setByokSessionApiKey("");
    setByokDraftKey("");
    setLlmSettings((current) => ({ ...current, enabled: false }));
    setSaveStatus("BYOK session ended");
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>RelicForge</strong>
            <span>Text RPG Studio</span>
          </div>
        </div>

        <div className="world-card">
          <span className="kicker">Active world</span>
          <h1>{world.title}</h1>
          <p>{world.tagline}</p>
        </div>

        <nav className="mode-switch" aria-label="Mode">
          <button className={mode === "play" ? "active" : ""} onClick={() => setMode("play")}>
            <Swords size={18} />
            Play
          </button>
          <button className={mode === "builder" ? "active" : ""} onClick={() => setMode("builder")}>
            <Hammer size={18} />
            Builder
          </button>
        </nav>

        <div className="stat-grid">
          <div>
            <strong>{world.rooms.length}</strong>
            <span>Rooms</span>
          </div>
          <div>
            <strong>{world.npcs.length}</strong>
            <span>NPCs</span>
          </div>
          <div>
            <strong>{world.items.length}</strong>
            <span>Items</span>
          </div>
          <div>
            <strong>{session.turns.length}</strong>
            <span>Turns</span>
          </div>
        </div>

        <section className="llm-panel" aria-label="LLM settings">
          <div className="llm-heading">
            <KeyRound size={17} />
            <strong>LLM Settings</strong>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={llmSettings.enabled && Boolean(byokSessionApiKey)}
              disabled={!byokSessionApiKey}
              onChange={(event) => setLlmSettings((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Use custom AI narration
          </label>
          <div className={byokSessionApiKey ? "session-pill active" : "session-pill"}>
            {byokSessionApiKey ? "BYOK session active" : "No BYOK session"}
          </div>
          <label>
            Model
            <input
              value={llmSettings.model}
              onChange={(event) => setLlmSettings((current) => ({ ...current, model: event.target.value }))}
              placeholder="gpt-4.1-mini, openrouter/model, local-model"
            />
          </label>
          <label>
            API Key
            <input
              value={byokDraftKey}
              type="password"
              autoComplete="off"
              onChange={(event) => setByokDraftKey(event.target.value)}
              placeholder={byokSessionApiKey ? "Session key active" : "Paste key to start session"}
            />
          </label>
          <label>
            Base URL
            <input
              value={llmSettings.baseUrl}
              onChange={(event) => setLlmSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="Optional, e.g. https://openrouter.ai/api/v1"
            />
          </label>
          <div className="button-row">
            <button onClick={startByokSession}>
              <KeyRound size={16} />
              Start
            </button>
            <button onClick={endByokSession} disabled={!byokSessionApiKey}>
              End
            </button>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="kicker">{mode === "play" ? "Runtime" : "Creator workspace"}</span>
            <h2>{mode === "play" ? currentRoom.title : selectedRoom.title}</h2>
          </div>
          <div className="topbar-actions">
            <input
              ref={importInputRef}
              className="file-input"
              type="file"
              accept="application/json"
              onChange={(event) => void importWorkspace(event.target.files?.[0])}
            />
            <span className="save-status">{isDirecting ? "AI directing" : saveStatus}</span>
            <button className="icon-button" title="Save snapshot" aria-label="Save snapshot" onClick={saveNow}>
              <Save size={18} />
            </button>
            <button className="icon-button" title="Export workspace" aria-label="Export workspace" onClick={exportWorkspace}>
              <Download size={18} />
            </button>
            <button className="icon-button" title="Import workspace" aria-label="Import workspace" onClick={() => importInputRef.current?.click()}>
              <Upload size={18} />
            </button>
            <button className="icon-button" title="Restore demo" aria-label="Restore demo" onClick={resetWorkspace}>
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" title="AI director" aria-label="AI director">
              <WandSparkles size={18} />
            </button>
          </div>
        </header>

        {mode === "play" ? (
          <div className="runtime-grid">
            <section className="main-stage">
              <RoomMap
                rooms={world.rooms}
                lines={mapLines}
                currentRoomId={session.currentRoomId}
                selectedRoomId={selectedRoomId}
                onSelect={setSelectedRoomId}
              />

              <div className="room-panel">
                <div className="panel-heading">
                  <Compass size={18} />
                  <span>{currentRoom.summary}</span>
                </div>
                <p>{currentRoom.description}</p>
                <div className="chip-row">
                  {visibleExits(world, session).map((exit) => (
                    <button key={exit.direction} className="chip" onClick={() => setCommand(exit.direction)}>
                      <Route size={14} />
                      {exit.direction}
                    </button>
                  ))}
                </div>
              </div>

              <form className="command-bar" onSubmit={submitTurn}>
                <MessageSquareText size={20} />
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="go east, talk mara, take brass key, use relay prism"
                />
                <button type="submit">Send</button>
              </form>
            </section>

            <aside className="runtime-side">
              <Panel title="Quest" icon={<Flag size={18} />}>
                <h3>{activeQuest.title}</h3>
                <p>{activeQuest.summary}</p>
                <div className="progress-track">
                  <span style={{ width: `${(completedSteps / activeQuest.requiredFlags.length) * 100}%` }} />
                </div>
                <ol className="quest-list">
                  {activeQuest.steps.map((step, index) => (
                    <li key={step} className={index < completedSteps ? "done" : ""}>
                      {step}
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel title="Inventory" icon={<Box size={18} />}>
                {inventory.length ? (
                  <div className="inventory-list">
                    {inventory.map((item) => (
                      <button key={item.id} onClick={() => setCommand(`use ${item.name}`)}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Empty</p>
                )}
              </Panel>

              <Panel title="Room" icon={<Archive size={18} />}>
                <div className="mini-list">
                  {roomItems.map((item) => (
                    <button key={item.id} onClick={() => setCommand(`take ${item.name}`)}>
                      {item.name}
                    </button>
                  ))}
                  {currentNpcs.map((npc) => (
                    <button key={npc.id} onClick={() => setCommand(`talk ${npc.name}`)}>
                      {npc.name}
                    </button>
                  ))}
                  {!roomItems.length && !currentNpcs.length ? <p className="muted">Clear</p> : null}
                </div>
              </Panel>

              <Panel title="Turn Log" icon={<BookOpen size={18} />}>
                <div className="turn-log">
                  {session.turns.slice(-8).map((turn) => (
                    <article key={turn.id} className={turn.actor}>
                      <span>{turn.actionLabel ?? turn.actor}</span>
                      <p>{turn.text}</p>
                    </article>
                  ))}
                </div>
              </Panel>

              <button className="wide-button" onClick={resetSession}>
                Reset Session
              </button>
            </aside>
          </div>
        ) : (
          <div className="builder-grid">
            <section className="builder-main">
              <div className="tabbar" role="tablist" aria-label="Builder sections">
                {[
                  ["map", Map],
                  ["cast", UserRound],
                  ["items", Box],
                  ["quests", Flag],
                  ["lore", BookOpen]
                ].map(([tab, Icon]) => (
                  <button
                    key={String(tab)}
                    className={builderTab === tab ? "active" : ""}
                    onClick={() => setBuilderTab(tab as typeof builderTab)}
                  >
                    <Icon size={17} />
                    {String(tab)}
                  </button>
                ))}
              </div>

              {builderTab === "map" ? (
                <div className="editor-stack">
                  <RoomMap
                    rooms={world.rooms}
                    lines={mapLines}
                    currentRoomId={session.currentRoomId}
                    selectedRoomId={selectedRoomId}
                    onSelect={setSelectedRoomId}
                  />
                  <div className="editor-form">
                    <label>
                      Title
                      <input value={selectedRoom.title} onChange={(event) => updateSelectedRoom({ title: event.target.value })} />
                    </label>
                    <label>
                      Summary
                      <input value={selectedRoom.summary} onChange={(event) => updateSelectedRoom({ summary: event.target.value })} />
                    </label>
                    <label>
                      Description
                      <textarea value={selectedRoom.description} onChange={(event) => updateSelectedRoom({ description: event.target.value })} />
                    </label>
                    <div className="form-row">
                      <label>
                        Direction
                        <select value={newExitDirection} onChange={(event) => setNewExitDirection(event.target.value as Direction)}>
                          {directions.map((direction) => (
                            <option key={direction}>{direction}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Target
                        <select value={newExitTarget} onChange={(event) => setNewExitTarget(event.target.value)}>
                          {world.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="button-row">
                      <button onClick={addRoom}>
                        <Plus size={16} />
                        Room
                      </button>
                      <button onClick={connectRoom}>
                        <Route size={16} />
                        Exit
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {builderTab === "cast" ? (
                <BuilderList
                  title="Cast"
                  actionLabel="NPC"
                  onAdd={addNpc}
                  activeId={selectedNpcId}
                  onSelect={setSelectedNpcId}
                  rows={world.npcs.map((npc) => ({
                    id: npc.id,
                    title: npc.name,
                    meta: npc.role,
                    body: npc.personality
                  }))}
                />
              ) : null}

              {builderTab === "items" ? (
                <BuilderList
                  title="Items"
                  actionLabel="Item"
                  onAdd={addItem}
                  activeId={selectedItemId}
                  onSelect={setSelectedItemId}
                  rows={world.items.map((item) => ({
                    id: item.id,
                    title: item.name,
                    meta: item.portable ? "portable" : "fixed",
                    body: item.description
                  }))}
                />
              ) : null}

              {builderTab === "quests" ? (
                <BuilderList
                  title="Quests"
                  actionLabel="Quest"
                  onAdd={addQuest}
                  activeId={selectedQuestId}
                  onSelect={setSelectedQuestId}
                  rows={world.quests.map((quest) => ({
                    id: quest.id,
                    title: quest.title,
                    meta: `${quest.steps.length} steps`,
                    body: quest.summary
                  }))}
                />
              ) : null}

              {builderTab === "lore" ? (
                <BuilderList
                  title="Lore"
                  actionLabel="Lore"
                  onAdd={addLore}
                  activeId={selectedLoreId}
                  onSelect={setSelectedLoreId}
                  rows={world.lore.map((entry) => ({
                    id: entry.id,
                    title: entry.title,
                    meta: "codex",
                    body: entry.body
                  }))}
                />
              ) : null}
            </section>

            <aside className="builder-side">
              <Panel title="World" icon={<Sparkles size={18} />}>
                <label>
                  Title
                  <input value={world.title} onChange={(event) => setWorld({ ...world, title: event.target.value })} />
                </label>
                <label>
                  Tagline
                  <textarea value={world.tagline} onChange={(event) => setWorld({ ...world, tagline: event.target.value })} />
                </label>
                <label>
                  Tone
                  <textarea value={world.tone} onChange={(event) => setWorld({ ...world, tone: event.target.value })} />
                </label>
              </Panel>

              {builderTab === "cast" && selectedNpc ? (
                <Panel title="NPC Editor" icon={<UserRound size={18} />}>
                  <label>
                    Name
                    <input value={selectedNpc.name} onChange={(event) => updateNpc(selectedNpc.id, { name: event.target.value })} />
                  </label>
                  <label>
                    Role
                    <input value={selectedNpc.role} onChange={(event) => updateNpc(selectedNpc.id, { role: event.target.value })} />
                  </label>
                  <label>
                    Room
                    <select value={selectedNpc.roomId} onChange={(event) => updateNpc(selectedNpc.id, { roomId: event.target.value })}>
                      {world.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Greeting
                    <textarea value={selectedNpc.greeting} onChange={(event) => updateNpc(selectedNpc.id, { greeting: event.target.value })} />
                  </label>
                  <label>
                    Personality
                    <textarea value={selectedNpc.personality} onChange={(event) => updateNpc(selectedNpc.id, { personality: event.target.value })} />
                  </label>
                </Panel>
              ) : null}

              {builderTab === "items" && selectedItem ? (
                <Panel title="Item Editor" icon={<Box size={18} />}>
                  <label>
                    Name
                    <input value={selectedItem.name} onChange={(event) => updateItem(selectedItem.id, { name: event.target.value })} />
                  </label>
                  <label>
                    Description
                    <textarea value={selectedItem.description} onChange={(event) => updateItem(selectedItem.id, { description: event.target.value })} />
                  </label>
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={selectedItem.portable}
                      onChange={(event) => updateItem(selectedItem.id, { portable: event.target.checked })}
                    />
                    Portable
                  </label>
                  <label>
                    Use Text
                    <textarea value={selectedItem.useText ?? ""} onChange={(event) => updateItem(selectedItem.id, { useText: event.target.value })} />
                  </label>
                </Panel>
              ) : null}

              {builderTab === "quests" && selectedQuest ? (
                <Panel title="Quest Editor" icon={<Flag size={18} />}>
                  <label>
                    Title
                    <input value={selectedQuest.title} onChange={(event) => updateQuest(selectedQuest.id, { title: event.target.value })} />
                  </label>
                  <label>
                    Summary
                    <textarea value={selectedQuest.summary} onChange={(event) => updateQuest(selectedQuest.id, { summary: event.target.value })} />
                  </label>
                  <label>
                    Steps
                    <textarea
                      value={selectedQuest.steps.join("\n")}
                      onChange={(event) =>
                        updateQuest(selectedQuest.id, {
                          steps: event.target.value.split("\n").filter(Boolean)
                        })
                      }
                    />
                  </label>
                  <label>
                    Required Flags
                    <textarea
                      value={selectedQuest.requiredFlags.join("\n")}
                      onChange={(event) =>
                        updateQuest(selectedQuest.id, {
                          requiredFlags: event.target.value.split("\n").filter(Boolean)
                        })
                      }
                    />
                  </label>
                </Panel>
              ) : null}

              {builderTab === "lore" && selectedLore ? (
                <Panel title="Lore Editor" icon={<BookOpen size={18} />}>
                  <label>
                    Title
                    <input value={selectedLore.title} onChange={(event) => updateLore(selectedLore.id, { title: event.target.value })} />
                  </label>
                  <label>
                    Body
                    <textarea value={selectedLore.body} onChange={(event) => updateLore(selectedLore.id, { body: event.target.value })} />
                  </label>
                </Panel>
              ) : null}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function RoomMap({
  rooms,
  lines,
  currentRoomId,
  selectedRoomId,
  onSelect
}: {
  rooms: Room[];
  lines: { source: Room; target: Room; locked: boolean }[];
  currentRoomId: string;
  selectedRoomId: string;
  onSelect: (roomId: string) => void;
}) {
  return (
    <div className="map-surface">
      <svg viewBox="0 0 860 520" role="img" aria-label="World map">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(238,232,205,.09)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="860" height="520" fill="url(#grid)" />
        {lines.map((line) => (
          <line
            key={`${line.source.id}-${line.target.id}`}
            x1={line.source.x}
            y1={line.source.y}
            x2={line.target.x}
            y2={line.target.y}
            className={line.locked ? "map-line locked" : "map-line"}
          />
        ))}
        {rooms.map((room) => (
          <g key={room.id} className="map-node" onClick={() => onSelect(room.id)} tabIndex={0}>
            <circle
              cx={room.x}
              cy={room.y}
              r={room.id === currentRoomId ? 25 : 19}
              className={[
                room.id === currentRoomId ? "current" : "",
                room.id === selectedRoomId ? "selected" : ""
              ].join(" ")}
            />
            <text x={room.x} y={room.y + 43}>
              {room.title}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BuilderList({
  title,
  actionLabel,
  rows,
  onAdd,
  activeId,
  onSelect
}: {
  title: string;
  actionLabel: string;
  rows: { id: string; title: string; meta: string; body: string }[];
  onAdd?: () => void;
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="builder-list">
      <div className="builder-list-head">
        <h2>{title}</h2>
        {onAdd ? (
          <button onClick={onAdd}>
            <Plus size={16} />
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="entity-grid">
        {rows.map((row) => (
          <button key={row.id} className={row.id === activeId ? "entity-card active" : "entity-card"} onClick={() => onSelect?.(row.id)}>
            <span>{row.meta}</span>
            <h3>{row.title}</h3>
            <p>{row.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
