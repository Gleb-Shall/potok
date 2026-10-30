export function Brand({ href = '/', onClick, className = '' }) {
  return <a class={`brand ${className}`} href={href} onClick={onClick} aria-label="Поток — на главную"><span class="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 10c5-6 9 6 14 0s7-1 10 0M4 17c5-6 9 6 14 0s7-1 10 0M4 24c5-6 9 6 14 0s7-1 10 0"/></svg></span><span>поток<span class="brand-dot">.</span></span></a>;
}
