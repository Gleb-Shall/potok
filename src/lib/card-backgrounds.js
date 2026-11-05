// Images live once per workspace. Event snapshots keep only the asset id.
export const MAX_BACKGROUND_BYTES = 64 * 1024;
const MAX_IMAGE_CHARS = Math.ceil(MAX_BACKGROUND_BYTES / 3) * 4 + 32;
const MAX_STORE_CHARS = 360 * 1024;
export const isCardBackground = value => typeof value === 'string' && value.length <= MAX_IMAGE_CHARS && /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
export const cardBackground = (data, type) => {
  const image = data.cardBackgrounds?.[type.cardBackgroundId];
  return isCardBackground(image) ? image : '';
};

export function saveCardBackground(data, input) {
  const { cardBackgroundImage, ...type } = input;
  const assets = { ...data.cardBackgrounds };
  if (cardBackgroundImage !== undefined) {
    if (cardBackgroundImage && !isCardBackground(cardBackgroundImage)) throw new Error('Не удалось сохранить фон. Выбери PNG заново.');
    type.cardBackgroundId = cardBackgroundImage ? Object.keys(assets).find(id => assets[id] === cardBackgroundImage) || crypto.randomUUID() : '';
    if (cardBackgroundImage) assets[type.cardBackgroundId] = cardBackgroundImage;
  }
  if (type.cardBackgroundId && !isCardBackground(assets[type.cardBackgroundId])) throw new Error('Картинка фона не найдена. Выбери PNG заново.');
  type.cardBackgroundStrength = Math.min(50, Math.max(0, Number(type.cardBackgroundStrength ?? 20) || 0));
  const referenced = new Set([
    type.cardBackgroundId,
    ...data.types.filter(item => item.id !== type.id).map(item => item.cardBackgroundId),
    ...[...data.events, ...data.series].map(event => event.snapshot?.type?.cardBackgroundId),
  ]);
  const cardBackgrounds = Object.fromEntries(Object.entries(assets).filter(([id, image]) => referenced.has(id) && isCardBackground(image)));
  if (Object.values(cardBackgrounds).reduce((size, image) => size + image.length, 0) > MAX_STORE_CHARS) throw new Error('Много разных фонов. Убери неиспользуемый фон у одного из шаблонов и попробуй ещё раз.');
  return { type, cardBackgrounds };
}

export async function prepareCardBackground(file) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('Выбери PNG размером до 10 МБ.');
  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length < 24 || !signature.every((byte, index) => header[index] === byte)) throw new Error('Нужна картинка в формате PNG.');
  const view = new DataView(header.buffer);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width * height > 20000000) throw new Error('Картинка слишком большая. Уменьши её до 20 мегапикселей.');
  let bitmap;
  const canvas = document.createElement('canvas');
  try {
    bitmap = await createImageBitmap(file);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось обработать картинку в браузере.');
    let scale = Math.min(1, 1200 / width, 900 / height);
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
      if (!blob) throw new Error('Не удалось обработать картинку. Попробуй другой PNG.');
      if (blob.size <= MAX_BACKGROUND_BYTES) {
        const image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Не удалось прочитать картинку.'));
          reader.readAsDataURL(blob);
        });
        if (!isCardBackground(image)) throw new Error('Не удалось обработать картинку. Попробуй другой PNG.');
        return image;
      }
      scale *= Math.min(.8, Math.sqrt(MAX_BACKGROUND_BYTES / blob.size) * .9);
    }
    throw new Error('Не удалось уменьшить картинку. Попробуй PNG попроще.');
  } catch (error) {
    if (error instanceof Error && error.name === 'Error') throw error;
    throw new Error('Не удалось открыть PNG. Проверь, что файл не повреждён.');
  } finally { bitmap?.close(); canvas.width = canvas.height = 0; }
}
