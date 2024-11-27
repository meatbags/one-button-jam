/** Game */

import { SceneNode, EventPlane, BlendVector3, UIElement } from 'engine';
import * as THREE from 'three';
import Room from './Room';

class Game extends SceneNode {
  constructor() {
    super({label: 'Game'});

    // props
    this.age = 0;
    this.score = 0;
    this.speedIncreasePerRoom = 0.05;
    this.speedMax = 2.5;
    this.currentSpeed = 1;
    this.currentRoom = null;
    this.nextRoom = null;
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

    // camera helpers
    this.cameraTarget = new THREE.Vector3();
    this.cameraOffset = new THREE.Vector3(-2.5, 5, 5);
    this.cameraPosition = new THREE.Vector3();

    // create UI
    const ui = new UIElement({
      element: {
        class: 'game',
        children: {
          class: 'game__inner',
          children: [{
            class: 'game__item',
            children: [{
              class: 'game__item-label',
              innerHTML: 'Time:',
            }, {
              class: 'game__item-value',
              dataset: {
                id: 'time'
              }
            }]
          }, {
            class: 'game__item',
            children: [{
              class: 'game__item-label',
              innerHTML: 'Speed:',
            }, {
              class: 'game__item-value',
              dataset: {
                id: 'speed'
              }
            }]
          }, {
            class: 'game__item',
            children: [{
              class: 'game__item-label',
              innerHTML: 'Score:',
            }, {
              class: 'game__item-value',
              dataset: {
                id: 'score'
              }
            }]
          }]
        }
      }
    });
    this.addInitialise(ui);
    this.uiTime = ui.getElement().querySelector('[data-id="time"]');
    this.uiSpeed = ui.getElement().querySelector('[data-id="speed"]');
    this.uiScore = ui.getElement().querySelector('[data-id="score"]');
    ui.show();

    // add DEV log
    const dev = this._getModule('Dev');
    dev.addStat('Current room', () => this.currentRoom ? this.currentRoom.id : 'null');
    dev.addStat('Next room', () => this.nextRoom ? this.nextRoom.id : 'null');
  }

  /** on room enter callback */
  onRoomEnter(room) {
    // set current room
    this.currentRoom = room;

    // create exit room/s
    const rooms = this.currentRoom.createAdjoiningRooms();
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
    this.currentSpeed = Math.min(this.speedMax, this.currentSpeed + this.speedIncreasePerRoom);
    this.score += this.currentRoom.isPathDangerous() ? -1 : 0
  }

  /** on room exit callback */
  onRoomExit(room) {
    room.animateOutAndDestroy();
  }

  /** on key press -- switch tracks */
  onKeyPress() {
    if (this.nextRoom && this.currentRoom) {
      const entrance = this.currentRoom.getFlippedPosition(this.currentRoom.getExit());
      this.nextRoom.incrementPathSelection(entrance);
    }
  }

  /** get current room */
  getCurrentRoom() {
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

  /** @override */
  _update(delta) {
    // set age
    this.age += delta;

    // move player
    const room = this.getCurrentRoom();
    if (room) {
      room.movePlayer(delta, this.currentSpeed);
    }

    // set camera
    const target = this.ref.Player.getPosition().clone();
    if (this.nextRoom) {
      BlendVector3(target, this.nextRoom.position, 1);
    }
    this.cameraTarget.x += (target.x - this.cameraTarget.x) * 0.025;
    this.cameraTarget.y += (target.y - this.cameraTarget.y) * 0.025;
    this.cameraTarget.z += (target.z - this.cameraTarget.z) * 0.025;
    this.cameraPosition.copy(this.cameraTarget).add(this.cameraOffset);
    this.ref.Camera.setPosition(this.cameraPosition);
    this.ref.Camera.lookAt(this.cameraTarget);

    // set ui
    const s = Math.floor(this.age);
    this.uiTime.innerHTML = `${s}s`;
    this.uiSpeed.innerHTML = `${Math.round(this.currentSpeed * 100) / 100}m/s`;
    this.uiScore.innerHTML = this.score;
  }
}

export default Game;
