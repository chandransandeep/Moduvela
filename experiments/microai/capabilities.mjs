/** Advisory browser resource inspection. Not a VRAM measurement or a guarantee. */
export function summarizeHardware({threads=null,ramGB=null,gpu=false}={}){
 const concurrency=Number.isFinite(threads)&&threads>0?Math.floor(threads):null;
 const reportedRam=Number.isFinite(ramGB)&&ramGB>0?ramGB:null;
 return {
  cpuThreads:concurrency,approxDeviceRAMGB:reportedRam,webgpuAdapterFound:Boolean(gpu),
  cpuTier:"Tiny classifier: on by default. Semantic embeddings: optional download.",
  gpuTier:gpu?"WebGPU optional tiers can be attempted":"WebGPU unavailable; large local generator disabled",
  caution:"Browser feature detection does NOT measure dedicated GPU memory or predict model compatibility. RAM estimates may be rounded/capped. Large models can crash a browser tab."
 };
}
export async function detectHardware(nav=globalThis.navigator){
 let available=false;
 try{available=!!(await nav?.gpu?.requestAdapter?.());}catch{}
 return summarizeHardware({threads:nav?.hardwareConcurrency??null,
  ramGB:nav?.deviceMemory??null,gpu:available});
}
