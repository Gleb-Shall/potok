import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
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
    expect(root.textContent).toContain('Твоё время.');
    expect(connectFirebase).not.toHaveBeenCalled();
    const demo = [...root.querySelectorAll('a')].find(link => link.textContent.includes('Попробовать демо'));
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
