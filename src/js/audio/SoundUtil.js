/** SoundUtil */

import { ObjectEqualsShallow } from 'engine';

class SoundUtil {
  static SEMITONE_RATIO = 1.05946;
  static BASE_FREQUENCY = 880; // 440, 466.16, 493.88, 523.25, 554.37
  static BASE_VOLUME = 0;
  static AUDIO_QUALITY = 'high';
  static cache = {};
  static reverbDefault = { wet: 0.75, duration: 1.5, decay: 2 };
  static reverbZones = [];
  static audioContext = null;

  /** set audio context */
  static setAudioContext(context) {
    SoundUtil.audioContext = context;
  }

  static setAudioQuality(quality) {
    SoundUtil.AUDIO_QUALITY = quality;
  }

  /** get sound by source */
  static get(source) {
    return SoundUtil.load(source);
  }

  /** load async */
  static load(source) {
    return new Promise(resolve => {
      if (SoundUtil.cache[source] !== undefined) {
        resolve(SoundUtil.cache[source]);
      } else {
        SoundUtil.cache[source] = null;
        fetch(source)
          .then(res => res.arrayBuffer())
          .then(buffer => SoundUtil.audioContext.decodeAudioData(buffer))
          .then(audioBuffer => {
            SoundUtil.cache[source] = audioBuffer;
            resolve(SoundUtil.cache[source]);
          });
      }
    });
  }

  /** get square wave */
  static squareWave(hz) {
    const context = SoundUtil.audioContext;
    const osc = new OscillatorNode(context, {type:'square', frequency: hz});
    osc.start(context.currentTime);
    return osc;
  }

  /** get sine wave */
  static sineWave(hz) {
    const context = SoundUtil.audioContext;
    const osc = new OscillatorNode(context, {type:'sine', frequency: hz});
    osc.start(context.currentTime);
    return osc;
  }

  /** add reverb zone */
  static createReverbZone(box, props={}) {
    // prevent duplicate zones
    for (let i=0; i<SoundUtil.reverbZones.length; i++) {
      if (
        SoundUtil.reverbZones[i].box.equals(box) &&
        ObjectEqualsShallow(props, SoundUtil.reverbZones[i].props)
      ) {
        console.log('Duplicate zone exists, skipping:', box, props);
        return;
      }
    }

    // add reverb zone
    SoundUtil.reverbZones.push({ box, props });
  }

  /** get reverb props at position */
  static reverbAtPosition(p) {
    let reverb = { ...SoundUtil.reverbDefault };
    let overlapping = 0;

    // get props from zones
    for (let i=0; i<SoundUtil.reverbZones.length; i++) {
      if (SoundUtil.reverbZones[i].box.containsPoint(p)) {
        let props = { ...SoundUtil.reverbZones[i].props };
        for (const key in props) {
          if (reverb[key] === undefined) {
            reverb[key] = props[key];
          } else {
            reverb[key] += props[key];
          }
        }
        overlapping += 1;
      }
    }

    // blend overlapping zones
    if (overlapping > 1) {
      for (const key in reverb) {
        reverb[key] /= overlapping;
      }
    }

    return reverb;
  }

  /** get random sample interval from buffer, i.e. footsteps */
  static getRandomSample(buffer, samples, sampleDuration) {
    // set context
    const context = SoundUtil.audioContext;

    // get sample at random step
    const input = new AudioBufferSourceNode(context, {buffer: buffer});
    const offset = Math.floor(Math.random() * samples) * sampleDuration;
    const gain = new GainNode(context, {gain: 1});
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + sampleDuration);
    input.connect(gain);
    input.start(context.currentTime, offset, sampleDuration);

    return gain;
  }

  /** util: pitch shift hz */
  static pitchShift(hz, semitones) {
    return hz * Math.pow(SoundUtil.SEMITONE_RATIO, semitones);
  }

  /** util: pitch shift hz + snap to minor scale */
  static pitchShiftMinorScale(hz, index) {
    const scale = [0, 2, 3, 5, 7, 8, 10];
    let octave = 0;
    let i = index;
    if (i < 0) {
      while (i < 0) {
        i += scale.length;
        octave -= 1;
      }
    } else if (i >= scale.length) {
      while (i >= scale.length) {
        i -= scale.length;
        octave += 1;
      }
    }
    const key = scale[i];
    return SoundUtil.pitchShift(hz, key + octave * 12);
  }

  /** util: get current connected audio nodes */
  static countCurrentConnectedNodes(root) {

  }
}

export default SoundUtil;
