import { setMinecraftText } from './minecraft-font.mjs';
import { el, asset } from './world-menu-ui.mjs';

// Ordem e defaults extraídos de lp (enum) e ki (GameSettings) do 1.0.jar.
const defaults = {
  music: 1, sound: 1, invertYMouse: false, mouseSensitivity: 0.5,
  fov: 0, gamma: 0, viewDistance: 0, bobView: true, anaglyph3d: false,
  advancedOpengl: false, fpsLimit: 1, difficulty: 2, fancyGraphics: true,
  ao: true, guiScale: 0, clouds: true, particles: 0,
  keys: {
    attack: -100, use: -99, forward: 17, left: 30, back: 31, right: 32,
    jump: 57, sneak: 42, drop: 16, inventory: 18, chat: 20,
    playerlist: 15, pickItem: -98
  }
};
const optionLabels = {
  music:'Music', sound:'Sound', invertYMouse:'Invert Mouse',
  mouseSensitivity:'Sensitivity', fov:'FOV', gamma:'Brightness',
  viewDistance:'Render Distance', bobView:'View Bobbing',
  anaglyph3d:'3D Anaglyph', advancedOpengl:'Advanced OpenGL',
  fpsLimit:'Performance', difficulty:'Difficulty', fancyGraphics:'Graphics',
  ao:'Smooth Lighting', guiScale:'GUI Scale', clouds:'Clouds', particles:'Particles'
};
const cycles = {
  viewDistance:['Far','Normal','Short','Tiny'],
  fpsLimit:['Max FPS','Balanced','Power Saver'],
  difficulty:['Peaceful','Easy','Normal','Hard'],
  fancyGraphics:['Fast','Fancy'],
  guiScale:['Auto','Small','Normal','Large'],
  particles:['All','Decreased','Minimal']
};
const controlBindings = [
  ['Attack','attack'], ['Use Item','use'], ['Forward','forward'],
  ['Left','left'], ['Back','back'], ['Right','right'], ['Jump','jump'],
  ['Sneak','sneak'], ['Drop','drop'], ['Inventory','inventory'],
  ['Chat','chat'], ['List Players','playerlist'], ['Pick Block','pickItem']
];
const lwjglCodes = {
  KeyA:30,KeyB:48,KeyC:46,KeyD:32,KeyE:18,KeyF:33,KeyG:34,KeyH:35,
  KeyI:23,KeyJ:36,KeyK:37,KeyL:38,KeyM:50,KeyN:49,KeyO:24,KeyP:25,
  KeyQ:16,KeyR:19,KeyS:31,KeyT:20,KeyU:22,KeyV:47,KeyW:17,KeyX:45,
  KeyY:21,KeyZ:44,Digit0:11,Digit1:2,Digit2:3,Digit3:4,Digit4:5,
  Digit5:6,Digit6:7,Digit7:8,Digit8:9,Digit9:10,Escape:1,Tab:15,
  Space:57,Enter:28,Backspace:14,ShiftLeft:42,ShiftRight:54,
  ControlLeft:29,ControlRight:157,AltLeft:56,AltRight:184,
  ArrowUp:200,ArrowDown:208,ArrowLeft:203,ArrowRight:205,
  F1:59,F2:60,F3:61,F4:62,F5:63,F6:64,F7:65,F8:66,F9:67,
  F10:68,F11:87,F12:88,Minus:12,Equal:13,BracketLeft:26,
  BracketRight:27,Semicolon:39,Quote:40,Backquote:41,Backslash:43,
  Comma:51,Period:52,Slash:53,CapsLock:58,ScrollLock:70,PrintScreen:183,
  Pause:197,Home:199,End:207,PageUp:201,PageDown:209,Insert:210,Delete:211,
  Numpad0:82,Numpad1:79,Numpad2:80,Numpad3:81,Numpad4:75,Numpad5:76,
  Numpad6:77,Numpad7:71,Numpad8:72,Numpad9:73,NumpadDecimal:83,
  NumpadAdd:78,NumpadSubtract:74,NumpadMultiply:55,NumpadDivide:181,
  NumpadEnter:156,NumpadEqual:141
};
const keyNames = new Map([
  [-100,'Button 1'],[-99,'Button 2'],[-98,'Button 3'],
  [17,'W'],[30,'A'],[31,'S'],[32,'D'],[57,'Space'],[42,'Left Shift'],
  [16,'Q'],[18,'E'],[20,'T'],[15,'Tab']
]);
const keyName = (dom, code) => {
  if (dom?.startsWith('Key')) return dom.slice(3);
  if (dom?.startsWith('Digit')) return dom.slice(5);
  if (dom === 'Space') return 'SPACE';
  if (dom === 'ArrowUp') return 'UP';
  if (dom === 'ArrowDown') return 'DOWN';
  if (dom === 'ArrowLeft') return 'LEFT';
  if (dom === 'ArrowRight') return 'RIGHT';
  if (dom === 'Mouse0') return 'Button 1';
  if (dom === 'Mouse2') return 'Button 2';
  if (dom === 'Mouse1') return 'Button 3';
  return keyNames.get(code) || (code >= 0 && code < 256 ? String.fromCharCode(code).toUpperCase() : 'Unknown');
};
const readOptions = () => {
  const value = { ...defaults, keys: { ...defaults.keys }, domKeys: {} };
  try {
    value.domKeys = JSON.parse(localStorage.getItem('mc10-controls') || '{}');
    for (const line of (localStorage.getItem('mc10-options.txt') || '').split(/\r?\n/)) {
      const split = line.indexOf(':');
      if (split < 1) continue;
      const key = line.slice(0, split), raw = line.slice(split + 1);
      if (key.startsWith('key_key.')) {
        const id = key.slice(8);
        if (id in value.keys) value.keys[id] = Number(raw);
      } else if (key === 'renderClouds') {
        value.clouds = raw === 'true';
      } else if (key in defaults && key !== 'keys') {
        value[key] = typeof defaults[key] === 'boolean' ? raw === 'true'
          : typeof defaults[key] === 'number' ? Number(raw) : raw;
      }
    }
  } catch {}
  return value;
};
const saveOptions = value => {
  const fields = [
    'music','sound','invertYMouse','mouseSensitivity','fov','gamma',
    'viewDistance','guiScale','particles','bobView','anaglyph3d',
    'advancedOpengl','fpsLimit','difficulty','fancyGraphics','ao','renderClouds'
  ];
  const lines = fields.map(key => key === 'renderClouds' ? 'renderClouds:' + value.clouds : key + ':' + value[key]);
  lines.push('skin:Default','lastServer:');
  for (const [key, code] of Object.entries(value.keys)) lines.push('key_key.' + key + ':' + code);
  try {
    // GameSettings.b() grava options.txt no formato original.
    localStorage.setItem('mc10-options.txt', lines.join('\n') + '\n');
    const fallbackDom = {
      '17':'KeyW','30':'KeyA','31':'KeyS','32':'KeyD','57':'Space',
      '42':'ShiftLeft','16':'KeyQ','18':'KeyE','20':'KeyT','15':'Tab',
      '-100':'Mouse0','-99':'Mouse2','-98':'Mouse1'
    };
    localStorage.setItem('mc10-controls', JSON.stringify(Object.fromEntries(
      Object.entries(value.keys).map(([key, code]) => [key, value.domKeys[key] || fallbackDom[String(code)] || ''])
    )));
    localStorage.setItem('mc10-video-options', JSON.stringify({
      renderDistance:value.viewDistance, smoothLighting:value.ao,
      viewBobbing:value.bobView, fancyGraphics:value.fancyGraphics,
      clouds:value.clouds, particles:value.particles, guiScale:value.guiScale
    }));
  } catch {}
};
const formatValue = (key, value) => {
  if (key === 'music' || key === 'sound') return value === 0 ? 'OFF' : Math.round(value * 100) + '%';
  if (key === 'mouseSensitivity') return value === 0 ? '*yawn*' : value === 1 ? 'HYPERSPEED!!!' : Math.floor(value * 200) + '%';
  if (key === 'fov') return value === 0 ? 'Normal' : value === 1 ? 'Quake Pro' : String(Math.floor(70 + value * 40));
  if (key === 'gamma') return value === 0 ? 'Moody' : value === 1 ? 'Bright' : '+' + Math.floor(value * 100) + '%';
  if (key === 'viewDistance') return cycles.viewDistance[value];
  if (key === 'difficulty') return cycles.difficulty[value];
  if (key === 'fpsLimit') return cycles.fpsLimit[value];
  if (key === 'fancyGraphics') return value ? 'Fancy' : 'Fast';
  if (key === 'guiScale') return cycles.guiScale[value];
  if (key === 'particles') return cycles.particles[value];
  return value ? 'ON' : 'OFF';
};

