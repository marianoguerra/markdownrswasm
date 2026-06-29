use markdown::LineEnding;
use markdown::mdast;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Parse options shared by all entry points. Enables GFM constructs while keeping
/// raw HTML, math and MDX disabled.
fn parse_options() -> markdown::ParseOptions {
    markdown::ParseOptions {
        constructs: markdown::Constructs {
            attention: true,
            autolink: true,
            block_quote: true,
            character_escape: true,
            character_reference: true,
            code_indented: true,
            code_fenced: true,
            code_text: true,
            definition: true,
            frontmatter: true,
            gfm_autolink_literal: true,
            gfm_footnote_definition: true,
            gfm_label_start_footnote: true,
            gfm_strikethrough: true,
            gfm_table: true,
            gfm_task_list_item: true,
            hard_break_escape: true,
            hard_break_trailing: true,
            heading_atx: true,
            heading_setext: true,
            html_flow: false,
            html_text: false,
            label_start_image: true,
            label_start_link: true,
            label_end: true,
            list_item: true,
            math_flow: false,
            math_text: false,
            mdx_esm: false,
            mdx_expression_flow: false,
            mdx_expression_text: false,
            mdx_jsx_flow: false,
            mdx_jsx_text: false,
            thematic_break: true,
        },
        gfm_strikethrough_single_tilde: true,
        math_text_single_dollar: false,
        mdx_expression_parse: None,
        mdx_esm_parse: None,
    }
}

#[wasm_bindgen(js_name=mdToHtml)]
pub fn md_to_html(md: &str) -> Option<String> {
    let options = markdown::Options {
        parse: parse_options(),
        compile: markdown::CompileOptions {
            allow_any_img_src: true,
            allow_dangerous_html: false,
            allow_dangerous_protocol: false,
            default_line_ending: LineEnding::CarriageReturn,
            gfm_footnote_back_label: None,
            gfm_footnote_clobber_prefix: None,
            gfm_footnote_label_attributes: None,
            gfm_footnote_label_tag_name: None,
            gfm_footnote_label: None,
            gfm_task_list_item_checkable: true,
            gfm_tagfilter: false,
        },
    };
    match markdown::to_html_with_options(md, &options) {
        Ok(s) => Some(s),
        Err(_err) => None,
    }
}

/// Parse markdown and return the whole mdast tree serialized as JSON.
#[wasm_bindgen(js_name=mdToAst)]
pub fn md_to_ast(md: &str) -> Option<String> {
    let node = markdown::to_mdast(md, &parse_options()).ok()?;
    serde_json::to_string(&node).ok()
}

/// Parse markdown and return a tree of sections (built from headings) where each
/// section's body blocks are kept as raw markdown strings rather than parsed
/// subtrees. Content before the first heading lands in `preamble`.
#[wasm_bindgen(js_name=mdToTopLevel)]
pub fn md_to_top_level(md: &str) -> Option<String> {
    let node = markdown::to_mdast(md, &parse_options()).ok()?;
    let top = build_top_level(md, &node);
    serde_json::to_string(&top).ok()
}

#[derive(Serialize)]
struct TopLevel {
    preamble: Vec<Block>,
    sections: Vec<Section>,
}

#[derive(Serialize)]
struct Section {
    #[serde(rename = "type")]
    kind: &'static str,
    depth: u8,
    title: String,
    blocks: Vec<Block>,
    children: Vec<Section>,
}

#[derive(Serialize)]
struct Block {
    #[serde(rename = "type")]
    kind: &'static str,
    markdown: String,
}

fn build_top_level(md: &str, root: &mdast::Node) -> TopLevel {
    let mut preamble: Vec<Block> = Vec::new();
    let mut roots: Vec<Section> = Vec::new();
    let mut stack: Vec<Section> = Vec::new();

    let empty = Vec::new();
    let children = root.children().unwrap_or(&empty);
    for node in children {
        if let mdast::Node::Heading(h) = node {
            // Close any open section at the same or deeper level.
            while stack.last().is_some_and(|top| top.depth >= h.depth) {
                let finished = stack.pop().unwrap();
                attach(&mut stack, &mut roots, finished);
            }
            stack.push(Section {
                kind: "section",
                depth: h.depth,
                title: heading_title(md, h),
                blocks: Vec::new(),
                children: Vec::new(),
            });
        } else {
            let block = Block {
                kind: node_type(node),
                markdown: source_slice(md, node),
            };
            match stack.last_mut() {
                Some(section) => section.blocks.push(block),
                None => preamble.push(block),
            }
        }
    }
    while let Some(finished) = stack.pop() {
        attach(&mut stack, &mut roots, finished);
    }

    TopLevel {
        preamble,
        sections: roots,
    }
}

/// Attach a finished section to its parent (top of stack) or to the root list.
fn attach(stack: &mut Vec<Section>, roots: &mut Vec<Section>, section: Section) {
    match stack.last_mut() {
        Some(parent) => parent.children.push(section),
        None => roots.push(section),
    }
}

