import assert from "node:assert/strict";
import test from "node:test";
import {detectHardware,summarizeHardware} from "./capabilities.mjs";
test("no WebGPU never claims large models work",async()=>{
 const result=await detectHardware({hardwareConcurrency:2,deviceMemory:4});
 assert.equal(result.webgpuAdapterFound,false);
 assert.ok(result.gpuTier.includes("unavailable"));
});
test("WebGPU is a capability, never a guaranteed VRAM assessment",async()=>{
 const result=await detectHardware({
  hardwareConcurrency:8,deviceMemory:8,gpu:{requestAdapter:async()=>({limits:{}})}
 });
 assert.equal(result.webgpuAdapterFound,true);
 assert.ok(result.caution.includes("NOT measure"));
 assert.equal(result.approxDeviceRAMGB,8);
});
test("rejected WebGPU adapter request keeps lightweight fallback",async()=>{
 const result=await detectHardware({gpu:{requestAdapter:async()=>{throw Error("blocked");}}});
 assert.equal(result.webgpuAdapterFound,false);
 assert.ok(result.cpuTier.includes("Tiny classifier"));
});
test("corrupt hardware info is not used for definitive requirements",()=>{
 const result=summarizeHardware({threads:-9,ramGB:Infinity,gpu:0});
 assert.equal(result.cpuThreads,null);
 assert.equal(result.approxDeviceRAMGB,null);
});
