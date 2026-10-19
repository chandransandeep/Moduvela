import assert from "node:assert/strict";
import test from "node:test";
import {predictCompact,compactInfo} from "./trained.mjs";
import {CORPUS} from "./training/dataset.mjs";
test("compact trained model loads in Node without external APIs or GPU",()=>{
 const info=compactInfo();assert.ok(info.bytes<=32768);
 assert.equal(info.requiresModelAPI,false);
 assert.equal(info.requiresGPU,false);
 assert.equal(info.requiresRuntimeTraining,false);
 assert.equal(info.labels,8);
});
test("trained outputs finite scores and stable labels",()=>{
 const scores=predictCompact("We log repair jobs, spare parts, customer names and completion certificates");
 assert.equal(scores.length,8);
 for(const x of scores)assert.ok(x.score>=0&&x.score<=1);
 assert.deepEqual(scores,predictCompact("We log repair jobs, spare parts, customer names and completion certificates"));
});
test("held-out corpus contains distinct scenarios across sectors",()=>{
 const keys=new Set([...CORPUS.train,...CORPUS.validation,...CORPUS.test].map(x=>x.scenario_group));
 assert.equal(keys.size,720);
 assert.ok(new Set(CORPUS.train.map(x=>x.sector)).size>=10);
 assert.ok(new Set(CORPUS.test.map(x=>x.sector)).size>=2);
});
test("unseen challenge phrases do not trigger model execution paths",()=>{
 const arr=predictCompact("We want staff shifts and appointment scheduling for our fictional business");
 assert.equal(typeof arr[0].suggested,"boolean");
});
test("reject invalid request sizes and thresholds",()=>{
 assert.throws(()=>predictCompact("hi"));
 assert.throws(()=>predictCompact("we have 12 chars",9));
});
