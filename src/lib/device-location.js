export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Этот браузер не поддерживает определение местоположения. Выбери место на карте.')); return; }
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Моё местоположение' }),
      error => reject(new Error(error.code === 1 ? 'Доступ к местоположению запрещён. Разреши его в настройках браузера или выбери точку на карте.' : error.code === 3 ? 'Не удалось определить местоположение вовремя. Попробуй ещё раз.' : 'Местоположение недоступно. Проверь настройки устройства или выбери место на карте.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
