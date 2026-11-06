// Development-only, isolated samples. No workspace session or production data is loaded.
import {render} from 'preact';
import {useState} from 'preact/hooks';
import {ThemeProvider,useWorkspaceTheme} from '../../src/theme/ThemeProvider.jsx';
import {readColorTheme,setColorTheme} from '../../src/lib/color-theme.js';
import {demoData} from '../../src/lib/storage.js';
import {todayISO,addDays} from '../../src/lib/domain.js';
import {moveEvent} from '../../src/lib/events.js';
import {TransfersView} from '../../src/components/TransfersView.jsx';
import {HistoryView} from '../../src/components/HistoryView.jsx';
import {PendingEventCard} from '../../src/components/PendingEvents.jsx';
import {RecordsDirectory} from '../../src/components/RecordsDirectory.jsx';
import {TemplateBrowser} from '../../src/components/TemplateBrowser.jsx';
import {AppearanceSettings} from '../../src/components/AppearanceSettings.jsx';
import {EventDetails} from '../../src/components/EventDetails.jsx';
import {EventEditor} from '../../src/components/EventEditor.jsx';
import {StudentEditor,StudentDetails} from '../../src/components/StudentEditor.jsx';
import {RecordEditor} from '../../src/components/RecordEditor.jsx';
import {TypeEditor} from '../../src/components/TypeEditor.jsx';
import {MoveEditor} from '../../src/components/MoveEditor.jsx';
import {ReminderDialog} from '../../src/components/ReminderDialog.jsx';
import {EventCard} from '../../src/components/EventCard.jsx';
import '../../src/app.css';

const data=demoData(), today=todayISO(), before=addDays(today,-1);
const sample={id:'review-event',title:'Занятие с Анной',typeId:'lesson',studentId:data.students[0].id,recordId:data.students[0].id,date:before,anchorDate:before,start:1020,duration:60,status:'planned',color:'violet',busy:true,fields:{topic:'Производные',rate:1500,call:'https://example.com/meeting'},history:[]};
const pending=moveEvent({...sample,id:'review-pending'},null,sample.start,sample.duration);
data.events=[sample,pending,moveEvent({...sample,id:'review-moved'},today,1080,60),{...sample,id:'review-done',title:'Разбор задач',start:900,status:'done'},{...sample,id:'review-cancelled',title:'Консультация',start:720,status:'cancelled'}];
data.students[0].details=[{id:'board',label:'Доска',type:'url',value:'https://example.com/board'}];
const noop=()=>{};
function Review(){
 useWorkspaceTheme();
 const [view,setView]=useState('transfers'),[theme,setTheme]=useState(readColorTheme),[query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const [dialog,setDialog]=useState('');const close=()=>setDialog('');
 const renderPending=event=><PendingEventCard key={event.id} data={data} event={event} onOpen={()=>setDialog('pending')} onMove={()=>setDialog('move')} onRemind={()=>setDialog('reminder')} onRestore={noop}/>;
 return <div class="layout sidebar-collapsed" data-workspace-view={view}><main class="main">
  <header style={{display:'flex',gap:'8px',flexWrap:'wrap',padding:'12px 0 24px'}}>
   <select aria-label="Review section" value={view} onChange={event=>setView(event.currentTarget.value)}>{['transfers','history','records','templates','appearance','cards'].map(name=><option value={name}>{name}</option>)}</select>
   <select aria-label="Review theme" value={theme} onChange={event=>setTheme(setColorTheme(event.currentTarget.value))}>{['light','dark'].map(name=><option value={name}>{name}</option>)}</select>
   <select aria-label="Review dialog" value={dialog} onChange={event=>setDialog(event.currentTarget.value)}>{['','event','pending','event-editor','student','student-editor','record-editor','type-editor','move','reminder'].map(name=><option value={name}>{name||'No dialog'}</option>)}</select>
  </header>
  {view==='transfers' && <TransfersView data={data} pending={[pending]} renderPending={renderPending} onOpen={()=>setDialog('event')}/>}
  {view==='history' && <HistoryView data={data} now={Date.now()} onOpen={()=>setDialog('event')} onStatus={noop}/>}
  {view==='records' && <RecordsDirectory data={data} today={today} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onOpen={()=>setDialog('student')} onAdd={()=>setDialog('record-editor')}/>}
  {view==='templates' && <TemplateBrowser data={data} onEdit={()=>setDialog('type-editor')} onCopy={noop} onArchive={noop} onDelete={noop} onAdd={()=>setDialog('type-editor')} onArchived={noop}/>}
  {view==='appearance' && <AppearanceSettings/>}
  {view==='cards' && <div style={{maxWidth:'420px',display:'grid',gap:'16px'}}><EventCard data={data} event={sample} expanded onOpen={noop}/><EventCard data={data} event={{...sample,status:'done'}} expanded onOpen={noop}/></div>}
  {['event','pending'].includes(dialog) && <EventDetails data={data} event={dialog==='pending'?pending:sample} onClose={close} onEdit={()=>setDialog('event-editor')} onMove={()=>setDialog('move')} onRestore={noop} onRemind={()=>setDialog('reminder')} onStatus={noop} onStudent={()=>setDialog('student')} onRecord={noop}/>}
  {dialog==='event-editor' && <EventEditor data={data} original={sample} onClose={close} onSave={noop}/>}
  {dialog==='student' && <StudentDetails data={data} student={data.students[0]} onClose={close} onEdit={()=>setDialog('student-editor')} onEvent={noop}/>}
  {dialog==='student-editor' && <StudentEditor data={data} original={data.students[0]} onClose={close} onSave={noop}/>}
  {dialog==='record-editor' && <RecordEditor data={data} category="project" onClose={close} onSave={noop}/>}
  {dialog==='type-editor' && <TypeEditor data={data} original={data.types[0]} onClose={close} onSave={noop}/>}
  {dialog==='move' && <MoveEditor data={data} event={pending} onClose={close} onAdvanced={noop} onSave={noop} onRestore={noop}/>}
  {dialog==='reminder' && <ReminderDialog data={data} event={pending} onClose={close} onSave={noop} onRemove={noop}/>}
 </main></div>;
}
render(<ThemeProvider><Review/></ThemeProvider>,document.getElementById('app'));
