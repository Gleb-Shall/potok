import { useEffect, useState } from 'preact/hooks';

export function useDeviceAlarms(adapter, account, alerts, { mode, stale }) {
  const [deviceId,setDeviceId] = useState('');
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const { authResolved, hasData, pending, ready, user } = account;
  useEffect(()=>{
    if (!adapter) return;
    let mounted = true;
    adapter.status().then(result=>{
      if (mounted && result?.supported) setDeviceId(result.deviceId);
    }).catch(()=>{
      if (mounted) setError('Не удалось проверить поддержку будильников.');
    });
    return ()=>{ mounted = false; };
  },[adapter,retry]);
  useEffect(()=>{
    if (!adapter || !deviceId || !authResolved) return;
    if (user && (mode !== 'cloud' || !hasData || stale || (!ready && !pending))) return;
    let mounted = true;
    const sync = () => {
      const desired = user ? alerts.filter(alert=>alert.alarmDevice === deviceId).map(alert=>({
        id:alert.id, title:alert.title, timestamp:Date.parse(alert.at),
      })) : [];
      adapter.sync(desired).then(()=>{
        if (mounted) setError('');
      }).catch(error=>{
        if (mounted) setError(typeof error === 'string' ? error : 'Не удалось обновить будильники на iPhone.');
      });
    };
    const foreground = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    document.addEventListener('visibilitychange',foreground);
    return ()=>{ mounted = false; document.removeEventListener('visibilitychange',foreground); };
  },[adapter,deviceId,authResolved,hasData,pending,ready,user?.id,alerts,mode,stale,retry]);
  return { deviceId, error, retry:()=>setRetry(value=>value+1) };
}
