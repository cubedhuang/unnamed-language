import type { Root } from "hast";
import { visit } from "unist-util-visit";

export default function rehypeWrapTables() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "table" && parent && index !== undefined) {
        parent.children[index] = {
          type: "element",
          tagName: "div",
          properties: { className: ["table-container"] },
          children: [node],
        };
      }
    });
  };
}
