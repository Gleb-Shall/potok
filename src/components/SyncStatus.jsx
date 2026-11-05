import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';

export function SyncStatus({account,mode,onSync}) {
  const [failure,setFailure]=useState('');
  useEffect(()=>setFailure(''),[account.lastSyncedAt]);
  if(mode!=='cloud' || !account.user) return null;
  const busy=account.syncing || account.saving;
  const error=account.syncError || account.error || failure;
  const time=account.lastSyncedAt ? new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(account.lastSyncedAt) : '—';
  const status=account.syncing?'Обновляем…':account.saving?'Сохраняем…':!account.online?'Нет связи':error?'Ошибка обновления':!account.ready?'Проверяем…':account.lastSyncedAt?'Обновлено':'Ожидаем данные';
  const detail=account.lastSyncedAt ? `Последняя успешная синхронизация: ${new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Moscow'}).format(account.lastSyncedAt)} МСК.` : 'Синхронизация с сервером ещё не подтверждена.';
  return <div class="sync-status"><button type="button" class={`sync-control ${busy?'is-syncing':''} ${!account.online || error?'has-sync-error':''}`} title={`${detail} ${error || status}`} aria-label={`Обновить расписание. ${detail} ${status}`} aria-busy={Boolean(busy)} disabled={Boolean(busy || !account.online)} onClick={async()=>{
    setFailure('');try{await onSync();}catch(error){setFailure(error.message);}
  }}><Icon name="refresh"/><span class="sync-copy"><span>{status}</span><time dateTime={account.lastSyncedAt ? new Date(account.lastSyncedAt).toISOString() : undefined}>{time}</time></span></button><span class="sr-only" role="status">{error}</span></div>;
}
