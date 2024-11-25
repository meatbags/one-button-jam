/** AmbientSounds */

import { SceneNode, Animation, HSL2RGB } from 'engine';
import * as THREE from 'three';
import SoundUtil from './SoundUtil';
import PositionalAudioNode from './PositionalAudioNode';
import DummyAudioNode from './DummyAudioNode';
import Field from '../scene/Field';
import Reactor from '../scene/Reactor';

class AmbientSounds extends SceneNode {
  static AUDIO_LOW_TIMEOUT_EXTRA = 0.15;
  static AUDIO_LOW_MAX_SOUNDS = 18;

  constructor() {
    super({label: 'AmbientSounds'});
    this.age = 0;
    this.timeout = 2;
    this.area = null;
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Camera = this._getModule('Camera');
    this.ref.LogicRoot = this._getModule('LogicRoot');
    this._devStatId = this._getModule('Dev').addStat('current room',
      () => (this.area === null ? 'null' : this.area.label));
  }

  /** @override */
  _destroy() {
    this._getModule('Dev').removeStat(this._devStatId);
  }

  /** on settings */
  onSettingsChanged(settings) {
    this._audio = settings.audio;
    this.onAreaChanged(this.area);
  }

  /** on area changed */
  onAreaChanged(area=null) {
    const label = this.getAreaLabel(area);
    if (label === null || label === 'InfiniteHallway') {
      this.timeout = 0.35;
    } else if (label === 'Staircase') {
      this.timeout = 0.35;
    } else if (label === 'Maze') {
      this.timeout = 0.35;
    } else if (label === 'Field') {
      this.timeout = 0.225;
    } else if (label === 'Reactor') {
      this.timeout = 0.5;
    }

    // throttle audio
    if (this._audio && this._audio === 'low') {
      this.timeout += AmbientSounds.AUDIO_LOW_TIMEOUT_EXTRA;
    }
  }

  /** get current area */
  getCurrentArea() {
    let area = null;
    const p = this.ref.Camera.getCamera().position.clone();

    // get containing room
    this._getModule('LogicRoot').traverse(child => {
      if (
        typeof child.containsPoint === 'function' &&
        child.containsPoint(p)
      ) {
        area = child;
      }
    });

    return area;
  }

  /** util: extract label from area */
  getAreaLabel(area) {
    return area === null ? null : area.label;
  }

  /** get area-specific ambient sound */
  getAreaSpecificSound() {
    const label = this.getAreaLabel(this.area);

    // set position
    const p = this.ref.Camera.getCamera().position.clone();

    // random colour
    const colour = new THREE.Vector3(
      Math.random(), Math.random(), Math.random()).normalize();

    // get input
    let input = null;
    let volume = 0.25;
    let duration = 1.0 + Math.random() * 0.5;

    // Hallway/default
    if (label === null || label === 'InfiniteHallway') {
      const semitones = Math.round((Math.random() * 2 - 1) * 12);
      const hz = SoundUtil.pitchShiftMinorScale(SoundUtil.BASE_FREQUENCY, semitones - 12);
      input = SoundUtil.sineWave(hz);
      p.x += (Math.random() * 2 - 1) * 10;
      p.y += -3 + Math.random() * 10;
      p.z += (Math.random() * 2 - 1) * 10;

    // staircase
    } else if (label === 'Staircase') {
      const semitones = Math.round((Math.random() * 2 - 1) * 12);
      const hz = SoundUtil.pitchShiftMinorScale(SoundUtil.BASE_FREQUENCY, semitones - 24);
      input = SoundUtil.sineWave(hz);
      p.x += (Math.random() * 2 - 1) * 5;
      p.y += -5 + Math.random() * 5;
      p.z += (Math.random() * 2 - 1) * 5;
      volume = 0.05;

    // maze
    } else if (label === 'Maze') {
      const semitones = Math.round((Math.random() * 2 - 1) * 12);
      const hz = SoundUtil.pitchShiftMinorScale(SoundUtil.BASE_FREQUENCY, semitones - 24);
      input = SoundUtil.sineWave(hz);
      p.x += (Math.random() * 2 - 1) * 10;
      p.y += -2 + Math.random() * 7;
      p.z += (Math.random() * 2 - 1) * 10;
      volume = 0.1;

    // field
    } else if (label === 'Field') {
      const keyOffset = Math.round((Math.random() * 2 - 1) * 14) - 7;
      const hz = SoundUtil.pitchShiftMinorScale(SoundUtil.BASE_FREQUENCY, keyOffset);
      input = SoundUtil.sineWave(hz);
      volume /= 2;
      if (Math.random() > 0.25) {
        p.copy( this.area.getRandomHotspot(p) );
        const theta = Math.random() * Math.PI * 2;
        const magMax = 6;
        const mag = Math.pow(Math.random(), 3) * magMax;
        p.x += Math.cos(theta) * mag;
        p.y += Math.random() * (2 + (1 - mag / magMax) * 6);
        p.z += Math.sin(theta) * mag;
      } else {
        p.x += (Math.random() * 2 - 1) * 20;
        p.y += Math.random() * 2;
        p.z += (Math.random() * 2 - 1) * 20;
      }
      duration += 1;

      // set colour
      const rgb = HSL2RGB(Math.random(), 1, 0.5);
      colour.set(rgb[0], rgb[1], rgb[2]);

    // reactor
    } else if (label === 'Reactor') {
      const keyOffset = Math.round((Math.random() * 2 - 1) * 16) - 6;
      const hz = SoundUtil.pitchShiftMinorScale(SoundUtil.BASE_FREQUENCY, keyOffset);
      input = SoundUtil.sineWave(hz);
      volume /= 2;

      p.x += (Math.random() * 2 - 1) * 10;
      p.y += -3 + Math.random() * 10;
      p.z += (Math.random() * 2 - 1) * 10;

      // set position
      //p.x = Reactor.OFFSET.x + 10 + Math.floor(Math.random() * 4) * 8;
      //p.y = Reactor.OFFSET.y + 2 + (Math.random() * 2 - 1) * 1;
      //p.z = Reactor.OFFSET.z - 8 + Math.floor(Math.random() * 4) * 8;

      // set colour
      const rgb = HSL2RGB(Math.random(), 1, 0.5);
      colour.set(rgb[0], rgb[1], rgb[2]);
    }

    // get node
    let rolloffFactor = 1.5;
    let fadeIn = 1.0;
    let fadeOut = 1.0;
    let useReverb = true;
    let usePanner = true;
    if (this._audio && this._audio === 'low') {
      volume *= 0.05;
      rolloffFactor = 1.75;
      fadeIn = 0.5;
      fadeOut = 0.5;
      duration = Math.max(0.35, duration - 0.5);
      useReverb = true;
      usePanner = false;
    }
    return new PositionalAudioNode({
      input: input,
      position: p,
      colour: colour,
      fadeIn: fadeIn,
      fadeOut: fadeOut,
      rolloffFactor: rolloffFactor,
      lifespan: duration,
      volume: volume,
      useReverb: useReverb,
      usePanner: usePanner
    });
  }

