import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
import { FlipBoard } from '../src/components/FlipBoard.jsx';
import { Site } from '../src/Site.jsx';
import { connectFirebase } from '../src/lib/firebase-client.js';

const connection = vi.hoisted(() => ({ onAuth: vi.fn(), signIn: vi.fn() }));
vi.mock('../src/lib/firebase-client.js', () => ({
  connectFirebase: vi.fn(async () => connection),
  getFirebaseSession: () => undefined, explainFirebaseError: error => error.message,
}));
let root;
beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.classList.remove('dark');
  localStorage.clear();
  history.replaceState({}, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  connection.signIn.mockResolvedValue({});
  connection.onAuth.mockImplementation(callback => { callback(null); return vi.fn(); });
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(async () => {
  await act(() => render(null, root));
  root.remove();
  vi.restoreAllMocks();
});

describe('separate public and personal entry points', () => {
  it('does not flash Google sign-in while restoring an existing session', async () => {
    let auth, snapshot;
    connection.onAuth.mockImplementation(callback => { auth = callback; return vi.fn(); });
    connection.subscribe = vi.fn((_uid, callback) => { snapshot = callback; return vi.fn(); });
    await act(() => render(<App initialMode="personal" requireAccount/>, root));
    expect(root.querySelector('.google-signin')).toBeNull();
    expect(root.textContent).toContain('Открываем твоё пространство');
    await act(() => auth({ uid: 'alice' }));
    expect(root.querySelector('.google-signin')).toBeNull();
    await act(() => snapshot({ version: 2, revision: 1, students: [], records: [], types: [], series: [], events: [] }, false));
    expect(root.querySelector('.workspace-entry')).toBeNull();
    expect(root.querySelector('.layout')).not.toBeNull();
    expect(root.textContent).toContain('Показана сохранённая копия');
    expect(connection.signIn).not.toHaveBeenCalled();
  });
  it('warms the saved session on the landing without starting Google sign-in', async () => {
    await act(() => render(<Site/>, root));
    expect(root.querySelector('h1').textContent).toBe('ПОТОК');
    expect(connectFirebase).toHaveBeenCalledOnce();
    expect(connection.signIn).not.toHaveBeenCalled();
    expect(root.querySelector('a[href="/demo"]')).toBeNull();
    const personal = root.querySelector('a[href="/app"]');
    await act(async () => { personal.click(); });
    expect(location.pathname).toBe('/app');
    await vi.waitFor(async () => { await act(async () => {}); expect(root.querySelector('.google-signin')).not.toBeNull(); });
    expect(connection.signIn).not.toHaveBeenCalled();
  });

  it('never connects demo to a signed-in user’s cloud workspace', async () => {
    await act(() => render(<App initialMode="demo" demoOnly/>, root));
    expect(root.textContent).toContain('Деморасписание');
    expect(connectFirebase).not.toHaveBeenCalled();
    const records = [...root.querySelectorAll('button')].find(button => button.textContent === 'Записи');
    await act(() => records.click());
    expect(root.textContent).toContain('Добавить запись');
    expect(connectFirebase).not.toHaveBeenCalled();
  });

  it('remembers a collapsed sidebar and keeps icon navigation usable', async () => {
    await act(() => render(<App initialMode="demo" demoOnly/>, root));
    const toggle = root.querySelector('.sidebar-toggle');
    if (toggle.getAttribute('aria-expanded') === 'false') await act(() => toggle.click());
    await act(() => toggle.click());
    expect(root.querySelector('.layout').classList.contains('sidebar-collapsed')).toBe(true);
    expect(localStorage.getItem('potok:sidebar-collapsed')).toBe('true');
    const records = root.querySelector('#workspace-navigation [aria-label="Записи"]');
    expect(records.dataset.tooltip).toBe('Записи');
    await act(() => records.click());
    expect(root.querySelector('h1').textContent).toBe('Записи');
    await act(() => render(null, root));
    await act(() => render(<App initialMode="demo" demoOnly/>, root));
    expect(root.querySelector('.sidebar-toggle').getAttribute('aria-expanded')).toBe('false');
    await act(() => root.querySelector('.sidebar-toggle').click());
    expect(localStorage.getItem('potok:sidebar-collapsed')).toBe('false');
  });

  it('keeps landing and account light despite a saved dark preference', async () => {
    localStorage.setItem('potok:theme', 'dark');
    await act(() => render(<Site/>, root));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('potok:theme')).toBe('dark');
    await act(async () => root.querySelector('a[href="/app"]').click());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await vi.waitFor(async () => { await act(async () => {}); expect(root.querySelector('.entry-back')).not.toBeNull(); });
    await act(async () => root.querySelector('.entry-back').click());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('potok:theme')).toBe('dark');
  });

  it('redirects old demo links to Google entry without exposing demo records', async () => {
    history.replaceState({}, '', '/demo');
    await act(() => render(<Site/>, root));
    expect(location.pathname).toBe('/app');
    await vi.waitFor(async () => { await act(async () => {}); expect(root.querySelector('.google-signin')).not.toBeNull(); });
    expect(root.querySelector('.calendar-grid')).toBeNull();
  });

  it('ignores the phone dark preference and exposes no theme controls', async () => {
    localStorage.setItem('potok:theme', 'dark');
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media:query, matches:query.includes('color-scheme'), addEventListener() {}, removeEventListener() {} }));
    document.documentElement.classList.add('dark');
    history.replaceState({}, '', '/app');
    await act(() => render(<Site/>, root));
    await vi.waitFor(async () => { await act(async () => {}); expect(root.querySelector('.google-signin')).not.toBeNull(); });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(root.querySelector('.theme-toggle,.theme-options')).toBeNull();
  });

  it('keeps the board readable without motion and lets users choose a scene', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: query.includes('reduced-motion'), addEventListener() {}, removeEventListener() {} }));
    await act(() => render(<FlipBoard/>, root));
    expect(root.querySelector('.flap-leaving')).toBeNull();
    const change = [...root.querySelectorAll('button')].find(button => button.textContent === 'Перемены');
    await act(() => change.click());
    expect(root.querySelector('[role=img]').getAttribute('aria-label')).toContain('ПЛАНЫ МЕНЯЮТСЯ');
    expect(root.querySelector('.flap-leaving')).toBeNull();
  });

  it('shows the visitor’s own message on the flipping board', async () => {
    await act(() => render(<FlipBoard allowCustom/>,root));
    const input=root.querySelector('[aria-label="Текст на табло"]');
    await act(() => { input.value='Мой новый проект'; input.dispatchEvent(new Event('input',{bubbles:true})); });
    await act(() => root.querySelector('.board-message').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(root.querySelector('[role=img]').getAttribute('aria-label')).toContain('МОЙ НОВЫЙ ПРОЕКТ');
    expect([...root.querySelectorAll('button')].find(button => button.textContent==='Твой план').getAttribute('aria-pressed')).toBe('true');
  });

  it('requires Google sign-in before showing personal records', async () => {
    await act(() => render(<App initialMode="personal" requireAccount/>, root));
    await act(async () => {});
    expect(root.textContent).toContain('Продолжить с Google');
    expect(root.querySelector('.calendar-grid')).toBeNull();
    const signIn = root.querySelector('.google-signin');
    await act(() => signIn.click());
    expect(connection.signIn).toHaveBeenCalledOnce();
  });
});
