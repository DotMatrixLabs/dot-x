// Font Awesome reads this when @fortawesome/fontawesome-free/js/all loads, so
// main.ts must import this module first.
//
// "nest" puts each SVG inside the <i> element Vue rendered. The default replaces
// the <i>, leaving Vue holding a node that is no longer in the DOM; the next patch
// that swaps an icon (a button's v-if/v-else, a spinner) then throws on null
// (insertBefore, parentNode, _vei) and the view stops updating until reload.
const w = window as Window & { FontAwesomeConfig?: Record<string, unknown> };
w.FontAwesomeConfig = { ...w.FontAwesomeConfig, autoReplaceSvg: "nest" };

export {};
