/** Game */

import { SceneNode, EventPlane, Blend, Clamp, BlendVector3, UIElement, Animation, MinAngleBetween } from 'engine';
import * as THREE from 'three';
import Room from './Room';
import Path from './Path';

class Game extends SceneNode {
  static PLAYER_RADIUS = 0.2;
  static PATHS_INITIAL = 2;
  static PATHS_INCREMENT = 1;
  static SPEED_INITIAL = 1.5;
  static SPEED_INCREMENT = 0.375;
  static SCORE_INITIAL = 5;
  static ZOOM_INCREMENT = 0.75;
  static CAMERA_OFFSET = new THREE.Vector3(-5, 7.5, 5);
  static STATE_HOLDING = 0x1;
  static STATE_GAME = 0x2;
  static STATE_DEAD = 0x3;
  static STATE_SUCCESS = 0x4;
  static PLAYER_RGB = [0.26, 0.26, 0.26];
  static PLAYER_RGB_ALT = [1, 0, 0];

  constructor() {
    super({label: 'Game'});

    // props
    this.age = 0;
    this.score = Game.SCORE_INITIAL;
    this.numPaths = Game.PATHS_INITIAL;
    this.currentSpeed = Game.SPEED_INITIAL;
    this.speedDeathMod = 0;
    this.zoom = Game.ZOOM_INITIAL;
    this.currentState = null;
    this.currentRoom = null;
    this.nextRoom = null;
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Player = this._getModule('Player');
    this.ref.Camera = this._getModule('Camera');

    // group
    this.group = new THREE.Group();
    this._addToScene(this.group);

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.left = -10;
    this.directionalLight.shadow.camera.right = 10;
    this.directionalLight.shadow.camera.top = 10;
    this.directionalLight.shadow.camera.bottom = -10;
    this.directionalLight.shadow.camera.near = 0.05;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.radius = 12;
    this.directionalLightOffset = new THREE.Vector3(10, 10, 10);
    this.directionalLight.position.copy(this.directionalLightOffset);
    this._addToScene(ambientLight, this.directionalLight, this.directionalLight.target);

    // create player ball
    const playerGeo = new THREE.SphereGeometry(Game.PLAYER_RADIUS, 32, 32);
    playerGeo.translate(0, Game.PLAYER_RADIUS + Path.VERTICAL_OFFSET, 0);
    const playerMat = new THREE.MeshPhysicalMaterial({
      color: 0x444444, metalness: 1.0, roughness: 0.2, });
    playerMat.envMap = this._getModule('Environment').getTexture('envMap');
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.playerMeshPositionPrevious = new THREE.Vector3();
    this.playerMesh.castShadow = true;
    this._addToScene(this.playerMesh);

    // camera helpers
    this.cameraTarget = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3();

    // set initial state
    this.reset();
  }

  /** reset game */
  reset() {
    // clear children
    for (let i=this.children.length-1; i>=0; i--) {
      this.children[i].destroy();
    }

    // reset props
    this.age = 0;
    this.score = Game.SCORE_INITIAL;
    this.numPaths = Game.PATHS_INITIAL;
    this.currentSpeed = Game.SPEED_INITIAL;
    this.speedDeathMod = 0;
    this.zoom = Game.ZOOM_INITIAL;
    this.currentRoom = null;
    this.nextRoom = null;
    this.setGameState(Game.STATE_HOLDING);

    // create initial room
    this.addInitialise(new Room({
      position: new THREE.Vector3(),
      onEnter: room => this.onRoomEnter(room),
      onExit: room => this.onRoomExit(room),
    }));

    // reset player position, mesh, light, camera
    const origin = new THREE.Vector3();
    this.ref.Player.setPosition(origin);
    this.cameraTarget.copy(origin)
    this.setPositions();
  }

  /** on stage changed */
  onStageChange(n) {
    // stage [1,5] index [0,4]
    const index = n - 1;

    // set numpaths, speed, zoom
    this.numPaths = Game.PATHS_INITIAL + index * Game.PATHS_INCREMENT;
    this.currentSpeed = Game.SPEED_INITIAL + index * Game.SPEED_INCREMENT;
    this.zoom = 12.5/(12.5 + index * Game.ZOOM_INCREMENT);

    // zoom out camera
    const camera = this._getModule('Camera');
    const zoom = camera.getCamera().zoom;
    this.add(new Animation({
      duration: 1.5,
      easing: Animation.EASING_IN_OUT,
      callback: t => {
        const z = zoom + (this.zoom - zoom) * t;
        camera.setCamera('zoom', z);
      }
    }));
  }

