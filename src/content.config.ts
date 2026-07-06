import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { BLOG_POST_STATUS_OPTIONS } from "../shared/blog-frontmatter";

const nullableString = z.preprocess((value) => value ?? "", z.string());
const nullableStringArray = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/blogs" }),
  schema: z.object({
    title: z.string(),
    description: nullableString,
    author: z.string().default("Madinah"),
    pubDate: z.coerce.date(),
    tags: nullableStringArray.default([]),
    status: z.enum(BLOG_POST_STATUS_OPTIONS).default("published"),
  }),
});

export const collections = { blog };
