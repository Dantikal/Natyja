import test from 'node:test';
import assert from 'node:assert/strict';
import {journalArchiveGroups} from '../src/utils/journalArchive.js';
test('Bishkek dates, newest years and documents, Monday weeks',()=>{
 const groups=journalArchiveGroups([{id:1,archivedAt:'2026-12-31T20:00:00Z'},{id:2,archivedAt:'2026-11-11T10:00:00Z'},{id:3,archivedAt:'2026-11-12T10:00:00Z'},{id:4,archivedAt:'2026-11-02T10:00:00Z'}]);
 assert.deepEqual([...groups.keys()],['2027','2026']);
 const weeks=groups.get('2026').get('11');
 assert.deepEqual([...weeks.keys()],['2026-11-09','2026-11-02']);
 assert.deepEqual(weeks.get('2026-11-09').documents.map(d=>d.id),[3,2]);
 assert.equal(weeks.get('2026-11-09').end.toISOString().slice(0,10),'2026-11-15');
});
