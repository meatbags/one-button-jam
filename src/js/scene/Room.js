/** Room */

import { SceneNode, Animation } from 'engine';
import * as THREE from 'three';
import Path from './Path';

class Room extends SceneNode {
  static NUM_ROOMS = 1;
  static DEFAULT_SIZE = 4;
  static CARDINAL = [
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0)
  ];

  constructor(props={}) {
    super({ label: 'Room_' + Room.NUM_ROOMS });
    this.isRoom = true;
    Room.NUM_ROOMS += 1;

    // props
    this.position = props.position || new THREE.Vector3();
    this.size = props.size || new THREE.Vector3().setScalar(Room.DEFAULT_SIZE);
    this.entrances = props.entrances || [ new THREE.Vector3(-this.size.x/2, 0, 0) ];
    this.numPaths = props.numPaths || 1;
    this.playerInRoom = false;
    this.activePath = null;
    this.selectedPathIndex = 0;

    // callbacks
    this.onEnter = props.onEnter ? props.onEnter : null;
    this.onExit = props.onExit ? props.onExit : null;
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Player = this._getModule('Player');

    // get box
    this.box = new THREE.Box3().setFromCenterAndSize(this.position, this.size);

    // group
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this._addToScene(this.group);

    // create floor
    const geo = new THREE.PlaneGeometry(this.size.x, this.size.z, 2, 2);
    const mat = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, wireframe: true});
    const mat2 = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, opacity: 0.5});
    mat2.userData.opacity = 0.5;
    const mesh = new THREE.Mesh(geo, mat);
    const mesh2 = new THREE.Mesh(geo, mat2);
    mesh.rotation.x = -Math.PI / 2;
    mesh2.rotation.x = -Math.PI / 2;
    this.group.add(mesh, mesh2);

    // box helper
    const boxGeo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const boxMat = new THREE.MeshBasicMaterial({color: 0x0000ff, wireframe: true});
    const box = new THREE.Mesh(boxGeo, boxMat);

    // create path/s
    this.paths = [];
    this.entrances.forEach(entrance => {
      const exit = this.getExit(entrance);
      const path = new Path(entrance, exit);
      this.addInitialise(path);
      this.paths.push(path);

      if (Math.random() > 0.5 && this.paths.length < 3) {
        const entrance2 = entrance.clone();
        const exit2 = this.getExit(entrance2);
        const path2 = new Path(entrance2, exit2);
        this.addInitialise(path2);
        this.paths.push(path2);
      }
    });

    // create path marker
    const markerGeo = new THREE.ConeGeometry(0.25, 1, 32);
    markerGeo.rotateX(Math.PI);
    markerGeo.translate(0, 0.5, 0);
    const markerMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    this.pathMarker = new THREE.Mesh(markerGeo, markerMat);
    this.group.add(this.pathMarker);
    this.setPathMarker();
  }

  /** get exit for entrance */
  getExit(entrance) {
    const dirs = Room.CARDINAL.filter(dir => !this.isInCardinalDirection(entrance, dir));
    if (dirs.length === 0) {
      console.warn('error', dirs);
      return;
    }
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const base = dir.clone().multiply(this.size).multiplyScalar(0.5);
    if (dir.x === 0) {
      base.x += (Math.random() * 2 - 1) * this.size.x * 0.45;
    } else if (dir.z === 0) {
      base.z += (Math.random() * 2 - 1) * this.size.z * 0.45;
    }
    return base;
  }

  /** util check point is in cardinal direction */
  isInCardinalDirection(point, dir) {
    return dir.x === 0 && point.z === dir.z * this.size.z * 0.5 ||
      dir.z === 0 && point.x === dir.x * this.size.x * 0.5;
  }

  /** increment selected path */
  incrementPathSelection() {
    this.selectedPathIndex = (this.selectedPathIndex + 1) % this.paths.length;
    this.setPathMarker();
  }

  /** set path marker position */
  setPathMarker() {
    if (!this.paths) return;
    const path = this.paths[this.selectedPathIndex];
    this.pathMarker.position.copy(path.getExit());
  }

  /** get rooms adjoining this */
  createAdjoiningRooms() {
    // get room exits
    const exits = this.paths.map(p => p.getExit().clone());

    // get rooms NESW
    const rooms = [];
    Room.CARDINAL.forEach(dir => {
      const filtered = exits.filter(p => this.isInCardinalDirection(p, dir));
      if (!filtered.length) return;
      const position = this.position.clone().add(dir.clone().multiply(this.size));
      rooms.push(new Room({
        position: position,
        entrances: filtered.map(p => {
          const p1 = p.clone();
          if (dir.x === 0) p1.z *= -1;
          if (dir.z === 0) p1.x *= -1;
          return p1;
        }),
      }));
    });

    return rooms;
  }

  /** get contains point */
  contains(p) {
    return !this._willDestroy && this.box.containsPoint(p);
  }

  /** move player in room */
  movePlayer(delta, speed) {
    // enter room
    if (!this.playerInRoom) {
      this.playerInRoom = true;
      this.activePath = this.paths[this.selectedPathIndex];
      if (this.onEnter) {
        this.onEnter(this);
      }
    }

    // move player
    const p = this.ref.Player.getPosition().clone();
    p.x -= this.position.x;
    p.z -= this.position.z;
    this.activePath.movePosition(p, delta, speed);
    p.x += this.position.x;
    p.z += this.position.z;
    this.ref.Player.setPosition(p);

    // exit room
    if (!this.contains(p)) {
      if (this.onExit) {
        this.onExit(this);
      }
    }
  }

  /** animate in */
  animateIn() {
    if (this._animateInLock) return;
    this._animateInLock = true;

    // animate in
    const y = this.position.y;
    this.add(new Animation({
      duration: 0.5,
      easing: Animation.EASING_OUT,
      callback: t => {
        this.group.position.y = this.position.y - (1-t) * 0.5;
        this.group.children.forEach(child => {
          if (child.material) {
            child.material.opacity = t * (child.material.userData.opacity || 1);
          }
        });
      },
    }));
  }

  /** animate out and destroy */
  animateOutAndDestroy() {
    if (this._willDestroy) return;
    this._willDestroy = true;

    // animate down
    const y = this.position.y;
    this.add(new Animation({
      duration: 2,
      easing: Animation.EASING_IN,
      callback: t => {
        this.group.position.y = this.position.y - t * 5.0;
        this.group.children.forEach(child => {
          if (child.material) {
            child.material.opacity = (1 - t) * (child.material.userData.opacity || 1);
          }
        });
      },
      onEnd: () => {
        setTimeout(() => {
          this.destroy();
        }, 50);
      }
    }));
  }
}

export default Room;
