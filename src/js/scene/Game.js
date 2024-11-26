/** Game */

import { SceneNode, EventPlane, Animation } from 'engine';
import * as THREE from 'three';
import Room from './Room';

class Game extends SceneNode {
  constructor() {
    super({label: 'Game'});

    // props
    this.age = 0;
    this.currentSpeed = 1.5;
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

    // axis
    this.group.add(new THREE.AxesHelper());

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this._addToScene(ambientLight, directionalLight);

    // create room
    this.addInitialise(new Room({
      position: new THREE.Vector3(),
      onEnter: room => this.onRoomEnter(room),
      onExit: room => this.onRoomExit(room),
    }));

    // reset player
    this.ref.Player.setPosition(new THREE.Vector3());
  }

  /** on room enter callback */
  onRoomEnter(room) {
    const rooms = room.createAdjoiningRooms();
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
  }

  /** on room exit callback */
  onRoomExit(room) {
    room.animateOutAndDestroy();
  }

  /** on key press -- switch tracks */
  onKeyPress() {
    const room = this.getCurrentRoom();
    console.log('switch track:', room);
  }

  /** get current room */
  getCurrentRoom() {
    const p = this.ref.Player.getPosition();
    for (let i=0; i<this.children.length; i++) {
      const room = this.children[i];
      if (room.isRoom && room.contains(p)) {
        return room;
      }
    }
    return null;
  }

  /** @override */
  _update(delta) {
    // move player
    const room = this.getCurrentRoom();
    if (room) {
      room.movePlayer(delta, this.currentSpeed);
    }

    // set camera
    const c = this.ref.Player.getPosition().clone();
    c.add(new THREE.Vector3(-2.5, 5, 5));
    this.ref.Camera.setPosition(c);
    this.ref.Camera.lookAt(this.ref.Player.getPosition());
  }
}

export default Game;
