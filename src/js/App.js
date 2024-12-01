/** App */

import * as THREE from 'three';
import * as PostProcessing from 'postprocessing';
import * as Engine from 'engine';

// scene/s
import GameWrapper from './scene/GameWrapper';

// menu animation
// import MenuAnimation from './scene/MenuAnimation';

class App {
  constructor() {
    const root = Engine.CreateRoot('#app-target', {
      Camera: {
        orthographic: true,
        width: 12.5,
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
      Renderer: {
        shadows: true,
      },
      History: {
        disabled: true,
      }
    });
    this.root = root;

    // set up scene
    const scene = root.getModule('Scene');
    scene.setBackground(0x406659);

    // set up audio
    const audioHandler = root.getModule('AudioHandler');
    audioHandler.preloadSound('introduction', './audio/introduction.mp3');
    audioHandler.preloadSound('speed_01', './audio/speed_01.mp3');
    audioHandler.preloadSound('speed_02', './audio/speed_02.mp3');
    audioHandler.preloadSound('speed_03', './audio/speed_03.mp3');
    audioHandler.preloadSound('interlude_02_03', './audio/interlude_02_03.mp3');
    audioHandler.preloadSound('ending', './audio/ending.mp3');
    audioHandler.preloadSound('death_01', './audio/death_01.mp3');
    audioHandler.preloadSound('explosion', './audio/explosion.mp3');
    audioHandler.preloadSound('life_01', './audio/life_01.mp3');
    audioHandler.preloadSound('life_02', './audio/life_02.mp3');
    audioHandler.preloadSound('life_03', './audio/life_03.mp3');
    audioHandler.preloadSound('life_04', './audio/life_04.mp3');
    audioHandler.preloadSound('life_05', './audio/life_05.mp3');

    // add envmap
    const env = root.getModule('Environment');
    env.addTexture('envMap', './textures/rect.jpg', {
      mapping: THREE.EquirectangularReflectionMapping,
      colorSpace: THREE.SRGBColorSpace
    });

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

    root.getModule('Overlay').createScreen(
      'pause', {
        content: {
          innerHTML: 'Press <span>[e]</span> to resume.'
        }
      }
    );

    // add level/s
    root.addScene( GameWrapper );

    // run
    root.run();
  }
}

export default App;
