// Snapshots contain editable data only, never GPU objects or navigation state.
export function createHistory(read,restore,changed=()=>{}){
 let past=[],future=[],base=structuredClone(read()),depth=0,applying=false;
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function notify(){changed({undo:past.length>0,redo:future.length>0});}
 function commit(){if(applying||depth)return;const next=structuredClone(read());if(!equal(base,next)){past.push(base);if(past.length>100)past.shift();base=next;future=[];notify();}}
 return {begin(){if(!applying)depth++;},end(){depth=Math.max(0,depth-1);commit();},commit,
 reset(){past=[];future=[];depth=0;base=structuredClone(read());notify();},
 async undo(){if(applying)return;depth=0;commit();if(!past.length)return;applying=true;const next=past.pop();future.push(base);try{await restore(structuredClone(next));base=structuredClone(read());}finally{applying=false;notify();}},
 async redo(){if(applying||!future.length)return;applying=true;const next=future.pop();past.push(base);try{await restore(structuredClone(next));base=structuredClone(read());}finally{applying=false;notify();}},
 get applying(){return applying;},get counts(){return {undo:past.length,redo:future.length};}};
}
