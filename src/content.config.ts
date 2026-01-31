import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/blogs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string().default("Madinah"),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