  /** on room enter callback */
  onRoomEnter(room) {
    // set current room
    this.currentRoom = room;

    // create exit room/s
    const numPaths = Math.floor(this.numPaths);

    // get rooms
    let rooms = null;
    if (this.currentState === Game.STATE_HOLDING) {
      rooms = this.currentRoom.createRestRoom();
    } else {
      rooms = this.currentRoom.createAdjoiningRooms(numPaths);
    }

    const currentRooms = this.children.filter(child => child.isRoom);
    rooms.forEach(room => {
      room.onEnter = room => this.onRoomEnter(room);
      room.onExit = room => this.onRoomExit(room);
      this.addInitialise(room);

      // animate room in
      room.animateIn();

      // prevent doubling
      currentRooms.forEach(current => {
        if (room.contains(current.position)) {
          current.animateOutAndDestroy();
        }
      });
    });

    // get next room, set focus
    const exit = this.currentRoom.getExit().clone();
    const entrance = this.currentRoom.getFlippedPosition(exit);
    this.nextRoom = this.children.find(child => (
      child.isRoom &&
      child.id !== this.currentRoom.id &&
      child.isActive() &&
      child.hasEntrance(entrance) &&
      child.isAdjacentTo(this.currentRoom)
    ));
    this.children.forEach(child => {
      if (!child.isRoom) return;
      if (this.nextRoom && child.id === this.nextRoom.id) {
        child.focus(entrance);
      } else {
        child.blur();
      }
    });
  }

  /** on room exit callback */
  onRoomExit(room) {
    // check hit rubble
    if (room.isPathDangerous()) {
      this.score -= 1;

      // change player colour
      const blendFrom = 1 - ((this.score + 1) / Game.SCORE_INITIAL);
      const blendTo = 1 - (this.score / Game.SCORE_INITIAL);
      this.add(new Animation({
        duration: 0.5,
        callback: t => {
          const blend = blendFrom + (blendTo - blendFrom) * t;
          this.setPlayerMaterial(blend);
        }
      }));

      // warning animation
      this.createDeathAnimation(true);
    }

    room.animateOutAndDestroy();
  }

  /** on key press -- switch tracks */
  onKeyDown() {
    if (this.nextRoom && this.currentRoom) {
      const entrance = this.currentRoom.getFlippedPosition(
        this.currentRoom.getExit());
      this.nextRoom.incrementPathSelection(entrance);
    }
  }

  /** get current room */
  getCurrentRoom() {
    // container room
    const p = this.ref.Player.getPosition();
    for (let i=0; i<this.children.length; i++) {
      const room = this.children[i];
      if (room.isRoom && room.isActive() && room.contains(p)) {
        return room;
      }
    }

    // fallback
    return this.getNearestRoom();
  }

  /** get nearest room */
  getNearestRoom() {
    const p = this.ref.Player.getPosition();
    let d = -1;
    let room = null;
    this.children.forEach(child => {
      if (!child.isRoom || !child.isActive()) return;
      const dist = child.distanceTo(p);
      if (room === null || dist < d) {
        room = child;
        d = dist;
      }
    });
    return room;
  }

  /** set game state */
  setGameState(state) {
    if (this.currentState === state) {
      return;
    }
    this.currentState = state;
    switch (this.currentState) {
      case Game.STATE_DEAD:
        this.playerMesh.visible = false;
        this.createDeathAnimation();
        break;
      default:
        this.setPlayerMaterial(0);
        this.playerMesh.visible = true;
        break;
    }
  }

  /** set player material */
  setPlayerMaterial(blend) {
    blend = Clamp(blend, 0, 1);
    const r = Blend(Game.PLAYER_RGB[0], Game.PLAYER_RGB_ALT[0], blend);
    const g = Blend(Game.PLAYER_RGB[1], Game.PLAYER_RGB_ALT[1], blend);
    const b = Blend(Game.PLAYER_RGB[2], Game.PLAYER_RGB_ALT[2], blend);
    this.playerMesh.material.color.setRGB(r, g, b);
    this.playerMesh.material.metalness = Blend(1.0, 0.5, blend);
    this.playerMesh.material.roughness = Blend(0.2, 0.6, blend);
  }

