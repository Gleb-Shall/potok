import { useState } from 'preact/hooks';
import { isTauri } from '@tauri-apps/api/core';
import { fieldDisplay } from '../lib/events.js';
import { linkHref, linkParts } from '../lib/links.js';
import { Icon } from './Icon.jsx';

export function ExternalLink({ href, children, className = '' }) {
  const [error,setError] = useState('');
  return <><a class={`external-link ${className}`} href={href} title={href} target="_blank" rel="noopener noreferrer" draggable={false} onClick={event => {
    event.stopPropagation();
    if (!isTauri()) return;
    event.preventDefault();
    setError('');
    const target = linkHref(href);
    if (!target) { setError('Нужна ссылка http или https.'); return; }
    // Card links stop bubbling, so they cannot rely on the plugin's window listener.
    import('@tauri-apps/plugin-opener').then(({openUrl})=>openUrl(target)).catch(()=>setError(`Не удалось открыть ссылку в браузере. Адрес: ${target}`));
  }} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>{children}<Icon name="external"/></a>{error && <small class="link-open-error" role="alert">{error}</small>}</>;
}
export function LinkedText({ value }) {
  return <>{linkParts(value).map((part, index) => part.href ? <ExternalLink key={index} href={part.href}>{part.text}</ExternalLink> : part.text)}</>;
}
export function LinkedValue({ field, value }) {
  if (field.type === 'url') {
    const href = linkHref(value);
    return href ? <ExternalLink href={href}>{field.linkLabel?.trim() || field.label}</ExternalLink> : <>{fieldDisplay(field, value)}</>;
  }
  return <LinkedText value={fieldDisplay(field, value)}/>;
}
