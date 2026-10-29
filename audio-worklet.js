// Lelelilo HQ: the office's sound, on the browser's audio thread. The synthesizer is a small WebAssembly module of
// its own (audio.wasm, which imports nothing); the game sends it commands as bytes through the port, and the page
// sends the recordings it has decoded, a piece at a time, answering each so the next can come.
class HqAudio extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // (if the synthesizer could not be started, what the game sends is dropped: the office goes on in silence)
    this.port.onmessage = e => { if (this.w) this.take(e.data); };
    try {
      // Compiling here, off the page's main thread, is allowed synchronously
      const module = new WebAssembly.Module(options.processorOptions.wasm);
      const w = new WebAssembly.Instance(module, {}).exports;
      w.init(sampleRate);
      this.w = w;
    } catch (e) {
      this.port.postMessage({ error: String(e) });
    }
  }
  take(data) {
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) return this.send(data);
    const w = this.w;
    if (data && data.pcm) {
      // a piece of a sheet: into the synthesizer's own memory, then kept (or refused)
      const { sheet, at, pcm } = data, p = w.pcm(sheet, at, pcm.length);
      const kept = p ? (new Float32Array(w.memory.buffer, p, pcm.length).set(pcm), w.store(sheet, at, pcm.length)) : 0;
      this.port.postMessage({ stored: sheet, at, kept });
    } else if (data && data.ask) {
      this.port.postMessage({ ready: w.ready(), played: w.played() });
    }
  }
  send(data) {
    const bytes = new Uint8Array(data), p = this.w.inbox(bytes.length);
    new Uint8Array(this.w.memory.buffer, p, bytes.length).set(bytes);
    this.w.commands(bytes.length);
  }
  process(_, outputs) {
    const out = outputs[0];
    if (!this.w || !out || !out.length) return true;
    const n = out[0].length, p = this.w.render(n), memory = this.w.memory.buffer;
    // (the views onto the synthesizer's two channels are kept, made anew only when its memory moves or grows, so
    // the audio thread makes no garbage)
    if (this.memory !== memory || this.at !== p || this.n !== n) {
      [this.memory, this.at, this.n] = [memory, p, n];
      this.left = new Float32Array(memory, p, n);
      this.right = new Float32Array(memory, p + n * 4, n);
    }
    out[0].set(this.left);
    if (out[1]) out[1].set(this.right);
    return true;
  }
}
registerProcessor('hq-audio', HqAudio);
