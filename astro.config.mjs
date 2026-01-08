// @ts-check

import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import remarkDirective from "remark-directive";
import {
  extendedTableHandlers,
  remarkExtendedTable,
} from "remark-extended-table";
import remarkMath from "remark-math";

import rehypeTypst from "./plugins/rehypeTypst.mts";
import remarkGloss from "./plugins/remarkGloss.mjs";
import remarkSmallcaps from "./plugins/remarkSmallcaps.mts";
import rehypeWrapTables from "./plugins/remarkWrapTables.mts";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [
      remarkExtendedTable,
      remarkMath,
      remarkDirective,
      remarkSmallcaps,
      remarkGloss,
    ],
    rehypePlugins: [rehypeWrapTables, rehypeTypst, rehypeExternalLinks],
    remarkRehype: { handlers: { ...extendedTableHandlers } },
    syntaxHighlight: false,
  },
});
