export type Direction = "north" | "east" | "south" | "west" | "up" | "down";

export type Exit = {
  direction: Direction;
  targetRoomId: string;
  label?: string;
  travelText?: string;
  lockedByItemId?: string;
  hiddenUntilFlag?: string;
};

export type Room = {
  id: string;
  title: string;
  summary: string;
  description: string;
  entryText?: string;
  x: number;
  y: number;
  exits: Exit[];
  itemIds: string[];
  npcIds: string[];
  tags: string[];
};

export type Npc = {
  id: string;
  name: string;
  role: string;
  roomId: string;
  personality: string;
  greeting: string;
  questFlag?: string;
};

// Represents an item definition from the world, not a specific instance in inventory
export type Item = {
  id: string;
  name: string;
  description: string;
  portable: boolean;
  useText?: string;
  grantsFlag?: string;
  maxDurability?: number; // Added: Max durability for items that can break
};

export type Quest = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  requiredFlags: string[];
};

export type LoreEntry = {
  id: string;
  title: string;
  body: string;
};

export type World = {
  id: string;
  title: string;
  tagline: string;
  tone: string;
  startRoomId: string;
  rooms: Room[];
  npcs: Npc[];
  items: Item[];
  quests: Quest[];
  lore: LoreEntry[];
};

export type Turn = {
  id: string;
  actor: "player" | "engine" | "npc";
  text: string;
  actionLabel?: string;
};

// Represents a specific instance of an item in a player's inventory
export type PlayerInventoryItem = {
  itemId: string;
  currentDurability: number;
};

export type SessionState = {
  currentRoomId: string;
  // inventoryItemIds: string[]; // Replaced with a richer inventory type
  inventory: PlayerInventoryItem[]; // Added: Tracks specific item instances and their state
  flags: string[];
  completedQuestIds: string[];
  turns: Turn[];
};

export type EngineResult = {
  session: SessionState;
  narration: string;
  actionLabel: string;
};