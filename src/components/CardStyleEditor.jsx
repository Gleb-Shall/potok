import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Check, Colors, ErrorMessage, Field, FormFooter, Modal, Select } from './UI.jsx';
import { EventCard } from './EventCard.jsx';
import { CARD_VIEWS, cardComposition, readCardStyle } from '../lib/card-style.js';
import { cardBackground, prepareCardBackground } from '../lib/card-backgrounds.js';
import { saveType } from '../lib/events.js';
import { todayISO } from '../lib/domain.js';

function previewValue(field) {
  switch (field.type) {
    case 'checkbox': return true;
    case 'number': return 1500;
    case 'date': return todayISO();
    case 'multiselect': return field.options.slice(0, 2);
    case 'select': return field.options[0] || 'Вариант';
    case 'url': return 'https://example.com';
    default: return field.id === 'topic' ? 'Производные' : 'Пример значения';
  }
}

function CardStyleFields({rows, applyRows, onLinkLabel}) {
  const list = useRef(null), gesture = useRef(null);
  const [drop, setDrop] = useState(null);
  const reorder = (from, to) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    next.splice(to, 0, next.splice(from, 1)[0]);
    applyRows(next);
  };
  const start = (event, index) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {pointerId:event.pointerId, from:index, startY:event.clientY};
  };
  const targetAt = y => {
    const bounds = list.current.getBoundingClientRect();
    if (y < bounds.top - 24 || y > bounds.bottom + 24) return null;
    const target = Array.from(list.current.children).findIndex(row => y < row.getBoundingClientRect().bottom);
    return target < 0 ? rows.length - 1 : target;
  };
  const move = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    if (!active.moved && Math.abs(event.clientY - active.startY) < 5) return;
    active.moved = true;
    const to = targetAt(event.clientY);
    setDrop(to === null ? null : {from:active.from, to});
  };
  const finish = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDrop(null);
    if (event.type !== 'pointerup' || !active.moved) return;
    const to = targetAt(event.clientY);
    if (to !== null) reorder(active.from, to);
  };
  return <ol class="card-style-fields" ref={list}>
    {rows.map(({field,slot}, index) => <li class="card-style-field" key={field.id}
      data-drop={drop?.to === index && drop.from !== index ? (drop.from < index ? 'after' : 'before') : undefined}
      data-dragging={drop?.from === index ? '' : undefined}>
      <button type="button" class="card-style-grip" aria-label={`Переместить «${field.label}», позиция ${index + 1} из ${rows.length}`}
        title="Перетащить поле" disabled={rows.length < 2}
        onPointerDown={event => start(event, index)} onPointerMove={move}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onKeyDown={event => {
          const direction = {ArrowUp:-1, ArrowDown:1}[event.key];
          if (!direction) return;
          event.preventDefault();
          reorder(index, index + direction);
          // WebKit may blur a focused element when its row moves in the DOM.
          const handle = event.currentTarget;
          requestAnimationFrame(() => { if (handle.isConnected) handle.focus({preventScroll:true}); });
        }}><span aria-hidden="true">⠿</span></button>
      <Select label={field.label} value={slot} onChange={next => applyRows(rows.map(row => row.field.id === field.id ? {...row,slot:next} : row))}>
        <option value="hidden">Не показывать</option>
        {field.type === 'url' ? <option value="link">Подписанная ссылка</option> : <><option value="line">В строке деталей</option><option value="badge">Бейдж</option></>}
      </Select>
      {field.type === 'url' && slot === 'link' && <Field label={`Подпись ссылки «${field.label}»`} value={field.linkLabel || ''} maxLength="100" placeholder={field.label} onChange={linkLabel => onLinkLabel(field.id, linkLabel)}/>}
    </li>)}
  </ol>;
}

