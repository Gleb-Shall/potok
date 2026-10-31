import { useEffect, useRef } from 'preact/hooks';

const clamp = value => Math.min(1,Math.max(0,value));

// Passive native scrolling, one scheduled frame, no React updates per scroll.
// Everything is visible by default, including without the animation APIs.
export function useLandingScenes() {
  const ref=useRef(null);
  useEffect(() => {
    const root=ref.current;
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const hero=root.querySelector('.home-opening');
    const stages=[...root.querySelectorAll('[data-scroll-stage]')];
    const locked=new WeakSet();
    const animations=new Set();
    const request=window.requestAnimationFrame?.bind(window) || (callback => setTimeout(callback,16));
    const cancel=window.cancelAnimationFrame?.bind(window) || clearTimeout;
    let frame=0;
    const update=() => {
      frame=0;
      if (media?.matches || document.hidden) return;
      const height=window.innerHeight;
      const heroRect=hero.getBoundingClientRect();
      root.style.setProperty('--hero-away',clamp(-heroRect.top/Math.max(1,heroRect.height)));
      const total=document.documentElement.scrollHeight-height;
      root.style.setProperty('--journey',total>0?clamp(window.scrollY/total):0);
      for (const stage of stages) {
        const rect=stage.getBoundingClientRect();
        if (rect.top>height+120 || rect.bottom< -120) continue;
        const progress=locked.has(stage)?1:clamp((height-rect.top)/(height*.78));
        stage.style.setProperty('--stage-open',progress);
      }
    };
    const schedule=() => { if (!frame) frame=request(update); };
    const reset=() => {
      if (media?.matches) {
        root.style.setProperty('--hero-away',0);
        stages.forEach(stage => stage.style.setProperty('--stage-open',1));
        animations.forEach(animation => animation.cancel());
        animations.clear();
      } else schedule();
    };
    const settle=input => {
      const stage=input.target.closest?.('[data-scroll-stage]');
      if (stage) { locked.add(stage); stage.dataset.settled='true'; stage.style.setProperty('--stage-open',1); }
    };
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (media?.matches || !entry.target.animate) continue;
        const delay=Number(entry.target.dataset.revealDelay)||0;
        const animation=entry.target.animate([
          {opacity:0,transform:'translateY(25px)'},
          {opacity:1,transform:'translateY(0)'},
        ],{duration:700,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
        animations.add(animation);
        animation.onfinish=() => animations.delete(animation);
      }
    },{threshold:.12}):null;
    root.querySelectorAll('[data-reveal],.experiment-heading h2,.experiment-heading p,.experiment-faq details').forEach(node => observer?.observe(node));
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    document.addEventListener('visibilitychange',schedule);
    root.addEventListener('pointerdown',settle);
    root.addEventListener('focusin',settle);
    media?.addEventListener('change',reset);
    reset();
    return () => {
      cancel(frame); observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      document.removeEventListener('visibilitychange',schedule);
      root.removeEventListener('pointerdown',settle);
      root.removeEventListener('focusin',settle);
      media?.removeEventListener('change',reset);
    };
  },[]);
  return ref;
}
