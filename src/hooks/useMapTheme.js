import {useEffect,useState} from 'preact/hooks';

const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
export function useMapTheme() {
  const [theme,setTheme]=useState(currentTheme);
  useEffect(()=>{
    const update=()=>setTheme(currentTheme());update();
    const observer=new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    return()=>observer.disconnect();
  },[]);
  return theme;
}
