import { useEffect, useReducer, useRef, useState } from 'react';
export function remainingSeconds(deadline:number|null|undefined, offset=0, now=Date.now()) {
  return deadline ? Math.max(0,Math.ceil((deadline-now-offset)/1000)) : 0;
}

/** Only countdown consumers subscribe; the transport/page has no ticking state. */
export function useCombatCountdown(deadline:number|null|undefined, offset=0) {
  const [snapshot,setSnapshot]=useState(()=>({deadline,offset,value:remainingSeconds(deadline,offset)}));
  const latest=useRef(snapshot);
  useEffect(()=>{
    let timer:ReturnType<typeof setInterval>|undefined;
    const update=()=>{
      const value=remainingSeconds(deadline,offset);
      const previous=latest.current;
      if(previous.deadline!==deadline||previous.offset!==offset||previous.value!==value){latest.current={deadline,offset,value};setSnapshot(latest.current);}
      if(!value&&timer!==undefined){clearInterval(timer);timer=undefined;}
    };
    if(remainingSeconds(deadline,offset)>0)timer=setInterval(update,250);
    update();
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[deadline,offset]);
  return snapshot.deadline===deadline&&snapshot.offset===offset?snapshot.value:remainingSeconds(deadline,offset);
}

/** The question intro changes the page once at its absolute server deadline. */
export function useBeforeCombatDeadline(deadline:number|null|undefined, offset=0) {
  const [,wake]=useReducer(n=>n+1,0);
  useEffect(()=>{
    if(!deadline)return;
    const delay=deadline-Date.now()-offset;
    if(delay<=0)return;
    const timer=setTimeout(wake,delay+1);
    const refresh=()=>wake();
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[deadline,offset]);
  return !!deadline&&Date.now()+offset<deadline;
}
