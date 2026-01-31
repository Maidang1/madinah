// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import partytown from "@astrojs/partytown";

import mdx from "@astrojs/mdx";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), partytown(), mdx()],
  adapter: cloudflare(),
});