/// Title of a heading: the raw source spanning its inline children (drops the
/// leading `#` markers, keeps inline markdown). Empty for an empty heading.
fn heading_title(md: &str, h: &mdast::Heading) -> String {
    let start = h.children.first().and_then(|n| n.position()).map(|p| p.start.offset);
    let end = h.children.last().and_then(|n| n.position()).map(|p| p.end.offset);
    match (start, end) {
        (Some(s), Some(e)) => md.get(s..e).unwrap_or("").to_string(),
        _ => String::new(),
    }
}

/// Raw source text covered by a node, via its byte-offset position.
fn source_slice(md: &str, node: &mdast::Node) -> String {
    node.position()
        .and_then(|p| md.get(p.start.offset..p.end.offset))
        .unwrap_or("")
        .to_string()
}

/// The mdast `type` string for a node, matching the camelCase tags used by the
/// crate's serde output.
fn node_type(node: &mdast::Node) -> &'static str {
    match node {
        mdast::Node::Root(_) => "root",
        mdast::Node::Blockquote(_) => "blockquote",
        mdast::Node::FootnoteDefinition(_) => "footnoteDefinition",
        mdast::Node::MdxJsxFlowElement(_) => "mdxJsxFlowElement",
        mdast::Node::List(_) => "list",
        mdast::Node::MdxjsEsm(_) => "mdxjsEsm",
        mdast::Node::Toml(_) => "toml",
        mdast::Node::Yaml(_) => "yaml",
        mdast::Node::Break(_) => "break",
        mdast::Node::InlineCode(_) => "inlineCode",
        mdast::Node::InlineMath(_) => "inlineMath",
        mdast::Node::Delete(_) => "delete",
        mdast::Node::Emphasis(_) => "emphasis",
        mdast::Node::MdxTextExpression(_) => "mdxTextExpression",
        mdast::Node::FootnoteReference(_) => "footnoteReference",
        mdast::Node::Html(_) => "html",
        mdast::Node::Image(_) => "image",
        mdast::Node::ImageReference(_) => "imageReference",
        mdast::Node::MdxJsxTextElement(_) => "mdxJsxTextElement",
        mdast::Node::Link(_) => "link",
        mdast::Node::LinkReference(_) => "linkReference",
        mdast::Node::Strong(_) => "strong",
        mdast::Node::Text(_) => "text",
        mdast::Node::Code(_) => "code",
        mdast::Node::Math(_) => "math",
        mdast::Node::MdxFlowExpression(_) => "mdxFlowExpression",
        mdast::Node::Heading(_) => "heading",
        mdast::Node::Table(_) => "table",
        mdast::Node::ThematicBreak(_) => "thematicBreak",
        mdast::Node::TableRow(_) => "tableRow",
        mdast::Node::TableCell(_) => "tableCell",
        mdast::Node::ListItem(_) => "listItem",
        mdast::Node::Definition(_) => "definition",
        mdast::Node::Paragraph(_) => "paragraph",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn ast_has_typed_nodes() {
        let json = md_to_ast("# Hi\n\nsome *text*").unwrap();
        let v: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["type"], "root");
        assert_eq!(v["children"][0]["type"], "heading");
        assert_eq!(v["children"][1]["type"], "paragraph");
    }

    #[test]
    fn top_level_section_tree() {
        let md = "intro para\n\n# A\n\npara\n\n## B\n\nmore\n\n# C\n\ntail";
        let json = md_to_top_level(md).unwrap();
        let v: Value = serde_json::from_str(&json).unwrap();

        // Preamble holds content before the first heading.
        assert_eq!(v["preamble"][0]["type"], "paragraph");
        assert_eq!(v["preamble"][0]["markdown"], "intro para");

        let sections = v["sections"].as_array().unwrap();
        assert_eq!(sections.len(), 2);

        // Section A nests B and carries its own body block.
        assert_eq!(sections[0]["type"], "section");
        assert_eq!(sections[0]["depth"], 1);
        assert_eq!(sections[0]["title"], "A");
        assert_eq!(sections[0]["blocks"][0]["markdown"], "para");
        assert_eq!(sections[0]["children"][0]["title"], "B");
        assert_eq!(sections[0]["children"][0]["depth"], 2);
        assert_eq!(sections[0]["children"][0]["blocks"][0]["markdown"], "more");

        // Section C is a sibling of A, not a child.
        assert_eq!(sections[1]["title"], "C");
        assert_eq!(sections[1]["children"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn heading_title_keeps_inline_markdown() {
        let json = md_to_top_level("## My **Title**").unwrap();
        let v: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["sections"][0]["title"], "My **Title**");
    }

    #[test]
    fn invalid_input_is_handled() {
        let v: Value = serde_json::from_str(&md_to_top_level("").unwrap()).unwrap();
        assert_eq!(v["preamble"].as_array().unwrap().len(), 0);
        assert_eq!(v["sections"].as_array().unwrap().len(), 0);
    }
}
