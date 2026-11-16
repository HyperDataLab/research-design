import { z } from 'zod';
export const projectSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  owner: z.string(),
  members: z.array(z.string()),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;
