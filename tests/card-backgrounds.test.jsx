import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it } from 'vitest';
import { EventCard } from '../src/components/EventCard.jsx';
import { defaultTypes, saveType, snapshotEvent } from '../src/lib/events.js';
import { cardBackground, MAX_BACKGROUND_BYTES, prepareCardBackground } from '../src/lib/card-backgrounds.js';
import { prepareWorkspace, readWorkspace } from '../src/lib/cloud-workspace.js';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const base = () => ({version:2,students:[],records:[],types:defaultTypes(),events:[],series:[]});
const event = {id:'e',typeId:'personal',title:'Встреча',date:'2026-11-05',start:600,duration:60,status:'planned',fields:{}};
let root;
afterEach(() => { if (root) { act(() => render(null, root)); root.remove(); root = null; } });

it('shares one image across templates and snapshots and retains it through cloud round trips', () => {
  let data = base();
  data = saveType(data, {...data.types[2],cardBackgroundImage:image,cardBackgroundStrength:25});
  data = saveType(data, {...data.types[1],cardBackgroundImage:image});
  data.events = [snapshotEvent(data, event)];
  expect(Object.keys(data.cardBackgrounds)).toHaveLength(1);
  expect(data.events[0].snapshot.type.cardBackgroundImage).toBeUndefined();
  const saved = readWorkspace(prepareWorkspace(data, 0));
  expect(cardBackground(saved, saved.events[0].snapshot.type)).toBe(image);
});

it('keeps a historical background after the template changes and collects an unused replacement', () => {
  let data = base();
  data = saveType(data, {...data.types[2],cardBackgroundImage:image});
  data.events = [snapshotEvent(data, event)];
  const replacement = 'data:image/webp;base64,UklGRg==';
  data = saveType(data, {...data.types[2],cardBackgroundImage:replacement});
  expect(Object.values(data.cardBackgrounds)).toHaveLength(2);
  data = saveType(data, {...data.types[2],cardBackgroundImage:''});
  expect(cardBackground(data, data.types[2])).toBe('');
  expect(Object.values(data.cardBackgrounds)).toEqual([image]);
  expect(cardBackground(data, data.events[0].snapshot.type)).toBe(image);
});

it('rejects external URLs, SVG and oversize images without mutating the workspace', async () => {
  const data = base();
  for (const invalid of ['https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,'+'A'.repeat(MAX_BACKGROUND_BYTES*2)]) {
    expect(() => saveType(data, {...data.types[2],cardBackgroundImage:invalid})).toThrow();
  }
  expect(data.cardBackgrounds).toBeUndefined();
  await expect(prepareCardBackground({size:11*1024*1024})).rejects.toThrow('до 10 МБ');
  await expect(prepareCardBackground({size:24,slice:()=>({arrayBuffer:async()=>new ArrayBuffer(24)})})).rejects.toThrow('формате PNG');
});

it('renders the shared image behind a card without the template symbol', () => {
  let data = base();
  data = saveType(data, {...data.types[2],cardBackgroundImage:image,cardBackgroundStrength:25});
  root = document.createElement('div'); document.body.append(root);
  act(() => render(<EventCard data={data} event={event} preview/>, root));
  expect(root.querySelector('.card-background-image').src).toBe(image);
  expect(root.querySelector('.card-background-image').style.opacity).toBe('0.25');
  expect(root.querySelector('.event-type-label').textContent).toBe('Личное');
});
