export type Direction = "north" | "east" | "south" | "west";

export type Room = {
  id: string;
  title: string;
  description: string;
  exits: Record<Direction, string>;
};

export type World = {
  rooms: Record<string, Room>;
  startRoomId: string;
};

export type SessionState = {
  currentRoomId: string;
  history: string[];
};

export type EngineResult = {
  session: SessionState;
  output: string;
};