/** GameWrapper */

import { SceneNode, UIElement } from 'engine';

import Game from './Game';
import GameScore from './GameScore';

class GameWrapper extends SceneNode {
  constructor() {
    super({ label: 'GameWrapper' });

    this.add(
      new Game(),
      new GameScore()
    );
  }

  /** @override */
  _init() {
    // create screens
    this.screen = {};
    this.screen.intro = new UIElement({
      element: {
        class: 'screen',
        children: [{
          type: 'h1',
          innerHTML: 'D[e]RAILED',
        }, {
          type: 'p',
          innerHTML: `
            Avoid dangerous paths! Switch tracks with <span>[e]</span>. Survive for two minutes!
            <br><br>
            Press <span>[e]</span> to begin!
          `
        }]
      },
    });
    this.screen.fail = new UIElement({
      element: {
        class: 'screen',
        children: [{
          type: 'h1',
          innerHTML: 'You died!',
        }, {
          type: 'p',
          innerHTML: `
            Press <span>[e]</span> to try again.
          `
        }]
      },
    });
    this.screen.success = new UIElement({
      element: {
        class: 'screen',
        children: [{
          type: 'h1',
          innerHTML: 'Congratulations!',
        }, {
          type: 'p',
          innerHTML: `
            You scored <span data-id="score"></span>.<br><br>
            Press <span>[e]</span> to play again.
          `
        }]
      },
    });
    this.addInitialise(this.screen.intro, this.screen.fail, this.screen.success);
    this.screen.intro.show();

    // start game
    this._getModule('UserInterface').addEventListener('key', keyboard => {
      if (keyboard.isKeyDown('e')) {
        this.onKeyDown();
      }
    });

    // events
    const score = this._getSceneNode('GameScore');
    score.addEventListener(
      GameScore.EVENT_STAGE_CHANGE, stage => this.onStageChange(stage));
    score.addEventListener(
      GameScore.EVENT_DIE, () => this.onDie());
    score.addEventListener(
      GameScore.EVENT_GAME_COMPLETE, () => this.onGameComplete());

    // run game
    this._getRoot().resumeGame();
  }

  /** on key down */
  onKeyDown() {
    if (this._locked) {
      this._locked = true;
    }

    // handle paused
    const mainLoop = this._getSceneNode('MainLoop');
    if (mainLoop.isPaused()) {
      this._getRoot().resumeGame();
    }

    // handle intro screen
    if (!this.screen.intro.isHidden()) {
      this.screen.intro.hide();
      this._getSceneNode('Game').setGameState(Game.STATE_GAME);
      this._getSceneNode('GameScore').show();

    // handle fail/success screen -- restart
    } else if (
      !this.screen.fail.isHidden() || !this.screen.success.isHidden()
    ) {
      this.onRestart();

    // handle game
    } else {
      this._locked = false;
      this._getSceneNode('Game').onKeyDown();
    }
  }

  /** on change stage */
  onStageChange(stage) {
    this._getSceneNode('Game').onStageChange(stage);
  }

  /** on restart */
  onRestart() {
    // reset child nodes
    this.children.forEach(child => {
      if (typeof child.reset === 'function') {
        child.reset();
      }
    });

    // show intro screen
    this.screen.fail.hide();
    this.screen.success.hide();
    this.screen.intro.show();

    // set game state
    this._getSceneNode('Game').setGameState(Game.STATE_HOLDING);

    // unlock controls
    setTimeout(() => {
      this._locked = false;
    }, 500);
  }

  /** on die */
  onDie() {
    if (this._locked) return;
    this._locked = true;

    // hide scores
    this._getSceneNode('GameScore').hide();

    // set dead, show retry screen
    setTimeout(() => {
      this._getSceneNode('Game').setGameState(Game.STATE_DEAD);
      setTimeout(() => {
        this.screen.fail.show();
        this._locked = false;
      }, 500);
    }, 1000);
  }

  /** @override */
  onGameComplete() {
    if (this._locked) return;
    this._locked = true;

    // hide score, show win screen
    this._getSceneNode('GameScore').hide();
    this._getSceneNode('Game').setGameState(Game.STATE_HOLDING);
    const score = this.screen.success.getElement().querySelector('[data-id="score"]');
    if (score) {
      score.innerText = `${this._getSceneNode('Game').score}/${Game.SCORE_INITIAL}`;
    }
    this.screen.success.show();

    setTimeout(() => {
      this._locked = false;
    }, 1000);
  }
}

export default GameWrapper;
