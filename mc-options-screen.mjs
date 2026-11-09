import { setMinecraftText } from './minecraft-font.mjs';
import { el, asset } from './world-menu-ui.mjs';

const defaults = {
  music: 1, sound: 1, invertYMouse: false, mouseSensitivity: 0.5, fov: 0,
  gamma: 0, viewDistance: 0, guiScale: 0, particles: 0, bobView: true,
  anaglyph3d: false, advancedOpengl: false, fpsLimit: 1, difficulty: 2,
  fancyGraphics: true, ao: true, clouds: true,
  keys: { attack: -100, use: -99, forward: 17, left: 30, back: 31, right: 32, jump: 57, sneak: 42, drop: 16, inventory: 18, chat: 20, playerlist: 15, pickItem: -98 }
};
const labels = {
  music:'Music', sound:'Sound', invertYMouse:'Invert Mouse', mouseSensitivity:'Sensitivity', fov:'FOV', gamma:'Brightness',
  viewDistance:'Render Distance', bobView:'View Bobbing', anaglyph3d:'3D Anaglyph', advancedOpengl:'Advanced OpenGL',
  fpsLimit:'Performance', difficulty:'Difficulty', fancyGraphics:'Graphics', ao:'Smooth Lighting',
  guiScale:'GUI Scale', clouds:'Clouds', particles:'Particles'
};
const cycles = {
  viewDistance:['Far','Normal','Short','Tiny'], fpsLimit:['Max FPS','Balanced','Power Saver'],
  difficulty:['Peaceful','Easy','Normal','Hard'], fancyGraphics:['Fast','Fancy'],
  guiScale:['Auto','Small','Normal','Large'], particles:['All','Decreased','Minimal']
};
const keys = [
  ['Attack','attack'],['Use Item','use'],['Forward','forward'],['Left','left'],['Back','back'],['Right','right'],
  ['Jump','jump'],['Sneak','sneak'],['Drop','drop'],['Inventory','inventory'],['Chat','chat'],['List Players','playerlist'],['Pick Block','pickItem']
];
const keyNames = new Map([[ -100,'Button 1'],[-99,'Button 2'],[-98,'Button 3'],[17,'W'],[30,'A'],[31,'S'],[32,'D'],[57,'Space'],[42,'Left Shift'],[16,'Q'],[18,'E'],[20,'T'],[15,'Tab']]);
const readOptions = () => {
  let value = { ...defaults, keys: { ...defaults.keys }, domKeys: {} };
  try {
    value.domKeys = JSON.parse(localStorage.getItem('mc10-controls') || '{}');
    const raw = localStorage.getItem('mc10-options.txt') || '';
    for (const line of raw.split(/\r?\n/)) {
      const at = line.indexOf(':'); if (at < 1) continue;
      const k = line.slice(0, at), v = line.slice(at + 1);
      if (k.startsWith('key_key.')) { const id = k.slice(8); if (id in value.keys) value.keys[id] = Number(v); continue; }
      if (k in value) value[k] = typeof defaults[k] === 'boolean' ? v === 'true' : typeof defaults[k] === 'number' ? Number(v) : v;
    }
  } catch {}
  return value;
};
const saveOptions = value => {
  const rows = ['music','sound','invertYMouse','mouseSensitivity','fov','gamma','viewDistance','guiScale','particles','bobView','anaglyph3d','advancedOpengl','fpsLimit','difficulty','fancyGraphics','ao','clouds']
    .map(key => key + ':' + value[key]);
  rows.push('skin:Default','lastServer:');
  for (const [key, code] of Object.entries(value.keys)) rows.push('key_key.' + key + ':' + code);
  try {
    localStorage.setItem('mc10-options.txt', rows.join('\n') + '\n');
    const domCodes = {'17':'KeyW','30':'KeyA','31':'KeyS','32':'KeyD','57':'Space','42':'ShiftLeft','16':'KeyQ','18':'KeyE','20':'KeyT','15':'Tab','-100':'Mouse0','-99':'Mouse2','-98':'Mouse1'};
    localStorage.setItem('mc10-controls', JSON.stringify(Object.fromEntries(Object.entries(value.keys).map(([key,code])=>[key,value.domKeys[key] || domCodes[code] || '']))));
    localStorage.setItem('mc10-video-options', JSON.stringify({
      renderDistance: value.viewDistance, smoothLighting: value.ao, viewBobbing: value.bobView
    }));
  } catch {}
};
const formatValue = (key, value) => {
  if (key === 'music' || key === 'sound') return value === 0 ? 'OFF' : Math.round(value * 100) + '%';
  if (key === 'mouseSensitivity') return value === 0 ? '*yawn*' : value === 1 ? 'HYPERSPEED!!!' : Math.floor(value * 200) + '%';
  if (key === 'fov') return value === 0 ? 'Normal' : value === 1 ? 'Quake Pro' : String(Math.floor(70 + value * 40));
  if (key === 'gamma') return value === 0 ? 'Moody' : value === 1 ? 'Bright' : '+' + Math.floor(value * 100) + '%';
  if (key === 'viewDistance') return ['Far','Normal','Short','Tiny'][value];
  if (key === 'difficulty') return ['Peaceful','Easy','Normal','Hard'][value];
  if (key === 'fpsLimit') return ['Max FPS','Balanced','Power Saver'][value];
  if (key === 'fancyGraphics') return value ? 'Fancy' : 'Fast';
  if (key === 'guiScale') return ['Auto','Small','Normal','Large'][value];
  if (key === 'particles') return ['All','Decreased','Minimal'][value];
  return value ? 'ON' : 'OFF';
};
const keyCodeName = code => keyNames.get(code) || (code >= 0 && code < 256 ? String.fromCharCode(code).toUpperCase() : 'Unknown');
const displayKeyName = (dom, code) => {
  if (typeof dom === 'string' && dom.startsWith('Key')) return dom.slice(3);
  if (typeof dom === 'string' && dom.startsWith('Digit')) return dom.slice(5);
  if (dom === 'Space') return 'SPACE';
  if (dom === 'ArrowUp') return 'UP';
  if (dom === 'ArrowDown') return 'DOWN';
  if (dom === 'ArrowLeft') return 'LEFT';
  if (dom === 'ArrowRight') return 'RIGHT';
  if (dom?.startsWith('Mouse')) return 'Button ' + (Number(dom.slice(5)) + 1);
  return keyCodeName(code);
};

