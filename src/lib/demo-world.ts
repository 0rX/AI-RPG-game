import type { World } from "./game-types";

export const demoWorld: World = {
  id: "clockwork-mire",
  title: "Clockwork Mire",
  tagline: "A rain-bright city keeps one forbidden signal alive under its streets.",
  tone: "moody, tactile, clever, hopeful under pressure",
  startRoomId: "relay-yard",
  rooms: [
    {
      id: "relay-yard",
      title: "Relay Yard",
      summary: "Rain ticks against inactive signal masts.",
      description:
        "A crescent of iron signal masts surrounds the old yard. Their glass lenses are dark, but the ground hums as if a message is still trying to climb out of the city.",
      x: 160,
      y: 190,
      exits: [
        { direction: "east", targetRoomId: "market-arcade" },
        { direction: "south", targetRoomId: "flooded-steps" }
      ],
      itemIds: [],
      npcIds: ["mara"],
      tags: ["start", "industrial"]
    },
    {
      id: "market-arcade",
      title: "Market Arcade",
      summary: "Canopies snap above shuttered stalls.",
      description:
        "Colored canopies sag with rainwater. Most stalls are shut, but one counter still glows with a kettle lamp and a row of carefully labeled salvage drawers.",
      x: 340,
      y: 185,
      exits: [
        { direction: "west", targetRoomId: "relay-yard" },
        { direction: "east", targetRoomId: "archive-hall" }
      ],
      itemIds: ["brass-key"],
      npcIds: ["tovin"],
      tags: ["market", "social"]
    },
    {
      id: "archive-hall",
      title: "Archive Hall",
      summary: "Cabinets of damp city records lean in long rows.",
      description:
        "The archive smells of wet paper and lamp oil. A cracked skylight pours silver light over indexes of transit routes, family seals, and forbidden engineering notes.",
      x: 520,
      y: 185,
      exits: [
        { direction: "west", targetRoomId: "market-arcade" },
        { direction: "east", targetRoomId: "lens-vault", lockedByItemId: "brass-key" }
      ],
      itemIds: ["tin-badge"],
      npcIds: [],
      tags: ["lore", "quiet"]
    },
    {
      id: "lens-vault",
      title: "Lens Vault",
      summary: "A sealed vault holds the relay's missing prism.",
      description:
        "Copper ribs cross the walls like a mechanical ribcage. At the center, a pedestal waits under a cone of dust-thick light.",
      x: 700,
      y: 185,
      exits: [
        { direction: "west", targetRoomId: "archive-hall" },
        { direction: "south", targetRoomId: "signal-dais", lockedByItemId: "relay-prism" }
      ],
      itemIds: ["relay-prism"],
      npcIds: [],
      tags: ["vault", "quest"]
    },
    {
      id: "flooded-steps",
      title: "Flooded Steps",
      summary: "Steps descend into ankle-deep black water.",
      description:
        "The stairwell breathes cold air from below. Old chalk marks on the wall name water levels from storms no one alive remembers.",
      x: 160,
      y: 365,
      exits: [
        { direction: "north", targetRoomId: "relay-yard" },
        { direction: "east", targetRoomId: "pump-room" }
      ],
      itemIds: [],
      npcIds: [],
      tags: ["undercity"]
    },
    {
      id: "pump-room",
      title: "Pump Room",
      summary: "A patient machine keeps the lower city breathing.",
      description:
        "Pistons move behind brass safety mesh, slow and monumental. The pump is damaged but loyal, pushing riverwater away from neighborhoods built too low.",
      x: 340,
      y: 365,
      exits: [
        { direction: "west", targetRoomId: "flooded-steps" },
        { direction: "east", targetRoomId: "signal-dais" }
      ],
      itemIds: [],
      npcIds: ["elian"],
      tags: ["machine", "undercity"]
    },
    {
      id: "signal-dais",
      title: "Signal Dais",
      summary: "The final console waits below the city.",
      description:
        "A round dais holds the relay console. Its brass switches are cold, but the prism socket is polished from nervous hands returning to it over many years.",
      x: 525,
      y: 365,
      exits: [
        { direction: "west", targetRoomId: "pump-room" },
        { direction: "north", targetRoomId: "lens-vault" }
      ],
      itemIds: [],
      npcIds: [],
      tags: ["finale"]
    }
  ],
  npcs: [
    {
      id: "mara",
      name: "Mara Venn",
      role: "signal keeper",
      roomId: "relay-yard",
      personality:
        "Practical, watchful, and dryly kind. She believes broken systems can still carry honest messages.",
      greeting:
        "Mara wipes rain from a cracked lens and studies you. 'If the relay wakes tonight, everyone who buried the truth will hear it.'",
      questFlag: "met_mara"
    },
    {
      id: "tovin",
      name: "Tovin Silt",
      role: "salvage broker",
      roomId: "market-arcade",
      personality:
        "Fast-talking, careful with favors, secretly sentimental about the old city.",
      greeting:
        "Tovin slides a drawer shut with one finger. 'Nothing here is free, but some things are worth more in the right hands.'",
      questFlag: "met_tovin"
    },
    {
      id: "elian",
      name: "Elian Rook",
      role: "pumpwright",
      roomId: "pump-room",
      personality:
        "Tired, precise, and protective of the undercity's machinery.",
      greeting:
        "Elian does not look up from the pressure gauge. 'If you came to break something, pick a machine less tired than I am.'",
      questFlag: "met_elian"
    }
  ],
  items: [
    {
      id: "brass-key",
      name: "brass key",
      description: "A narrow key stamped with the Archive Hall crest.",
      portable: true
    },
    {
      id: "tin-badge",
      name: "tin badge",
      description: "A dented inspector badge from a dissolved city office.",
      portable: true,
      useText: "The badge catches lamplight. It will not open doors, but it changes how official trouble feels in your hand.",
      grantsFlag: "held_badge"
    },
    {
      id: "relay-prism",
      name: "relay prism",
      description: "A palm-sized prism that bends light into a thread of blue fire.",
      portable: true,
      useText: "The prism warms and throws a blue line across every wet surface nearby.",
      grantsFlag: "prism_attuned"
    }
  ],
  quests: [
    {
      id: "restore-relay",
      title: "Restore the Relay",
      summary: "Find the missing prism and bring the lower relay back online.",
      steps: [
        "Speak with Mara in the Relay Yard.",
        "Find a way through the Archive Hall vault.",
        "Recover the relay prism.",
        "Carry the prism to the Signal Dais."
      ],
      requiredFlags: ["met_mara", "has_relay-prism", "reached_signal-dais"]
    }
  ],
  lore: [
    {
      id: "relay-edict",
      title: "The Relay Edict",
      body:
        "The city relay was built to broadcast emergency testimony. Its last official use was sealed after the Council Riots."
    },
    {
      id: "mireworks",
      title: "Mireworks",
      body:
        "The undercity pumps are older than the current government. Most engineers treat them less like machines and more like stubborn ancestors."
    }
  ]
};
