import {mergeConfig} from 'vite';
import base from '../vite.config.js';
export default mergeConfig(base,{build:{outDir:'benchmark-dist',rolldownOptions:{input:'benchmark.html'}}});
