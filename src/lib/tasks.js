export const TASK_COLUMNS = [
  ['todo', 'К выполнению'],
  ['doing', 'В работе'],
  ['done', 'Готово'],
];

export function saveTask(data, { id, title, eventId = '' }) {
  const name = title.trim();
  if (!name || name.length > 200) throw new Error('Введи название задачи до 200 символов.');
  const tasks = data.tasks || [];
  if (id && !tasks.some(task => task.id === id)) throw new Error('Задача больше не доступна.');
  const changes = { title: name, eventId };
  return {
    ...data,
    tasks: id
      ? tasks.map(task => task.id === id ? { ...task, ...changes } : task)
      : [...tasks, { ...changes, id: crypto.randomUUID(), status: 'todo', archived: false }],
  };
}

export function setTaskStatus(data, id, status) {
  if (!TASK_COLUMNS.some(([column]) => column === status)) return data;
  return { ...data, tasks: (data.tasks || []).map(task => task.id === id && !task.archived ? { ...task, status } : task) };
}

export function archiveTasks(data, ids, archived) {
  const selection = new Set(ids);
  return {
    ...data,
    tasks: (data.tasks || []).map(task => selection.has(task.id) && task.status === 'done' ? { ...task, archived } : task),
  };
}
