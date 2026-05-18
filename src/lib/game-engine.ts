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

/**
 * Rolls a standard six-sided die (1-6).
 */
function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function createInitialSession(world: World): SessionState {
  return {
    currentRoomId: world.startRoomId,
    // inventoryItemIds: [], // Old, replaced
    inventory: [], // New inventory array
    flags: [],
    completedQuestIds: [],
    turns: [
      {
        id: crypto.randomUUID(),
        actor: "engine",
        actionLabel: "session_started",
        text: "The session begins with the world waiting for its first decision."
      }
    ]
  };
}

export function getRoom(world: World, roomId: string): Room {
  const room = world.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }
  return room;
}

/**
 * Retrieves the player's inventory items, merging their world definitions with session-specific state (like current durability).
 */
export function getInventoryItems(world: World, session: SessionState): (Item & { currentDurability: number })[] {
  return session.inventory
    .map(sessionItem => {
      const worldItem = world.items.find(item => item.id === sessionItem.itemId);
      if (worldItem) {
        return { ...worldItem, currentDurability: sessionItem.currentDurability };
      }
      return null;
    })
    .filter((item): item is (Item & { currentDurability: number }) => Boolean(item));
}

export function visibleExits(world: World, session: SessionState) {
  const room = getRoom(world, session.currentRoomId);
  return room.exits.filter((exit) => !exit.hiddenUntilFlag || session.flags.includes(exit.hiddenUntilFlag));
}

export function runTurn(world: World, session: SessionState, rawInput: string): EngineResult {
  const command = rawInput.trim();
  const turns: Turn[] = [
    ...session.turns,
    {
      id: crypto.randomUUID(),
      actor: "player",
      text: command,
      actionLabel: "player_input"
    }
  ];

  if (!command) {
    return finish(session, turns, "Wait", "Rain and machinery fill the silence. Nothing changes yet.");
  }

  const normalized = command.toLowerCase();
  const directDirection = normalizeDirection(normalized);
  const goMatch = normalized.match(/^(go|move|walk|head)\s+(north|east|south|west|up|down|n|e|s|w|u|d)$/);

  if (directDirection || goMatch) {
    const direction = directDirection ?? normalizeDirection(goMatch?.[2] ?? "");
    return move(world, session, turns, direction ?? "north");
  }

  if (normalized === "look" || normalized === "inspect room" || normalized === "look around") {
    return finish(session, turns, "Inspect room", describeRoom(world, session));
  }

  if (normalized.startsWith("take ") || normalized.startsWith("pick up ")) {
    const itemName = normalized.replace(/^take\s+|^pick up\s+/, "");
    return takeItem(world, session, turns, itemName);
  }

  if (normalized.startsWith("use ")) {
    const itemName = normalized.replace(/^use\s+/, "");
    return activateItem(world, session, turns, itemName);
  }

  if (normalized.startsWith("talk ") || normalized.startsWith("speak ") || normalized.startsWith("ask ")) {
    return talkToNpc(world, session, turns, normalized);
  }

  return finish(
    session,
    turns,
    "Freeform action",
    `The world considers "${command}". For this MVP slice, the engine keeps freeform actions narrative-only until a module claims them.`
  );
}

function move(world: World, session: SessionState, turns: Turn[], direction: string): EngineResult {
  const room = getRoom(world, session.currentRoomId);
  const exit = room.exits.find((candidate) => candidate.direction === direction);

  if (!exit) {
    return finish(session, turns, "Move blocked", `There is no ${direction} exit from ${room.title}.`);
  }

  // Check if exit is locked by an item the player possesses (using the new inventory structure)
  if (exit.lockedByItemId && !session.inventory.some(invItem => invItem.itemId === exit.lockedByItemId)) {
    const item = world.items.find((candidate) => candidate.id === exit.lockedByItemId);
    return finish(session, turns, "Locked exit", `${exit.label ?? "The way"} is locked. ${item ? `You need the ${item.name}.` : "You need the right key."}`);
  }

  const nextRoom = getRoom(world, exit.targetRoomId);
  const flags = addFlags(session.flags, nextRoom.id === "signal-dais" ? ["reached_signal-dais"] : []);
  const completedQuestIds = world.quests
    .filter((quest) => quest.requiredFlags.every((flag) => flags.includes(flag)))
    .map((quest) => quest.id);

  return finish(
    {
      ...session,
      currentRoomId: nextRoom.id,
      flags,
      completedQuestIds
    },
    turns,
    `Move ${direction}`,
    `${exit.travelText ?? `You move ${direction}.`} ${nextRoom.summary} ${nextRoom.entryText ?? ""}`.trim()
  );
}

function takeItem(world: World, session: SessionState, turns: Turn[], itemName: string): EngineResult {
  const room = getRoom(world, session.currentRoomId);
  const item = world.items.find((candidate) => room.itemIds.includes(candidate.id) && candidate.name.toLowerCase().includes(itemName));

  if (!item) {
    return finish(session, turns, "Take failed", `You do not see "${itemName}" here.`);
  }

  if (!item.portable) {
    return finish(session, turns, "Take failed", `The ${item.name} is not something you can carry.`);
  }

  // Add the item to the new inventory structure with initial durability
  const newInventory: PlayerInventoryItem[] = [
    ...session.inventory,
    {
      itemId: item.id,
      currentDurability: item.maxDurability ?? 5 // Default durability to 5 if not specified
    }
  ];

  return finish(
    {
      ...session,
      // inventoryItemIds: unique([...session.inventoryItemIds, item.id]), // Old, replaced
      inventory: newInventory, // New inventory update
      flags: addFlags(session.flags, [`has_${item.id}`])
    },
    turns,
    `Take ${item.name}`,
    `You take the ${item.name}. ${item.description}`
  );
}

