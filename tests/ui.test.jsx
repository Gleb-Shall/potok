import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
import { EventEditor } from '../src/components/EventEditor.jsx';
import { TypeEditor } from '../src/components/TypeEditor.jsx';
import { MoveEditor } from '../src/components/MoveEditor.jsx';
import { EventCard } from '../src/components/EventCard.jsx';
import MapPicker from '../src/components/MapPicker.jsx';
import MapView from '../src/components/MapView.jsx';
import { defaultTypes, calendarRange } from '../src/lib/events.js';
import { todayISO } from '../src/lib/domain.js';

// jsdom has no GPU. Stub the map SDK while exercising our map adapter,
// search requests, component events and persistence with their real code.
const mapSDK = vi.hoisted(() => ({ maps: [], markers: [] }));
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: class {
    constructor(options) {
      this.options = options; this.handlers = new Map(); this.container = options.container;
      this.click = () => this.fire('click', { lngLat: { lat: 59.94, lng: 30.3 } });
      this.container.addEventListener('click', this.click); mapSDK.maps.push(this);
      this.easeTo = vi.fn(); this.fitBounds = vi.fn();
    }
    on(name, handler) { this.handlers.set(name, handler); }
    fire(name, value) { this.handlers.get(name)?.(value); }
    resize() {}
    isStyleLoaded() { return true; }
    remove() { this.container.removeEventListener('click', this.click); }
  },
  Marker: class {
    constructor(options) { this.options = options; this.handlers = new Map(); mapSDK.markers.push(this); }
    setLngLat(value) { this.position = value; return this; }
    getLngLat() { return { lng: this.position[0], lat: this.position[1] }; }
    addTo(map) { map.container.append(this.options.element); return this; }
    on(name, handler) { this.handlers.set(name, handler); return this; }
    remove() { this.options.element.remove(); }
  },
  LngLatBounds: class { extend() { return this; } },
}));

let root;
const base = () => ({ version: 2, students: [], records: [{ id: 'course', kind: 'course', name: 'Математика', color: 'blue', details: [{ id: 'room', label: 'Корпус', value: 'Главный' }] }], types: defaultTypes(), events: [], series: [], revision: 0 });
const sample = () => ({ id: 'test-event', typeId: 'class', title: 'Тестовая пара', date: todayISO(), anchorDate: todayISO(), start: 600, duration: 90, fields: { room: '204' }, status: 'planned', busy: true, history: [] });
const mount = async element => { await act(() => render(element, root)); };
const click = async element => { expect(element).toBeTruthy(); await act(() => element.click()); };
const byText = text => [...root.querySelectorAll('button')].find(button => button.textContent.includes(text));
const input = async (element, value, type = 'input') => { expect(element).toBeTruthy(); await act(() => { element.value = value; element.dispatchEvent(new Event(type, { bubbles: true })); }); };
const submit = async form => { await act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); };
beforeEach(() => {
  root = document.createElement('div'); document.body.append(root);
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }));
  mapSDK.maps.length = 0; mapSDK.markers.length = 0;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); vi.unstubAllGlobals(); });

