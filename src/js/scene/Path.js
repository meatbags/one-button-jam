/** Path */

import { SceneNode, Clamp } from 'engine';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import Game from './Game';
import Room from './Room';

class Path extends SceneNode {
  static STEP = 0.375;
  static COLLISION_THRESHOLD = 0.8;
  static COLLISION_OFFSET_MAX = 0.25;
  static VERTICAL_OFFSET = 0.5;
  static HEX = 0x888888;
  static RAIL_HEX = 0xaaaaaa;
  static RAIL_HEX_SELECTED = 0xffff00;
  static PATH_UID = 0;

  constructor(a, b) {
    super({ label: 'Path_' + (++Path.PATH_UID) });
    this.isPath = true;

    // props
    this.a = a;
    this.b = b;
    this.isStraight = a.x === b.x || a.z === b.z;
    this.traversed = 0;
    this.dangerous = false;
  }

  /** @override */
  _init() {
    // create curve
    this.curve = Path.bezierSetFromPoints([this.a, this.b]);
    this.length = this.curve.getLength();
    this.points = this.curve.getSpacedPoints(Math.round(this.length / Path.STEP));

    // adjust points -- create pylon meshes
    const thresh2 = Math.pow(Path.COLLISION_THRESHOLD, 2);
    const curvePath = new THREE.CurvePath();
    this.points.forEach((p, i) => {
      if (i === 0 || i === this.points.length - 1) {
        return;
      }
      const h = Path.VERTICAL_OFFSET + p.y;
      const geo = new THREE.CylinderGeometry(0.05, 0.05, h, 16);
      geo.translate(0, -h/2, 0);
      const mat = new THREE.MeshPhysicalMaterial({
        color: Path.HEX,
        transparent: true,
        envMap: this._getModule('Environment').getTexture('envMap'),
      });
      mat.envMap = this._getModule('Environment').getTexture('envMap');
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(p);
      mesh.position.y += Path.VERTICAL_OFFSET;
      this.parent.group.add(mesh);
    });

    // create base geometry
    const width = 0.25;
    const height = 0.05;
    const mat = new THREE.MeshPhysicalMaterial({
      color: Path.HEX,
      transparent: true,
      envMap: this._getModule('Environment').getTexture('envMap'),
    });
    mat.envMap = this._getModule('Environment').getTexture('envMap');
    if (!this.isStraight) {
      const w = width / 2;
      const h = height / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-h, -w);
      shape.lineTo( h, -w);
      shape.lineTo( h,  w);
      shape.lineTo(-h,  w);
      shape.lineTo(-h, -w);
      const geo = new THREE.ExtrudeGeometry(shape, {
        curveSegments: 16,
        steps: 32,
        bevelEnabled: false,
        extrudePath: this.curve,
      });
      geo.translate(0, Path.VERTICAL_OFFSET, 0);
      this.lineMesh = new THREE.Mesh(geo, mat);
    } else {
      const sx = this.a.x === this.b.x ? width : Math.abs(this.b.x - this.a.x);
      const sz = this.a.z === this.b.z ? width : Math.abs(this.b.z - this.a.z);
      const geo = new THREE.BoxGeometry(sx, height, sz);
      const tx = this.a.x === this.b.x ? this.a.x : 0;
      const tz = this.a.z === this.b.z ? this.a.z : 0;
      geo.translate(tx, Path.VERTICAL_OFFSET, tz);
      this.lineMesh = new THREE.Mesh(geo, mat);
    }
    this.lineMesh.castShadow = true;
    this.lineMesh.receiveShadow = true;

