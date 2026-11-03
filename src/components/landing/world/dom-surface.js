// Paint a small, read-only DOM surface using its real layout and typography.
// The live HTML stays in the document and takes over at the exact same rectangle.
export function paintSurface(element, canvas, pixelRatio = 1.5) {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return false;
  canvas.width = Math.ceil(bounds.width * pixelRatio);
  canvas.height = Math.ceil(bounds.height * pixelRatio);
  const ctx = canvas.getContext('2d');
  ctx.scale(pixelRatio, pixelRatio);
  ctx.textBaseline = 'alphabetic';
  const box = node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height };
  };
  const transparent = color => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
  function paintText(node, style) {
    if (!node.textContent.trim()) return;
    const range = document.createRange();
    const lines = [];
    let line = null;
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (!line || Math.abs(line.top - rect.top) > 1) {
        line = { start: i, end: i + 1, top: rect.top }; lines.push(line);
      } else line.end = i + 1;
    }
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    for (const item of lines) {
      range.setStart(node, item.start); range.setEnd(node, item.end);
      const rect = range.getBoundingClientRect();
      const text = node.textContent.slice(item.start, item.end);
      const ascent = ctx.measureText(text).fontBoundingBoxAscent || parseFloat(style.fontSize) * .8;
      ctx.fillText(text, rect.left - bounds.left, rect.top - bounds.top + ascent);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  function paintSvg(node, style, rect) {
    const view = node.viewBox.baseVal;
    if (!view.width || !view.height) return;
    ctx.save();
    ctx.translate(rect.x, rect.y); ctx.scale(rect.width / view.width, rect.height / view.height); ctx.translate(-view.x, -view.y);
    ctx.strokeStyle = style.color; ctx.fillStyle = style.color;
    ctx.lineWidth = parseFloat(node.getAttribute('stroke-width')) || 1.7;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const path of node.querySelectorAll('path')) {
      const shape = new Path2D(path.getAttribute('d') || '');
      if ((path.getAttribute('fill') || node.getAttribute('fill')) !== 'none') ctx.fill(shape);
      if ((path.getAttribute('stroke') || node.getAttribute('stroke')) !== 'none') ctx.stroke(shape);
    }
    for (const circle of node.querySelectorAll('circle')) {
      ctx.beginPath(); ctx.arc(Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy')), Number(circle.getAttribute('r')), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function paintInput(node, style, rect) {
    if (node.matches('input[type=radio],input[type=checkbox],input[type=password],input[type=hidden]')) return;
    const text = node.tagName === 'SELECT' ? node.selectedOptions[0]?.textContent : node.value;
    if (!text) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.width, rect.height); ctx.clip();
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color; ctx.textBaseline = 'middle';
    const left = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    ctx.fillText(text, rect.x + left, rect.y + rect.height / 2);
    ctx.restore();
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) { paintText(node, getComputedStyle(node.parentElement)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains('sr-only')) return;
    const style = getComputedStyle(node);
    if (style.display === 'none' || node.getAttribute('aria-hidden') === 'true' && !node.matches('svg,.toy-grip')) return;
    const rect = box(node);
    if (!rect.width || !rect.height) return;
    ctx.save();
    ctx.globalAlpha *= Number(style.opacity);
    const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2);
    ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    if (!transparent(style.backgroundColor)) { ctx.fillStyle = style.backgroundColor; ctx.fill(); }
    const edges = [
      ['Top', rect.x, rect.y, rect.x + rect.width, rect.y],
      ['Right', rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
      ['Bottom', rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height],
      ['Left', rect.x, rect.y, rect.x, rect.y + rect.height],
    ];
    for (const [side, x1, y1, x2, y2] of edges) {
      const border = parseFloat(style[`border${side}Width`]);
      if (!border || style[`border${side}Style`] === 'none') continue;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = style[`border${side}Color`]; ctx.lineWidth = border; ctx.stroke();
    }
    // The surface itself clips rounded corners, just like the live card.
    if (node === element || style.overflow === 'hidden' || style.overflow === 'clip') {
      ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius); ctx.clip();
    }
    if (node.matches('input,textarea,select')) paintInput(node, style, rect);
    else if (node.tagName.toLowerCase() === 'svg') paintSvg(node, style, rect);
    else for (const child of node.childNodes) visit(child);
    ctx.restore();
  }
  visit(element);
  return true;
}
