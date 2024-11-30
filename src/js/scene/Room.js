/** Room */

import { SceneNode, Animation } from 'engine';
import * as THREE from 'three';
import Path from './Path';

class Room extends SceneNode {
  static ROOM_UID = 1;
  static DEFAULT_SIZE = 4.25;
  static ROOM_HEX = 0x87d0b7;
  static ROOM_HEX_FOCUS = 0x87d0b7;
  static EXIT_OFFSET_MIN = 0.2;
  static EXIT_OFFSET_MAX = 0.8;
  static EXIT_OFFSET_STEP = 0.2;
  static FLOOR_SCALE = 0.925;
  static CARDINAL = [
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0)
  ];

  constructor(props={}) {
    super({ label: 'Room_' + (++Room.ROOM_UID) });
    this.isRoom = true;

    // props
    this.position = props.position || new THREE.Vector3();
    this.size = props.size || new THREE.Vector3().setScalar(Room.DEFAULT_SIZE);
    this.extent = this.size.clone().multiplyScalar(0.5);
    this.entrances = props.entrances || [ new THREE.Vector3(-this.extent.x, 0, 0) ];
    this.validEntrance = props.validEntrance || this.entrances[0];
    this.numPaths = Math.max(props.numPaths || 1, this.entrances.length);
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

    // create floor block
    const geo2 = new THREE.BoxGeometry(this.size.x, 0.5, this.size.z);
    geo2.translate(0, -0.25, 0);
    const mat2 = new THREE.MeshPhysicalMaterial({
      color: Room.ROOM_HEX,
      transparent: true,
      envMap: this._getModule('Environment').getTexture('envMap')
    });
    this.floorMesh = new THREE.Mesh(geo2, mat2);
    this.floorMesh.receiveShadow = true;
    this.floorMesh.castShadow = true;
    this.floorMesh.scale.set(Room.FLOOR_SCALE, 1, Room.FLOOR_SCALE);
    this.group.add(this.floorMesh);

    // create valid path/s
    this.paths = [];
    for (let i=0; i<this.numPaths; i++) {
      this.createPath(this.validEntrance);
    }

    // get clockwise distance on perimeter
    const corners = Room.CARDINAL.map(dir => {
      const p = new THREE.Vector3().copy(dir).multiply(this.extent)
        .add(new THREE.Vector3(-dir.z, 0, dir.x).multiply(this.extent));
      return p;
    });
    const cardinalIndex = Room.CARDINAL.findIndex(dir =>
      this.isInCardinalDirection(this.validEntrance, dir));

    const getClockwiseDistance = path => {
      const exit = path.getExit();
      let dist = 0;
      for (let i=0; i<Room.CARDINAL.length-1; i++) {
        const dirIndex = (cardinalIndex + i + 1) % Room.CARDINAL.length;
        const cornerIndex = (cardinalIndex + i) % Room.CARDINAL.length;
        const dir = Room.CARDINAL[dirIndex];
        const corner = corners[cornerIndex];
        if (this.isInCardinalDirection(exit, dir)) {
          dist += corner.distanceTo(exit);
          break;
        } else {
          dist += dir.x === 0 ? this.size.x : this.size.z;
        }
      }
      return dist;
    };

    // sort paths clockwise
    this.paths = this.paths.sort(
      (a, b) => getClockwiseDistance(a) - getClockwiseDistance(b));

    // select random path
    this.selectedPathIndex = Math.floor(Math.random() * this.paths.length);

    // set active path
    this.activePath = this.paths[this.selectedPathIndex];

    // create path marker, smaller path marker
    const markerGeo = new THREE.ConeGeometry(0.25, 1, 32);
    markerGeo.rotateX(Math.PI);
    markerGeo.translate(0, 0.5, 0);
    const markerMat = new THREE.MeshPhysicalMaterial({
      color: 0xffff00,
      envMap: this._getModule('Environment').getTexture('envMap')
    });
    this.pathMarkerMesh = new THREE.Mesh(markerGeo, markerMat);
    // this.pathMarkerMesh.castShadow = true;
    this.pathMarker = new THREE.Group();
    this.pathMarker.visible = false;
    this.pathMarker.add(this.pathMarkerMesh);
    const markerGeo2 = new THREE.ConeGeometry(0.25, 1, 32);
    markerGeo2.rotateX(Math.PI);
    markerGeo2.translate(0, 0.5, 0);
    const markerMat2 = new THREE.MeshPhysicalMaterial({
      color: 0xffff00,
      envMap: this._getModule('Environment').getTexture('envMap')
    });
    this.pathMarkerMesh2 = new THREE.Mesh(markerGeo, markerMat);
    this.pathMarkerMesh2.scale.setScalar(0.4);
    this.pathMarker2 = new THREE.Group();
    this.pathMarker2.visible = false;
    this.pathMarker2.add(this.pathMarkerMesh2);

    // add to group
    this.group.add(this.pathMarker, this.pathMarker2);

    // set initial path marker
    this.setPathMarker();

    // activate
    this._active = true;
  }

  /** create path */
  createPath(entrance) {
    // create exit/s
    if (!this.availableExits) {
      this.availableExits = [];
      Room.CARDINAL.forEach(dir => {
        if (!this.isInCardinalDirection(entrance, dir)) {
          for (let d=Room.EXIT_OFFSET_MIN; d<=Room.EXIT_OFFSET_MAX; d+= Room.EXIT_OFFSET_STEP) {
            const exit = dir.clone().multiply(this.extent);
            if (dir.x === 0) {
              exit.x = -this.extent.x + d * this.size.x;
            } else if (dir.z === 0) {
              exit.z = -this.extent.z + d * this.size.z;
            }
            this.availableExits.push(exit)
          }
        }
      });
    }

    // no exits
    if (!this.availableExits.length) {
      return;
    }

    // get random exit, remove
    const index = Math.floor(Math.random() * this.availableExits.length);
    const exit = this.availableExits.splice(index, 1)[0];

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

    // set marker
    const path = this.paths[this.selectedPathIndex];
    this.pathMarker.position.copy(path.getExit());
    this.pathMarker.position.y += Path.VERTICAL_OFFSET;

    // set marker 2
    if (this.paths.length > 1) {
      const path2 = this.paths[(this.selectedPathIndex + 1) % this.paths.length];
      this.pathMarker2.position.copy(path2.getExit());
      this.pathMarker2.position.y += Path.VERTICAL_OFFSET;
    }

    this.paths.forEach(p => {
      if (p.id !== path.id) {
        p.blur();
      }
    });
    path.focus();
  }

  /** get current path exit */
  getExit() {
    if (!this.activePath) return null;
    return this.activePath.getExit();
  }

  /** get entrance */
  getEntrance() {
    return this.validEntrance;
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
  createAdjoiningRooms(numPaths) {
    // get room exits
    const exits = this.paths.map(p => p.getExit().clone());
    const validExit = this.getExit();
    const nextValidEntrance = validExit ? this.getFlippedPosition(validExit) : null;

    // get rooms NESW
    const rooms = [];
    Room.CARDINAL.forEach(dir => {
      if (!this.isInCardinalDirection(validExit, dir)) {
        return;
      }
      const filtered = exits.filter(p => this.isInCardinalDirection(p, dir));
      if (!filtered.length) {
        console.warn('No exit rooms found:', this);
        return;
      }
      const roomPosition = this.position.clone();
      roomPosition.add(dir.clone().multiply(this.size));
      rooms.push(new Room({
        position: roomPosition,
        entrances: filtered.map(p => this.getFlippedPosition(p)),
        validEntrance: nextValidEntrance ? nextValidEntrance.clone() : null,
        numPaths: numPaths,
      }));
    });

    return rooms;
  }

  /** create rest room -- one path */
  createRestRoom() {
    const validExit = this.getExit();
    const nextValidEntrance = this.getFlippedPosition(validExit).clone();
    const dir = Room.CARDINAL.find(dir => this.isInCardinalDirection(validExit, dir));
    const roomPosition = this.position.clone();
    roomPosition.add(dir.clone().multiply(this.size));
    const rooms = [
      new Room({
        position: roomPosition,
        entrances: [nextValidEntrance],
        validEntrance: nextValidEntrance,
        numPaths: 1,
      })
    ];
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
  focus(entrance) {
    if (this.hasFocus) return;
    this.hasFocus = true;

    // ensure index set to valid path
    if (!this.paths[this.selectedPathIndex].getEntrance().equals(entrance)) {
      this.incrementPathSelection(entrance);
    }

    // create dangerous path/s
    const valid = this.paths.filter(p => p.getEntrance().equals(entrance));
    if (valid.length >= 2) {
      const n = 1 + (valid.length > 2 ? Math.floor(Math.random() * (valid.length - 1)) : 0);
      for (let i=0; i<n; i++) {
        const index = Math.floor(Math.random() * valid.length);
        valid[index].makeDangerous();
        valid.splice(index, 1);
      }
    }

    // show ui elements
    // this.focusHelper.visible = true;
    this.floorMesh.material.color.setHex(Room.ROOM_HEX_FOCUS);
    this.pathMarker.visible = true;
    if (this.paths.length > 1) {
      this.pathMarker2.visible = true;
    }
  }

  /** blur focus */
  blur() {
    if (!this.hasFocus) return;
    this.hasFocus = false;

    // hide ui elements
    // this.focusHelper.visible = false;
    this.floorMesh.material.color.setHex(Room.ROOM_HEX);
    this.pathMarker.visible = false;
    this.pathMarker2.visible = false;

    // diminish path intensity
    if (this.activePath) {
      this.activePath.onParentBlur();
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
    const inPath = this.activePath.movePosition(p, delta, speed);
    p.x += this.position.x;
    p.z += this.position.z;
    this.ref.Player.setPosition(p);

    // exit room
    if (!inPath) {
      if (this.onExit) {
        this.onExit(this);
      }
    }
  }

  /** util: get flipped position across centre line */
  getFlippedPosition(p) {
    const flipped = p.clone();
    if (Math.abs(p.z) === this.extent.z) flipped.z *= -1;
    if (Math.abs(p.x) === this.extent.x) flipped.x *= -1;
    return flipped;
  }

  /** @override */
  _update(delta) {
    if (!this.hasFocus) return;
    if (!this.pathMarkerMesh.userData.age) {
      this.pathMarkerMesh.userData.age = 0;
      this.pathMarkerMesh2.userData.age = 0;
    }
    this.pathMarkerMesh.userData.age += delta;
    this.pathMarkerMesh2.userData.age += delta;
    this.pathMarkerMesh.position.y = Math.sin(this.pathMarkerMesh.userData.age * 0.5 * Math.PI * 2) * 0.25 + 0.25;
    this.pathMarkerMesh2.position.y = Math.sin(this.pathMarkerMesh2.userData.age * 0.5 * Math.PI * 2) * 0.125 + 0.25;
  }
}

export default Room;