describe('critical user flows', () => {
  it('opens 7, 14 and all month days and expands cards independently', async () => {
    const data = base(); data.events.push(sample());
    localStorage.setItem('tutor-schedule:mode', 'personal'); localStorage.setItem('tutor-schedule:personal:v2', JSON.stringify(data));
    await mount(<App/>);
    expect(root.querySelectorAll('.day-column')).toHaveLength(7);
    expect(root.querySelector('.card-expanded-content')).toBeNull();
    await click(byText('Подробнее'));
    expect(root.querySelector('.card-expanded-content').textContent).toContain('204');
    await click(byText('2 недели'));
    expect(root.querySelectorAll('.day-column')).toHaveLength(14);
    await click(byText('Месяц'));
    expect(root.querySelectorAll('.day-column')).toHaveLength(calendarRange(todayISO(), 'month').count);
    await click(byText('Раскрыть карточки'));
    expect(root.querySelector('.card-expanded-content')).toBeTruthy();
  });
  it('drag to another day opens only quick time form and persists transfer', async () => {
    const data = base(); data.events.push(sample());
    localStorage.setItem('tutor-schedule:mode', 'personal'); localStorage.setItem('tutor-schedule:personal:v2', JSON.stringify(data));
    await mount(<App/>);
    const card = root.querySelector('.event-card');
    const transfer = { setData: vi.fn(), getData: () => 'test-event' };
    const drag = new Event('dragstart', { bubbles: true }); Object.defineProperty(drag, 'dataTransfer', { value: transfer });
    await act(() => card.dispatchEvent(drag));
    const target = [...root.querySelectorAll('.day-column')].find(day => !day.getAttribute('aria-label').includes(new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(todayISO() + 'T00:00:00Z'))));
    const drop = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(drop, 'dataTransfer', { value: transfer });
    await act(() => target.dispatchEvent(drop));
    expect(root.querySelectorAll('dialog input')).toHaveLength(1);
    expect(root.querySelector('dialog').textContent).toContain('Расширенное редактирование');
    await input(root.querySelector('dialog input[type=time]'), '13:00');
    await submit(root.querySelector('dialog form'));
    const saved = JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));
    expect(saved.events[0].start).toBe(780);
    expect(saved.events[0].duration).toBe(90);
    expect(saved.events[0].originalDate).toBe(todayISO());
    expect(saved.events[0].history).toHaveLength(1);
  });
  it('allows multiple options and links a course without requiring a student', async () => {
    const data = base(); data.types[1].fields.push({ id: 'tools', label: 'Материалы', type: 'multiselect', options: ['Учебник', 'Тетрадь'], required: true });
    const onSave = vi.fn();
    await mount(<EventEditor data={data} typeId="class" date="2026-10-30" onSave={onSave} onClose={() => {}}/>);
    await input(root.querySelectorAll('select')[1], 'course', 'change');
    for (const checkbox of root.querySelectorAll('.multi-choice input')) await click(checkbox);
    await submit(root.querySelector('form'));
    expect(onSave).toHaveBeenCalledOnce();
    const event = onSave.mock.calls[0][0].events[0];
    expect(event.recordId).toBe('course');
    expect(event.studentId).toBe('');
    expect(event.fields.tools).toEqual(['Учебник', 'Тетрадь']);
    expect(event.title).toBe('Математика');
  });
  it('edits each list option in a separate field and saves a multi-choice template', async () => {
    const data = base(); const onSave = vi.fn();
    await mount(<TypeEditor data={data} onSave={onSave} onClose={() => {}}/>);
    await input(root.querySelector('input[maxlength="80"]'), 'Практика');
    await click(byText('Добавить поле'));
    await input(root.querySelector('.builder-field input'), 'Материалы');
    await input(root.querySelector('.builder-field select'), 'multiselect', 'change');
    await click(byText('Добавить вариант')); await click(byText('Добавить вариант'));
    const choices = root.querySelectorAll('.option-row input');
    await input(choices[0], 'Книга, часть 1'); await input(choices[1], 'Тетрадь');
    await submit(root.querySelector('form'));
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0].types.at(-1);
    expect(saved.fields[0].type).toBe('multiselect');
    expect(saved.fields[0].options).toEqual(['Книга, часть 1', 'Тетрадь']);
  });
  it('passes chosen date and time into advanced editing without saving early', async () => {
    const onSave = vi.fn(), onAdvanced = vi.fn();
    await mount(<MoveEditor data={base()} event={sample()} date="2026-11-03" onSave={onSave} onAdvanced={onAdvanced} onClose={() => {}}/>);
    await input(root.querySelector('input[type=time]'), '14:30');
    await click(byText('Расширенное редактирование'));
    expect(onAdvanced).toHaveBeenCalledWith({ date: '2026-11-03', start: '14:30' });
    expect(onSave).not.toHaveBeenCalled();
  });
  it('shows suggestions while typing and confirms a named place through the map adapter', async () => {
    const onChange = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [30.3, 59.94] }, properties: { name: 'Учебный корпус', city: 'Санкт-Петербург' } }] }) });
    vi.stubGlobal('fetch', fetch);
    await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
    await vi.waitFor(() => expect(mapSDK.maps.length).toBe(1));
    expect(mapSDK.maps[0].options.scrollZoom).toBe(true);
    expect(mapSDK.maps[0].options.cooperativeGestures).toBe(false);
    await input(root.querySelector('.place-search input'), 'Университет Санкт-Петербург');
    await vi.waitFor(() => expect(root.querySelector('.place-results button')).toBeTruthy());
    expect(fetch).toHaveBeenCalledOnce();
    await click(root.querySelector('.place-results button'));
    expect(root.querySelector('.place-floating-label').textContent).toContain('Учебный корпус');
    expect(root.querySelector('.place-marker')).toBeTruthy();
    await input(root.querySelector('input[maxlength="200"]'), 'Мой корпус');
    await vi.waitFor(() => expect(byText('Выбрать место').disabled).toBe(false));
    await click(byText('Выбрать место'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: 59.94, lng: 30.3, label: 'Мой корпус' }));
  });
  it('selects a point from a map click without using place search', async () => {
    const onChange = vi.fn();
    await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
    await vi.waitFor(() => expect(root.querySelector('.map-canvas')).toBeTruthy());
    await act(() => root.querySelector('.map-canvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 80 })));
    expect(root.querySelector('.place-marker')).toBeTruthy();
    await vi.waitFor(() => expect(byText('Выбрать место').disabled).toBe(false));
    await click(byText('Выбрать место'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number), label: 'Выбранное место' }));
  });
  it('adds a map point through the editor without accidentally submitting the event', async () => {
    const onSave = vi.fn();
    await mount(<EventEditor data={base()} original={sample()} onSave={onSave} onClose={() => {}}/>);
    await click(root.querySelector('.location-trigger'));
    await vi.waitFor(() => expect(document.body.querySelector('.map-canvas')).toBeTruthy());
    await act(() => document.body.querySelector('.map-canvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 90 })));
    const confirm = [...document.body.querySelectorAll('button')].find(button => button.textContent === 'Выбрать место');
    await vi.waitFor(() => expect(confirm.disabled).toBe(false));
    await click(confirm);
    expect(onSave).not.toHaveBeenCalled();
    expect(root.querySelector('.location-trigger').textContent).toContain('Выбранное место');
    expect(document.body.querySelectorAll('dialog')).toHaveLength(1);
    await submit(root.querySelector('form'));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].events[0].location.label).toBe('Выбранное место');
  });
  it('shows a search failure and still allows selection on the map', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Сеть недоступна')));
    const onChange = vi.fn();
    await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
    await input(root.querySelector('.place-search input'), 'Тест недоступного поиска');
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')?.textContent).toContain('Сеть недоступна'));
    await vi.waitFor(() => expect(root.querySelector('.map-canvas')).toBeTruthy());
    await act(() => root.querySelector('.map-canvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 140, clientY: 100 })));
    await vi.waitFor(() => expect(byText('Выбрать место').disabled).toBe(false));
    await click(byText('Выбрать место'));
    expect(onChange).toHaveBeenCalledOnce();
  });
  it('shows the address after a map click and saves it with the exact pin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ properties: { street: 'Дворцовая набережная', housenumber: '38', city: 'Санкт-Петербург' } }] }) }));
    const onChange = vi.fn(); await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
    await vi.waitFor(() => expect(root.querySelector('.map-canvas')).toBeTruthy());
    await act(() => root.querySelector('.map-canvas').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(root.querySelector('.place-floating-label').textContent).toContain('Дворцовая набережная, 38'));
    await vi.waitFor(() => expect(byText('Выбрать место').disabled).toBe(false));
    await click(byText('Выбрать место'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: 59.94, lng: 30.3, address: 'Дворцовая набережная, 38, Санкт-Петербург' }));
  });
  it('keeps a custom place name typed while the address is being resolved', async () => {
    let resolveBody;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) }));
    const onChange = vi.fn(); await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
    await vi.waitFor(() => expect(root.querySelector('.map-canvas')).toBeTruthy());
    // A different point avoids the successful previous lookup's address cache.
    await act(() => mapSDK.maps[0].fire('click', { lngLat: { lat: 59.95, lng: 30.31 } }));
    await vi.waitFor(() => expect(resolveBody).toBeTypeOf('function'));
    await input(root.querySelector('input[maxlength="200"]'), 'Мой корпус');
    await act(async () => resolveBody({ features: [{ properties: { street: 'Университетская набережная', housenumber: '7', city: 'Санкт-Петербург' } }] }));
    await vi.waitFor(() => expect(byText('Выбрать место').disabled).toBe(false));
    await click(byText('Выбрать место'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Мой корпус', labelIsCustom: true, address: 'Университетская набережная, 7, Санкт-Петербург' }));
  });
  it('groups events at the same map pin and opens the matching event from the list', async () => {
    const first = sample(); first.location = { lat: 59.94, lng: 30.3, label: 'Корпус' };
    const second = { ...first, id: 'second', title: 'Вторая пара' };
    const onOpen = vi.fn();
    await mount(<MapView events={[first, second]} data={base()} onOpen={onOpen}/>);
    expect(root.querySelectorAll('.place-marker')).toHaveLength(1);
    expect(root.querySelector('.place-marker').textContent).toBe('2');
    await click(root.querySelector('.place-marker'));
    expect(root.querySelector('.map-events h3').textContent).toBe('Корпус');
    await click(root.querySelectorAll('.map-event-row')[1]);
    expect(onOpen).toHaveBeenCalledWith('second');
  });
});
