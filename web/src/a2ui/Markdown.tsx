import MarkdownIt from 'markdown-it';

// The model writes this Markdown (Text, Tip), so it must not place clickable links or remote images on
// the page, the same reason the catalog leaves out Image: html: false escapes raw HTML, links render
// as their text and images as their alt text.
const md = new MarkdownIt({html: false, linkify: false, breaks: true});
md.renderer.rules.link_open = () => '';
md.renderer.rules.link_close = () => '';
md.renderer.rules.image = (tokens, idx) => md.utils.escapeHtml(tokens[idx].content);

export function Markdown({markdown}: {markdown: string}) {
  return <div className="md" dangerouslySetInnerHTML={{__html: md.render(markdown ?? '')}} />;
}
