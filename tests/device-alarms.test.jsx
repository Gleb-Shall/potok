import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useDeviceAlarms } from '../src/hooks/useDeviceAlarms.js';

const root = document.createElement('div');
const user = { id: 'account' };
const offline = { authResolved: true, user, ready: false, pending: false, hasData: true };
const alert = { id: 'alarm', title: 'План на день', at: '2026-11-24T07:00:00Z', alarmDevice: 'phone' };

function Harness({ adapter, account, alerts, mode }) {
  useDeviceAlarms(adapter, account, alerts, { mode, stale: false });
  return null;
}

afterEach(() => act(() => render(null, root)));

it('applies pending alarm edits offline and keeps native alarms intact outside the cloud workspace', async () => {
  const adapter = {
    status: async () => ({ supported: true, deviceId: 'phone' }),
    sync: vi.fn().mockResolvedValue(undefined),
  };
  const show = (account, alerts, mode = 'cloud') =>
    act(() => render(<Harness {...{ adapter, account, alerts, mode }}/>, root));
  const pending = { ...offline, pending: true };

  await show(offline, [alert]);
  expect(adapter.sync).not.toHaveBeenCalled();
  await show(pending, [alert]);
  expect(adapter.sync).toHaveBeenLastCalledWith([{ id: alert.id, title: alert.title, timestamp: Date.parse(alert.at) }]);
  await show(pending, []);
  expect(adapter.sync).toHaveBeenLastCalledWith([]);

  adapter.sync.mockClear();
  await show({ ...offline, ready: true }, [], 'demo');
  expect(adapter.sync).not.toHaveBeenCalled();
  await show({ ...offline, user: null, hasData: false }, []);
  expect(adapter.sync).toHaveBeenCalledWith([]);
});
