import type { Root } from "mdast";
import type {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

export default function remarkSmallcaps() {
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (
        node.type === "containerDirective" ||
        node.type === "leafDirective" ||
        node.type === "textDirective"
      ) {
        const directive = node as
          | ContainerDirective
          | LeafDirective
          | TextDirective;
        if (directive.name !== "smallcaps" && directive.name !== "sc") return;

        if (directive.name !== "smallcaps" && directive.name !== "sc") return;

        const data = directive.data || (directive.data = {});

        data.hName = node.type === "textDirective" ? "span" : "div";
        data.hProperties = {
          className: "smallcaps",
        };
      }
    });
  };
}
