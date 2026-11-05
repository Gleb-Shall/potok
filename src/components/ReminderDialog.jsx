import { Modal } from './UI.jsx';
import { EventReminder } from './EventReminder.jsx';
import { eventTitle } from '../lib/events.js';

export function ReminderDialog({onClose,...props}) {
  return <Modal title="Напомнить о переносе" subtitle={eventTitle(props.data,props.event)} onClose={onClose} className="reminder-dialog"><EventReminder {...props} standalone/></Modal>;
}
