import assert from "node:assert/strict";
import test from "node:test";
import {predictCompactV2,compactV2Info} from "./trained_v2.mjs";
import {predictCompact} from "./trained.mjs";
import {CORPUS} from "./training/dataset.mjs";

function f1(rows,predict){
 let tp=0,fp=0,fn=0;
 for(const row of rows){
  const expected=new Set(row.labels),found=new Set(predict(row.description));
  for(const x of found)expected.has(x)?tp++:fp++;
  for(const x of expected)if(!found.has(x))fn++;
 }
 return 2*tp+fp+fn ? 2*tp/(2*tp+fp+fn):0;
}
const v1=text=>predictCompact(text).filter(x=>x.suggested).map(x=>x.name);
const v2=text=>predictCompactV2(text).filter(x=>x.suggested).map(x=>x.name);
test("v2 weights remain tiny and require no API/GPU",()=>{
 const info=compactV2Info();
 assert.equal(info.version,2);
 assert.equal(info.weightBytes,16384);
 assert.equal(info.requiresGPU,false);
 assert.equal(info.requiresProvider,false);
});
test("v2 scores are deterministic, bounded and contain supporting clauses",()=>{
 const input="Our garage tracks customers, repair jobs and stock parts for a fictional workshop.";
 const one=predictCompactV2(input),two=predictCompactV2(input);
 assert.deepEqual(one,two);
 assert.equal(one.length,8);
 for(const item of one) {
  assert.ok(item.score>=0&&item.score<=1);
  assert.equal(typeof item.suggested,"boolean");
  assert.ok(item.evidence?.length>=12);
 }
});
test("v2 improves v1 on synthetic held-out test, while remaining advisory",()=>{
 assert.ok(f1(CORPUS.test,v2)>f1(CORPUS.test,v1));
 assert.ok(f1(CORPUS.challenge,v2)>f1(CORPUS.challenge,v1));
});
test("unknown, too short, or oversized requirements are rejected",()=>{
 assert.throws(()=>predictCompactV2("too short"));
 assert.throws(()=>predictCompactV2("x".repeat(5001)));
 assert.throws(()=>predictCompactV2(null));
});
