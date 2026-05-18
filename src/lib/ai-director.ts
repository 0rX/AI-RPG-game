import { z } from "zod";

export const directorRequestSchema = z.object({
  worldTitle: z.string().min(1),
  tone: z.string().min(1),
  roomTitle: z.string().min(1),
  actionLabel: z.string().min(1),
  engineNarration: z.string().min(1),
  model: z.string().trim().min(1).max(160).optional(),
  apiKey: z.string().trim().max(512).optional(),
  baseUrl: z.union([z.string().trim().url(), z.literal("")]).optional()
});

export type DirectorRequest = z.infer<typeof directorRequestSchema>;

export function fallbackDirectorNarration(input: DirectorRequest) {
  return [
    input.engineNarration,
    `The ${input.worldTitle} answers in a ${input.tone} cadence, keeping the result grounded in ${input.roomTitle}.`
  ].join(" ");
}
