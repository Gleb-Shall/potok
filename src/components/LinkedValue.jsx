import { fieldDisplay } from '../lib/events.js';
import { linkHref, linkParts } from '../lib/links.js';
import { Icon } from './Icon.jsx';

export function ExternalLink({ href, children, className = '' }) {
  return <a class={`external-link ${className}`} href={href} title={href} target="_blank" rel="noopener noreferrer" draggable={false} onClick={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>{children}<Icon name="external"/></a>;
}
export function LinkedText({ value }) {
  return <>{linkParts(value).map((part, index) => part.href ? <ExternalLink key={index} href={part.href}>{part.text}</ExternalLink> : part.text)}</>;
}
export function LinkedValue({ field, value }) {
  if (field.type === 'url') {
    const href = linkHref(value);
    return href ? <ExternalLink href={href}>{field.linkLabel || field.label}</ExternalLink> : <>{fieldDisplay(field, value)}</>;
  }
  return <LinkedText value={fieldDisplay(field, value)}/>;
}
