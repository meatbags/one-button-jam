/** PositionalAudioNode */

import { Vector3, Mesh, BoxGeometry, CircleGeometry, MeshBasicMaterial } from 'three';
import { SceneNode, Animation } from 'engine';
import SoundUtil from './SoundUtil';

class PositionalAudioNode extends SceneNode {
  static LOUDNESS_SCALE = 3;
  static LOUDNESS_INV_DISTANCE_SQR_MAX = 1.0;
  static LOUDNESS_INV_DISTANCE_SQR_SCALE = 0.01;
  static LOUDNESS_ZERO_EPS = 0.0001;
  static RADIUS_DEFAULT = 15;
  static ANALYSER_FFT_SIZE = 64; // 2048
  static ANALYSER_FFT_SIZE_LOWQ = 32;
  static ANALYSER_SMOOTHING_TIME_CONST = 0.8; // 0.8
  static FADE_IN_DEFAULT = 1.0;
  static FADE_OUT_DEFAULT = 1.0;
  static FADE_MINIMUM = 0.02;

  constructor(props={}) {
    super({});
    this.isPositionalAudioNode = true;
    this.props = props;
  }

  /** @override */
  _init() {
    // refs
    this.ref = {};
    this.ref.CameraPosition = this._getModule('Camera').getCamera().position;

    // set context
    this.audioContext = this._getModule('AudioHandler').getAudioContext();

    // props
    this.volume = (this.props.volume !== undefined ? this.props.volume : 1) + SoundUtil.BASE_VOLUME;
    this.position = this.props.position || new Vector3();
    this.normal = this.props.normal || null;
    this._temp = new Vector3();
    this.lifespan = this.props.lifespan || 0;
    this.radius = this.props.radius || PositionalAudioNode.RADIUS_DEFAULT;
    this.radius2 = this.radius * this.radius;
    this.radiusVertical = this.props.radiusVertical || (this.radius / 2);
    this.fadeInDuration = this.props.fadeIn !== undefined ? this.props.fadeIn : PositionalAudioNode.FADE_IN_DEFAULT;
    this.fadeOutDuration = this.props.fadeOut !== undefined ? this.props.fadeOut : PositionalAudioNode.FADE_OUT_DEFAULT;
    this.colour = this.props.colour || null;
    this.loudness = 0;
    this.loudnessScale = this.props.loudnessScale || PositionalAudioNode.LOUDNESS_SCALE;
    this.connected = false;
    this.inputStarted = true;
    this.useReverb = this.props.useReverb !== undefined ? this.props.useReverb : true;
    this.usePanner = this.props.usePanner !== undefined ? this.props.usePanner : true;

    // default audio nodes
    this.audioNodes = {};
    this.audioNodes.input = this.props.input || null;
    if (this.usePanner) {
      this.audioNodes.panner = new PannerNode(this.audioContext, {
        panningModel: 'equalpower', //'HRTF', // equalpower, HRTF
        // distanceModel: this.props.distanceModel || 'linear', // linear, exponential, inverse
        positionX: this.position.x,
        positionY: this.position.y,
        positionZ: this.position.z,
        maxDistance: this.props.maxDistance || PositionalAudioNode.RADIUS_DEFAULT,
        rolloffFactor: this.props.rolloffFactor || 2,
      });
    }
    this.audioNodes.output = new GainNode(this.audioContext, {gain: 0});

    // audio pipeline
    this.createPipeline();

    // connect pipeline
    for (let i=0; i<this.pipe.length-1; i++) {
      const from = this.pipe[i].output || this.pipe[i];
      const to = this.pipe[i+1].input || this.pipe[i+1];
      from.connect(to);
    }

    // create analyser
    this.audioNodes.analyser = new AnalyserNode(this.audioContext, {
      fftSize: PositionalAudioNode.ANALYSER_FFT_SIZE,
      smoothingTimeConstant: PositionalAudioNode.ANALYSER_SMOOTHING_TIME_CONST
    });
    this.analyserDataArray = new Uint8Array(this.audioNodes.analyser.frequencyBinCount);
    this.audioNodes.output.connect(this.audioNodes.analyser);

    // trigger destroy event
    if (this.lifespan) {
      setTimeout(() => {
        if (!this.destroyed) {
          this.fadeOutAndDestroy();
        }
      }, Math.round(this.lifespan * 1000));
    }

    // set silent, disconnected flag
    //this.audioNodes.output.gain.setValueAtTime(Number.EPSILON, this.audioContext.currentTime);
    this.audioNodes.output.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.audioNodes.output._disconnected = true;

    // firefox hotfix
    this.firefox = this.audioNodes.output.gain.cancelAndHoldAtTime === undefined;
  }

