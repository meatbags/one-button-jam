/** MenuAnimation */

import { SceneNode } from 'engine';
import * as THREE from 'three';
import NoiseMaterialHandler from '../material/NoiseMaterialHandler';
import DummyAudioNode from '../audio/DummyAudioNode';

class MenuAnimation extends SceneNode {
  constructor() {
    super({});

    // props
    this.active = false;
    this.age = 0;
  }

  /** @override */
  _init() {
    // noise material
    const noiseMaterial = new NoiseMaterialHandler({
      label: 'NoiseMaterialHandler_TEMP',
      root: this
    });
    this.addInitialise(noiseMaterial);

    // dummy audio noise node
    for (let i=0; i<5; i++) {
      let position = new THREE.Vector3(
        (Math.random() * 2 - 1) * 10,
        (Math.random() * 2 - 1) * 5,
        (Math.random() * 2 - 1) * 10,
      );
      let colour = new THREE.Vector3(
        Math.random(), Math.random(), Math.random());
      let phase = Math.random() * Math.PI * 2;
      let rate = 0.25 + Math.random() * 0.25;
      let dt = 1/60;
      this.add(new DummyAudioNode({
        position: position,
        colour: colour,
        callback: () => {
          phase += dt * rate;
          return Math.max(0, Math.sin(phase)) * 2.0;
        }
      }));
    }

    // scene, camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.001, 1000);
    this.camera.position.set(6, 1, 6);
    this.camera.lookAt(new THREE.Vector3());

    // box
    const box = new THREE.Mesh(new THREE.BoxGeometry(100, 7, 100),
      noiseMaterial.getMaterial());
    box.geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    this.scene.add(box);
  }

  /** reset renderer, destroy */
  resetAndDestroy() {
    // reset renderer defaults
    const scene = this._getModule('Scene').getScene();
    const camera = this._getModule('Camera').getCamera();
    const renderer = this._getModule('Renderer');
    renderer.setSceneCamera(scene, camera);

    // remove window event
    window.removeEventListener('resize', this.resize);

    // destroy node
    this.destroy();
  }

  /** set renderer targets */
  _setUp() {
    // destroy if mainLoop already running
    if (!this._getModule('MainLoop').isPaused()) {
      this.destroy();

    // set menu state
    } else {
      // set renderer targets
      this.ref = {};
      this.ref.Renderer = this._getModule('Renderer');
      this.ref.Renderer.setSceneCamera(this.scene, this.camera);

      // add destroy event
      const ui = this._getModule('UserInterface');
      this._addEventListenerToObject(ui, 'pointerlockchange', controls => {
        if (controls.isLocked()) {
          this.resetAndDestroy();
        }
      });

      // resize
      this.resize = () => this.onResize();
      window.addEventListener('resize', this.resize);
      this.resize();

      // set active flag
      this.active = true;
    }
  }

  /** resize */
  onResize() {
    const width = this.ref.Renderer.getRenderer().domElement.width;
    const height = this.ref.Renderer.getRenderer().domElement.height;
    const aspect = width / height;

    // correct camera aspect ratio
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  /** @override */
  _update(delta) {
    if (!this.active) {
      this._setUp();
    }
    if (this.active) {
      this.ref.Renderer.render(delta);
    }
  }
}

export default MenuAnimation;
