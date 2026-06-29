import init from "../pkg/markdownrswasm.js";
import { mdToAst, mdToTopLevel } from "../pkg/markdownrswasm.js";

await init();

const doc = `intro para

# A

para

## B

more

# C

tail`;

console.log("=== mdToAst (whole tree) ===");
const ast = JSON.parse(mdToAst(doc));
console.log(ast.type, "->", ast.children.map((c) => c.type).join(", "));

console.log("\n=== mdToTopLevel (section tree) ===");
const top = JSON.parse(mdToTopLevel(doc));
console.log(JSON.stringify(top, null, 2));

// Minimal assertions
function assert(cond, msg) {
  if (!cond) throw new Error("assertion failed: " + msg);
}
assert(ast.type === "root", "ast root");
assert(top.preamble[0].markdown === "intro para", "preamble");
assert(top.sections.length === 2, "two root sections");
assert(top.sections[0].title === "A", "section A title");
assert(top.sections[0].children[0].title === "B", "B nested under A");
assert(top.sections[1].title === "C", "section C sibling");
assert(JSON.parse(mdToTopLevel("## My **Title**")).sections[0].title === "My **Title**", "inline title");
console.log("\nall assertions passed ✅");
