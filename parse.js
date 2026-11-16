// Fast marked-18.1.3-compatible markdown parser (GFM defaults).
// Single-pass design: one scan over the source emits HTML pieces straight
// into an output tree as it goes. No token array, no second render pass.
// The only deferred work is inline spans that contain '[': their rendering
// waits until the whole document has been scanned, because a link reference
// definition later in the document can change what they mean. Everything
// else is rendered the moment it is scanned.

const TAG_LIST = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

const reSpace = /(?:[ \t]*(?:\n|$))+/y;
const reCode = /((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/y;
const reFences = / {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/y;
const reHeading = / {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/y;
const reHr = / {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/y;
const reBlockquote = /( {0,3}> ?(?:(?![ \t]*(?:\n|$))(([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)|[ \t]+\n)[^\n]+)*))|[^\n]*)(?:\n|$))+/y;
const reListStart = /( {0,3}(?:[*+-]|\d{1,9}[.)]))([ \t][^\n]*?)?(?:\n|$)/y;
const reHtml = / {0,3}(?:<(script|pre|style|textarea)[\s>][\s\S]*?(?:<\/\1>[^\n]*\n*|$)|<!--(?:-?>|[\s\S]*?(?:-->|$))[^\n]*(\n+|$)|<\?[\s\S]*?(?:\?>[^\n]*\n*|$)|<![A-Z][\s\S]*?(?:>[^\n]*\n*|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>[^\n]*\n*|$)|<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t]+|\n|\/?>|$)[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?)*? *\/?>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<\/[a-z][a-z0-9-]*\s*>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$))/iy;
const reDef = / {0,3}\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)((?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))))? *(?:\n+|$)/y;
const reTable = / *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)/y;
const reLheading = /(?! {0,3}(?:[*+-]|\d{1,9}[.)]) |(?: {4}| {0,3}\t)| {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n)((?:.|\n(?!\s*?\n| {0,3}(?:[*+-]|\d{1,9}[.)]) | {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/y;
const reParagraph = /([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)| *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)|[ \t]+\n)[^\n]+)*)/y;
const reTextBlock = /[^\n]+/y;
const reEscape = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/y;
const reTag = /<!--(?:-?>|[\s\S]*?-->)|<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?)*?\s*\/?>|<\?[\s\S]*?\?>|<![a-zA-Z]+\s[\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>/y;
const reAutolink = /<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/y;
const reLink = /!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\([ \t\n]*(<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\)))(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)))?[ \t\n]*\)/y;
const reReflink = /!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]/y;
const reNolink = /!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\](?:\[\])?/y;
const reEmL = /(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?/yu;
const reEmRAst = /^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?=[\s]|$)|(?:[^\s\p{P}\p{S}]|~)(\*+)(?!\*)(?=(?!~)[\s\p{P}\p{S}]|$)|(?!\*)(?!~)[\s\p{P}\p{S}](\*+)(?=(?:[^\s\p{P}\p{S}]|~))|[\s](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?:[^\s\p{P}\p{S}]|~)(\*+)(?=(?:[^\s\p{P}\p{S}]|~))/gu;
const reEmRUnd = /^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)[\p{P}\p{S}](_+)(?=[\s]|$)|[^\s\p{P}\p{S}](_+)(?!_)(?=[\s\p{P}\p{S}]|$)|(?!_)[\s\p{P}\p{S}](_+)(?=[^\s\p{P}\p{S}])|[\s](_+)(?!_)(?=[\p{P}\p{S}])|(?!_)[\p{P}\p{S}](_+)(?!_)(?=[\p{P}\p{S}])/gu;
const reCodespan = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/y;
const reBr = /( {2,}|\\)\n(?!\s*$)[ \t]*/y;
const reDelL = /~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/yu;
const reDelR = /^[^~]+(?=[^~])|(?!~)[\p{P}\p{S}](~~?)(?=[\s]|$)|[^\s\p{P}\p{S}](~~?)(?!~)(?=[\s\p{P}\p{S}]|$)|(?!~)[\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])|[\s](~~?)(?!~)(?=[\p{P}\p{S}])|(?!~)[\p{P}\p{S}](~~?)(?!~)(?=[\p{P}\p{S}])|[^\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])/gu;
const reUrl = /(?:mailto:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])|xmpp:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?)|((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/y;
const reInlineText = /(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/y;
const reReflinkSearch = /!?\[((?:[^\[\]\\`]*(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\]|!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\](?:\[\])?(?!\()/g;
const reBlockSkip = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;
const reAnyPunctOutsideCode = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
const reAnyPunct = /\\([\p{P}\p{S}])/gu;
const rePunct = /^((?![*_])[\s\p{P}\p{S}])/u;
const reUnicodeAN = /[\p{L}\p{N}]/u;
const reBackpedal = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;
const reNumericRef = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/;
const reNumericRefOrAmp = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const reEscTest = /[&<>"']/;
const reEscReplace = /[&<>"']/g;
const reEscTestNoEnc = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const reEscReplaceNoEnc = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const reCodeRemoveIndent = /^(?: {0,3}\t| {1,4})/gm;
const reIndentCodeComp = /^(\s+)(?:```)/;
const reBeginningSpace = /^\s+/;
const reEndingHash = /#$/;
const reEndingSpaceTabChar = /[ \t]$/;
const reNonSpaceChar = /[^ ]/;
const reNewlineGlobal = /\n/g;
const reTabGlobal = /\t/g;
const reLeadingSpaceTab = /^[ \t]+/;
const reMultipleSpace = /\s+/g;
const reBlankLine = /^[ \t]*$/;
const reDoubleBlankLine = /\n[ \t]*\n[ \t]*$/;
const reBlockquoteStart = /^ {0,3}>/;
const reBlockquoteSetext = /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g;
const reBlockquoteSetext2 = /^ {0,3}>[ \t]?/gm;
const reBlockquoteMarkerWS = /^( {0,3}>)([ \t]+)/gm;
const reListReplaceNesting = /^ {1,4}(?=( {4})*[^ ])/g;
const reListIsTask = /^\[[ xX]\][ \t]+\S/;
const reListReplaceTask = /^\[[ xX]\][ \t]+/;
const reListTaskCheckbox = /\[[ xX]\]/;
const reAnyLine = /\n.*\n/;
const reHrefBrackets = /^<(.*)>$/;
const reTableDelim = /[:|]/;
const reTableAlignChars = /^\||\| *$/g;
const reTableRowBlank = /\n[ \t]*$/;
const reTableAlignRight = /^ *-+: *$/;
const reTableAlignCenter = /^ *:-+: *$/;
const reTableAlignLeft = /^ *:-+ *$/;
const reStartATag = /^<a /i;
const reEndATag = /^<\/a>/i;
const reStartPreScript = /^<(pre|code|kbd|script)(\s|>)/i;
const reEndPreScript = /^<\/(pre|code|kbd|script)(\s|>)/i;
const reStartAngle = /^</;
const reEndAngle = />$/;
const reOutputLinkReplace = /\\([\[\]])/g;
const rePercentDecode = /%25/g;
const reFindPipe = /\|/g;
const reSplitPipe = / \|/;
const reSlashPipe = /\\\|/g;
const reCarriageReturn = /\r\n|\r/g;
const reNotSpaceStart = /^\S*/;
const reEndingNewline = /\n$/;
const reStartingSpace = /^ /;
const reEndingSpace = / $/;

// list inner regexes (built per list, sticky). marked wraps the six
// break-check builders in D(), which clamps the indent: n = max(0, min(3, R-1)).
// listItemRegex is NOT wrapped (it takes the bullet pattern, not an indent).
const clampN = (a) => Math.max(0, Math.min(3, a - 1));
const memoN = (fn) => {
  const cache = [null, null, null, null];
  return (a) => { const n = clampN(a); return cache[n] || (cache[n] = fn(n)); };
};
const reListItem = (a) => new RegExp(`( {0,3}${a})((?:[ \t][^\\n]*)?(?:\\n|$))`, 'y');
const reNextBullet = memoN((a) => new RegExp(` {0,${a}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`, 'y'));
const reHrN = memoN((a) => new RegExp(` {0,${a}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`, 'y'));
const reFencesBegin = memoN((a) => new RegExp(` {0,${a}}(?:\`\`\`|~~~)`, 'y'));
const reHeadingBegin = memoN((a) => new RegExp(` {0,${a}}#{1,6}(?:\\s|$)`, 'y'));
const reHtmlBegin = memoN((a) => new RegExp(` {0,${a}}(?:</?(?:${TAG_LIST})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'iy'));
const reBlockquoteBegin = memoN((a) => new RegExp(` {0,${a}}>`, 'y'));

// ---------- helpers ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escChar = (c) => ESC[c];
function esc(s, encode) {
  if (encode) {
    if (reEscTest.test(s)) return s.replace(reEscReplace, escChar);
  } else if (reEscTestNoEnc.test(s)) return s.replace(reEscReplaceNoEnc, escChar);
  return s;
}
function unesc(s) {
  if (!reNumericRef.test(s)) return s;
  return s.replace(reNumericRefOrAmp, (e, t, n) => {
    if (t === void 0 && n === void 0) return '&amp;';
    const v = t === void 0 ? parseInt(n, 16) : parseInt(t, 10);
    if (v === 0 || v > 1114111 || (v >= 55296 && v <= 57343)) return '\uFFFD';
    if (v === 38) return '&amp;';
    return String.fromCodePoint(v);
  });
}
function cleanUrl(a) {
  try { a = encodeURI(a).replace(rePercentDecode, '%'); } catch { return null; }
  return a;
}
function splitCells(a, count) {
  const t = a.replace(reFindPipe, (r, o, i) => {
    let l = false, p = o;
    for (; --p >= 0 && i[p] === '\\';) l = !l;
    return l ? '|' : ' |';
  });
  const n = t.split(reSplitPipe);
  let s = 0;
  if (n[0].trim()) { /* keep */ } else n.shift();
  if (n.length > 0 && !n[n.length - 1].trim()) n.pop();
  if (count) {
    if (n.length > count) n.splice(count);
    else while (n.length < count) n.push('');
  }
  for (; s < n.length; s++) n[s] = n[s].trim().replace(reSlashPipe, '|');
  return n;
}
function rtrim(a, e, t) {
  const n = a.length;
  if (n === 0) return '';
  let s = 0;
  for (; s < n;) {
    const r = a.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return a.slice(0, n - s);
}
function trimBlankLines(a) {
  const e = a.split('\n');
  let t = e.length - 1;
  for (; t >= 0 && reBlankLine.test(e[t]);) t--;
  return e.length - t <= 2 ? a : e.slice(0, t + 1).join('\n');
}
function normLabel(a) {
  return a.trim().replace(reMultipleSpace, ' ').toLowerCase().toUpperCase().toLowerCase();
}
function findBracket(a, e) {
  if (a.indexOf(e[0]) === -1 && a.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < a.length; n++) {
    if (a[n] === '\\') n++;
    else if (a[n] === e[0]) t++;
    else if (a[n] === e[1] && (t--, t < 0)) return n;
  }
  return t > 0 ? -2 : -1;
}
function expandTabs(a, e = 0) {
  let t = e, n = '';
  for (const s of a) {
    if (s === '\t') { const r = 4 - t % 4; n += ' '.repeat(r); t += r; }
    else { n += s; t++; }
  }
  return n;
}
function fenceIndentComp(a, e) {
  const n = a.match(reIndentCodeComp);
  if (n === null) return e;
  const s = n[1];
  return e.split('\n').map((r) => {
    const o = r.match(reBeginningSpace);
    if (o === null) return r;
    const [i] = o;
    return r.slice(Math.min(i.length, s.length));
  }).join('\n');
}

// ---------- inline helpers: mask, link-in-label, link-in-text ----------
// The emStrong/del closer search runs on a masked copy of the inline text
// (same length: code spans, links and escaped punctuation are blanked so a
// delimiter inside them can never close). Built lazily, once per inline span.
function linkInText(e, links) {
  if (!e.includes('[')) return false;
  for (const m of e.matchAll(reBlockSkip)) {
    reLink.lastIndex = 0;
    if (reLink.test(m[0]) && e.charAt(m.index - 1) !== '!') return true;
  }
  for (const m of e.matchAll(reReflinkSearch)) {
    const s = m[0], r = s.lastIndexOf('[');
    if (!(s.charAt(0) === '!' || !Object.hasOwn(links, normLabel(s.slice(r + 1, -1))))) {
      if (!(r > 1 && linkInText(s.slice(1, r - 1), links))) return true;
    }
  }
  return false;
}
function buildMask(src, links) {
  let t = src;
  if (links && src.includes('[')) {
    const rx = reReflinkSearch;
    const s = (r) => {
      const o = r.lastIndexOf('[');
      if (!Object.hasOwn(links, normLabel(r.slice(o + 1, -1)))) return r;
      if (o > 1 && r.charAt(0) !== '!') {
        const inner = r.slice(1, o - 1);
        if (linkInText(inner, links)) return '[' + inner.replace(rx, s) + '][' + 'a'.repeat(r.length - o - 2) + ']';
      }
      return '[' + 'a'.repeat(r.length - 2) + ']';
    };
    t = t.replace(rx, s);
  }
  t = t.replace(reAnyPunctOutsideCode, (n, s, r) => r ? '+'.repeat(n.length) : s ? s + n.slice(s.length, -s.length).replace(/`/g, '+') + s : n);
  t = t.replace(reBlockSkip, (n, s, r) => { const o = r ? r.length : 0; return n.slice(0, o) + '[' + 'a'.repeat(n.length - o - 2) + ']'; });
  return t;
}
function lastPossible(masked) {
  const em = { '*': -1, '_': -1 };
  let del = -1;
  const n = masked.length;
  for (let s = 0; s < n; s++) {
    const r = masked[s];
    if (r !== '*' && r !== '_' && r !== '~') continue;
    const o = s === 0 ? '\n' : masked[s - 1];
    let i = s + 1;
    for (; i < n && masked[i] === r;) i++;
    if (o !== ' ' && o !== '\t' && o !== '\n' && o !== '\r' && o !== '\f') {
      if (r === '~') del = s; else em[r] = s;
    }
    s = i - 1;
  }
  return { em, del };
}
function linkInLabel(src, i, label, off) {
  if (!label.includes('<')) return false;
  for (let s = 0; s < label.length; s++) {
    if (label[s] === '\\') { s++; continue; }
    if (label[s] === '`') {
      reCodespan.lastIndex = s;
      const m = reCodespan.exec(label);
      if (m) { s += m[0].length - 1; continue; }
    }
    if (label[s] !== '<') continue;
    const rpos = i + off + s;
    reTag.lastIndex = rpos;
    let o = reTag.exec(src);
    if (!o) { reAutolink.lastIndex = rpos; o = reAutolink.exec(src); }
    if (o) {
      if (o[0].length > label.length - s) return true;
      s += o[0].length - 1;
    }
  }
  return false;
}

// ---------- emphasis / strikethrough (linear delimiter search) ----------
function tryEmStrong(src, i, masked, lastEm, prevChar) {
  reEmL.lastIndex = i;
  const s = reEmL.exec(src);
  if (!s || (!s[1] && !s[2] && !s[3] && !s[4])) return null;
  const r = s[0][0];
  const o = prevChar === r;
  let l = i;
  for (; l > 0 && masked[l - 1] === r;) l--;
  const p = [...masked.slice(Math.max(0, l - 2), l)].at(-1) ?? '';
  const h = p === '*' || p === '_' || !!rePunct.exec(p);
  let nn = prevChar;
  if (l < i) nn = p;
  const u = l < i ? h : !!rePunct.exec(nn);
  if (s[4] && reUnicodeAN.test(nn)) return null;
  const d = s[1] || s[3] || '';
  if (!d || !nn || u) {
    const k = [...s[0]].length - 1;
    let m = k, f = 0;
    const y = i - l + k;
    const R = !!p.trim() && (!!d || (r === '*' && !h));
    if (r !== '*' && r !== '_') return null;
    const A = r === '*' ? reEmRAst : reEmRUnd;
    const v = lastEm[r];
    const Q = i + k;
    if (v < Q) return null;
    const ee = v - Q;
    const base = i + k;
    // marked slices the masked string to start after the opener run, so the
    // RDelim ^-alternative (which skips a * between two __ pairs without
    // touching the m pool) can fire. Running it on the full string kills
    // that alternative (^ only matches at position 0) and mis-attributes
    // the skipped delimiter to m.
    const t = masked.slice(base);
    A.lastIndex = 0;
    let s2;
    while ((s2 = A.exec(t)) !== null && !(s2.index > ee)) {
      const g = s2[1] || s2[2] || s2[3] || s2[4] || s2[5] || s2[6];
      if (!g) continue;
      let b = [...g].length;
      if (s2[3] || s2[4]) { m += b; continue; }
      else if (s2[5] || s2[6] || R) {
        if (o && (s2[5] || s2[6])) break;
        if (y % 3 && !((y + b) % 3)) { f += b; continue; }
      }
      if ((m -= b) > 0) continue;
      b = Math.min(b, b + m + f);
      const te = [...s2[0]][0].length;
      const Mlen = k + s2.index + te + b;
      const M = src.slice(i, i + Mlen);
      if (Math.min(k, b) % 2) return { len: Mlen, inner: M.slice(1, -1), strong: false };
      return { len: Mlen, inner: M.slice(2, -2), strong: true };
    }
  }
  return null;
}
function tryDel(src, i, masked, lastDel, prevChar) {
  reDelL.lastIndex = i;
  const s = reDelL.exec(src);
  if (!s) return null;
  if (s[1] && prevChar && !rePunct.exec(prevChar)) return null;
  const o = [...s[0]].length - 1;
  let p = o;
  const d = i + o;
  if (lastDel < d) return null;
  const k = lastDel - d;
  const base = i + o;
  const t = masked.slice(base);
  reDelR.lastIndex = 0;
  let s2;
  while ((s2 = reDelR.exec(t)) !== null && !(s2.index > k)) {
    const g = s2[1] || s2[2] || s2[3] || s2[4] || s2[5] || s2[6];
    if (!g) continue;
    let l = [...g].length;
    if (l !== o) continue;
    if (s2[3] || s2[4]) { p += l; continue; }
    if ((p -= l) > 0) continue;
    l = Math.min(l, l + p);
    const te = [...s2[0]][0].length;
    const Mlen = o + s2.index + te + l;
    return { len: Mlen, inner: src.slice(i + o, i + Mlen - o) };
  }
  return null;
}

// ---------- link / image resolution (shared by inline link and reflink) ----------
// Returns null when the link must not be created (a link inside its text),
// otherwise { t: 1, s: html } for normal mode or { t: 0, s: text } for text-only.
function finishLink(ctx, st, textOnly, isImage, labelSrc, href, title) {
  const text = labelSrc.replace(reOutputLinkReplace, '$1');
  const p = st.inLink, h = st.linkEmitted, u = st.inRawBlock;
  st.inLink = true; st.linkEmitted = false;
  const inner = [];
  renderInline(text, ctx, inner, st, isImage ? true : textOnly);
  const k = st.linkEmitted;
  st.linkEmitted = h; st.inLink = p;
  if (!isImage) {
    if (k) { st.inRawBlock = u; return null; }
    st.linkEmitted = true;
  }
  const innerStr = inner.join('');
  if (isImage) {
    if (textOnly) return { t: 0, s: innerStr };
    const cu = cleanUrl(href);
    if (cu === null) return { t: 1, s: esc(innerStr, false) };
    let o = '<img src="' + esc(cu, false) + '" alt="' + esc(innerStr, false) + '"';
    if (title) o += ' title="' + esc(title, false) + '"';
    return { t: 1, s: o + '>' };
  }
  if (textOnly) return { t: 0, s: innerStr };
  const cu = cleanUrl(href);
  if (cu === null) return { t: 1, s: innerStr };
  let o = '<a href="' + esc(cu, false) + '"';
  if (title) o += ' title="' + esc(title, false) + '"';
  return { t: 1, s: o + '>' + innerStr + '</a>' };
}
function tryLink(src, i, ctx, st, textOnly) {
  if (st.linkParenPossible === false) return null;
  reLink.lastIndex = i;
  const m = reLink.exec(src);
  if (!m) return null;
  const off = src[i] === '!' ? 2 : 1;
  if (linkInLabel(src, i, m[1], off)) return null;
  const s = m[2].trim();
  if (reStartAngle.test(s)) {
    if (!reEndAngle.test(s)) return null;
    const l = rtrim(s.slice(0, -1), '\\');
    if ((s.length - l.length) % 2 === 0) return null;
  } else {
    const l = findBracket(m[2], '()');
    if (l === -2) return null;
    if (l > -1) {
      const h = (m[0].indexOf('!') === 0 ? 5 : 4) + m[1].length + l;
      m[2] = m[2].substring(0, l);
      m[0] = m[0].substring(0, h).trim();
      m[3] = '';
    }
  }
  const r = rtrim(m[0].slice(0, -1), '\\');
  if ((m[0].length - r.length) % 2 === 0) return null;
  const title = m[3] ? m[3].slice(1, -1) : '';
  let o = m[2].trim();
  if (reStartAngle.test(o)) o = o.slice(1, -1);
  const href = o ? o.replace(reAnyPunct, '$1') : o;
  const ttl = title ? title.replace(reAnyPunct, '$1') : title;
  const isImage = m[0].charAt(0) === '!';
  const res = finishLink(ctx, st, textOnly, isImage, m[1], href, ttl);
  if (!res) return null;
  return { len: m[0].length, res };
}
function tryReflink(src, i, ctx, st, textOnly) {
  reReflink.lastIndex = i;
  let m = reReflink.exec(src);
  if (!m) {
    reNolink.lastIndex = i;
    m = reNolink.exec(src);
    if (!m) return null;
  }
  const off = src[i] === '!' ? 2 : 1;
  if (linkInLabel(src, i, m[1], off)) return null;
  const ref = ctx.links[normLabel(m[2] || m[1])];
  if (!ref) return { len: 1, textChar: src[i] };
  const isImage = m[0].charAt(0) === '!';
  const res = finishLink(ctx, st, textOnly, isImage, m[1], ref.href, ref.title);
  if (!res) return null;
  return { len: m[0].length, res };
}

// ---------- inline scanner: one pass, buffer-and-flush text ----------
// Text runs accumulate decoded (numeric-ref) chunks in a buffer and are
// escaped once when the run is flushed, which reproduces marked's
// decode-per-chunk then escape-the-merged-text rule with a single scan.
// textOnly=true renders the plain-text form (used for image alt text).
// Extended autolink (url/email) match at position i. Returns {txt, href, len}
// or null. The email local part [A-Za-z0-9._+-] can start with _, -, . or +,
// so this must be tried at those positions too (after emStrong for _),
// not only at alphanumerics.
function matchUrl(src, i) {
  reUrl.lastIndex = i;
  const u = reUrl.exec(src);
  if (!u) return null;
  let txt, href;
  if (u[2] === '@') { txt = u[0]; href = 'mailto:' + txt; }
  else {
    let r0 = u[0], r1;
    do { r1 = r0; const bp = reBackpedal.exec(r0); r0 = bp ? bp[0] : ''; } while (r0 !== r1);
    txt = r0;
    href = u[1] === 'www.' ? 'http://' + r0 : r0;
  }
  return { txt, href, len: txt.length };
}
function renderInline(src, ctx, out, st, textOnly) {
  const savedLPP = st.linkParenPossible;
  st.linkParenPossible = savedLPP && src.includes(')');
  let i = 0;
  const n = src.length;
  let buf = '';
  let bufRaw = false;
  let prevChar = '';
  let prevWasText = false;
  let mask = null;
  const getMask = () => {
    if (!mask) {
      const masked = buildMask(src, ctx.links);
      const lp = lastPossible(masked);
      mask = { masked, em: lp.em, del: lp.del };
    }
    return mask;
  };
  const flush = () => {
    if (buf) {
      if (textOnly || bufRaw) out.push(buf);
      else out.push(esc(buf, false));
      buf = '';
    }
    bufRaw = false;
  };
  const clearPrev = () => { prevWasText = false; prevChar = ''; };
  while (i < n) {
    const c = src[i];
    if (c === '\\') {
      reEscape.lastIndex = i;
      const m = reEscape.exec(src);
      if (m) {
        flush();
        if (textOnly) buf += m[1]; else out.push(esc(m[1], false));
        i += m[0].length; clearPrev(); continue;
      }
      reBr.lastIndex = i;
      const b = reBr.exec(src);
      if (b) {
        flush();
        if (!textOnly) out.push('<br>');
        i += b[0].length; clearPrev(); continue;
      }
    } else if (c === '<') {
      reTag.lastIndex = i;
      const m = reTag.exec(src);
      if (m) {
        flush();
        const t0 = m[0];
        if (!st.inLink && reStartATag.test(t0)) st.inLink = true;
        else if (st.inLink && reEndATag.test(t0)) st.inLink = false;
        if (!st.inRawBlock && reStartPreScript.test(t0)) st.inRawBlock = true;
        else if (st.inRawBlock && reEndPreScript.test(t0)) st.inRawBlock = false;
        if (textOnly) buf += t0; else out.push(t0);
        i += t0.length; clearPrev(); continue;
      }
      reAutolink.lastIndex = i;
      const a = reAutolink.exec(src);
      if (a) {
        flush();
        const txt = a[1];
        const href = a[2] === '@' ? 'mailto:' + txt : txt;
        if (textOnly) buf += txt;
        else {
          const cu = cleanUrl(href);
          if (cu === null) out.push(esc(txt, true));
          else out.push('<a href="' + esc(cu, true) + '">' + esc(txt, true) + '</a>');
        }
        i += a[0].length; clearPrev(); continue;
      }
    } else if (c === '[' || (c === '!' && src[i + 1] === '[')) {
      const lk = tryLink(src, i, ctx, st, textOnly);
      if (lk) {
        flush();
        if (lk.res.t === 1) out.push(lk.res.s); else buf += lk.res.s;
        i += lk.len; clearPrev(); continue;
      }
      const rl = tryReflink(src, i, ctx, st, textOnly);
      if (rl) {
        if (rl.textChar !== undefined) {
          if (buf && bufRaw) flush();
          buf += rl.textChar;
          prevWasText = true; prevChar = rl.textChar;
          i += 1; continue;
        }
        flush();
        if (rl.res.t === 1) out.push(rl.res.s); else buf += rl.res.s;
        i += rl.len; clearPrev(); continue;
      }
    } else if (c === '*' || c === '_') {
      const mk = getMask();
      const em = tryEmStrong(src, i, mk.masked, mk.em, prevWasText ? prevChar : '');
      if (em) {
        flush();
        const inner = [];
        renderInline(em.inner, ctx, inner, st, textOnly);
        const innerStr = inner.join('');
        if (textOnly) buf += innerStr;
        else out.push(em.strong ? '<strong>' + innerStr + '</strong>' : '<em>' + innerStr + '</em>');
        i += em.len; clearPrev(); continue;
      }
      // emStrong failed: an email local part may start with _ (marked tries
      // url after emStrong), e.g. ___user@example.com links whole.
      if (c === '_' && !st.inLink) {
        const u = matchUrl(src, i);
        if (u) {
          flush();
          if (textOnly) buf += u.txt;
          else {
            const cu = cleanUrl(u.href);
            if (cu === null) out.push(esc(u.txt, true));
            else out.push('<a href="' + esc(cu, true) + '">' + esc(u.txt, true) + '</a>');
          }
          i += u.len; clearPrev(); continue;
        }
      }
    } else if (c === '`') {
      reCodespan.lastIndex = i;
      const m = reCodespan.exec(src);
      if (m) {
        flush();
        let t = m[2].replace(reNewlineGlobal, ' ');
        if (reNonSpaceChar.test(t) && reStartingSpace.test(t) && reEndingSpace.test(t)) t = t.substring(1, t.length - 1);
        if (textOnly) buf += t; else out.push('<code>' + esc(t, true) + '</code>');
        i += m[0].length; clearPrev(); continue;
      }
    } else if (c === '-' || c === '.' || c === '+') {
      // an email local part may start with -, . or + (e.g. ---user@example.com)
      if (!st.inLink) {
        const u = matchUrl(src, i);
        if (u) {
          flush();
          if (textOnly) buf += u.txt;
          else {
            const cu = cleanUrl(u.href);
            if (cu === null) out.push(esc(u.txt, true));
            else out.push('<a href="' + esc(cu, true) + '">' + esc(u.txt, true) + '</a>');
          }
          i += u.len; clearPrev(); continue;
        }
      }
    } else if (c === ' ') {
      reBr.lastIndex = i;
      const b = reBr.exec(src);
      if (b) {
        flush();
        if (!textOnly) out.push('<br>');
        i += b[0].length; clearPrev(); continue;
      }
    } else if (c === '~') {
      const mk = getMask();
      const d = tryDel(src, i, mk.masked, mk.del, prevWasText ? prevChar : '');
      if (d) {
        flush();
        const inner = [];
        renderInline(d.inner, ctx, inner, st, textOnly);
        const innerStr = inner.join('');
        if (textOnly) buf += innerStr;
        else out.push('<del>' + innerStr + '</del>');
        i += d.len; clearPrev(); continue;
      }
    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
      if (!st.inLink) {
        const u = matchUrl(src, i);
        if (u) {
          flush();
          if (textOnly) buf += u.txt;
          else {
            const cu = cleanUrl(u.href);
            if (cu === null) out.push(esc(u.txt, true));
            else out.push('<a href="' + esc(cu, true) + '">' + esc(u.txt, true) + '</a>');
          }
          i += u.len; clearPrev(); continue;
        }
      }
    }
    // plain text run
    reInlineText.lastIndex = i;
    const tm = reInlineText.exec(src);
    const chunk = tm ? tm[0] : src[i];
    if (buf && bufRaw !== st.inRawBlock) flush();
    if (st.inRawBlock) { buf += chunk; bufRaw = true; }
    else { buf += unesc(chunk); bufRaw = false; }
    prevWasText = true;
    if (chunk.charCodeAt(chunk.length - 1) !== 95) prevChar = chunk[chunk.length - 1];
    i += chunk.length;
  }
  flush();
  st.linkParenPossible = savedLPP;
}
// ---------- block rendering helpers ----------
function codeBlockHtml(text, lang) {
  const s = (lang || '').match(reNotSpaceStart)?.[0];
  const r = text ? text.replace(reEndingNewline, '') + '\n' : '';
  if (s) return '<pre><code class="language-' + esc(s, false) + '">' + esc(r, true) + '</code></pre>\n';
  return '<pre><code>' + esc(r, true) + '</code></pre>\n';
}
// Append an inline span to an array as a deferred slot. All inline spans
// are rendered in document order at the end of parse(): marked's <a>-state
// (inLink) leaks across paragraphs, and link refs may be defined later, so
// inline rendering must happen in order after the full block scan.
function pushInline(text, ctx, arr) {
  const slot = { s: text, w: 0, pre: '' };
  ctx.events.push(slot);
  arr.push(slot);
}
function tableGuard(src, pos, end) {
  const nl = src.indexOf('\n', pos);
  if (nl < 0 || nl + 1 >= end) return false;
  let hasDash = false, hasPipeColon = false;
  let j = nl + 1;
  while (j < end && src[j] === ' ' && j - (nl + 1) < 3) j++;
  for (; j < end && src[j] !== '\n'; j++) {
    if (src[j] === '-') hasDash = true;
    else if (src[j] === '|' || src[j] === ':') hasPipeColon = true;
  }
  return hasDash && hasPipeColon;
}
function lheadingGuard(src, pos, end) {
  let p = pos;
  while (p < end) {
    let nl = src.indexOf('\n', p);
    if (nl < 0) nl = end;
    let j = p;
    while (j < nl && (src[j] === ' ' || src[j] === '\t')) j++;
    if (j >= nl) return false;
    let k = p;
    while (k < nl && src[k] === ' ' && k - p < 3) k++;
    if (k < nl && (src[k] === '=' || src[k] === '-')) {
      const ch = src[k];
      let m = k;
      while (m < nl && src[m] === ch) m++;
      while (m < nl && (src[m] === ' ' || src[m] === '\t')) m++;
      if (m >= nl) return true;
    }
    p = nl + 1;
  }
  return false;
}

// ---------- block scanner: one pass, emits HTML pieces as it goes ----------
// out receives one element per block: a string, a slot {s,w,pre} (inline
// content rendered at the end), or a nested array (list / blockquote / table).
// Returns the last block's {kind, raw, text, hookCalled}.
function parseBlocks(src, pos, end, ctx, out, inBQ, stats, firstHook, prevSlot) {
  let pendKind = 0, pendText = '', pendRaw = '';
  let lastKind = null, lastRaw = '', lastText = '';
  let blocksEmitted = 0, hookCalled = false;
  // True when a real blank line (a space run longer than "\n") was seen
  // before any block or pending paragraph/text in this call. In marked
  // that pushes a space token, so a following code/paragraph no longer
  // follows the preceding paragraph token and must not merge into it.
  let firstBlank = false;
  // ev0: when a sub-parse (list / blockquote / table) has already pushed
  // inline slots into ctx.events before this flush, pass the events length
  // from before that sub-parse: the flushed paragraph/text slot precedes
  // the sub-parse's content in the source, so it is inserted at ev0
  // instead of appended. Inline rendering follows ctx.events order, and
  // marked's <a>-state (inLink) leaks in token order — appending here
  // rendered the interrupting block first, so a bare GFM autolink after
  // an unclosed <a> tag wrongly linked. `out` order is untouched.
  const flushPend = (ev0) => {
    if (pendKind === 1 || pendKind === 2) {
      if (firstHook && blocksEmitted === 0 && !hookCalled) {
        pendText = firstHook(pendText);
        hookCalled = true;
      }
      if (pendKind === 1) {
        const slot = { s: pendText, w: 1, pre: '' };
        out.push(slot);
        if (ev0 !== undefined) ctx.events.splice(ev0, 0, slot); else ctx.events.push(slot);
        lastKind = 'paragraph';
      } else {
        const slot = { s: pendText, w: 0, pre: '' };
        out.push(slot);
        if (ev0 !== undefined) ctx.events.splice(ev0, 0, slot); else ctx.events.push(slot);
        lastKind = 'text';
      }
      lastRaw = pendRaw; lastText = pendText;
      blocksEmitted++;
    }
    pendKind = 0; pendText = ''; pendRaw = '';
  };
  const setLast = (kind, raw, text) => { lastKind = kind; lastRaw = raw; lastText = text || ''; blocksEmitted++; };
  while (pos < end) {
    // blank line?
    let j = pos;
    while (j < end && (src[j] === ' ' || src[j] === '\t')) j++;
    if (j >= end || src[j] === '\n') {
      reSpace.lastIndex = pos;
      const m = reSpace.exec(src);
      const raw = m ? m[0] : src.slice(pos, end);
      if (stats && raw.indexOf('\n') !== raw.lastIndexOf('\n')) stats.spaceAnyLine = true;
      pos += raw.length;
      if (raw.length > 1 && blocksEmitted === 0 && pendKind === 0) firstBlank = true;
      // marked: a space token of exactly "\n" appends to the previous
      // token's raw and does NOT break a pending paragraph/text (it is just
      // a line break); only a longer space (a real blank line) flushes.
      if (raw.length === 1 && (pendKind === 1 || pendKind === 2)) {
        pendRaw += '\n';
        lastRaw = pendRaw;
      } else flushPend();
      continue;
    }
    // indented code?
    let s = 0;
    while (src[pos + s] === ' ') s++;
    if (s >= 4 || src[pos + s] === '\t') {
      reCode.lastIndex = pos;
      const m = reCode.exec(src);
      if (m) {
        const raw = trimBlankLines(m[0]);
        const text = raw.replace(reCodeRemoveIndent, '');
        if (pendKind === 1 || pendKind === 2) {
          pendText += '\n' + text;
          pendRaw += (pendRaw.endsWith('\n') ? '' : '\n') + raw;
          lastKind = pendKind === 1 ? 'paragraph' : 'text'; lastRaw = pendRaw; lastText = pendText;
        } else if (inBQ && prevSlot && blocksEmitted === 0 && !firstBlank) {
          // An indented code block cannot interrupt a paragraph (marked
          // Lexer: the code token merges into a preceding paragraph/text
          // token). At the start of a blockquote continuation group the
          // paragraph lives in the previous group, so merge the code text
          // into that slot instead of emitting a code block. The code text
          // keeps its trailing newline (trimBlankLines keeps one), which is
          // what makes a following paragraph merge with "\n\n" as in marked.
          prevSlot.s += '\n' + text;
          lastKind = prevSlot.w === 1 ? 'paragraph' : 'text'; lastRaw = raw; lastText = text;
        } else {
          flushPend();
          out.push(codeBlockHtml(text, ''));
          setLast('code', raw, text);
        }
        pos += raw.length;
        continue;
      }
    }
    const sp = s > 3 ? 3 : s;
    const ch = src[pos + sp];
    if (ch === '`' || ch === '~') {
      reFences.lastIndex = pos;
      const m = reFences.exec(src);
      if (m) {
        flushPend();
        const lang = m[2] ? m[2].trim().replace(reAnyPunct, '$1') : m[2];
        const text = fenceIndentComp(m[0], m[3] || '');
        out.push(codeBlockHtml(text, lang));
        setLast('fences', m[0], text);
        pos += m[0].length;
        continue;
      }
    } else if (ch === '#') {
      reHeading.lastIndex = pos;
      const m = reHeading.exec(src);
      if (m) {
        flushPend();
        const depth = m[1].length;
        let text = m[2].trim();
        if (reEndingHash.test(text)) {
          const h = rtrim(text, '#');
          if (!h || reEndingSpaceTabChar.test(h)) text = h.trim();
        }
        const raw = rtrim(m[0], '\n');
        const arr = ['<h' + depth + '>'];
        pushInline(text, ctx, arr);
        arr.push('</h' + depth + '>\n');
        out.push(arr);
        setLast('heading', raw);
        pos += raw.length;
        continue;
      }
    } else if (ch === '-' || ch === '_' || ch === '*') {
      reHr.lastIndex = pos;
      const m = reHr.exec(src);
      if (m) {
        flushPend();
        const raw = rtrim(m[0], '\n');
        out.push('<hr>\n');
        setLast('hr', raw);
        pos += raw.length;
        continue;
      }
      if (ch !== '_') {
        reListStart.lastIndex = pos;
        const l = reListStart.exec(src);
        if (l) {
          const ev0 = ctx.events.length;
          const f = parseList(src, pos, ctx);
          if (f) {
            flushPend(ev0);
            out.push(f.el);
            setLast('list', f.raw);
            pos += f.len;
            continue;
          }
        }
      }
    } else if (ch === '+') {
      reListStart.lastIndex = pos;
      const l = reListStart.exec(src);
      if (l) {
        const ev0 = ctx.events.length;
        const f = parseList(src, pos, ctx);
        if (f) {
          flushPend(ev0);
          out.push(f.el);
          setLast('list', f.raw);
          pos += f.len;
          continue;
        }
      }
    } else if (ch === '>') {
      const ev0 = ctx.events.length;
      const f = parseBlockquote(src, pos, ctx);
      if (f) {
        flushPend(ev0);
        out.push(f.el);
        setLast('blockquote', f.raw, f.text);
        pos += f.len;
        continue;
      }
    } else if (ch >= '0' && ch <= '9') {
      reListStart.lastIndex = pos;
      const l = reListStart.exec(src);
      if (l) {
        const ev0 = ctx.events.length;
        const f = parseList(src, pos, ctx);
        if (f) {
          flushPend(ev0);
          out.push(f.el);
          setLast('list', f.raw);
          pos += f.len;
          continue;
        }
      }
    } else if (ch === '<') {
      reHtml.lastIndex = pos;
      const m = reHtml.exec(src);
      if (m) {
        flushPend();
        const raw = trimBlankLines(m[0]);
        out.push(raw);
        setLast('html', raw);
        pos += raw.length;
        continue;
      }
    } else if (ch === '[') {
      reDef.lastIndex = pos;
      const m = reDef.exec(src);
      if (m && (reStartAngle.test(m[2]) || findBracket(m[2], '()') === -1)) {
        const raw = rtrim(m[0], '\n');
        if (pendKind === 1 || pendKind === 2) {
          pendText += '\n' + raw;
          pendRaw += (pendRaw.endsWith('\n') ? '' : '\n') + raw;
          lastKind = pendKind === 1 ? 'paragraph' : 'text'; lastRaw = pendRaw; lastText = pendText;
        } else if (inBQ && prevSlot) {
          // def at the start of a blockquote group: cannot interrupt the
          // preceding paragraph (marked merges it into the paragraph token,
          // the link is NOT registered).
          prevSlot.s += '\n' + raw;
        } else {
          const tag = normLabel(m[1]);
          const href = m[2] ? m[2].replace(reHrefBrackets, '$1').replace(reAnyPunct, '$1') : '';
          const title = m[3] ? m[3].substring(1, m[3].length - 1).replace(reAnyPunct, '$1') : m[3];
          if (!Object.hasOwn(ctx.links, tag)) ctx.links[tag] = { href, title };
        }
        pos += raw.length;
        continue;
      }
    }
    // table?
    if (tableGuard(src, pos, end)) {
      reTable.lastIndex = pos;
      const m = reTable.exec(src);
      if (m && reTableDelim.test(m[2])) {
        const ev0 = ctx.events.length;
        const el = buildTable(m, ctx);
        if (el) {
          flushPend(ev0);
          const raw = rtrim(m[0], '\n');
          out.push(el);
          setLast('table', raw);
          pos += raw.length;
          continue;
        }
      }
    }
    // setext heading?
    if (lheadingGuard(src, pos, end)) {
      reLheading.lastIndex = pos;
      const m = reLheading.exec(src);
      if (m) {
        flushPend();
        const text = m[1].trim();
        const depth = m[2].charAt(0) === '=' ? 1 : 2;
        const raw = rtrim(m[0], '\n');
        const arr = ['<h' + depth + '>'];
        pushInline(text, ctx, arr);
        arr.push('</h' + depth + '>\n');
        out.push(arr);
        setLast('heading', raw);
        pos += raw.length;
        continue;
      }
    }
    // paragraph (top) or single-line text
    if (ctx.top) {
      reParagraph.lastIndex = pos;
      const m = reParagraph.exec(src);
      if (m) {
        let text = m[1];
        if (text.charCodeAt(text.length - 1) === 10) text = text.slice(0, -1);
        const raw = m[0];
        if (inBQ && pendKind === 1) {
          pendText += '\n' + text;
          pendRaw += (pendRaw.endsWith('\n') ? '' : '\n') + raw;
          lastKind = 'paragraph'; lastRaw = pendRaw; lastText = pendText;
        } else {
          flushPend();
          pendKind = 1; pendText = text; pendRaw = raw;
          lastKind = 'paragraph'; lastRaw = raw; lastText = text;
        }
        pos += raw.length;
        continue;
      }
    }
    reTextBlock.lastIndex = pos;
    const tm = reTextBlock.exec(src);
    if (tm) {
      const text = tm[0];
      if (pendKind === 2) {
        pendText += '\n' + text;
        pendRaw += (pendRaw.endsWith('\n') ? '' : '\n') + text;
        lastKind = 'text'; lastRaw = pendRaw; lastText = pendText;
      } else {
        flushPend();
        pendKind = 2; pendText = text; pendRaw = text;
        lastKind = 'text'; lastRaw = text; lastText = text;
      }
      pos += text.length;
      continue;
    }
    // unreachable in practice; skip one char rather than looping forever
    pos++;
  }
  flushPend();
  ctx.top = true;
  return { kind: lastKind, raw: lastRaw, text: lastText, hookCalled, firstBlank };
}
function buildTable(m, ctx) {
  const headerCells = splitCells(m[1]);
  const aligns = m[2].replace(reTableAlignChars, '').split('|');
  if (headerCells.length !== aligns.length) return null;
  const alignOf = (a) => reTableAlignRight.test(a) ? 'right' : reTableAlignCenter.test(a) ? 'center' : reTableAlignLeft.test(a) ? 'left' : null;
  const arr = ['<table>\n<thead>\n<tr>\n'];
  for (let i = 0; i < headerCells.length; i++) {
    const a = alignOf(aligns[i]);
    arr.push(a ? '<th align="' + a + '">' : '<th>');
    pushInline(headerCells[i], ctx, arr);
    arr.push('</th>\n');
  }
  arr.push('</tr>\n</thead>\n');
  const rowLines = m[3] && m[3].trim() ? m[3].replace(reTableRowBlank, '').split('\n') : [];
  if (rowLines.length) {
    arr.push('<tbody>');
    for (const row of rowLines) {
      arr.push('<tr>\n');
      const cells = splitCells(row, headerCells.length);
      for (let i = 0; i < cells.length; i++) {
        const a = alignOf(aligns[i]);
        arr.push(a ? '<td align="' + a + '">' : '<td>');
        pushInline(cells[i], ctx, arr);
        arr.push('</td>\n');
      }
      arr.push('</tr>\n');
    }
    arr.push('</tbody>');
  }
  arr.push('</table>\n');
  return arr;
}

// ---------- lists ----------
// at(): run a (sticky) regex at the start of a string, like marked's exec.
function at(re, str) { re.lastIndex = 0; return re.exec(str); }
function parseList(src, pos, ctx) {
  let e = src.slice(pos);
  let t = at(reListStart, e);
  if (!t) return null;
  const n = e;
  const consumed = () => n.length - e.length;
  const r = t[1].trim();
  const ordered = r.length > 1;
  const start = ordered ? +r.slice(0, -1) : '';
  const items = [];
  let loose = false;
  const bullPat = ordered ? `\\d{1,9}\\${r.slice(-1)}` : `\\${r}`;
  const itemRe = reListItem(bullPat);
  let p = false;
  while (e) {
    let u = false, d = '';
    t = at(itemRe, e);
    if (!t || at(reHr, e)) break;
    const k = consumed();
    e = e.substring(t[0].length);
    const g = t[2].split('\n', 1)[0];
    const b = t[1].length;
    let m = g.replace(reLeadingSpaceTab, (v) => expandTabs(v, b));
    let f = e.split('\n', 1)[0];
    let y = !m.trim();
    let R = 0;
    if (y) R = b + 1;
    else {
      R = m.search(reNonSpaceChar);
      R = R > 4 ? 1 : R;
      d = m.slice(R);
      R += b;
    }
    if (y && reBlankLine.test(f)) { e = e.substring(f.length + 1); u = true; }
    if (!u) {
      const v = reNextBullet(R), Q = reHrN(R), ee = reFencesBegin(R), te = reHeadingBegin(R), M = reHtmlBegin(R), ne = reBlockquoteBegin(R);
      while (e) {
        const U = e.split('\n', 1)[0];
        let Z;
        f = U;
        Z = f.replace(reLeadingSpaceTab, (me) => expandTabs(me));
        if (at(ee, f) || at(te, f) || at(M, f) || at(ne, f) || at(v, f) || at(Q, f)) break;
        if (Z.search(reNonSpaceChar) >= R || !f.trim()) d += '\n' + Z.slice(R);
        else {
          if (y || m.replace(reTabGlobal, '    ').search(reNonSpaceChar) >= 4 || at(ee, m) || at(te, m) || at(M, m) || at(Q, m)) break;
          const qe = /^ {0,3}(?:=+|-+) *$/.test(f) && at(reLheading, `${m}\n${f}`) ? `    ${Z.replace(/^ {0,3}/, '')}` : f;
          d += '\n' + qe;
        }
        y = !f.trim();
        e = e.substring(U.length + 1);
        m = Z.slice(R);
      }
    }
    const A = n.slice(k, consumed());
    if (!loose) {
      if (p) loose = true;
      else if (reDoubleBlankLine.test(A)) p = true;
    }
    items.push({ raw: A, task: reListIsTask.test(d), text: d });
  }
  const last = items[items.length - 1];
  if (!last) return null;
  last.raw = last.raw.trimEnd();
  last.text = last.text.trimEnd();
  const listRaw = n.slice(0, consumed()).trimEnd();
  // parse each item's blocks
  const itemOuts = [];
  for (const item of items) {
    const stats = { spaceAnyLine: false };
    const itemOut = [];
    let hookState = null;
    let hook = null;
    if (item.task) {
      hookState = { called: false };
      hook = (txt) => { hookState.called = true; return txt.replace(reListReplaceTask, ''); };
    }
    ctx.top = false;
    const res = parseBlocks(item.text, 0, item.text.length, ctx, itemOut, false, stats, hook);
    if (hookState && !hookState.called) item.task = false;
    if (!loose && stats.spaceAnyLine) loose = true;
    itemOuts.push(itemOut);
  }
  // loose lists turn text blocks into paragraphs
  if (loose) {
    for (const itemOut of itemOuts) {
      for (const el of itemOut) {
        if (el && typeof el === 'object' && !Array.isArray(el) && 's' in el && el.w === 0) el.w = 1;
      }
    }
  }
  const listTag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : '';
  const listArr = ['<' + listTag + startAttr + '>\n'];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const itemOut = itemOuts[idx];
    const itemEl = ['<li>'];
    if (item.task) {
      const ck = reListTaskCheckbox.exec(item.raw);
      const checked = ck ? ck[0] !== '[ ]' : false;
      const cb = '<input ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
      if (!loose) {
        itemEl.push(cb);
      } else {
        const first = itemOut[0];
        if (typeof first === 'string' && first.startsWith('<p>')) {
          itemOut[0] = '<p>' + cb + first.slice(3);
        } else if (first && typeof first === 'object' && !Array.isArray(first) && 's' in first) {
          first.pre = cb;
        } else {
          itemEl.push('<p>' + cb + '</p>\n');
        }
      }
    }
    itemEl.push(...itemOut);
    itemEl.push('</li>\n');
    listArr.push(itemEl);
  }
  listArr.push('</' + listTag + '>\n');
  return { el: listArr, raw: listRaw, len: listRaw.length };
}

// ---------- blockquotes ----------
function parseBlockquoteAt(str, ctx) {
  const t = at(reBlockquote, str);
  if (!t) return null;
  let n = rtrim(t[0], '\n').split('\n');
  let s = '', r = '';
  const out = [];
  while (n.length > 0) {
    let i = false;
    const l = [];
    let p;
    for (p = 0; p < n.length; p++) {
      if (reBlockquoteStart.test(n[p])) { l.push(n[p]); i = true; }
      else if (!i) l.push(n[p]);
      else break;
    }
    n = n.slice(p);
    const h = l.join('\n');
    const u = h.replace(reBlockquoteMarkerWS, (g, b, m) => b + expandTabs(m, b.length))
      .replace(reBlockquoteSetext, '\n    $1')
      .replace(reBlockquoteSetext2, '');
    s = s ? `${s}\n${h}` : h;
    r = r ? `${r}\n${u}` : u;
    const d = ctx.top;
    ctx.top = true;
    const before = out.length;
    // A def at the start of this group merges into the preceding paragraph/
    // text slot (marked: def cannot interrupt a paragraph; the link is not
    // registered). Pass that slot through so parseBlocks can merge into it.
    const prevEl = before > 0 ? out[before - 1] : null;
    const prevSlot = (prevEl && typeof prevEl === 'object' && !Array.isArray(prevEl) && 's' in prevEl) ? prevEl : null;
    const res = parseBlocks(u, 0, u.length, ctx, out, true, null, null, prevSlot);
    ctx.top = d;
    // marked's blockTokens: an INDENTED code token merges into a preceding
    // paragraph/text token (its text is appended). Fenced code never merges
    // (the fences branch always pushes a separate token). The code must be
    // the group's only block and the group must not start with a real blank
    // line (a blank line breaks the merge).
    if (res.kind === 'code' && before > 0 && out.length - 1 === before) {
      const prev = out[before - 1], first = out[before];
      const isSlot = (el) => el && typeof el === 'object' && !Array.isArray(el) && 's' in el;
      const startsBlank = /^[ \t]*\n[ \t]*\n/.test(u) || /^[ \t]+\n/.test(u);
      if (typeof first === 'string' && first.startsWith('<pre>') && isSlot(prev) && !startsBlank) {
        prev.s += '\n' + res.text;
        out.splice(before, 1);
      }
    }
    // marked's blockTokens(u, o, true): a paragraph merges into a preceding
    // paragraph token (inlineQueue entry popped, src updated to merged text).
    // But not across a real blank line before the group's first block: in
    // marked a space token is pushed there, so the paragraph stands alone.
    if (before > 0 && out.length > before && !res.firstBlank) {
      const prev = out[before - 1], first = out[before];
      const isPara = (el) => el && typeof el === 'object' && !Array.isArray(el) && 's' in el && el.w === 1;
      if (isPara(prev) && isPara(first)) {
        prev.s += '\n' + first.s;
        out.splice(before, 1);
        const ei = ctx.events.indexOf(first);
        if (ei >= 0) ctx.events.splice(ei, 1);
      }
    }
    if (n.length === 0) break;
    if (res.kind === 'code' || res.kind === 'fences' || res.kind === 'heading' || res.kind === 'hr' || res.kind === 'html' || res.kind === 'table') break;
    if (res.kind === 'blockquote') {
      const gRaw = res.raw, gText = res.text;
      const b = n.join('\n');
      const mStr = gRaw + '\n' + b.replace(reBlockquoteSetext2, '');
      const f = parseBlockquoteAt(mStr, ctx);
      if (!f) break;
      out[out.length - 1] = f.el;
      const y = mStr.substring(f.raw.length).replace(/^\n/, '');
      const R = y ? y.split('\n').length : 0;
      const A = R ? n.slice(0, -R) : n;
      if (A.length > 0) s = `${s}\n${A.join('\n')}`;
      r = r.substring(0, r.length - gText.length) + f.text;
      n = n.slice(A.length);
      if (n.length > 0 && reBlockquoteStart.test(n[0])) continue;
      break;
    } else if (res.kind === 'list') {
      const gRaw = res.raw;
      const b = gRaw + '\n' + n.join('\n');
      const m2 = parseList(b, 0, ctx);
      if (!m2) break;
      out[out.length - 1] = m2.el;
      const f = m2.raw.length > gRaw.length ? b.slice(gRaw.length + 1, m2.raw.length).split('\n').length : 0;
      if (f > 0) {
        const y = n.slice(0, f).join('\n');
        s = `${s}\n${y}`;
        r = `${r}\n${y}`;
      }
      n = n.slice(f);
      continue;
    }
  }
  return { el: ['<blockquote>\n', ...out, '</blockquote>\n'], raw: s, text: r, len: s.length };
}
function parseBlockquote(src, pos, ctx) {
  return parseBlockquoteAt(src.slice(pos), ctx);
}

// ---------- entry point ----------
function renderSlot(slot, ctx) {
  ctx.st.inRawBlock = false;
  const out = [];
  renderInline(slot.s, ctx, out, ctx.st, false);
  const html = out.join('');
  return slot.w === 1 ? '<p>' + (slot.pre || '') + html + '</p>\n' : html;
}
function flatten(el, out) {
  if (typeof el === 'string') { out.push(el); return; }
  if (Array.isArray(el)) { for (const x of el) flatten(x, out); return; }
  out.push(el.html);
}
export function parse(markdown) {
  const src = String(markdown).replace(reCarriageReturn, '\n');
  const ctx = {
    links: Object.create(null),
    top: true,
    st: { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true },
    events: [],
  };
  const out = [];
  parseBlocks(src, 0, src.length, ctx, out, false, null, null);
  // Render every inline span in document order. ctx.st.inLink evolves
  // through them exactly as in marked (it leaks across paragraphs), and
  // renderSlot resets inRawBlock per span, as marked's lex() does.
  for (const ev of ctx.events) ev.html = renderSlot(ev, ctx);
  const parts = [];
  for (const el of out) flatten(el, parts);
  return parts.join('');
}
