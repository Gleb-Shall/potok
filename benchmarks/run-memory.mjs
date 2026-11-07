import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const directory=resolve(process.argv[2] || 'builds/flutter-prototype');
const helper=resolve(process.argv[3] || '/private/tmp/potok-memory-macos');
const applications={flutter:{bundle:'Potok Flutter Prototype.app',exe:'Potok Flutter Prototype'},tauri:{bundle:'Potok Web Baseline.app',exe:'Potok Web Baseline'}};
const findPid=app=>{
  const path=`${directory}/${app.bundle}/Contents/MacOS/${app.exe}`;
  const matches=execFileSync('ps',['-axo','pid=,comm='],{encoding:'utf8'}).split('\n').map(line=>line.trim().match(/^(\d+)\s+(.*)$/)).filter(match=>match?.[2]===path);
  if(matches.length>1)throw new Error(`More than one isolated ${app.exe} instance. Close the extra one first.`);
  return matches[0]?Number(matches[0][1]):null;
};
const results={machine:{os:execFileSync('sw_vers',['-productVersion'],{encoding:'utf8'}).trim(),arch:execFileSync('uname',['-m'],{encoding:'utf8'}).trim(),model:execFileSync('sysctl',['-n','hw.model'],{encoding:'utf8'}).trim()},source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),metric:'sum of ri_phys_footprint in application resource coalition',unit:'MiB',warmupSeconds:20,sampleIntervalSeconds:2,runs:[]};
mkdirSync('benchmarks/results',{recursive:true});
for(const name of Object.keys(applications))if(findPid(applications[name]))throw new Error(`Close the isolated ${name} benchmark before measuring. The runner will not close an existing instance.`);
for(const [scenario,order] of [['empty',['flutter','tauri']],['fixture',['tauri','flutter']],['fixture',['flutter','tauri']],['empty',['tauri','flutter']]]) {
  for(const name of order) {
    const app=applications[name];let pid;
    console.log(`Starting ${name}, ${scenario}; warming 20 s.`);
    try {
      execFileSync('open',['-na',`${directory}/${app.bundle}`,'--args',scenario==='empty'?'--bench-empty':'--benchmark']);
      for(let attempt=0;attempt<20;attempt++){pid=findPid(app);if(pid)break;await sleep(500);}
      if(!pid)throw new Error(`No running ${name} process found.`);
      await sleep(20000);
      const samples=[];
      for(let i=0;i<10;i++){
        const sample=JSON.parse(execFileSync(helper,[String(pid)],{encoding:'utf8'}));
        if(!sample.complete||!sample.processes.some(p=>p.pid===pid))throw new Error('Incomplete process total.');
        // Reject a coalition shared by a terminal or another host application.
        if(sample.processes.some(p=>p.pid!==pid&&!/WebKit|Graphics|Networking|Potok/.test(p.name)))throw new Error('Unexpected resource coalition member; inspect grouping before reporting.');
        samples.push({...sample,at:new Date().toISOString()});
        if(i<9)await sleep(2000);
      }
      const sorted=samples.map(s=>s.physicalFootprintBytes/1048576).sort((a,b)=>a-b);
      const run={name,scenario,medianMiB:(sorted[4]+sorted[5])/2,minMiB:sorted[0],maxMiB:sorted.at(-1),samples};
      results.runs.push(run);
      writeFileSync('benchmarks/results/memory.json',JSON.stringify(results,null,2)+'\n');
      console.log(`${name} ${scenario}: median ${run.medianMiB.toFixed(1)} MiB, ${samples.at(-1).processes.length} processes.`);
    }finally{
      if(pid&&findPid(app)===pid){process.kill(pid,'SIGTERM');for(let i=0;i<20&&findPid(app);i++)await sleep(250);}
    }
  }
}
console.log('Completed. Raw measurements: benchmarks/results/memory.json');
