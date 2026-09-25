// A stand-in for Web Audio in Node, enough for audio.js to build and play everything. It counts the
// nodes started, so tests can see that sounds were made.
function param(value = 0) {
  return {
    value,
    setValueAtTime(v) {
      this.value = v;
    },
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime(v) {
      this.value = v;
    },
  };
}

export function fakeAudioContext() {
  const started = [];
  const node = (extra = {}) => ({
    connect: (to) => to,
    disconnect() {},
    ...extra,
  });
  const ctx = {
    started,
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    listener: {
      positionX: param(), positionY: param(), positionZ: param(),
      forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param(),
    },
    resume() {
      ctx.state = 'running';
    },
    suspend() {
      ctx.state = 'suspended';
    },
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createDelay: () => node({ delayTime: param() }),
    createPanner: () => node({ positionX: param(), positionY: param(), positionZ: param() }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => node({ buffer: null, loop: false, start: () => started.push('buffer'), stop() {} }),
    createOscillator: () => node({ type: 'sine', frequency: param(440), start: () => started.push('osc'), stop() {} }),
  };
  return ctx;
}
