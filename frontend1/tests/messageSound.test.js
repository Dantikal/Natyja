import test from 'node:test';
import assert from 'node:assert/strict';
test('blocked notification plays after audio unlock, only once, and respects mute', async()=>{
 let enabled=true,started=0;
 const audio={state:'suspended',currentTime:0,destination:{},resume:async()=>{audio.state='running';},createOscillator:()=>({frequency:{setValueAtTime(){}},connect(){},start(){started++;},stop(){},disconnect(){}}),createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 global.window={localStorage:{getItem:()=>JSON.stringify({sound:false,notificationSound:enabled})},AudioContext:function(){return audio;}};
 const {playMessageSound}=await import('../src/utils/messageSound.js');
 playMessageSound('incoming-1');
 assert.equal(started,0);
 await Promise.resolve();await Promise.resolve();
 assert.equal(started,3);
 playMessageSound('incoming-1');assert.equal(started,3);
 enabled=false;playMessageSound('muted');assert.equal(started,3);
 delete global.window;
});
