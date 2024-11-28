/** Game */

import { SceneNode, EventPlane, BlendVector3, UIElement, Animation } from 'engine';
import * as THREE from 'three';
import GameOverlay from './GameOverlay';
import Room from './Room';
import Path from './Path';

class Game extends SceneNode {
  static PLAYER_RADIUS = 0.2;
  static PATHS_INITIAL = 2;
  static SPEED_INITIAL = 1.5;
  static ZOOM_INITIAL = 1;
  static ZOOM_INCREMENT = 0.75;

  constructor() {
    super({label: 'Game'});

    // props
    this.age = 0;
    this.score = 0;
    this.numPaths = Game.PATHS_INITIAL;
    this.currentSpeed = Game.SPEED_INITIAL;
    this.zoom = Game.ZOOM_INITIAL;
    this.currentRoom = null;
    this.nextRoom = null;
    this._active = false;

    // add overlay
    this.add(new GameOverlay({
      onStageChange: n => this.onStageChange(n),
      onComplete: () => this.onComplete(),
    }));
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Player = this._getModule('Player');
    this.ref.Camera = this._getModule('Camera');
    this.ref.UserInterface = this._getModule('UserInterface');

    // on keyboard
    this.ref.UserInterface.addEventListener('key', k => {
      if (k.isKeyDown('e') && !this._getModule('MainLoop').isPaused()) {
        this.onKeyPress();
      }
    });

    // group
    this.group = new THREE.Group();
    this._addToScene(this.group);

    // floor
    /*
    this.distantFloor = new THREE.Mesh(
      new THREE.BoxGeometry(100, 1, 100),
      new THREE.MeshPhysicalMaterial({color:0x406659})
    );
    this.distantFloor.position.y = -3;
    this.distantFloor.receiveShadow = true;
    this.group.add(this.distantFloor);
    */

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

    // create room
    this.addInitialise(new Room({
      position: new THREE.Vector3(),
      onEnter: room => this.onRoomEnter(room),
      onExit: room => this.onRoomExit(room),
    }));

    // reset player
    this.ref.Player.setPosition(new THREE.Vector3());

    // camera helpers
    this.cameraTarget = new THREE.Vector3();
    this.cameraOffset = new THREE.Vector3(-2.5, 5, 5);
    this.cameraPosition = new THREE.Vector3();

    // create ball
    const playerGeo = new THREE.SphereGeometry(Game.PLAYER_RADIUS, 32, 32);
    playerGeo.translate(0, Game.PLAYER_RADIUS + Path.VERTICAL_OFFSET, 0);
    const playerMat = new THREE.MeshPhysicalMaterial({ color: 0x444444, metalness: 1.0, roughness: 0.2, });
    playerMat.envMap = this._getModule('Environment').getTexture('envMap');
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.playerMesh.castShadow = true;
    this._addToScene(this.playerMesh);

    // add DEV log
    const dev = this._getModule('Dev');
    dev.addStat('Current room', () => this.currentRoom ? this.currentRoom.id : 'null');
    dev.addStat('Next room', () => this.nextRoom ? this.nextRoom.id : 'null');
  }

  /** on stage changed */
  onStageChange(n) {
    console.log('STAGE:', n);
    switch (n) {
      case 1:
        this.numPaths = Game.PATHS_INITIAL;
        this.currentSpeed = Game.SPEED_INITIAL;
        this.zoom = Game.ZOOM_INITIAL;
        break;
      case 2:
        this.numPaths = 3;
        this.currentSpeed = 2;
        this.zoom = 12/(12 + (n-1) * Game.ZOOM_INCREMENT);
        break;
      case 3:
        this.numPaths = 4;
        this.currentSpeed = 2.5;
        this.zoom = 12/(12 + (n-1) * Game.ZOOM_INCREMENT);
        break;
      case 4:
        this.numPaths = 5;
        this.currentSpeed = 3;
        this.zoom = 12/(12 + (n-1) * Game.ZOOM_INCREMENT);
        break;
      case 5:
        this.numPaths = 6;
        this.currentSpeed = 3.5;
        this.zoom = 12/(12 + (n-1) * Game.ZOOM_INCREMENT);
        break;
      default:
        break;
    }

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

  /** on game completed */
  onComplete() {
    console.log('Complete!');
  }

  /** on room enter callback */
  onRoomEnter(room) {
    // set current room
    this.currentRoom = room;

    // create exit room/s
    const numPaths = Math.floor(this.numPaths);
    const rooms = this.currentRoom.createAdjoiningRooms(numPaths);
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

    // update stats
    this.score += this.currentRoom.isPathDangerous() ? -1 : 0;
  }

  /** on room exit callback */
  onRoomExit(room) {
    room.animateOutAndDestroy();
  }

  /** on key press -- switch tracks */
  onKeyPress() {
    if (!this._active) return;
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

  /** activate room */
  activate() {
    this._active = true;
  }

  /** @override */
  _update(delta) {
    // set age
    this.age += delta;

    // move player
    const room = this.getCurrentRoom();
    if (room) {
      room.movePlayer(delta, this.currentSpeed);
    }

    // set player mesh position
    const target = this.ref.Player.getPosition().clone();
    this.playerMesh.position.copy(target);

    // set directional light position
    this.directionalLight.target.position.copy(target)
    this.directionalLight.position.copy(target).add(this.directionalLightOffset);

    // set camera
    if (this.nextRoom) {
      // BlendVector3(target, v, 1);
    }
    this.cameraTarget.x += (target.x - this.cameraTarget.x) * 0.2;
    this.cameraTarget.y += (target.y - this.cameraTarget.y) * 0.2;
    this.cameraTarget.z += (target.z - this.cameraTarget.z) * 0.2;
    this.cameraPosition.copy(this.cameraTarget).add(this.cameraOffset);
    this.ref.Camera.setPosition(this.cameraPosition);
    this.ref.Camera.lookAt(this.cameraTarget);

    // distant floor
    //this.distantFloor.position.x = target.x;
    //this.distantFloor.position.z = target.z;
  }
}

export default Game;