  /** @override */
  _destroy() {
    this.destroyed = true;

    // stop, disconnect nodes
    for (const key in this.audioNodes) {
      const node = this.audioNodes[key];
      if (typeof node.stop === 'function' && !node._stopped) {
        node.stop();
        node._stopped = true;
      }
      if (typeof node.disconnect === 'function' && !node._disconnected) {
        node.disconnect();
        node._disconnected = true;
      }
    }

    // remove helper */
    if (this.helper) {
      this._getModule('Scene').getScene().remove(this.helper);
    }

    // disconnect output
    this.disconnect();
  }

  /** create audio pipeline */
  createPipeline() {
    // pipeline
    this.pipe = [];
    this.pipe.push(this.audioNodes.input);
    if (this.usePanner) {
      this.pipe.push(this.audioNodes.panner);
    }
    this.pipe.push(this.audioNodes.output);
  }

  /** get loudness */
  getLoudness() {
    return this.loudness;
  }

  /** get position */
  getPosition() {
    return this.position;
  }

  /** set position */
  setPosition(p) {
    this.position.copy(p);
    if (this.helper) {
      this.helper.position.copy(p);
    }
    if (this.usePanner) {
      this.audioNodes.panner.positionX.setValueAtTime(p.x, this.audioContext.currentTime);
      this.audioNodes.panner.positionY.setValueAtTime(p.y, this.audioContext.currentTime);
      this.audioNodes.panner.positionZ.setValueAtTime(p.z, this.audioContext.currentTime);
    }
  }

  /** set volume */
  setVolume(v) {
    if (this.volume !== v) {
      this.volume = v;

      // fade to new volume
      if (this.active) {
        this.fadeIn(this.fadeInDuration);
      }
    }
  }

  /** calculate loudness */
  _calcLoudness() {
    if (!this.active && this.loudness < PositionalAudioNode.LOUDNESS_ZERO_EPS) {
      this.loudness = 0;
    } else {
      // base loudness
      this.audioNodes.analyser.getByteFrequencyData(this.analyserDataArray);
      let db = 0;
      const len = this.analyserDataArray.length;
      for (let i=0; i<len; i++) {
        db += this.analyserDataArray[i];
      }
      db /= len * 255;

      // scale by listener distance inv
      const d2 = this.distanceToEarSquared() *
        PositionalAudioNode.LOUDNESS_INV_DISTANCE_SQR_SCALE;
      db *= 1 / Math.max(PositionalAudioNode.LOUDNESS_INV_DISTANCE_SQR_MAX, d2);

      // loudness * scale
      this.loudness = db * this.loudnessScale;

      // zero loudness
      if (this.loudness < PositionalAudioNode.LOUDNESS_ZERO_EPS) {
        this.loudness = 0;
      }
    }
  }

  /** get distance to ear squared */
  distanceToEarSquared() {
    if (!this.firefox) {
      return Math.pow(this.audioContext.listener.positionX.value - this.position.x, 2) +
        Math.pow(this.audioContext.listener.positionY.value - this.position.y, 2) +
        Math.pow(this.audioContext.listener.positionZ.value - this.position.z, 2);

    // firefox hotfix
    } else {
      if (!this._refCameraPosition) {
        this._refCameraPosition = this._getModule('Camera').getCamera().position;
      }
      return this.position.distanceToSquared(this._refCameraPosition);
    }
  }

