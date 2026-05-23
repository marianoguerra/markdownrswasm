use markdown::LineEnding;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name=mdToHtml)]
pub fn md_to_html(md: &str) -> Option<String> {
    let options = markdown::Options {
        parse: markdown::ParseOptions {
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
        },
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
