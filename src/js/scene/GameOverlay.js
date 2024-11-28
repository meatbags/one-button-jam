/** GameOverlay */

import { SceneNode, UIElement } from 'engine';

class GameOverlay extends SceneNode {
  static STAGES = 5;

  constructor(props={}) {
    super({ label: 'GameOverlay' });

    // props
    this.timer = {};
    this.timer.age = 0;
    this.timer.max = 60;
    this.stage = 0;
    this.stageTimeout = this.timer.max / GameOverlay.STAGES;
    this.complete = false;

    // callbacks
    this.onStageChange = props.onStageChange || (() => {});
    this.onComplete = props.onComplete || (() => {});
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Game = this._getSceneNode('Game');

    // timeline UI
    const uiTimeline = new UIElement({
      element: {
        class: 'timeline',
        children: [{
          class: 'timeline__inner',
        }, {
          class: 'timeline__stages',
          children: [
            {}, {}, {}, {}
          ]
        }]
      },
    });

    // refs
    this.uiTimeline = uiTimeline.getElement().querySelector('.timeline__inner');

    // score UI
    const uiScore = new UIElement({
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
          }, {
            class: 'game__item',
            children: [{
              class: 'game__item-label',
              innerHTML: 'Paths:',
            }, {
              class: 'game__item-value',
              dataset: {
                id: 'paths'
              }
            }]
          }]
        }
      }
    });
    this.uiTime = uiScore.getElement().querySelector('[data-id="time"]');
    this.uiSpeed = uiScore.getElement().querySelector('[data-id="speed"]');
    this.uiScore = uiScore.getElement().querySelector('[data-id="score"]');
    this.uiPaths = uiScore.getElement().querySelector('[data-id="paths"]');

    // add to scenetree
    this.addInitialise(uiTimeline, uiScore);

    // show UI
    uiTimeline.show();
    uiScore.show();
  }

  /** @override */
  _update(delta) {
    this.timer.age += delta;

    // update stage
    if (this.stage < GameOverlay.STAGES) {
      const time = Math.min(this.timer.max, this.timer.age);
      const stage = Math.floor(time / this.stageTimeout) + 1;
      if (this.stage < stage) {
        this.stage = stage;
        this.onStageChange(this.stage);
      }
    }

    // timeline
    if (!this.complete) {
      const p = Math.min(1, this.timer.age / this.timer.max) * 100;
      this.uiTimeline.style.width = `${p}%`;
      if (p === 100) {
        this.complete = true;
        this.onComplete();
      }
    }

    // score
    const s = Math.floor(this.timer.age);
    this.uiTime.innerHTML = `${s}s`;
    this.uiSpeed.innerHTML = `${Math.round(this.ref.Game.currentSpeed * 100) / 100}m/s`;
    this.uiScore.innerHTML = this.ref.Game.score;
    this.uiPaths.innerHTML = Math.floor(this.ref.Game.numPaths);
  }
}

export default GameOverlay;
