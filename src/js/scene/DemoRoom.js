/** DemoRoom */

import { SceneNode, EventPlane } from 'engine';
import * as THREE from 'three';

class DemoRoom extends SceneNode {
  constructor() {
    super({label: 'DemoRoom'});
  }

  /** @override */
  _init() {
    // group
    this.group = new THREE.Group();

    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), new THREE.MeshPhysicalMaterial({}));
    box.position.y = -0.5;
    this._addToScene(box);
    const box2 = box.clone();
    this._addObjectToPhysicsWorld(box2);
    this._addToScene(box2);

    // add to global scene
    this._addToScene(this.group);
    
    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    const pointLight = new THREE.PointLight(0xffffff, 1, 5, 2);
    pointLight.position.set(0, 5, 0);
    this._addToScene(ambientLight, pointLight);
  }
}

export default DemoRoom;
