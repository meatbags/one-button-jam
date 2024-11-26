/** App */

import * as THREE from 'three';
import * as PostProcessing from 'postprocessing';
import * as Engine from 'engine';

// scene/s
import Game from './scene/Game';

// menu animation
// import MenuAnimation from './scene/MenuAnimation';

class App {
  constructor() {
    const root = Engine.CreateRoot('#app-target', {
      Camera: {
        orthographic: true,
        followPlayer: false,
      },
      Player: {
        disabled: true,
      },
      Physics: {
        disabled: true,
      },
      UserInterface: {
        keyboard: true,
        pointerControls: false,
      },
      History: {
        disabled: true,
      }
    });
    this.root = root;

    // set up scene
    const scene = root.getModule('Scene');
    scene.setBackground(0x0);

    // set up audio
    const audioHandler = root.getModule('AudioHandler');

    // set up camera, renderer
    const camera = root.getModule('Camera');
    const renderer = root.getModule('Renderer');
    const cameraCamera = camera.getCamera();
    const THREEscene = root.getModule('Scene').getScene();
    renderer.addPass(new PostProcessing.RenderPass(THREEscene, cameraCamera));
    const normalPass = new PostProcessing.NormalPass(THREEscene, cameraCamera);
    renderer.addPass(normalPass);
    renderer.addPass(new PostProcessing.EffectPass(
      camera,
      new PostProcessing.BloomEffect({
        blendFunction: PostProcessing.BlendFunction.SCREEN,
        luminanceThreshold: 0.9,
        luminanceSmoothing: 0.15,
        mipmapBlur: true,
        intensity: 0.1,
        radius: 0.7,
        levels: 8,
      }),
      new PostProcessing.ToneMappingEffect({
    		blendFunction: PostProcessing.BlendFunction.NORMAL,
    		mode: PostProcessing.ToneMappingMode.ACES_FILMIC,
    	})
    ));

    // create menu screens
    const overlay = root.getModule('Overlay');
    overlay.createScreen('home', {
      title: '[ one button jam ]',
      content: '[ press E ]',
    });

    // start game
    root.getModule('UserInterface').addEventListener('key', keyboard => {
      if (keyboard.isKeyDown('e') && root.getModule('MainLoop').isPaused()) {
        root.resumeGame();
      }
    });

    // add menu animation
    // root.getModule('MainLoop').add(new MenuAnimation());

    // add level/s
    root.addScene( Game );

    // run
    root.run();

    // dev -- autorun
    if (root.getModule('Dev').isDevMode()) {
      root.resumeGame();
    }
  }
}

export default App;
