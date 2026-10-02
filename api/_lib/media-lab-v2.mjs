export const V2_PROMPT_VERSION = 'media-lab-v2-one-agent-v1';

export function buildV2ChatPrompt(sharedRules, messages) {
  return `${sharedRules}\n\nMODE: CONVERSATION\nBe the same Learning Experience Design Partner described above. Respond to the teacher's latest message in a warm, concise, natural way. Help with incomplete ideas through concrete possibilities, not technical questions. Do not generate code or ask for a complete specification. The teacher may build whenever ready.\n\nConversation:\n${formatMessages(messages)}`;
}

export function buildV2ArtifactPrompt(sharedRules, messages) {
  return `${sharedRules}\n\nMODE: BUILD\nUse the conversation below as the source of teaching intent and constraints. Infer reasonable non-critical details and make a coherent, subject-appropriate learning experience. Do not force a quiz/game or a repeated UI template. Make a complete, self-contained, responsive single-page HTML document with CSS and JavaScript embedded in the document when useful. Use semantic, keyboard-accessible controls. Do not use external assets, URLs, libraries, network requests, storage, or personal student data.\n\nReturn ONLY one JSON object: {"title":"short Thai title","summary":"one-sentence description","html":"complete HTML document as a JSON string"}. No Markdown fences or extra keys. Keep the complete HTML under 45,000 characters.\n\nTeacher conversation:\n${formatMessages(messages)}`;
}

function formatMessages(messages) {
  return messages.map(({ role, content }) => `${role === 'assistant' ? 'AI' : 'ครู'}: ${String(content).slice(0, 5000)}`).join('\n\n').slice(-32000);
}

export function parseV2Artifact(raw) {
  const source = String(raw || '').trim();
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : source;
  if (candidate.startsWith('<!doctype html') || candidate.startsWith('<html')) {
    const title = candidate.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || 'สื่อการเรียนรู้';
    return { title, summary: '', html: candidate };
  }
  const json = extractSingleJson(candidate);
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('v2_output_not_object');
  if (Object.keys(data).some(key => !['title', 'summary', 'html'].includes(key))) throw new Error('v2_output_has_unapproved_fields');
  if (typeof data.title !== 'string' || typeof data.summary !== 'string' || typeof data.html !== 'string') throw new Error('v2_output_fields_must_be_strings');
  return { title: data.title.trim(), summary: data.summary.trim(), html: data.html.trim() };
}

function extractSingleJson(source) {
  if (source.startsWith('{') && source.endsWith('}')) return source;
  const matches = [];
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '{') continue;
    let depth = 0, quoted = false, escaped = false;
    for (let end = start; end < source.length; end += 1) {
      const ch = source[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') quoted = false;
      } else if (ch === '"') quoted = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}' && --depth === 0) {
        const value = source.slice(start, end + 1);
        try { JSON.parse(value); matches.push(value); } catch {}
        start = end;
        break;
      }
    }
  }
  if (matches.length !== 1) throw new Error('v2_output_not_single_json');
  return matches[0];
}

export function validateV2Html(html) {
  const errors = [];
  const source = String(html || '');
  if (source.length > 45000) errors.push('ไฟล์ HTML ยาวเกิน 45,000 ตัวอักษร');
  if (!/^\s*<!doctype\s+html\b/i.test(source) || !/<html\b/i.test(source) || !/<head\b/i.test(source) || !/<body\b/i.test(source)) errors.push('ต้องเป็น HTML document เต็มหน้า มี doctype, html, head และ body');
  if (!/<title\b[^>]*>\s*[^<]+/i.test(source)) errors.push('ไม่พบ title ของเอกสาร');
  const checked = source.replaceAll('http://www.w3.org/2000/svg', '');
  const unsafe = /(?:https?:\/\/|\bsrc\s*=\s*["']?(?!data:)[^"'\s>]+|\bhref\s*=\s*["']?(?!#|data:|mailto:)[^"'\s>]+|url\s*\(\s*["']?(?!#|data:)[^)]+\)|@import\b|javascript\s*:|<script\b[^>]*\bsrc\s*=|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|<iframe\b|<object\b|<embed\b|\bimport\s*\(|\beval\s*\()/i;
  if (unsafe.test(checked)) errors.push('พบ URL, network request หรือ resource ภายนอกที่ไม่อนุญาต');
  if (/<[a-z][^>]*\son\w+\s*=/i.test(source)) errors.push('ห้ามใช้ inline event handler');
  return { ok: errors.length === 0, errors, warnings: /:focus-visible/i.test(source) || !/<(?:button|input|select|textarea)\b/i.test(source) ? [] : ['ควรตรวจว่ามีรูปแบบ focus-visible สำหรับการใช้แป้นพิมพ์'] };
}