  /** create ambient sound */
  createAmbientSound() {
    // check max sounds reached
    let createSound = true;
    if (this._audio && this._audio === 'low') {
      let n = 0;
      this.ref.LogicRoot.traverse(node => {
        if (node.isPositionalAudioNode && node.connected) {
          n += 1;
        }
      });
      if (n >= AmbientSounds.AUDIO_LOW_MAX_SOUNDS) {
        createSound = false;
      }
    }

    // create node
    let node = this.getAreaSpecificSound();
    const duration = node.props.lifespan;

    // ignore -- create dummy node
    if (!createSound) {
      let age = 0;
      node = new DummyAudioNode({
        position: node.props.position,
        colour: node.props.colour,
        callback: () => {
          age += 1/60;
          return Math.max(0.01, Math.sin(Math.min(age/duration, 1) * Math.PI) * 0.5);
        }
      });
    }

    // create audio node, flag
    node.warpToPlayer = true;
    this.addInitialise(node);

    // mesh
    const p = node.position.clone();
    const noiseMaterial = this._utilSearchTree(node => node.isNoiseMaterialHandler).getMaterial();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24), noiseMaterial);
    mesh.position.copy(p);
    const scene = this._getModule('Scene').getScene();
    scene.add(mesh);

    // animate in/out
    const y0 = p.y;
    const y1 = p.y - 1;
    this.add(new Animation({
      duration: duration,
      callback: t => {
        p.y = y0 + (y1 - y0) * t;
        node.setPosition(p);
        mesh.position.copy(p);
        const s = Math.max(0.01, Math.sin(t * Math.PI));
        mesh.scale.set(s, s, s);
      },
      onEnd: () => {
        scene.remove(mesh);
        if (node.isDummyAudioNode) {
          node.destroy();
        }
      }
    }));
  }

  /** @override */
  _update(delta) {
    this.age += delta;

    if (this.age > this.timeout) {
      this.age %= this.timeout;

      // get current area
      const area = this.getCurrentArea();
      const label = this.getAreaLabel(area);
      if (this.getAreaLabel(this.area) !== label) {
        this.area = area;
        this.onAreaChanged(area);
      }

      // reactor-specific state
      if (label === 'Reactor') {
        this.timeout = (this.area.allNodesActive ? 0.35 : 0.5)
          + (this._audio && this._audio === 'low' ? AmbientSounds.AUDIO_LOW_TIMEOUT_EXTRA : 0);
      }

      // create sound
      this.createAmbientSound();
    }
  }
}

export default AmbientSounds;
