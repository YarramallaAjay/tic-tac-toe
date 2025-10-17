import { z } from "zod";

// Validation schema for starting a new game
export const gameStartSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

// Validation schema for joining an existing game
export const gameJoinSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  gameCode: z.string().min(1, "Game code is required").max(10, "Game code is too long"),
});

export type GameStartInput = z.infer<typeof gameStartSchema>;
export type GameJoinInput = z.infer<typeof gameJoinSchema>;

export default gameStartSchema;