export function createOptionsScreen({ content, getSize, font, button, text, clearContent, mainScreen, playButtonSound, setActiveScreen }) {
  const settings = readOptions();
  let active = 'main', waitingKey = null;
  const resolvedAsset = path => window.mcAssetUrl?.(asset(path)) ?? asset(path);
  const sliderStyle = el('style');
  sliderStyle.textContent = `.mc10-option-slider{appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;outline:0}
  .mc10-option-slider::-webkit-slider-runnable-track{height:20px;background:url('${resolvedAsset('gui/slider-track.png')}') center/150px 20px no-repeat}
  .mc10-option-slider::-moz-range-track{height:20px;background:url('${resolvedAsset('gui/slider-track.png')}') center/150px 20px no-repeat}
  .mc10-option-slider::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:8px;height:20px;border:0;border-radius:0;background:url('${resolvedAsset('gui/slider-thumb.png')}') center/8px 20px no-repeat}
  .mc10-option-slider::-moz-range-thumb{width:8px;height:20px;border:0;border-radius:0;background:url('${resolvedAsset('gui/slider-thumb.png')}') center/8px 20px no-repeat}`;
  document.head.append(sliderStyle);
  const screen = el('div', { id:'mc10-options-root' });
  Object.assign(screen.style, { position:'absolute', inset:'0', zIndex:'4', display:'none', backgroundColor:'#202020', backgroundImage:`url("${resolvedAsset('gui/background.png')}")`, backgroundRepeat:'repeat', backgroundSize:'32px 32px' });
  content.append(screen);
  const show = name => {
    active = name; setActiveScreen?.(() => show(active)); screen.style.display = 'block'; clearContent(); content.append(screen); screen.replaceChildren();
    const { width, height } = getSize();
    const title = name === 'main' ? 'Options' : name === 'video' ? 'Video Settings' : 'Controls';
    const heading = el('div'); heading.style.cssText = 'position:absolute;top:20px;left:0;width:100%;text-align:center;color:white';
    setMinecraftText(heading, title, font, { shadow:true }); screen.append(heading);
    const makeLabel = (value,x,y,w=150) => { const n=el('div'); Object.assign(n.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:'20px',display:'flex',alignItems:'center',justifyContent:'center',color:'#e0e0e0'}); setMinecraftText(n,value,font); screen.append(n); return n; };
    const control = (key,x,y,w=150) => {
      const node = button(screen, '', x, y, w, () => {
        if (key === 'invertYMouse' || typeof settings[key] === 'boolean') settings[key] = !settings[key];
        else if (cycles[key]) settings[key] = (settings[key] + 1) % cycles[key].length;
        saveOptions(settings); show(active);
      });
      node.setButtonLabel(labels[key] + ': ' + formatValue(key,settings[key]));
      return node;
    };
    const slider = (key,x,y) => {
      const current = settings[key], label = makeLabel(labels[key] + ': ' + formatValue(key,current),x,y); label.style.zIndex = '2'; label.style.pointerEvents = 'none';
      const input = el('input',{type:'range',min:'0',max:'100',step:'1',value:String(Math.round(current*100))});
      input.className = 'mc10-option-slider';
      Object.assign(input.style,{position:'absolute',left:x+'px',top:y+'px',width:'150px',height:'20px',margin:'0',opacity:'1',zIndex:'1'});
      input.addEventListener('input',()=>{settings[key]=Number(input.value)/100;setMinecraftText(label,labels[key]+': '+formatValue(key,settings[key]),font);saveOptions(settings);});
      screen.append(input);
    };
    const addDone = () => button(screen,'Done',width/2-100,height/6+168,200,()=>{if(name==='main'){screen.style.display='none';setActiveScreen?.(mainScreen);mainScreen();} else show('main');});
    if (name === 'main') {
      slider('music',width/2-155,height/6); slider('sound',width/2+5,height/6);
      control('invertYMouse',width/2-155,height/6+24); slider('mouseSensitivity',width/2+5,height/6+24);
      slider('fov',width/2-155,height/6+48); control('difficulty',width/2+5,height/6+48);
      button(screen,'Video Settings...',width/2-100,height/6+108,200,()=>show('video'));
      button(screen,'Controls...',width/2-100,height/6+132,200,()=>show('controls'));
      addDone();
    } else if (name === 'video') {
      const list=['fancyGraphics','viewDistance','ao','fpsLimit','anaglyph3d','bobView','guiScale','advancedOpengl','gamma','clouds','particles'];
      list.forEach((key,i)=>control(key,width/2-155+(i%2)*160,height/6+24*Math.floor(i/2)));
      addDone();

    } else {
      keys.forEach(([name,key],i)=>{
        const x=width/2-155+(i%2)*160,y=height/6+24*Math.floor(i/2);
        const nameNode=makeLabel(name,x,y,70); nameNode.style.justifyContent='flex-start';
        const keyButton=button(screen,waitingKey===key?'> ??? <':displayKeyName(settings.domKeys[key],settings.keys[key]),x+70,y,70,()=>{waitingKey=key;show('controls');});
        if(waitingKey===key) keyButton.setButtonLabel('> ??? <');
      });
      addDone();
    }
    if(waitingKey && name==='controls') {
      const cleanupCapture = () => {
        window.removeEventListener('keydown',capture,true);
        window.removeEventListener('mousedown',capture,true);
      };
      const capture = event => {
        if(event.type==='keydown' && event.key==='Escape'){cleanupCapture();event.preventDefault();waitingKey=null;show('controls');return;}
        if(event.type==='keydown'){
          cleanupCapture();event.preventDefault();
          const lwjglCodes = {KeyA:30,KeyB:48,KeyC:46,KeyD:32,KeyE:18,KeyF:33,KeyG:34,KeyH:35,KeyI:23,KeyJ:36,KeyK:37,KeyL:38,KeyM:50,KeyN:49,KeyO:24,KeyP:25,KeyQ:16,KeyR:19,KeyS:31,KeyT:20,KeyU:22,KeyV:47,KeyW:17,KeyX:45,KeyY:21,KeyZ:44,Digit0:11,Digit1:2,Digit2:3,Digit3:4,Digit4:5,Digit5:6,Digit6:7,Digit7:8,Digit8:9,Digit9:10,Escape:1,Tab:15,Space:57,Enter:28,Backspace:14,ShiftLeft:42,ShiftRight:54,ControlLeft:29,ControlRight:157,AltLeft:56,AltRight:184,ArrowUp:200,ArrowDown:208,ArrowLeft:203,ArrowRight:205};
          settings.keys[waitingKey] = lwjglCodes[event.code] ?? event.keyCode;
          settings.domKeys[waitingKey] = event.code;
          waitingKey=null;saveOptions(settings);show('controls');
        }
        if(event.type==='mousedown'){cleanupCapture();event.preventDefault();settings.keys[waitingKey]=-100-event.button;settings.domKeys[waitingKey]=`Mouse${event.button}`;waitingKey=null;saveOptions(settings);show('controls');}
      };
      window.addEventListener('keydown',capture,true);
      window.addEventListener('mousedown',capture,true);
    }
  };
  const open = () => show('main');
  window.addEventListener('keydown',event=>{
    if(screen.style.display==='none') return;
    if(event.key==='Escape'){if(waitingKey) return;event.preventDefault();if(active==='main'){screen.style.display='none';setActiveScreen?.(mainScreen);mainScreen();}else show('main');}
  },true);
  return { open, settings };
}
