import test from 'node:test';
import assert from 'node:assert/strict';
import {getMonthlyAnalysisDeadline, isMonthlyAnalysisSubmitted, formatMonthlyAnalysisCountdown} from '../src/utils/monthlyAnalysisStatus.js';
test('deadline uses Bishkek time and rolls forward only after the 28th',()=>{
 const end=Date.parse('2026-11-28T17:59:59.999Z');
 assert.equal(getMonthlyAnalysisDeadline(end).getTime(),end);
 assert.equal(getMonthlyAnalysisDeadline(end+1).toISOString(),'2026-12-28T17:59:59.999Z');
 assert.equal(getMonthlyAnalysisDeadline(Date.parse('2026-12-29T00:00:00Z')).toISOString(),'2027-01-28T17:59:59.999Z');
});
test('editing an old report does not count as a new submission',()=>{
 const now=Date.parse('2026-11-05T12:00:00Z');
 assert.equal(isMonthlyAnalysisSubmitted(null,now),false);
 assert.equal(isMonthlyAnalysisSubmitted({createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-11-05T00:00:00Z'},now),false);
 assert.equal(isMonthlyAnalysisSubmitted({createdAt:'2026-11-01T00:00:00Z'},now),true);
 assert.equal(isMonthlyAnalysisSubmitted({createdAt:'2026-12-01T00:00:00Z'},now),false);
 assert.match(formatMonthlyAnalysisCountdown(now),/^23 05:59:60$|^23 06:00:00$/);
});