    // rails
    const off = 0.03;
    const mat2 = new THREE.MeshPhysicalMaterial({
      color: Path.RAIL_HEX,
      transparent: true,
      envMap: this._getModule('Environment').getTexture('envMap'),
    });
    if (!this.isStraight) {
      const shape2 = new THREE.Shape();
      const w = width / 2;
      const h = height / 2;
      shape2.moveTo(+off, -w);
      shape2.lineTo(-off, -w);
      shape2.lineTo(-off, -w-off);
      shape2.lineTo(+off, -w-off);
      shape2.lineTo(+off, -w);
      shape2.moveTo(+off, +w);
      shape2.lineTo(+off, +w+off);
      shape2.lineTo(-off, +w+off);
      shape2.lineTo(-off, +w);
      shape2.lineTo(+off, +w);
      const geo2 = new THREE.ExtrudeGeometry(shape2, {
        curveSegments: 16,
        steps: 32,
        bevelEnabled: false,
        extrudePath: this.curve,
      });
      geo2.translate(0, Path.VERTICAL_OFFSET, 0);
      this.lineMeshSelected = new THREE.Mesh(geo2, mat2);
    } else {
      this.lineMeshSelected = new THREE.Group();
      if (this.a.x === this.b.x) {
        const sx = off;
        const sz = Math.abs(this.b.z - this.a.z);
        const geo1 = new THREE.BoxGeometry(sx, off*2, sz);
        const geo2 = new THREE.BoxGeometry(sx, off*2, sz);
        const tx1 = this.a.x - width/2 - off/2;
        const tx2 = this.a.x + width/2 + off/2;
        geo1.translate(tx1, Path.VERTICAL_OFFSET, 0);
        geo2.translate(tx2, Path.VERTICAL_OFFSET, 0);
        this.lineMeshSelected.add(
          new THREE.Mesh(geo1, mat2), new THREE.Mesh(geo2, mat2));
      } else {
        const sx = Math.abs(this.b.x - this.a.x);
        const sz = off;
        const geo1 = new THREE.BoxGeometry(sx, off*2, sz);
        const geo2 = new THREE.BoxGeometry(sx, off*2, sz);
        const tz1 = this.a.z - width/2 - off/2;
        const tz2 = this.a.z + width/2 + off/2;
        geo1.translate(0, Path.VERTICAL_OFFSET, tz1);
        geo2.translate(0, Path.VERTICAL_OFFSET, tz2);
        this.lineMeshSelected.add(
          new THREE.Mesh(geo1, mat2), new THREE.Mesh(geo2, mat2));
      }
    }
    this.lineMeshSelected.visible = false;

