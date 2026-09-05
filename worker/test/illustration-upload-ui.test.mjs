import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the actual UI handlers against a small DOM/API fixture: selecting a file is
// local only, and approval is tied to the displayed word, image and pointer.
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',options:[],files:[],open:false,
    listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},
    removeAttribute(name){delete this[name];},showModal(){this.open=true;},close(){this.open=false;},
  });
  return elements.get(id);
}
const originalId='11111111-1111-4111-8111-111111111111';
const changedId='22222222-2222-4222-8222-222222222222';
const word={id:'key',spelling:'key',senses:[{pos:'形',meaning:'重要な'}]};
let currentId=originalId, poll, copied='';
const writes=[];
const history=()=>({word:structuredClone(word),brief:{pos:'形',meaning:'重要な',scene:'',avoid:''},
  currentId,history:[],suggestedPrompt:'Draw one person.',referencePaths:[]});
const source=readFileSync(new URL('../../public/setting/illustrations.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'');
const context={
  EDITOR_API_BASE:'',VIEWER_API_BASE:'',document:{getElementById:element,hidden:false},
  location:{origin:'https://vocab.lrnr.jp'},URL,Response,console,crypto:globalThis.crypto,
  navigator:{clipboard:{writeText:async text=>{copied=text;}}},
  setInterval:fn=>{poll=fn;},
  FileReader:class {readAsDataURL(file){this.result='data:image/png;base64,'+file.base64;this.onload();}},
  Image:class {naturalWidth=1024;naturalHeight=1024;async decode(){}},
  editorFetch:async(path,options)=>{
    if(options.method && options.method!=='GET') {
      const body=JSON.parse(options.body); writes.push({path,body});
      if(path.endsWith('/import')) {
        if(body.expectedCurrentId!==currentId)return Response.json({error:'表示中の画像が変わっています'},{status:409});
        currentId=body.requestId;return Response.json({current:true});
      }
      return Response.json({ok:true});
    }
    if(path.includes('/words/'))return Response.json(history());
    return Response.json({config:{ready:false,importReady:true},sectionId:null,sections:[],counts:[],
      words:[{id:'key',spelling:'key',no:1,branch:0,status:'ready'}]});
  },
};
await vm.runInNewContext(`(async()=>{${source}})()`,context);
const ui=id=>element(id);
const open=()=>ui('words').listeners.click({target:{closest:()=>({dataset:{open:'key'}})}});
// click delegates to an async open; flush its response parsing before interacting.
open();await new Promise(r=>setTimeout(r,20));
assert.equal(ui('detail').open,true);
assert.equal(ui('generateWord').disabled,true,'paid generation unavailable');
assert.equal(ui('configuration').hidden,true,'no API-key warning for valid imports');
await ui('copyPrompt').onclick();
assert.match(copied,/OKするまではcrossoverに登録しない/);
ui('uploadFile').files=[{size:100,base64:'UE5H'}];
const before=writes.length;
await ui('uploadFile').onchange();
assert.equal(writes.length,before,'selecting the file must not send it');
assert.equal(ui('uploadPreview').hidden,false);
assert.equal(ui('importWord').disabled,true);
ui('uploadApproved').checked=true;ui('uploadApproved').onchange();
assert.equal(ui('importWord').disabled,false);
ui('scene').value='changed scene';ui('scene').listeners.input();
assert.equal(ui('uploadApproved').checked,false,'editing the brief invalidates approval');
ui('uploadApproved').checked=true;ui('uploadApproved').onchange();
currentId=changedId;await poll();
await ui('importWord').onclick();
assert.equal(writes.at(-1).body.expectedCurrentId,originalId,'background refresh must not silently approve a new pointer');
assert.match(ui('detailStatus').textContent,/変わっています/);
// Reviewing and checking again after a conflict targets the newly observed pointer.
ui('uploadApproved').checked=false;ui('uploadApproved').onchange();
ui('uploadApproved').checked=true;ui('uploadApproved').onchange();
await ui('importWord').onclick();
assert.equal(writes.at(-1).body.expectedCurrentId,changedId);
assert.equal(writes.at(-1).body.approved,true);
assert.match(ui('detailStatus').textContent,/承認した画像を登録/);
assert.equal(ui('uploadApproved').checked,false);
assert.equal(ui('importWord').disabled,true);
assert.equal(writes.filter(x=>x.path.endsWith('/jobs')).length,0);
console.log('Illustration upload UI: local preview, approval invalidation, stale-pointer protection and no paid generation passed');
