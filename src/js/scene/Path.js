/** Path */

import { SceneNode } from 'engine';
import * as THREE from 'three';

class Path extends SceneNode {
  static STEP = 0.25;
  static NUM_PATHS = 0;

  constructor(a, b) {
    super({ label: 'Path_' + Path.NUM_PATHS });
    this.isPath = true;
    Path.NUM_PATHS += 1;

    // props
    this.a = a;
    this.b = b;
    this.cp1 = this.a.clone().multiplyScalar(0.25);
    this.cp2 = this.b.clone().multiplyScalar(0.25);
    this.traversed = 0;
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Player = this._getModule('Player');

    // create curve, points
    this.curve = new THREE.CubicBezierCurve3(this.a, this.cp1, this.cp2, this.b);
    this.length = this.curve.getLength();
    this.points = this.curve.getPoints(Math.round(this.length / Path.STEP));

    // helpers
    this.points.forEach((p, i) => {
      const cv = new THREE.Vector3(1-i/this.points.length, i/this.points.length, 0).normalize();
      const c = new THREE.Color(cv.x, cv.y, cv.z);
      const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      const mat = new THREE.MeshBasicMaterial({color: c});
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(p);
      this.parent.group.add(mesh);
    });
  }

  /** move position along curve */
  movePosition(p, delta, speed) {
    // get initial position
    if (this.traversed === 0) {
      this.traversed = p.distanceTo(this.points[0]);
    }

    // increase distance traversed
    this.traversed += speed * delta;

    // move along curve
    if (this.traversed <= this.length) {
      const u = this.traversed / this.length;
      this.curve.getPointAt(u, p);

    // extend beyond curve
    } else {
      const a = this.points[this.points.length - 2];
      const b = this.points[this.points.length - 1];
      const v = b.clone().sub(a).normalize().multiplyScalar(this.traversed - this.length);
      p.add(v);
    }
  }

  /** get exit position */
  getExit() {
    return this.b;
  }
}

export default Path;
