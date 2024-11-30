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
    // audio helper
    this.audio = {};

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
      this.onStartGame();

    // handle fail/success screen -- restart
    } else if (!this.screen.fail.isHidden() || !this.screen.success.isHidden()) {
      this.onRestart();

    // handle game
    } else {
      this._locked = false;
      this._getSceneNode('Game').onKeyDown();
    }
  }

  /** on change stage */
  onStageChange(stage) {
    if (stage === 2) {
      this.doAudioEvent('stage_02');
    } else if (stage === 3) {
      this.doAudioEvent('stage_03');
    } else if (stage === 5) {
      this.doAudioEvent('stage_05');
    }

    // pass to game handler
    this._getSceneNode('Game').onStageChange(stage);
  }

  /** on start game */
  onStartGame() {
    this.screen.intro.hide();
    this._getSceneNode('Game').setGameState(Game.STATE_GAME);
    this._getSceneNode('GameScore').show();

    // await contect -- play introduction audio
    this._getSceneNode('AudioHandler').onAudioContextCreate(() => {
      this.doAudioEvent('introduction');
    });
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

    // audio
    this.doAudioEvent('die');

    // set dead, show retry screen
    setTimeout(() => {
      this._getSceneNode('Game').setGameState(Game.STATE_DEAD);
      setTimeout(() => {
        this.screen.fail.show();
        this._locked = false;
      }, 500);
    }, 1000);
  }

  /** on game complete */
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

  /** kill all audio without events, null refs */
  killAudio() {
    for (const key in this.audio) {
      if (this.audio[key]) {
        const node = this.audio[key].node;
        this.audio[key] = null;
        node.stop();
        node.disconnect();
      }
    }
  }

  /** do audio event */
  doAudioEvent(e) {
    // set up
    const audioHandler = this._getSceneNode('AudioHandler');
    const context = audioHandler.getAudioContext();
    const output = audioHandler.getCompressorNode();

    console.log('doAudioEvent', e);

    // do audio event
    switch (e) {
      case 'introduction': {
        this.killAudio();

        // get intro buffer
        const buffer = audioHandler.getSound('introduction');
        const node = new AudioBufferSourceNode(context, {buffer: buffer});
        node.connect(output);
        node.start();

        // ref
        this.audio.introduction = {
          node: node,
        };

        // destroy event
        node.addEventListener('ended', e => {
          if (this.audio.introduction) {
            this.audio.introduction.node.disconnect();
            this.audio.introduction = null;
            this.doAudioEvent('stage_01');
          }
        });
        break;
      }
      case 'stage_01': {
        const buffer = audioHandler.getSound('speed_01');
        const node = new AudioBufferSourceNode(context, {buffer: buffer, loop: true});
        node.connect(output);
        node.start();

        // ref
        this.audio.speed_01 = {
          node: node,
          buffer: buffer,
          timestamp: context.currentTime
        };

        // destroy
        node.addEventListener('ended', e => {
          if (this.audio.speed_01) {
            this.audio.speed_01.node.disconnect();
            this.audio.speed_01 = null;
          }
        });
        break;
      }
      case 'stage_02': {
        const buffer = audioHandler.getSound('speed_02');
        const node = new AudioBufferSourceNode(context, {buffer: buffer, loop: true});
        node.connect(output);

        // sync speed_02 with speed_01
        const duration = this.audio.speed_01.buffer.duration;
        const elapsed = context.currentTime - this.audio.speed_01.timestamp;
        const offset = duration - (elapsed % duration);
        node.start(context.currentTime + offset);

        // stop speed_01
        this.audio.speed_01.node.stop(context.currentTime + offset);

        // ref
        this.audio.speed_02 = {
          node: node,
          buffer: buffer,
          timestamp: context.currentTime + offset,
        };

        // destroy
        node.addEventListener('ended', e => {
          if (this.audio.speed_02) {
            this.audio.speed_02.node.disconnect();
            this.audio.speed_02 = null;
          }
        });
        break;
      }
      case 'stage_03': {
        const buffer = audioHandler.getSound('interlude_02_03');
        const node = new AudioBufferSourceNode(context, {buffer: buffer});
        node.connect(output);

        // sync interlude_02_03 with speed_02
        const duration = this.audio.speed_02.buffer.duration;
        const elapsed = context.currentTime - this.audio.speed_02.timestamp;
        const offset = duration - (elapsed % duration);
        node.start(context.currentTime + offset);

        // stop speed_02
        this.audio.speed_02.node.stop(context.currentTime + offset);

        // ref
        this.audio.interlude_02_03 = {
          node: node,
        };

        // onend -> start speed_03
        node.addEventListener('ended', e => {
          if (this.audio.interlude_02_03) {
            this.audio.interlude_02_03.node.disconnect();
            this.audio.interlude_02_03 = null;
            this.doAudioEvent('stage_03_2');
          }
        });
        break;
      }
      case 'stage_03_2': {
        const buffer = audioHandler.getSound('speed_03');
        const node = new AudioBufferSourceNode(context, {buffer: buffer, loop: true});
        node.connect(output);
        node.start();

        // ref
        this.audio.speed_03 = {
          node: node,
          buffer: buffer,
          timestamp: context.currentTime
        };

        // destroy
        node.addEventListener('ended', e => {
          if (this.audio.speed_03) {
            this.audio.speed_03.node.disconnect();
            this.audio.speed_03 = null;
          }
        });
        break;
      }
      case 'stage_05': {
        const buffer = audioHandler.getSound('ending');
        const node = new AudioBufferSourceNode(context, {buffer: buffer});
        node.connect(output);

        // sync ending with speed_03
        const duration = this.audio.speed_03.buffer.duration;
        const elapsed = context.currentTime - this.audio.speed_03.timestamp;
        const offset = duration - (elapsed % duration);
        node.start(context.currentTime + offset);

        // stop speed_03
        this.audio.speed_03.node.stop(context.currentTime + offset);

        // ref
        this.audio.ending = {
          node: node,
        };

        // destroy
        node.addEventListener('ended', e => {
          if (this.audio.ending) {
            this.audio.ending.node.disconnect();
            this.audio.ending = null;
          }
        });
        break;
      }
      case 'die': {
        this.killAudio();
        break;
      }
      default:
        break;
    }
  }
}

export default GameWrapper;
