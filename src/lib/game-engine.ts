import type { EngineResult, SessionState, World, Direction } from "./game-types";

/**
 * Validates that the provided world object contains the necessary structure
 * to initialize a session, specifically checking if the start room exists.
 */
export function validateWorld(world: World): { valid: boolean; error?: string } {
  if (!world.rooms) {
    return { valid: false, error: "World has no rooms defined." };
  }
  if (!world.startRoomId || !world.rooms[world.startRoomId]) {
    return { valid: false, error: `Start room with ID "${world.startRoomId}" not found in world.` };
  }
  return { valid: true };
}

export function createInitialSession(world: World): SessionState {
  const validation = validateWorld(world);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const room = world.rooms[world.startRoomId];

  return {
    currentRoomId: world.startRoomId,
    history: [`Welcome to the game.`, room.description]
  };
}

export function runTurn(world: World, session: SessionState, input: string): EngineResult {
  const cmd = input.toLowerCase().trim();
  const room = world.rooms[session.currentRoomId];
  let output = "";

  if (!room) {
    return {
      session,
      output: "Error: You are in a void. (Current room not found)"
    };
  }

  if (["north", "east", "south", "west"].includes(cmd)) {
    const direction = cmd as Direction;
    const nextRoomId = room.exits[direction];

    if (nextRoomId && world.rooms[nextRoomId]) {
      const nextRoom = world.rooms[nextRoomId];
      session.currentRoomId = nextRoomId;
      output = `You head ${direction}.\n\n${nextRoom.description}`;
    } else {
      output = "You can't go that way.";
    }
  } else if (cmd === "look") {
    output = room.description;
  } else {
    output = `Unknown command: ${cmd}. Try north, east, south, west, or look.`;
  }

  session.history.push(`> ${input}`);
  session.history.push(output);

  return { session, output };
}