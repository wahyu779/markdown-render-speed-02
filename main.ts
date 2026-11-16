// Driver for markdown-render-speed-02. The harness runs `node /bot/main.ts` on Node 22
// (types are stripped natively, so only erasable syntax is used here). It reads every
// case from /input/cases.json, renders each one alone with parse() from ./parse.js,
// and writes /output/html.json: a JSON array of the HTML strings, one per case and
// in the cases' order. Outside a container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output. Kept deliberately thin: the driver does one read,
// one loop and one write, and nothing else, so it adds no measurable CPU on top of parse.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as { id: string; markdown: string }[];
const html = new Array<string>(cases.length);
for (let i = 0; i < cases.length; i++) html[i] = parse(cases[i]!.markdown);
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
