/** App */

import * as THREE from 'three';
import * as PostProcessing from 'postprocessing';
import * as Engine from 'engine';

// scene/s
import DemoRoom from './scene/DemoRoom';

// menu animation
// import MenuAnimation from './scene/MenuAnimation';

class App {
  constructor() {
    const root = Engine.CreateRoot('#app-target');
    this.root = root;

    // set up scene
    const scene = root.getModule('Scene');
    scene.setBackground(0x0);

    // set up camera
    const cameraModule = root.getModule('Camera');

    // set up audio
    const audioHandler = root.getModule('AudioHandler');

    // set up renderer
    const renderer = root.getModule('Renderer');
    const camera = root.getModule('Camera').getCamera();
    const THREEscene = root.getModule('Scene').getScene();
    renderer.addPass(new PostProcessing.RenderPass(THREEscene, camera));
    const normalPass = new PostProcessing.NormalPass(THREEscene, camera);
    renderer.addPass(normalPass);
    renderer.addPass(new PostProcessing.EffectPass(
      camera,
      new PostProcessing.BloomEffect({
        blendFunction: PostProcessing.BlendFunction.SCREEN,
        luminanceThreshold: 0.7,
        luminanceSmoothing: 0.15,
        mipmapBlur: true,
        intensity: 0.5,
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
      title: '[ working title ]',
      buttons: {
        'play game': () => root.resumeGame(),
        'settings': () => overlay.openScreen('settings'),
        'controls': () => overlay.openScreen('controls'),
        'credits': () => overlay.openScreen('credits'),
      },
    });
    overlay.createScreen('settings', {
      title: 'settings',
      content: '[ settings ]',
      buttons: {
        '&larr; back': () => overlay.openScreen('home'),
      }
    });
    overlay.createScreen('controls', {
      title: 'controls',
      content: `
        pan camera ~ <span>mouse</span><br>
        move ~ <span>wsad</span> or <span>arrow keys</span><br>
        sprint ~ <span>hold shift</span><br>
        jump ~ <span>spacebar</span><br>
        pause menu ~ <span>esc</span>
      `,
      buttons: {
        '&larr; back': () => overlay.openScreen('home'),
      }
    });
    overlay.createScreen('credits', {
      title: 'credits',
      content: `
        by <a href="https://xavierburrow.com" target="_blank">Xavier Burrow</a>
        (<a href="https://getpixel.itch.io/" target="_blank">getpixel</a>)
      `,
      buttons: {
        '&larr; back': () => overlay.openScreen('home'),
      }
    });

    // add menu animation
    // root.getModule('MainLoop').add(new MenuAnimation());

    // add level/s
    root.addScene(DemoRoom);

    // run
    root.run();
  }
}

export default App;
