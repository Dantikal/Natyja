import { Fragment } from 'react';

// Render a small, predictable Markdown subset as React elements. HTML stays text.
function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> :
    part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>);
}
export default function AssistantMessage({ text, onCopy, ky }) {
  const lines = String(text).split('\n'), blocks = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(); const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      blocks.push(<div className="assistant-code" key={i}><div><span>{language || (ky ? 'Код' : 'Код')}</span><button type="button" onClick={() => onCopy(code.join('\n'))}>{ky ? 'Көчүрүү' : 'Копировать код'}</button></div><pre><code>{code.join('\n')}</code></pre></div>);
    } else if (/^#{1,6}\s/.test(line)) {
      const Heading = 'h' + Math.min(4, line.match(/^#+/)[0].length + 1);
      blocks.push(<Heading key={i++}>{inline(line.replace(/^#+\s+/, ''))}</Heading>);
    } else if (/^\s*(?:[-*+] |\d+[.)] )/.test(line)) {
      const ordered = /^\s*\d/.test(line), items = [];
      const pattern = ordered ? /^\s*\d+[.)] / : /^\s*[-*+] /;
      while (i < lines.length && pattern.test(lines[i])) { items.push(<li key={i}>{inline(lines[i].replace(pattern, ''))}</li>); i++; }
      const List = ordered ? 'ol' : 'ul'; blocks.push(<List key={i}>{items}</List>);
    } else {
      const paragraph = [];
      do { paragraph.push(lines[i++]); } while (i < lines.length && lines[i].trim() && !/^(?:```|#{1,6}\s|\s*[-*+] |\s*\d+[.)] )/.test(lines[i]));
      blocks.push(<p key={i}>{inline(paragraph.join('\n'))}</p>);
    }
  }
  return <div className="assistant-markdown">{blocks}</div>;
}
