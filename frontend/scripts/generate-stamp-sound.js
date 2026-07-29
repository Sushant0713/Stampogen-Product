const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const notes = [
  { freq: 523.25, start: 0.0, dur: 0.32 },
  { freq: 659.25, start: 0.18, dur: 0.42 },
  { freq: 783.99, start: 0.4, dur: 0.95 },
];
const totalSec = 1.45;
const n = Math.floor(sampleRate * totalSec);
const samples = new Float32Array(n);

function envelope(t, dur) {
  const attack = 0.014;
  const release = Math.min(0.32, dur * 0.45);
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  if (t > dur - release) return Math.max(0, (dur - t) / release);
  return 1;
}

for (const note of notes) {
  const start = Math.floor(note.start * sampleRate);
  const len = Math.floor(note.dur * sampleRate);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const idx = start + i;
    if (idx >= n) break;
    const env = envelope(t, note.dur);
    const wave =
      Math.sin(2 * Math.PI * note.freq * t) * 0.82 +
      Math.sin(2 * Math.PI * note.freq * 2 * t) * 0.14;
    samples[idx] += wave * env * 0.42;
  }
}

{
  const len = Math.floor(0.11 * sampleRate);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    samples[i] += Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t * 42) * 0.28;
  }
}

let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]));
const gain = peak > 0 ? 0.92 / peak : 1;
for (let i = 0; i < n; i++) samples[i] *= gain;

const buffer = Buffer.alloc(44 + n * 2);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + n * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const s = Math.max(-1, Math.min(1, samples[i]));
  buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2);
}

const out = path.join(__dirname, '..', 'public', 'sounds', 'stamp-request.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buffer);
console.log('Wrote', out, 'gain', gain.toFixed(3));
