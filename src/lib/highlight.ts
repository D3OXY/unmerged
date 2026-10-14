import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const LANGUAGES = { bash, c, cpp, csharp, css, dockerfile, go, java, javascript, json, kotlin, markdown, php, python, ruby, rust, scss, sql, swift, typescript, xml, yaml };
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language);

const BY_EXTENSION: Record<string, keyof typeof LANGUAGES> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json', css: 'css', scss: 'scss', html: 'xml', xml: 'xml', svg: 'xml', vue: 'xml', svelte: 'xml',
  md: 'markdown', mdx: 'markdown', py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  rb: 'ruby', php: 'php', yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
};

export function languageOf(path: string) {
  const name = path.split('/').pop() ?? '';
  if (name === 'Dockerfile') return 'dockerfile';
  return BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''];
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML for one line. Lines are highlighted on their own, so multi-line strings/comments may be off. */
export function highlightLine(text: string, language: string | undefined) {
  return language ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escape(text);
}
