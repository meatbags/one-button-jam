/** GameScore */

import { SceneNode, UIElement } from 'engine';
import Game from './Game';

class GameScore extends SceneNode {
  static STAGES = 5;
  static GAME_TIME_MAX = 120;
  static EVENT_STAGE_CHANGE = 'stage_change';
  static EVENT_GAME_COMPLETE = 'game_complete';
  static EVENT_LOSE_LIFE = 'lose_life';
  static EVENT_DIE = 'game_die';
  static DEV_INVINCIBLE = false;

  constructor(props={}) {
    super({ label: 'GameScore' });

    // state
    this.age = 0;
    this.stage = 0;
    this.score = null;
    this.complete = false;
    this.stageTimeout = GameScore.GAME_TIME_MAX / GameScore.STAGES;
  }

  /** @override */
  _init() {
    this.ref = {};
    this.ref.Game = this._getSceneNode('Game');

    // timeline UI
    this.ui = {};
    this.ui.timeline = new UIElement({
      element: {
        class: 'timeline',
        children: [{
          class: 'timeline__inner',
          children: {
            class: 'timeline__track'
          }
        }, {
          class: 'timeline__stages',
          children: [
            {}, {}, {}, {}
          ]
        }]
      },
    });
    const divs = [];
    for (let i=0; i<Game.SCORE_INITIAL; i++) {
      divs.push({});
    }
    this.ui.lives = new UIElement({
      element: {
        class: 'lives',
        children: divs,
      },
    });

    // refs
    this.uiTimeline = this.ui.timeline.getElement().querySelector('.timeline__track');
    this.uiLives = this.ui.lives.getElement().querySelectorAll('div');

    // add to scenetree
    this.addInitialise(this.ui.timeline, this.ui.lives);

    // reset props
    this.reset();
  }

  /** reset state */
  reset() {
    this.age = 0;
    this.stage = 0;
    this.score = null;
    this.complete = false;
  }

  /** show elements */
  show() {
    this.ui.timeline.show();
    this.ui.lives.show();
  }

  /** hide elements */
  hide() {
    this.ui.timeline.hide();
    this.ui.lives.hide();
  }

  /** @override */
  _update(delta) {
    switch (this.ref.Game.currentState) {
      case Game.STATE_GAME:
        if (this.ref.Game.currentState === Game.STATE_GAME) {
          this.age += delta;
        }

        // update stage
        if (this.stage < GameScore.STAGES) {
          const time = Math.min(GameScore.GAME_TIME_MAX, this.age);
          const stage = Math.floor(time / this.stageTimeout) + 1;
          if (this.stage < stage) {
            this.stage = stage;
            this.emit(GameScore.EVENT_STAGE_CHANGE, this.stage);
          }
        }

        // check score changed
        if (this.score === null || this.score !== this.ref.Game.score) {
          const lostLife = this.score > this.ref.Game.score;
          this.score = this.ref.Game.score;
          this.uiLives.forEach((div, i) => {
            if (i + 1 > this.score) {
              div.dataset.hidden = 1;
            } else {
              div.dataset.hidden = 0;
            }
          });
          if (lostLife) {
            this.emit(GameScore.EVENT_LOSE_LIFE, this.score);
          }
        }

        // check dead
        if (this.ref.Game.score <= 0 && !this.complete && !GameScore.DEV_INVINCIBLE) {
          this.emit(GameScore.EVENT_DIE);
        }

        // timeline
        if (!this.complete) {
          const p = Math.min(1, this.age / GameScore.GAME_TIME_MAX) * 100;
          this.uiTimeline.style.width = `${p}%`;
          if (p === 100) {
            this.complete = true;
            this.emit(GameScore.EVENT_GAME_COMPLETE);
          }
        }
        break;
      default:
        break;
    }
  }
}

export default GameScore;