export function createOptionsScreen({
  content, getSize, font, button, text, guiAtlas, clearContent, mainScreen,
  setActiveScreen, onGuiScaleChange, onChange, onClose = mainScreen,
  background = 'texture'
}) {
  const settings = readOptions();
  let active = 'main';
  let waitingKey = null;
  let captureHandler = null;
  const screen = el('div', { id:'mc10-options-root' });
  const sliderHitboxStyle = el('style');
  sliderHitboxStyle.textContent = '.mc10-options-slider-hitbox{appearance:none;-webkit-appearance:none;background:transparent;outline:0}.mc10-options-slider-hitbox::-webkit-slider-runnable-track{height:20px;background:transparent}.mc10-options-slider-hitbox::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:8px;height:20px;border:0;background:transparent}.mc10-options-slider-hitbox::-moz-range-track{height:20px;background:transparent}.mc10-options-slider-hitbox::-moz-range-thumb{width:8px;height:20px;border:0;border-radius:0;background:transparent}';
  document.head.append(sliderHitboxStyle);
  const resolvedAsset = path => window.mcAssetUrl?.(asset(path)) ?? asset(path);
  Object.assign(screen.style, {
    position:'absolute', inset:'0', zIndex:'4', display:'none',
    backgroundColor: background === 'texture' ? '#202020' : 'transparent',
    backgroundImage: background === 'texture'
      ? `url("${resolvedAsset('gui/background.png')}")`
      : background === 'transparent' ? 'none' : background,
    backgroundRepeat: background === 'texture' ? 'repeat' : 'no-repeat',
    backgroundSize: background === 'texture' ? '32px 32px' : '100% 100%'
  });
  content.append(screen);

  const heading = value => {
    const node = el('div');
    Object.assign(node.style, {
      position:'absolute', top:'20px', left:'0', width:'100%',
      textAlign:'center', color:'#fff'
    });
    setMinecraftText(node, value, font, { shadow:true });
    screen.append(node);
  };
  const label = (value, x, y, width = 150) => {
    const node = el('div');
    Object.assign(node.style, {
      position:'absolute', left:x+'px', top:y+'px', width:width+'px',
      height:'20px', display:'flex', alignItems:'center',
      justifyContent:'center', color:'#e0e0e0', pointerEvents:'none'
    });
    setMinecraftText(node, value, font, { shadow:true });
    screen.append(node);
    return node;
  };
  const clearCapture = () => {
    if (!captureHandler) return;
    window.removeEventListener('keydown', captureHandler, true);
    window.removeEventListener('mousedown', captureHandler, true);
    captureHandler = null;
  };
  const closeToParent = () => {
    clearCapture();
    waitingKey = null;
    screen.style.display = 'none';
    setActiveScreen?.(onClose);
    onClose?.();
  };
  const commit = key => {
    saveOptions(settings);
    onChange?.(key, settings[key], settings);
  };
  const drawSlider = (key, x, y) => {
    const valueLabel = label(optionLabels[key] + ': ' + formatValue(key, settings[key]), x, y);
    valueLabel.style.zIndex = '2';
    // ct.a() + zd.b(): o trilho usa o sprite de botão (gui.png, y=66/86)
    // e o cursor usa os dois recortes de 4px desenhados pelo GuiSlider original.
    const track = el('canvas', { width:150, height:20 });
    Object.assign(track.style, {
      position:'absolute', left:x+'px', top:y+'px', width:'150px', height:'20px',
      imageRendering:'pixelated', pointerEvents:'none', zIndex:'0'
    });
    const trackContext = track.getContext('2d');
    const drawTrack = hovered => {
      const sourceY = hovered ? 86 : 66;
      trackContext.clearRect(0,0,150,20);
      trackContext.drawImage(guiAtlas,0,sourceY,75,20,0,0,75,20);
      trackContext.drawImage(guiAtlas,125,sourceY,75,20,75,0,75,20);
    };
    drawTrack(false);
    const thumb = el('canvas', { width:8, height:20 });
    Object.assign(thumb.style, {
      position:'absolute', top:y+'px', width:'8px', height:'20px',
      left:(x + Math.floor(settings[key] * 142))+'px',
      imageRendering:'pixelated', pointerEvents:'none', zIndex:'1'
    });
    const thumbContext = thumb.getContext('2d');
    thumbContext.drawImage(guiAtlas,0,66,4,20,0,0,4,20);
    thumbContext.drawImage(guiAtlas,196,66,4,20,4,0,4,20);
    const input = el('input', { type:'range', min:'0', max:'100', step:'1', value:String(Math.round(settings[key] * 100)) });
    input.className = 'mc10-options-slider-hitbox';
    Object.assign(input.style, {
      position:'absolute', left:x+'px', top:y+'px', width:'150px', height:'20px',
      margin:'0', opacity:'0', cursor:'pointer', zIndex:'3'
    });
    input.addEventListener('pointerenter', () => drawTrack(true));
    input.addEventListener('pointerleave', () => drawTrack(false));
    input.addEventListener('input', () => {
      settings[key] = Number(input.value) / 100;
      thumb.style.left = (x + Math.floor(settings[key] * 142)) + 'px';
      setMinecraftText(valueLabel, optionLabels[key] + ': ' + formatValue(key, settings[key]), font, { shadow:true });
      commit(key);
    });
    screen.append(track, thumb, input);
  };
  const addControl = (key, x, y, width = 150) => {
    const node = button(screen, optionLabels[key] + ': ' + formatValue(key, settings[key]), x, y, width, () => {
      if (typeof settings[key] === 'boolean') settings[key] = !settings[key];
      else if (cycles[key]) settings[key] = (settings[key] + 1) % cycles[key].length;
      commit(key);
      if (key === 'guiScale') onGuiScaleChange?.();
      show(active);
    });
    return node;
  };
  const addDone = () => button(screen, 'Done', getSize().width / 2 - 100, getSize().height / 6 + 168, 200, () => {
    if (active === 'main') closeToParent();
    else show('main');
  });
  const showControls = (left, top) => {
    controlBindings.forEach(([title, key], index) => {
      const x = left + (index % 2) * 160;
      const y = top + Math.floor(index / 2) * 24;
      const current = keyName(settings.domKeys[key], settings.keys[key]);
      const caption = title + ': ' + current;
      const node = button(screen, caption, x, y, 70, () => {
        clearCapture();
        waitingKey = key;
        node.setButtonLabel('> ??? <');
        captureHandler = event => {
          if (event.type === 'keydown' && event.key === 'Escape') {
            event.preventDefault();
            clearCapture();
            waitingKey = null;
            show('controls');
            return;
          }
          if (event.type === 'keydown') {
            event.preventDefault();
            clearCapture();
            settings.keys[key] = lwjglCodes[event.code] ?? event.keyCode;
            settings.domKeys[key] = event.code;
            waitingKey = null;
            commit('keys');
            show('controls');
          } else if (event.type === 'mousedown') {
            event.preventDefault();
            clearCapture();
            settings.keys[key] = [-100, -98, -99][event.button] ?? -100;
            settings.domKeys[key] = 'Mouse' + event.button;
            waitingKey = null;
            commit('keys');
            show('controls');
          }
        };
        window.addEventListener('keydown', captureHandler, true);
        window.addEventListener('mousedown', captureHandler, true);
      });
      if (waitingKey === key) node.setButtonLabel('> ??? <');
    });
  };
  function show(name) {
    clearCapture();
    active = name;
    waitingKey = null;
    setActiveScreen?.(() => show(active));
    screen.style.display = 'block';
    clearContent();
    content.append(screen);
    screen.replaceChildren();
    const { width, height } = getSize();
    const left = Math.floor(width / 2) - 155;
    const top = Math.floor(height / 6);
    heading(name === 'main' ? 'Options' : name === 'video' ? 'Video Settings' : 'Controls');

    if (name === 'main') {
      drawSlider('music', left, top);
      drawSlider('sound', left + 160, top);
      addControl('invertYMouse', left, top + 24);
      drawSlider('mouseSensitivity', left + 160, top + 24);
      drawSlider('fov', left, top + 48);
      addControl('difficulty', left + 160, top + 48);
      button(screen, 'Video Settings...', width / 2 - 100, top + 108, 200, () => show('video'));
      button(screen, 'Controls...', width / 2 - 100, top + 132, 200, () => show('controls'));
      addDone();
    } else if (name === 'video') {
      const order = [
        'fancyGraphics','viewDistance','ao','fpsLimit','anaglyph3d',
        'bobView','guiScale','advancedOpengl','gamma','clouds','particles'
      ];
      order.forEach((key, index) => {
        const x = left + (index % 2) * 160;
        const y = top + Math.floor(index / 2) * 24;
        if (key === 'gamma') drawSlider(key, x, y);
        else addControl(key, x, y);
      });
      addDone();
    } else {
      showControls(left, top);
      addDone();
    }
  }
  const open = () => show('main');
  const onEscape = event => {
    if (screen.style.display === 'none' || event.key !== 'Escape') return;
    if (waitingKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (active === 'main') closeToParent();
    else show('main');
  };
  window.addEventListener('keydown', onEscape, true);
  return { open, settings };
}
