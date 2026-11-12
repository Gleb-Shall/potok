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
  const show = (focusItem = '') => {
    const node = panel.current;
    const rect = trigger.current.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;

    node.dataset.open = 'true';
    node.showPopover?.();
    const { width, height } = node.getBoundingClientRect();
    const below = viewportHeight - rect.bottom;
    const above = rect.top;
    const y = below >= height + gap + margin || below >= above
      ? rect.bottom + gap
      : rect.top - height - gap;
    node.style.left = `${Math.max(margin, Math.min(rect.right - width, viewportWidth - width - margin))}px`;
    node.style.top = `${Math.max(margin, Math.min(y, viewportHeight - height - margin))}px`;
    setOpen(true);
    const buttons = focusItem ? node.querySelectorAll('button:not(:disabled)') : [];
    const focusTarget = buttons[focusItem === 'last' ? buttons.length - 1 : 0] ?? node;
    focusTarget.focus({ preventScroll:true });
  };
  const toggle = event => open ? close(event.detail === 0) : show(event.detail === 0 ? 'first' : '');
  const openByArrow = event => {
    if (open || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'ArrowUp' ? 'last' : 'first');
  };
  return <><button ref={trigger} type="button" class={`action-menu-trigger ${compact ? 'icon-button' : 'button secondary'}`} aria-label={label} aria-haspopup="menu" aria-controls={id} aria-expanded={open} onClick={toggle} onKeyDown={openByArrow}><Icon name="more"/>{!compact && <span>{label}</span>}</button><div id={id} ref={panel} popover="auto" class="ui-action-menu" data-open={open} role="menu" aria-label={label} tabIndex={-1} onToggle={event => { if (event.newState === 'closed') setOpen(false); }} onKeyDown={event => {
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const down = event.key === 'ArrowDown';
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
        : index < 0 ? (down ? 0 : buttons.length - 1)
        : (index + (down ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close(true);
  }}>{items.filter(Boolean).map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} class={`${item.danger ? 'is-danger' : ''} ${item.separate ? 'has-separator' : ''}`} onClick={() => { close(); item.onSelect(); }}><Icon name={item.icon || 'arrow'}/><span>{item.label}{item.description && <small>{item.description}</small>}</span></button>)}</div></>;
}