function activateItem(world: World, session: SessionState, turns: Turn[], itemName: string): EngineResult {
  // Retrieve inventory items with their current durability state
  const inventoryItemsWithDurability = getInventoryItems(world, session);
  const itemToActivate = inventoryItemsWithDurability.find((candidate) => candidate.name.toLowerCase().includes(itemName));

  if (!itemToActivate) {
    return finish(session, turns, "Use failed", `You are not carrying "${itemName}".`);
  }

  let narration = itemToActivate.useText ?? `You test the ${itemToActivate.name}, but the moment is not ready for it yet.`;
  let newInventory = [...session.inventory]; // Create a mutable copy of the inventory
  let flags = [...session.flags]; // Create a mutable copy of flags

  // --- Critical Failure Mechanic ---
  const roll = rollD6();
  if (roll === 1) {
    let criticalFailureNarration = `Oh no! You fumble the ${itemToActivate.name} badly! A catastrophic complication occurs. `;
    let damagedItem: PlayerInventoryItem | undefined = undefined;
    let damagedItemIndex = -1;

    // Prioritize damaging the item that was just used, if it has durability
    const activeItemDurability = itemToActivate.currentDurability;
    if (activeItemDurability !== undefined && activeItemDurability > 0) {
      damagedItemIndex = newInventory.findIndex(invItem => invItem.itemId === itemToActivate.itemId);
      if (damagedItemIndex !== -1) {
        damagedItem = newInventory[damagedItemIndex];
      }
    }

    // If the activated item couldn't be damaged (e.g., already broken or no durability),
    // find another portable item in inventory with durability to damage
    if (!damagedItem) {
      const potentialOtherDamagedItems = newInventory.filter(
        invItem => invItem.itemId !== itemToActivate.itemId && invItem.currentDurability > 0
      );
      if (potentialOtherDamagedItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * potentialOtherDamagedItems.length);
        damagedItem = potentialOtherDamagedItems[randomIndex];
        damagedItemIndex = newInventory.findIndex(invItem => invItem.itemId === damagedItem?.itemId);
      }
    }

    if (damagedItem && damagedItemIndex !== -1) {
      damagedItem.currentDurability--;
      const damagedWorldItem = world.items.find(i => i.id === damagedItem!.itemId);
      const damagedItemName = damagedWorldItem?.name ?? "an unknown item";

      if (damagedItem.currentDurability <= 0) {
        criticalFailureNarration += `Your ${damagedItemName} shatters into pieces! It's now useless and removed from your inventory. `;
        newInventory.splice(damagedItemIndex, 1); // Remove the broken item
        // Remove the 'has_' flag for the broken item
        flags = flags.filter(flag => flag !== `has_${damagedItem!.itemId}`);
      } else {
        criticalFailureNarration += `Your ${damagedItemName} takes a beating, its durability reduced to ${damagedItem.currentDurability}. `;
        newInventory[damagedItemIndex] = damagedItem; // Update the item in the inventory with new durability
      }
    } else {
      criticalFailureNarration += `You manage to avoid serious damage to your gear, but the setback is palpable. `;
    }
    narration = criticalFailureNarration + narration; // Prepend failure to original use text
  }
  // --- End Critical Failure Mechanic ---

  // Apply item's flag grant after potential critical failure
  if (itemToActivate.grantsFlag) {
    flags = addFlags(flags, [itemToActivate.grantsFlag]);
  }

  return finish(
    {
      ...session,
      inventory: newInventory,
      flags: flags
    },
    turns,
    `Use ${itemToActivate.name}`,
    narration
  );
}

function talkToNpc(world: World, session: SessionState, turns: Turn[], normalized: string): EngineResult {
  const room = getRoom(world, session.currentRoomId);
  const npc = world.npcs.find((candidate) => room.npcIds.includes(candidate.id) && normalized.includes(candidate.name.toLowerCase().split(" ")[0]));

  if (!npc) {
    const available = world.npcs.filter((candidate) => room.npcIds.includes(candidate.id));
    if (available.length === 0) {
      return finish(session, turns, "Dialogue failed", "There is no one here to answer.");
    }
    return finish(session, turns, "Dialogue hint", `${available[0].name} is nearby. Try speaking to them by name.`);
  }

  return finish(
    {
      ...session,
      flags: addFlags(session.flags, npc.questFlag ? [npc.questFlag] : [])
    },
    turns,
    `Talk to ${npc.name}`,
    `${npc.greeting} ${npc.personality}`
  );
}

function describeRoom(world: World, session: SessionState) {
  const room = getRoom(world, session.currentRoomId);
  const exits = visibleExits(world, session).map((exit) => exit.direction).join(", ") || "none";
  const items = world.items.filter((item) => room.itemIds.includes(item.id) && !session.inventory.some(invItem => invItem.itemId === item.id));
  const npcs = world.npcs.filter((npc) => room.npcIds.includes(npc.id));
  return [
    room.description,
    items.length ? `Visible items: ${items.map((item) => item.name).join(", ")}.` : "No loose items catch your eye.",
    npcs.length ? `Present: ${npcs.map((npc) => npc.name).join(", ")}.` : "No one else is here.",
    `Exits: ${exits}.`
  ].join(" ");
}

function finish(session: SessionState, turns: Turn[], actionLabel: string, narration: string): EngineResult {
  return {
    session: {
      ...session,
      turns: [
        ...turns,
        {
          id: crypto.randomUUID(),
          actor: "engine",
          actionLabel,
          text: narration
        }
      ]
    },
    narration,
    actionLabel
  };
}

function addFlags(existing: string[], incoming: string[]) {
  return unique([...existing, ...incoming]);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}