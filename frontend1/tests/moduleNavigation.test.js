import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleNavigationKey as key} from '../src/utils/moduleNavigation.js';
test('navigation isolates documents, accounts and reused module sections',()=>{
 const user={id:1};const doc={directEditor:true,initialSectionId:'monthly-analysis',directDocumentId:'one'};
 assert.notEqual(key('Analytics',user,doc),key('Analytics',user,{...doc,directDocumentId:'two'}));
 assert.notEqual(key('Analytics',user,doc),key('Analytics',{id:2},doc));
 assert.notEqual(key('Library',user,{sections:[{id:'schedule'}]}),key('Library',user,{sections:[{id:'journal'}]}));
 assert.notEqual(key('Meetings',user,{storageNamespace:'meetings'}),key('Meetings',user,{storageNamespace:'young-soldier'}));
 assert.equal(key('Analytics',user,doc),key('Analytics',user,{...doc,title:'edited'}));
});
