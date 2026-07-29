import { z } from "zod";
import { OrbitPageIsoDateSchema, boundedString } from "./primitives";

export const OrbitPageTextFileSchema = z.object({
  key: boundedString(160).trim().min(1),
  path: boundedString(100).trim().min(1),
  content: boundedString(50_001),
  isCustom: z.boolean(),
  createdAt: OrbitPageIsoDateSchema,
  updatedAt: OrbitPageIsoDateSchema
}).strict();

export const OrbitPageTextFilesSchema = z.array(OrbitPageTextFileSchema).max(25);

export const OrbitPageSitemapSchema = z.object({
  generatedAt: OrbitPageIsoDateSchema
}).strict();

export type OrbitPageTextFile = z.infer<typeof OrbitPageTextFileSchema>;
export type OrbitPageSitemap = z.infer<typeof OrbitPageSitemapSchema>;
