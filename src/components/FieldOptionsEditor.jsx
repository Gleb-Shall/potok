import { Button } from './UI.jsx';

export function FieldOptionsEditor({label,options = [],onChange}) {
  return <div class="option-editor">
    <span>Варианты ответа</span>
    {options.map((option,index)=><div class="option-row" key={index}>
      <input aria-label={`Вариант ${index+1} поля ${label || 'без названия'}`} value={option} maxLength="200"
        onInput={event=>onChange(options.map((value,i)=>i===index ? event.currentTarget.value : value))}/>
      <button type="button" class="icon-button" aria-label={`Убрать вариант ${index+1}`}
        onClick={()=>onChange(options.filter((_,i)=>i!==index))}>×</button>
    </div>)}
    <Button icon="plus" onClick={()=>onChange([...options,''])}>Добавить вариант</Button>
  </div>;
}
