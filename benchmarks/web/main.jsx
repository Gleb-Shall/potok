import { render } from 'preact';
import { invoke } from '@tauri-apps/api/core';
import { App } from '../../src/App.jsx';
import { ThemeProvider } from '../../src/theme/ThemeProvider.jsx';
import fixture from '../fixtures/calendar.json';
import '../../src/app.css';
// This entry is packaged ONLY under app.potok.webbaseline, never app.potok.local.
if (!window.__TAURI_INTERNALS__) throw new Error('Benchmark entry requires its isolated native app.');
const scenario = await invoke('benchmark_scenario');
const data = scenario === 'empty' ? {...fixture, events:[], series:[]} : fixture;
localStorage.setItem('tutor-schedule:personal:v2', JSON.stringify(data));
localStorage.setItem('tutor-schedule:mode','personal');
localStorage.setItem('potok:color-theme','light');
localStorage.setItem('potok:week-layout','timeline');
render(<ThemeProvider><App initialMode="personal"/></ThemeProvider>,document.getElementById('app'));