  /** set player, light, camera */
  setPositions() {
    // set previous
    this.playerMeshPositionPrevious.copy(this.playerMesh.position);

    // set new playermesh position
    const target = this.ref.Player.getPosition().clone();
    this.playerMesh.position.copy(target);

    // set directional light position
    this.directionalLight.target.position.copy(target)
    this.directionalLight.position.copy(target).add(this.directionalLightOffset);

    // set camera
    this.cameraTarget.x += (target.x - this.cameraTarget.x) * 0.2;
    this.cameraTarget.y += (target.y - this.cameraTarget.y) * 0.2;
    this.cameraTarget.z += (target.z - this.cameraTarget.z) * 0.2;
    this.cameraPosition.copy(this.cameraTarget).add(Game.CAMERA_OFFSET);
    this.ref.Camera.setPosition(this.cameraPosition);
    this.ref.Camera.lookAt(this.cameraTarget);
  }

  /** create speed effect */
  createSpeedParticles() {
    const vec = this.playerMeshPositionPrevious.clone()
      .sub(this.playerMesh.position).normalize();

    const mat = this.playerMesh.material.clone();
    const g = new THREE.Group();
    const meshes = [];
    const r = () => Math.random() * 2 - 1;
    for (let i=0; i<1; i++) {
      const rad = Game.PLAYER_RADIUS * 0.5 * Math.random() + 0.01;
      const maxOff = Game.PLAYER_RADIUS - rad;
      const sphere = new THREE.SphereGeometry(rad, 12, 12);
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.userData.v = vec;//new THREE.Vector3(r(), r(), r()).normalize();
      mesh.userData.p = new THREE.Vector3(r(), r(), r())
        .normalize().multiplyScalar(maxOff);
      mesh.userData.speed = 0.125 + Math.random() * 0.25;
      g.add(mesh);
      meshes.push(mesh);
    }
    g.position.copy(this.playerMesh.position);
    g.position.y += Game.PLAYER_RADIUS + Path.VERTICAL_OFFSET;
    this.group.add(g);

    // animate
    this.add(new Animation({
      duration: 1,
      callback: t => {
        meshes.forEach(mesh => {
          const u = mesh.userData;
          mesh.position.x = u.p.x + u.v.x * u.speed * t;
          mesh.position.y = u.p.y + u.v.y * u.speed * t;
          mesh.position.z = u.p.z + u.v.z * u.speed * t;
          mesh.scale.setScalar(Math.max(0.01, 1 - t));
        });
      },
      onEnd: () => {
        this.group.remove(g);
      }
    }));
  }

  /** death animation */
  createDeathAnimation(warning=false) {
    // warning animation
    const n = warning ? 10 : 40;

    // create meshes
    const mat = this.playerMesh.material.clone();
    const g = new THREE.Group();
    const meshes = [];
    const r = () => Math.random() * 2 - 1;
    for (let i=0; i<n; i++) {
      const size = Game.PLAYER_RADIUS * 0.5 * Math.random() + 0.01;
      const sphere = new THREE.SphereGeometry(size, 12, 12);
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.userData.v = new THREE.Vector3(r(), r(), r()).normalize();
      mesh.userData.p = new THREE.Vector3();
      mesh.userData.speed = 1 + Math.random() * 3;
      g.add(mesh);
      meshes.push(mesh);
    }
    g.position.copy(this.playerMesh.position);
    g.position.y += Game.PLAYER_RADIUS + Path.VERTICAL_OFFSET;
    this.group.add(g);

    // animate
    this.add(new Animation({
      duration: 1,
      callback: t => {
        meshes.forEach(mesh => {
          const u = mesh.userData;
          mesh.position.x = u.p.x + u.v.x * u.speed * t;
          mesh.position.y = u.p.y + u.v.y * u.speed * t;
          mesh.position.z = u.p.z + u.v.z * u.speed * t;
          mesh.scale.setScalar(Math.max(0.01, 1 - t));
        });
      },
      onEnd: () => {
        this.group.remove(g);
      }
    }));
  }

  /** @override */
  _update(delta) {
    // set age
    this.age += delta;

    // slow down on death
    if (this.currentState === Game.STATE_DEAD) {
      this.speedDeathMod += (1 - this.speedDeathMod) * 0.01;
      if (this.speedDeathMod > 0.99) {
        this.speedDeathMod = 1;
      }
    }

    // move player
    const room = this.getCurrentRoom();
    if (room) {
      room.movePlayer(delta, this.currentSpeed * (1 - this.speedDeathMod));
    }

    // set positions
    this.setPositions();

    // particle effects
    if (this.currentState !== Game.STATE_DEAD) {
      if (Math.random() > 0.95) {
        this.createSpeedParticles();
      }
    }
  }
}

export default Game;
