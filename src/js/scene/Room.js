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
    this.extent = this.size.clone().multiplyScalar(0.5);
    this.entrances = props.entrances || [ new THREE.Vector3(-this.extent.x, 0, 0) ];
    this.numPaths = Math.max(props.numPaths || 3, this.entrances.length);
    this.playerInRoom = false;
    this.activePath = null;
    this.selectedPathIndex = 0;
    this.hasFocus = false;
    this._active = false;

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
    const geo = new THREE.PlaneGeometry(this.size.x, this.size.z, 5, 5);
    const mat = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, wireframe: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    this.group.add(mesh);
    const geo2 = new THREE.BoxGeometry(this.size.x, 0.5, this.size.z);
    geo2.translate(0, -0.25, 0);
    const mat2 = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, opacity: 0.35 });
    const mesh2 = new THREE.Mesh(geo2, mat2);
    mat2.userData.opacity = 0.35;
    this.group.add(mesh2);

    // box helper
    const boxGeo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const boxMat = new THREE.MeshBasicMaterial({color: 0x0000ff, wireframe: true});
    const box = new THREE.Mesh(boxGeo, boxMat);

    // create path/s
    this.paths = [];
    while (this.paths.length < this.numPaths) {
      this.entrances.forEach(entrance => {
        if (this.paths.length < this.numPaths) {
          this.createPath(entrance);
        }
      });
    }

    // create path marker, ui focus helper
    const markerGeo = new THREE.ConeGeometry(0.25, 1, 32);
    markerGeo.rotateX(Math.PI);
    markerGeo.translate(0, 0.5, 0);
    const markerMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    this.pathMarker = new THREE.Mesh(markerGeo, markerMat);
    this.pathMarker.visible = false;
    const mat3 = new THREE.MeshBasicMaterial({color: 0xffff00, wireframe: true });
    const mesh3 = new THREE.Mesh(geo, mat3);
    mesh3.rotation.x = -Math.PI / 2;
    mesh3.position.y += 0.01;
    this.focusHelper = mesh3;
    this.focusHelper.visible = false;
    this.group.add(this.pathMarker, this.focusHelper);

    // set initial path marker
    this.setPathMarker();

    // activate
    this._active = true;
  }

  /** create path */
  createPath(entrance) {
    // create exit
    const dirs = Room.CARDINAL.filter(dir => !this.isInCardinalDirection(entrance, dir));
    if (dirs.length === 0) {
      console.warn('error', dirs);
      return;
    }
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const exit = dir.clone().multiply(this.extent);
    const max = 0.8;
    const step = 0.2;
    const n = max / step;
    if (dir.x === 0) {
      exit.x += Math.round(n * (Math.random() * 2 - 1)) * step * this.extent.x;
    } else if (dir.z === 0) {
      exit.z += Math.round(n * (Math.random() * 2 - 1)) * step * this.extent.z;
    }

    // create path
    const path = new Path(entrance, exit);
    this.addInitialise(path);
    this.paths.push(path);
  }

  /** util check point is in cardinal direction */
  isInCardinalDirection(point, dir) {
    return dir.x === 0 && point.z === dir.z * this.extent.z ||
      dir.z === 0 && point.x === dir.x * this.extent.x;
  }

  /** increment selected -- exclude invalid */
  incrementPathSelection(entrance) {
    for (let i=0; i<this.paths.length; i++) {
      this.selectedPathIndex = (this.selectedPathIndex + 1) % this.paths.length;
      if (this.paths[this.selectedPathIndex].getEntrance().equals(entrance)) {
        break;
      }
    }
    this.setPathMarker();
  }

  /** set path marker position */
  setPathMarker() {
    if (!this.paths) return;
    const path = this.paths[this.selectedPathIndex];
    this.pathMarker.position.copy(path.getExit());
  }

  /** get current path exit */
  getExit() {
    if (!this.activePath) return null;
    return this.activePath.getExit();
  }

  /** count exits from entrance */
  countExitsFrom(entrance) {
    return this.paths.filter(
      p => p.getEntrance().equals(entrance)).length;
  }

  /** assert has entrance at p */
  hasEntrance(entrance) {
    return this.paths.findIndex(
      p => p.getEntrance().equals(entrance)) !== -1;
  }

  /** get rooms adjoining this */
  createAdjoiningRooms() {
    // get room exits
    const exits = this.paths.map(p => p.getExit().clone());
    const validExit = this.getExit();
    const nextRoomValidEntrance = validExit ? this.getFlippedPosition(validExit) : null;

    // get rooms NESW
    const rooms = [];
    Room.CARDINAL.forEach(dir => {
      const filtered = exits.filter(p => this.isInCardinalDirection(p, dir));
      if (!filtered.length) return;
      const roomPosition = this.position.clone();
      roomPosition.add(dir.clone().multiply(this.size));
      rooms.push(new Room({
        position: roomPosition,
        entrances: filtered.map(p => this.getFlippedPosition(p)),
        validEntrance: nextRoomValidEntrance ? nextRoomValidEntrance.clone() : null,
      }));
    });

    return rooms;
  }

  /** check room is adjacent */
  isAdjacentTo(room) {
    const dx = Math.abs(room.position.x - this.position.x);
    const dz = Math.abs(room.position.z - this.position.z);
    return (
      (dx === 0 && dz === this.extent.z + room.extent.z) ||
      (dz === 0 && dx === this.extent.x + room.extent.z)
    );
  }

  /** get contains point */
  contains(p) {
    return this.box.containsPoint(p);
  }

  /** get room distancet to point */
  distanceTo(p) {
    return this.box.distanceToPoint(p);
  }

  /** assert room active */
  isActive() {
    return this._active;
  }

  /** assert current path dangerous */
  isPathDangerous() {
    return this.activePath && this.activePath.isDangerous();
  }

  /** focus on room, validate entrance */
  focus(entrance, danger=0.5) {
    if (this.hasFocus) return;
    this.hasFocus = true;

    // ensure index set to valid path
    if (!this.paths[this.selectedPathIndex].getEntrance().equals(entrance)) {
      this.incrementPathSelection(entrance);
    }

    // ensure minimum 2 choices
    if (this.countExitsFrom(entrance) < 2) {
      this.createPath(entrance);
      console.log('Creating new path');
    }

    // create dangerous path/s
    const valid = this.paths.filter(p => p.getEntrance().equals(entrance));
    if (valid.length > 1) {
      const safeIndex = Math.floor(Math.random() * valid.length);
      valid.forEach((p, i) => {
        if (i !== safeIndex && Math.random() <= danger) {
          p.makeDangerous();
        }
      });
    }

    // dull invalid paths
    this.paths.forEach(p => {
      if (!p.getEntrance().equals(entrance)) {
        p.makeInactive();
      }
    });

    // show ui elements
    this.focusHelper.visible = true;
    this.pathMarker.visible = true;
  }

  /** blur focus */
  blur() {
    if (!this.hasFocus) return;
    this.hasFocus = false;

    // hide ui elements
    this.focusHelper.visible = false;
    this.pathMarker.visible = false;
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
        // this.group.position.y = this.position.y - (1-t) * 0.5;
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
    if (!this._active) return;
    this._active = false;

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

  /** util: get flipped position across cardinal axes */
  getFlippedPosition(p) {
    const flipped = p.clone();
    if (Math.abs(p.z) === this.extent.z) flipped.z *= -1;
    if (Math.abs(p.x) === this.extent.x) flipped.x *= -1;
    return flipped;
  }
}

export default Room;
