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
  explainFirebaseError: error => error.message,
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
  it('keeps the landing disconnected from Firebase and opens isolated demo', async () => {
    await act(() => render(<Site/>, root));
    expect(root.textContent).toContain('Планы меняются.');
    expect(connectFirebase).not.toHaveBeenCalled();
    const demo = [...root.querySelectorAll('a')].find(link => link.textContent.includes('Открыть полную демоверсию'));
    await act(async () => { demo.click(); });
    expect(location.pathname).toBe('/demo');
    expect(connectFirebase).not.toHaveBeenCalled();
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

  it('restores a saved theme and persists the visible theme switch', async () => {
    localStorage.setItem('potok:theme', 'dark');
    await act(() => render(<Site/>, root));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const toggle = root.querySelector('.theme-toggle');
    await act(async () => { toggle.click(); });
    expect(localStorage.getItem('potok:theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
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
