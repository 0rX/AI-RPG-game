import type { EngineResult, Item, Room, SessionState, Turn, World, PlayerInventoryItem } from "./game-types";

const directionAliases: Record<string, string> = {
  n: "north",
  north: "north",
  e: "east",
  east: "east",
  s: "south",
  south: "south",
  w: "west",
  west: "west",
  u: "up",
  up: "up",
  d: "down",
  down: "down"
};

const directionSet = new Set(["north", "east", "south", "west", "up", "down"]);

function normalizeDirection(input: string) {
  const direction = directionAliases[input];
  return direction && directionSet.has(direction) ? direction : null;
}

export function createInitialSession(world: World): SessionState {
  return {
    currentRoomId: world.startRoomId,
    inventory: [],
    flags: [],
    completedQuestIds: [],
    turns: [
      {
        id: crypto.randomUUID(),
        actor: "engine",
        actionLabel: "session_started",
        text: `--- WELCOME TO ${world.title.toUpperCase()} ---\n${world.tagline}\n\n${getRoom(world, world.startRoomId).description}`
      }
    ]
  };
}

export function getRoom(world: World, roomId: string): Room {
  const room = world.rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Room not found: ${roomId}`);
  return room;
}

export function runTurn(world: World, session: SessionState, rawInput: string): EngineResult {
  const command = rawInput.trim();
  const normalized = command.toLowerCase();
  
  // Basic movement handling
  const directDirection = normalizeDirection(normalized);
  const goMatch = normalized.match(/^(go|move|walk|head)\s+(north|east|south|west|up|down|n|e|s|w|u|d)$/);

  if (directDirection || goMatch) {
    const direction = directDirection ?? normalizeDirection(goMatch?.[2] ?? "");
    return move(world, session, direction ?? "north");
  }

  if (normalized === "look" || normalized === "l") {
    return finish(session, "Look", describeRoom(world, session));
  }

  if (normalized === "inv" || normalized === "inventory") {
    const inv = session.inventory.map(i => world.items.find(w => w.id === i.itemId)?.name).join(", ") || "nothing";
    return finish(session, "Inventory", `You are carrying: ${inv}.`);
  }

  return finish(session, "Input", `You said: "${command}". I am a text engine; try moving or looking around.`);
}

function move(world: World, session: SessionState, direction: string): EngineResult {
  const room = getRoom(world, session.currentRoomId);
  const exit = room.exits.find((candidate) => candidate.direction === direction);

  if (!exit) {
    return finish(session, "Move", `You cannot go ${direction} from here.`);
  }

  const nextRoom = getRoom(world, exit.targetRoomId);
  return finish(
    { ...session, currentRoomId: nextRoom.id },
    "Move",
    `${exit.travelText ?? `You head ${direction}.`}\n\n${nextRoom.title}\n${nextRoom.description}`
  );
}

function describeRoom(world: World, session: SessionState) {
  const room = getRoom(world, session.currentRoomId);
  const exits = room.exits.map((e) => e.direction).join(", ");
  return `${room.title}\n${room.description}\n\nExits: ${exits}`;
}

function finish(session: SessionState, actionLabel: string, narration: string): EngineResult {
  const newTurn: Turn = {
    id: crypto.randomUUID(),
    actor: "engine",
    actionLabel,
    text: narration
  };

  return {
    session: { ...session, turns: [...session.turns, newTurn] },
    narration,
    actionLabel
  };
}