  /** check camera in range, facing */
  cameraInRange() {
    return Math.abs(this.position.y - this.ref.CameraPosition.y) < this.radiusVertical &&
      this.ref.CameraPosition.distanceToSquared(this.position) <= this.radius2 && (
        this.normal === null ||
        this.normal.dot(
          this._temp.copy(this.ref.CameraPosition).sub(this.position)) >= 0
      );
  }

  /** set position */
  setPosition(p) {
    this.position.copy(p);
    if (this.usePanner) {
      this.audioNodes.panner.positionX.value = this.position.x;
      this.audioNodes.panner.positionY.value = this.position.y;
      this.audioNodes.panner.positionZ.value = this.position.z;
    }
  }

  /** connect audio */
  connect() {
    if (this.connected) return;
    this.connected = true;

    // get reverb destination
    if (!this.destinationNode) {
      if (this.useReverb) {
        this.destinationNode = this._getModule('AudioHandler').getReverbInput(
          SoundUtil.reverbAtPosition(this.position)
        );
      } else {
        this.destinationNode = this._getModule('AudioHandler').getCompressorNode();
      }
    }

    // connect
    this.audioNodes.output.connect(this.destinationNode);
    this.audioNodes.output._disconnected = false;
  }

  /** disconnect audio */
  disconnect() {
    if (!this.connected) return;
    this.connected = false;

    // disconnect output
    if (!this.audioNodes.output._disconnected) {
      this.audioNodes.output.disconnect(this.destinationNode);
      this.audioNodes.output._disconnected = true;
    }
  }

  /** fade in audio */
  fadeIn(t) {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // connect
    this.connect();

    // get t
    t = Math.max(PositionalAudioNode.FADE_MINIMUM, t);

    // cancel current transition
    if (!this.firefox) {
      this.audioNodes.output.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
    } else {
      this.audioNodes.output.gain.cancelScheduledValues(this.audioContext.currentTime);
    }

    // fade output in
    this.audioNodes.output.gain.setValueAtTime(Number.EPSILON, this.audioContext.currentTime);
    this.audioNodes.output.gain.exponentialRampToValueAtTime(
      this.volume, this.audioContext.currentTime + t);
  }

  /** fade out audio */
  fadeOut(t) {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // get t
    t = Math.max(PositionalAudioNode.FADE_MINIMUM, t);

    // cancel current transition
    if (!this.firefox) {
      this.audioNodes.output.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
    } else {
      this.audioNodes.output.gain.cancelScheduledValues(this.audioContext.currentTime);
    }

    // set target
    this.audioNodes.output.gain.setTargetAtTime(
      Number.EPSILON, this.audioContext.currentTime, t);

    // disconnect
    const ms = Math.floor(this.getReverbFadeOutDuration() * 1000);
    this.fadeTimeout = setTimeout(() => {
      this.disconnect();
      this.fadeTimeout = null;
    }, ms);
  }

  /** get fadeout duration + buffer for reverb */
  getReverbFadeOutDuration() {
    const props = SoundUtil.reverbAtPosition(this.position);
    return Math.max(PositionalAudioNode.FADE_MINIMUM, this.fadeOutDuration) +
      (props.duration || SoundUtil.reverbDefault.duration);
  }

  /** fade out and destroy node */
  fadeOutAndDestroy() {
    const t = Math.max(PositionalAudioNode.FADE_MINIMUM, this.fadeOutDuration);
    this.fadeOut(this.fadeOutDuration);
    const ms = Math.round(this.getReverbFadeOutDuration() * 1000) + 100;
    setTimeout(() => {
      if (!this.destroyed) {
        this.destroy();
      }
    }, ms);
  }

  /** activate node */
  activate() {
    if (this.active) return;
    this.active = true;

    // fade in
    this.fadeIn(this.fadeInDuration);
  }

  /** deactivate node */
  deactivate() {
    if (!this.active) return;
    this.active = false;

    // fade out
    this.fadeOut(this.fadeOutDuration);
  }

  /** update active state */
  _setActive() {
    if (this.cameraInRange()) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  /** @override */
  _update(delta) {
    this._setActive();
    this._calcLoudness();
  }
}

export default PositionalAudioNode;
