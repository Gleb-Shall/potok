import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';

// Native popover provides top-layer placement, light dismissal and Escape support.
export function ActionMenu({ items, label = 'Ещё', compact = false }) {
  const trigger = useRef(null), panel = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const close = (restore = false) => {
    panel.current?.hidePopover?.();
    if (panel.current) panel.current.dataset.open = 'false';
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll:true });
  };
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(); };
    const reposition = () => close();
    const scrolled = event => { if (!panel.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('scroll', scrolled, true); window.addEventListener('resize', reposition);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', scrolled, true); window.removeEventListener('resize', reposition); };
  }, [open]);
  const toggle = () => {
    if (open) { close(true); return; }
    const node = panel.current, rect = trigger.current.getBoundingClientRect();
    node.dataset.open = 'true';
    node.style.left = `${Math.max(12, Math.min(rect.right - 272, innerWidth - 284))}px`;
    node.style.top = `${rect.bottom + 8}px`;
    node.showPopover?.();
    const height = node.getBoundingClientRect().height;
    if (rect.bottom + height + 20 > innerHeight) node.style.top = `${Math.max(12, rect.top - height - 8)}px`;
    setOpen(true);
    node.querySelector('button:not(:disabled)')?.focus({ preventScroll:true });
  };
  return <><button ref={trigger} type="button" class={`action-menu-trigger ${compact ? 'icon-button' : 'button secondary'}`} aria-label={label} aria-haspopup="menu" aria-controls={id} aria-expanded={open} onClick={toggle}><Icon name="more"/>{!compact && <span>{label}</span>}</button><div id={id} ref={panel} popover="auto" class="ui-action-menu" data-open={open} role="menu" aria-label={label} onToggle={event => { if (event.newState === 'closed') setOpen(false); }} onKeyDown={event => {
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close(true);
  }}>{items.filter(Boolean).map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} class={`${item.danger ? 'is-danger' : ''} ${item.separate ? 'has-separator' : ''}`} onClick={() => { close(); item.onSelect(); }}><Icon name={item.icon || 'arrow'}/><span>{item.label}{item.description && <small>{item.description}</small>}</span></button>)}</div></>;
}