export function CardStyleEditor({data, original, onSave, onClose}) {
  const [type, setType] = useState(() => ({...original, cardStyle:readCardStyle(original)}));
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(false);
  const [background, setBackground] = useState(() => cardBackground(data, original));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  const style = type.cardStyle;
  const rows = cardComposition(type, view, style);
  const patchType = patch => setType(previous => ({...previous,...patch}));
  const patchStyle = patch => setType(previous => ({...previous,cardStyle:{...previous.cardStyle,...patch}}));
  const applyRows = next => patchStyle({layouts:{...style.layouts,[view]:next.map(({field,slot}) => ({id:field.id,slot}))}});
  const setLinkLabel = (id, linkLabel) => setType(previous => ({...previous, fields:previous.fields.map(item => item.id === id ? {...item,linkLabel} : item)}));
  const upload = async input => {
    const file = input.currentTarget.files?.[0];
    input.currentTarget.value = '';
    if (!file) return;
    const request = ++version.current;
    setBusy(true); setError('');
    try {
      const image = await prepareCardBackground(file);
      if (version.current === request) setBackground(image);
    } catch (failure) {
      if (version.current === request) setError(failure.message);
    } finally {
      if (version.current === request) setBusy(false);
    }
  };
  const submit = input => {
    input.preventDefault();
    if (busy) return;
    try { onSave(saveType(data, {...type,cardBackgroundImage:background}), 'Оформление сохранено'); }
    catch (failure) { setError(failure.message); }
  };
  const timeline = view === 'short' || view === 'grid';
  const previewData = {
    ...data, cardBackgrounds:{...data.cardBackgrounds,'appearance-preview':background},
    types:data.types.map(item => item.id === type.id ? {...type,cardBackgroundId:background?'appearance-preview':''} : item),
  };
  const preview = {
    id:'appearance-preview', typeId:type.id, title:type.titleLabel === 'Название события' ? type.name : type.titleLabel,
    date:todayISO(), start:900, duration:view === 'short' ? 30 : 60, status:'planned',
    location:type.enableLocation === false ? null : {label:'Место встречи'},
    fields:Object.fromEntries(type.fields.map(field => [field.id,previewValue(field)])),
  };
  return <Modal title="Оформление карточки" subtitle={type.name} wide onClose={onClose} className="product-dialog card-style-dialog">
    <form onSubmit={submit} class="card-style-form">
      <div class="card-style-layout">
        <section class="card-style-preview">
          <div class="card-style-toolbar">
            <Select label="Вид карточки" value={view} onChange={setView}>
              {Object.entries(CARD_VIEWS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
            <Button class="button secondary card-style-selection" aria-pressed={selected} onClick={() => setSelected(value => !value)}>Выделить карточку</Button>
          </div>
          <div class="card-style-stage">
            <div class={timeline ? `week-event ${view === 'short'?'is-short':'is-medium'}` : ''} style={timeline ? {height:preview.duration / 60 * 76} : undefined} key={view}>
              <EventCard data={previewData} event={preview} preview timeline={timeline} expanded={view==='expanded'} selected={selected}/>
            </div>
          </div>
          <details class="builder-settings" open>
            <summary>При выделении</summary>
            <div class="builder-settings-body">
              <Check checked={style.smoke} onChange={smoke => {patchStyle({smoke}); if (smoke) setSelected(true);}}>ASCII-дым</Check>
              <Check checked={style.liveText} onChange={liveText => {patchStyle({liveText}); if (liveText) setSelected(true);}}>Буквы реагируют на курсор</Check>
            </div>
          </details>
        </section>
        <div class="card-style-options">
          <section>
            <div class="builder-heading"><h3>Поля в этом виде</h3>{style.layouts[view] && <Button onClick={() => { const layouts={...style.layouts}; delete layouts[view]; patchStyle({layouts}); }}>По умолчанию</Button>}</div>
            {!rows.length && <p class="quiet-note">В шаблоне пока нет дополнительных полей.</p>}
            <CardStyleFields key={view} rows={rows} applyRows={applyRows} onLinkLabel={setLinkLabel}/>
          </section>
          <details class="builder-settings" open>
            <summary>Цвет и фон</summary>
            <div class="builder-settings-body">
              <Colors value={type.color} onChange={color => {patchType({color});patchStyle({tint:''});}}/>
              <div class="card-style-tint"><label>Свой оттенок <input type="color" value={style.tint || '#ff7848'} onInput={input => patchStyle({tint:input.currentTarget.value})}/></label>{style.tint && <Button onClick={() => patchStyle({tint:''})}>Сбросить</Button>}</div>
              <label class="background-strength">Непрозрачность фона <output>{style.opacity}%</output><input type="range" min="0" max="100" value={style.opacity} onInput={input => patchStyle({opacity:Number(input.currentTarget.value)})}/></label>
              <label class="card-style-upload">{busy?'Обработка…':background?'Заменить PNG':'Загрузить PNG'}<input type="file" accept="image/png,.png" disabled={busy} aria-label="PNG для фона карточки" onChange={upload}/></label>
              {background && <><label class="background-strength">Яркость картинки <output>{type.cardBackgroundStrength ?? 20}%</output><input type="range" min="0" max="50" value={type.cardBackgroundStrength ?? 20} onInput={input => patchType({cardBackgroundStrength:Number(input.currentTarget.value)})}/></label><Button disabled={busy} onClick={() => setBackground('')}>Убрать картинку</Button></>}
            </div>
          </details>
        </div>
      </div>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить оформление"/>
    </form>
  </Modal>;
}
