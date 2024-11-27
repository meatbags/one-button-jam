/** Path */

import { SceneNode, Clamp } from 'engine';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

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
    const scaleFactor = 0.3;
    const scaleCP1 = new THREE.Vector3(
      Math.abs(a.x) > Math.abs(a.z) ? scaleFactor : 1,
      1,
      Math.abs(a.x) > Math.abs(a.z) ? 1 : scaleFactor,
    );
    this.cp1 = this.a.clone().multiply(scaleCP1);
    const scaleCP2 = new THREE.Vector3(
      Math.abs(b.x) > Math.abs(b.z) ? scaleFactor : 1,
      1,
      Math.abs(b.x) > Math.abs(b.z) ? 1 : scaleFactor,
    );
    this.cp2 = this.b.clone().multiply(scaleCP2);
    this.traversed = 0;
    this.dangerous = false;
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
    this.helpers = [];
    const positions = [];
    this.points.forEach((p, i) => {
      //const cv = new THREE.Vector3(1-i/this.points.length, i/this.points.length, 0).normalize();
      //const c = new THREE.Color(cv.x, cv.y, cv.z);
      const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      const mat = new THREE.MeshBasicMaterial({color: 0x00ff00});
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(p);
      this.parent.group.add(mesh);
      this.helpers.push(mesh);

      // get raw data for line geo
      positions.push(p.x, p.y, p.z);
    });

    // line
    const lineMat = new LineMaterial({
      color: 0x00ff00,
      linewidth: 0.04,
      worldUnits: true,
    });
    const geo = new LineGeometry();
    geo.setPositions(positions);
    this.lineMesh = new Line2(geo, lineMat);
    this.parent.group.add(this.lineMesh);
  }

  /** make path dangerous */
  makeDangerous() {
    this.dangerous = true;
    this.helpers.forEach(mesh => mesh.material.color.setHex(0xff0000));
    this.lineMesh.material.color.set(0xff0000);
  }

  /** make inactive */
  makeInactive() {
    const grey = 0x888888;
    this.helpers.forEach(mesh => mesh.material.color.setHex(grey));
    this.lineMesh.material.color.setHex(grey);
  }

  /** assert is dangerous */
  isDangerous() {
    return this.dangerous;
  }

  /** move position along curve */
  movePosition(p, delta, speed) {
    // get initial position
    if (this.traversed === 0) {
      this.traversed = Clamp(p.distanceTo(this.points[0]), 0, this.length);
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

  /** get entrance position */
  getEntrance() {
    return this.a;
  }
}

export default Path;
