import { WorkspaceConflictError } from '../../lib/workspace-provider.js';
import { normalizeData } from '../../lib/events.js';
import { emptyData } from '../../lib/storage.js';
import { nextReminderAt } from '../../lib/reminder-model.js';

export function readWorkspace(document) {
  if (!document) return { ...emptyData(), records: [], revision: 0 };
  const data = normalizeData(JSON.parse(document.payload));
  if (!Number.isSafeInteger(document.revision) || document.revision < 1) throw new Error('Не удалось прочитать версию расписания.');
  return { ...data, revision: document.revision };
}

export function prepareWorkspace(data, expectedRevision, currentDocument, {publishReminders = false} = {}) {
  const currentRevision = currentDocument?.revision || 0;
  if (currentRevision !== expectedRevision) throw new WorkspaceConflictError();
  const normalized = normalizeData(data);
  delete normalized.revision;
  const payload = JSON.stringify(normalized);
  if (new TextEncoder().encode(payload).length > 900000) throw new Error('Расписание слишком большое для одной копии. Скачай резервную копию и удали ненужные записи.');
  // Keep existing Hosting-only installations compatible with their deployed rules.
  return { version: 2, revision: currentRevision + 1, payload, ...(publishReminders ? {nextReminderAt:nextReminderAt(normalized)} : {}) };
}
