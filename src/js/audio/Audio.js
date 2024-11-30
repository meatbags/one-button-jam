/** Audio */

import { SceneNode, Animation } from 'engine';

class Audio extends SceneNode {
  constructor(props={}) {
    super({});
    this.isAudio = true;

    // props
    this.audioContext = null;
    this.input = props.input;
  }

  /** @override */
  _init() {
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
}

export default Audio;
