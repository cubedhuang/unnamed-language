import type { Element, ElementContent, Root, RootContent } from "hast";
import type { MessageOptions, VFile } from "vfile";

import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { SKIP, visitParents } from "unist-util-visit-parents";

/**
 * Render elements with a `language-math` (or `math-display`, `math-inline`)
 * class with Typst.
 *
 * @param {Readonly<Options> | null | undefined} [options]
 *   Configuration (optional).
 * @returns
 *   Transform.
 */
export default function rehypeTypst() {
  const settings = {};

  return async function (tree: Root, file: VFile) {
    const matches: [Element, (Root | Element)[]][] = [];
    visitParents(tree, "element", (...args) => {
      matches.push(args);
    });
    async function visitor(element: Element, parents: (Root | Element)[]) {
      const classes = Array.isArray(element.properties.className)
        ? element.properties.className
        : [];
      // This class can be generated from markdown with ` ```math `.
      const languageMath = classes.includes("language-math");
      // NEW: This class can be generated from markdown with ` ```typst `.
      const languageTypst = classes.includes("language-typst");
      // This class is used by `remark-math` for flow math (block, `$$\nmath\n$$`).
      const mathDisplay = classes.includes("math-display");
      // This class is used by `remark-math` for text math (inline, `$math$`).
      const mathInline = classes.includes("math-inline");
      let displayMode = mathDisplay;
      let mathPreamble = !languageTypst;

      // Any class is fine.
      if (!languageMath && !languageTypst && !mathDisplay && !mathInline) {
        return;
      }

      let parent = parents[parents.length - 1];
      let scope = element;

      // If this was generated with a code block, replace the `<pre>` and use
      // display.
      if (
        element.tagName === "code" &&
        (languageMath || languageTypst) &&
        parent &&
        parent.type === "element" &&
        parent.tagName === "pre"
      ) {
        scope = parent;
        parent = parents[parents.length - 2];
        displayMode = true;
      }

      /* c8 ignore next -- verbose to test. */
      if (!parent) return;

      const value = toText(scope, { whitespace: "pre" });

      let result:
        | Array<ElementContent>
        | { svg: string; baselinePosition: number };

      try {
        result = await renderToSVGString(value, displayMode, mathPreamble);
      } catch (error) {
        file.message("Could not render math with typst", {
          ancestors: [...parents, element],
          cause: error as Error,
          place: element.position,
          source: "rehype-typst",
        } satisfies MessageOptions);

        result = [
          {
            type: "element",
            tagName: "span",
            properties: {
              className: ["typst-error"],
              style: "color: #cc0000",
              title: String(error),
            },
            children: [{ type: "text", value }],
          },
        ];
      }

      let elements: Array<RootContent>;

      if ("svg" in result) {
        const root = fromHtmlIsomorphic(result.svg, { fragment: true });
        const svg = root.children[0];
        if (svg.type !== "element") {
          throw "unreachable";
        }
        const defaultEm = 16;
        const height = parseFloat(svg.properties["dataHeight"] as string);
        const width = parseFloat(svg.properties["dataWidth"] as string);
        const shift = height - result.baselinePosition;
        const shiftEm = shift / defaultEm;
        if (!displayMode) {
          svg.properties.style = `vertical-align: -${shiftEm}em;`;
        }
        svg.properties.height = `${height / defaultEm}em`;
        svg.properties.width = `${width / defaultEm}em`;
        svg.properties.className ||= [];
        if (Array.isArray(svg.properties.className))
          if (displayMode && mathPreamble) {
            svg.properties.className.push("typst-math-display");
          } else if (displayMode && !mathPreamble) {
            svg.properties.className.push("typst-display");
          } else {
            svg.properties.className.push("typst-math-inline");
          }
        elements = root.children;
      } else {
        elements = result;
      }

      const index = parent.children.indexOf(scope);
      parent.children.splice(index, 1, ...elements);
      return SKIP;
    }
    const promises = matches.map(async (args) => {
      await visitor(...args);
    });
    await Promise.all(promises);
  };
}

let compilerIns: NodeCompiler;

async function renderToSVGString(
  code: string,
  displayMode: boolean,
  mathPreamble: boolean,
) {
  const $typst = (compilerIns ||= NodeCompiler.create({
    fontArgs: [{ fontPaths: ["public/fonts"] }],
  }));
  const res = renderToSVGString_($typst, code, displayMode, mathPreamble);
  $typst.evictCache(10);
  return res;
}

async function renderToSVGString_(
  $typst: NodeCompiler,
  code: string,
  displayMode: boolean,
  mathPreamble: boolean,
) {
  const commonPreamble = `
#set text(size: 16pt, font: "Noto Sans")
#show math.equation: set text(font: "Noto Sans Math")
`;
  const mainFileContent = !displayMode
    ? `
${commonPreamble}
#set page(height: auto, width: auto, margin: 0pt)

#let s = state("t", (:))

#let pin(t) = context {
  let width = measure(line(length: here().position().y)).width
  s.update(it => it.insert(t, width) + it)
}

#show math.equation: it => {
  box(it, inset: (top: 0.5em, bottom: 0.5em))
}

$pin("l1")${code}$

#context [
  #metadata(s.final().at("l1")) <label>
]`
    : mathPreamble
      ? `
${commonPreamble}
#set text(size: 16pt)
#set page(height: auto, width: auto, margin: (x: 0pt, y: 0.5em))

$ ${code} $`
      : `
${commonPreamble}
#set text(size: 16pt)
#set page(height: auto, width: auto, margin: (x: 0pt, y: 0.5em))
#import "typst/arborly:0.3.2/lib.typ": tree

${code}`;

  const docRes = $typst.compile({ mainFileContent });
  const warnings = docRes.takeWarnings();
  if (warnings) {
    const diags = $typst.fetchDiagnostics(warnings);
    console.warn(diags);
  }
  if (!docRes.result) {
    const diags = $typst.fetchDiagnostics(docRes.takeDiagnostics()!);
    console.error(diags);
    throw new Error("Typst compilation error");
  }
  const doc = docRes.result;

  const svg = $typst.svg(doc);
  const res = {
    svg,
    baselinePosition: 0,
  };

  if (!displayMode) {
    const query = $typst.query(doc, { selector: "<label>" });
    // parse baselinePosition from query ignore last 2 chars
    res.baselinePosition = parseFloat(query[0].value.slice(0, -2));
  }

  return res;
}
