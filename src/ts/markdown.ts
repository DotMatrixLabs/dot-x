import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { RenderRule } from 'markdown-it/lib/renderer.mjs';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const proxy: RenderRule = (tokens, idx, options, self) => self.renderToken(tokens, idx, options);

function appendClass(ruleName: keyof typeof md.renderer.rules, className: string) {
  const original = md.renderer.rules[ruleName] || proxy;
  md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
    const token: Token = tokens[idx];
    token.attrJoin('class', className);
    return original(tokens, idx, options, env, self);
  };
}

appendClass('paragraph_open', 'text-sm leading-relaxed text-white text-opacity-90 mb-3');
appendClass('bullet_list_open', 'list-disc pl-5 mb-3 text-white text-opacity-90');
appendClass('ordered_list_open', 'list-decimal pl-5 mb-3 text-white text-opacity-90');
appendClass('blockquote_open', 'border-l-4 border-base-300 pl-3 italic text-white text-opacity-80 mb-3');
appendClass('table_open', 'table w-full text-sm text-white text-opacity-90 mb-4');
appendClass('thead_open', 'text-left');
appendClass('tr_open', 'border-b border-base-300');
appendClass('th_open', 'py-2 px-3 font-semibold');
appendClass('td_open', 'py-2 px-3 align-top');
appendClass('code_inline', 'px-1 py-0.5 rounded bg-base-200 text-info text-xs');
appendClass('code_block', 'p-3 rounded bg-base-200 text-info text-xs mb-3 overflow-x-auto');
appendClass('fence', 'p-3 rounded bg-base-200 text-info text-xs mb-3 overflow-x-auto');

const defaultHeadingOpen = md.renderer.rules.heading_open || proxy;
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token: Token = tokens[idx];
  const level = Number(token.tag.replace('h', ''));
  const sizeClass = (
    level === 1 ? 'text-2xl mt-6 mb-3' :
    level === 2 ? 'text-xl mt-5 mb-3' :
    level === 3 ? 'text-lg mt-4 mb-2' :
    level === 4 ? 'text-base mt-3 mb-2' :
    level === 5 ? 'text-sm mt-3 mb-1' :
    'text-xs mt-2 mb-1'
  );
  token.attrJoin('class', `font-semibold text-white ${sizeClass}`);
  return defaultHeadingOpen(tokens, idx, options, env, self);
};

const defaultLinkOpen = md.renderer.rules.link_open || proxy;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token: Token = tokens[idx];
  token.attrJoin('class', 'underline text-white hover:opacity-80 transition-all');
  token.attrSet('target', '_blank');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(markdown: string): string {
  return md.render(markdown);
}


