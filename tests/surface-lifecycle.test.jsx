import { afterEach, expect, it, vi } from 'vitest';
import { createSurface } from '../src/components/landing/world/canvas-surface.js';
const painter=vi.hoisted(()=>vi.fn());
vi.mock('../src/components/landing/world/dom-surface.js',()=>({paintSurface:painter}));
afterEach(()=>vi.clearAllMocks());

it('balances every texture allocation through repeated resize and dispose cycles',()=>{
 const canvases=[];
 painter.mockImplementation((node,canvas)=>{canvases.push(canvas);canvas.width=node.width;canvas.height=node.height;return true;});
 let disposed=0;
 for(let cycle=0;cycle<40;cycle++) {
  const surface=createSurface();surface.texture.addEventListener('dispose',()=>disposed++);
  const first=surface.update({width:120,height:60},1);first.addEventListener('dispose',()=>disposed++);
  expect(surface.update({width:120,height:60},1)).toBe(first);
  const resized=surface.update({width:180,height:90},1);resized.addEventListener('dispose',()=>disposed++);
  surface.dispose();surface.dispose();
  expect(surface.texture).toBeNull();expect(surface.update({width:120,height:60},1)).toBeNull();
 }
 expect(disposed).toBe(120);
 expect(canvases.every(canvas=>canvas.width===0 && canvas.height===0)).toBe(true);
});
