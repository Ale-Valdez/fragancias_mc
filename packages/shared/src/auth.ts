import { z } from "zod";

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  role: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
