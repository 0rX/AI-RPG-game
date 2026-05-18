import { describe, expect, it } from "vitest";
import { demoWorld } from "./demo-world";
import { createInitialSession, getRoom, runTurn } from "./game-engine";

describe("game engine", () => {
  it("starts in the world's configured room", () => {
    const session = createInitialSession(demoWorld);

    expect(session.currentRoomId).toBe(demoWorld.startRoomId);
    expect(getRoom(demoWorld, session.currentRoomId).title).toBe("Relay Yard");
  });

  it("moves through a valid exit", () => {
    const session = createInitialSession(demoWorld);
    const result = runTurn(demoWorld, session, "east");

    expect(result.session.currentRoomId).toBe("market-arcade");
    expect(result.actionLabel).toBe("Move east");
  });

  it("blocks locked exits until the required item is carried", () => {
    const atArchive = {
      ...createInitialSession(demoWorld),
      currentRoomId: "archive-hall"
    };

    const blocked = runTurn(demoWorld, atArchive, "east");
    expect(blocked.session.currentRoomId).toBe("archive-hall");
    expect(blocked.actionLabel).toBe("Locked exit");

    const unlocked = runTurn(
      demoWorld,
      {
        ...atArchive,
        inventoryItemIds: ["brass-key"]
      },
      "east"
    );
    expect(unlocked.session.currentRoomId).toBe("lens-vault");
  });

  it("adds portable room items to inventory and grants possession flags", () => {
    const atMarket = {
      ...createInitialSession(demoWorld),
      currentRoomId: "market-arcade"
    };

    const result = runTurn(demoWorld, atMarket, "take brass key");

    expect(result.session.inventoryItemIds).toContain("brass-key");
    expect(result.session.flags).toContain("has_brass-key");
  });

  it("uses item effects to grant configured flags", () => {
    const session = {
      ...createInitialSession(demoWorld),
      inventoryItemIds: ["relay-prism"]
    };

    const result = runTurn(demoWorld, session, "use relay prism");

    expect(result.session.flags).toContain("prism_attuned");
  });

  it("completes a quest when all required flags exist", () => {
    const session = {
      ...createInitialSession(demoWorld),
      currentRoomId: "pump-room",
      flags: ["met_mara", "has_relay-prism"]
    };

    const result = runTurn(demoWorld, session, "east");

    expect(result.session.currentRoomId).toBe("signal-dais");
    expect(result.session.flags).toContain("reached_signal-dais");
    expect(result.session.completedQuestIds).toContain("restore-relay");
  });
});
