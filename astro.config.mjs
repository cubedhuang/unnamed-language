// @ts-check

import mdx from "@astrojs/mdx";
// @ts-expect-error no type declarations available
import rehypeTypst from "@myriaddreamin/rehype-typst";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";

import remarkGloss from "./plugins/remarkGloss.mjs";
import remarkSmallcaps from "./plugins/remarkSmallcaps.mts";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkMath, remarkDirective, remarkSmallcaps, remarkGloss],
    rehypePlugins: [rehypeTypst],
    syntaxHighlight: false,
  },
});