    // add meshes
    this.parent.group.add(this.lineMesh, this.lineMeshSelected);
  }

  /** warp path */
  warpPath(p) {

  }

  /** make path dangerous */
  makeDangerous() {
    this.dangerous = true;

    // visual
    let uStart = 0.5;
    let uStep = 0.04;
    let u = uStart;
    this.dangerousMeshes = [];
    while (u < 1) {
      if (Math.random() < u) {
        let rad = 0.05 + Game.PLAYER_RADIUS * 0.5 * u + Math.random() * Game.PLAYER_RADIUS * 0.5;
        rad *= 0.1 + ((u - uStart) / (1 - uStart)) * 0.9;
        const ball = new THREE.BoxGeometry(rad, rad, rad);
        ball.translate(0, rad / 2 + Path.VERTICAL_OFFSET, 0);
        const mat = new THREE.MeshPhysicalMaterial({
          color: Path.HEX,
          metalness: 0.5,
          roughness: 0.2,
          envMap: this._getModule('Environment').getTexture('envMap'),
        });
        const mesh = new THREE.Mesh(ball, mat);
        mesh.rotation.y = Math.PI * Math.random();
        this.curve.getPointAt(u, mesh.position);
        mesh.position.x += (Math.random() * 2 - 1) * 0.1;
        mesh.position.z += (Math.random() * 2 - 1) * 0.1;
        mesh.castShadow = true;
        this.parent.group.add(mesh);
        this.dangerousMeshes.push(mesh);
      }
      u += uStep;
    }
  }

  /** make inactive */
  makeInactive() {
    //const grey = 0x888888;
    //this.helpers.forEach(mesh => mesh.material.color.setHex(grey));
    //this.lineMesh.material.color.setHex(grey);
  }

  /** assert is dangerous */
  isDangerous() {
    return this.dangerous;
  }

  /** move position along curve */
  movePosition(p, delta, speed) {
    // get initial position
    if (this.traversed === 0) {
      this.traversed = Clamp(
        p.distanceTo(this.points[0]), 0, this.length);
    }

    // increase distance traversed
    this.traversed += speed * delta;

    // move along curve
    if (this.traversed < this.length) {
      const u = this.traversed / this.length;
      this.curve.getPointAt(u, p);

    // extend beyond curve
    } else {
      const a = this.points[this.points.length - 2];
      const b = this.points[this.points.length - 1];
      const v = b.clone().sub(a).normalize();
      v.multiplyScalar(this.traversed - this.length);
      p.copy(b).add(v);
    }

    return this.traversed <= this.length;
  }

  /** get exit position */
  getExit() {
    return this.b;
  }

  /** get entrance position */
  getEntrance() {
    return this.a;
  }

  /** focus */
  focus() {
    this.lineMeshSelected.visible = true;
    this.lineMeshSelected.traverse(obj => {
      if (obj.material) {
        obj.material.color.setHex(Path.RAIL_HEX_SELECTED);
      }
    });
  }

  /** blur */
  blur() {
    this.lineMeshSelected.visible = false;
    this.lineMeshSelected.traverse(obj => {
      if (obj.material) {
        obj.material.color.setHex(Path.RAIL_HEX);
      }
    });
  }

  /** parent room blurred */
  onParentBlur() {
    this.lineMeshSelected.traverse(obj => {
      if (obj.material) {
        obj.material.color.setHex(Path.RAIL_HEX);
      }
    });
  }

  /** util: get bezier set from points */
  static bezierSetFromPoints(points) {
    const curve = new THREE.CurvePath();

    // convert
    points.forEach((p1, i) => {
      const j = i + 1;
      if (j === points.length) return;

      // segment end point
      const p2 = points[j];

      // get initial scale
      const cpScale = p1.distanceTo(p2) * 0.5;

      // get normals
      const n = p2.clone().sub(p1).normalize();
      const n1 = new THREE.Vector3();
      const n2 = new THREE.Vector3();
      if (i === 0) {
        const cp1x = Math.abs(p1.z) > Math.abs(p1.x) ? 0 : Math.sign(p1.x) * -1;
        const cp1z = Math.abs(p1.z) > Math.abs(p1.x) ? Math.sign(p1.z) * -1 : 0;
        n1.set(cp1x, 0, cp1z);
      } else {
        n1.copy(p1).sub(points[i - 1]).normalize();
      }
      if (j === points.length - 1) {
        const cp2x = Math.abs(p2.z) > Math.abs(p2.x) ? 0 : Math.sign(p2.x) * -1;
        const cp2z = Math.abs(p2.z) > Math.abs(p2.x) ? Math.sign(p2.z) * -1 : 0;
        n2.set(cp2x, 0, cp2z);
      } else {
        n2.copy(p2).sub(points[j + 1]).normalize();
      }

      // control points -- extrude by sharpness = dot(a,b) -> [-1, 1] -> [1, 0]
      const invN = n.clone().multiplyScalar(-1);
      const dotScale1 = 1 + ((-n.dot(n1) + 1) * 0.5) * 1;
      const dotScale2 = 1 + ((-invN.dot(n2) + 1) * 0.5) * 1;
      const cp1 = p1.clone().add(n1.multiplyScalar(cpScale * dotScale1));
      const cp2 = p2.clone().add(n2.multiplyScalar(cpScale * dotScale2));

      // add bezier curve
      curve.add(new THREE.CubicBezierCurve3(p1, cp1, cp2, p2));
    });

    return curve;
  }
}

export default Path;
