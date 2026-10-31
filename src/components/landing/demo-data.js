import { addDays, mondayOf, todayISO } from '../../lib/domain.js';
import { defaultTypes } from '../../lib/events.js';

export function landingData() {
  const start = addDays(mondayOf(todayISO()), 7);
  const types = defaultTypes();
  types[0].fields.push({ id:'call', label:'Встреча', type:'url', showOnCard:true, showCompact:true, options:[] });
  return {
    version:2, revision:0, types, series:[],
    students:[{ id:'anna', name:'Анна', subject:'Математика · ЕГЭ', rate:1800, color:'violet', contact:'anna@example.com', details:[] }],
    records:[{ id:'course', kind:'course', name:'Линейная алгебра', subtitle:'Семинар · университет', color:'blue', details:[] }],
    events:[
      { id:'algebra', typeId:'class', recordId:'course', title:'Линейная алгебра', date:start, anchorDate:start, start:600, duration:90, color:'blue', status:'planned', fields:{ teacher:'Ирина Волкова', room:'204' }, history:[] },
      { id:'lesson', typeId:'lesson', recordId:'anna', studentId:'anna', title:'Занятие с Анной', date:addDays(start,1), anchorDate:addDays(start,1), start:900, duration:60, color:'violet', status:'planned', fields:{ topic:'Производные', rate:1800 }, history:[] },
      { id:'walk', typeId:'personal', title:'Прогулка у воды', date:addDays(start,2), anchorDate:addDays(start,2), start:1080, duration:60, color:'green', status:'planned', fields:{}, history:[] },
    ],
  };
}
