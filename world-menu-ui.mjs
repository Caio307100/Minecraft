export const asset = path => `./public/assets/mc10/${path}`;
export const labels = {
  singleplayer: 'Singleplayer', multiplayer: 'Multiplayer', texturePacks: 'Texture Packs',
  options: 'Options...', quit: 'Quit Game', selectTitle: 'Select World',
  play: 'Play Selected World', create: 'Create New World', rename: 'Rename', delete: 'Delete', cancel: 'Cancel',
  renameTitle: 'Rename World', renameButton: 'Rename', newWorld: 'New World', worldName: 'World Name',
  resultFolder: 'Will be saved in:', enterSeed: 'Seed for the World Generator', seedInfo: 'Leave blank for a random seed',
  gameMode: 'Game Mode:', survival: 'Survival', creative: 'Creative', hardcore: 'Hardcore',
  survival1: 'Search for resources, crafting, gain', survival2: 'levels, health and hunger',
  creative1: 'Unlimited resources, free flying and', creative2: 'destroy blocks instantly',
  hardcore1: 'Same as survival mode, locked at hardest', hardcore2: 'difficulty, and one life only',
  more: 'More World Options...', done: 'Done', structures: 'Generate Structures:', on: 'ON', off: 'OFF',
  structuresInfo: 'Villages, dungeons etc', worldType: 'World Type: Normal',
  deleteQuestion: 'Are you sure you want to delete this world?', deleteWarning: 'will be lost forever! (A long time!)'
};

export const styleText = `
#mc10-menu [hidden]{display:none!important}
#mc10-menu{position:fixed;inset:0;z-index:200;overflow:hidden;color:#fff;font-family:monospace;image-rendering:pixelated;user-select:none}
#mc10-panorama{position:absolute;inset:0;perspective:200px;perspective-origin:50% 50%;overflow:hidden;background:#000}
#mc10-panorama-cube{position:absolute;width:256px;height:256px;left:50%;top:50%;margin:-128px 0 0 -128px;transform-style:preserve-3d;animation:mc10-pan 42s linear infinite}
.mc10-pan-face{position:absolute;left:0;top:0;width:256px;height:256px;background-size:256px 256px;backface-visibility:hidden}
.mc10-pan-face:nth-child(1){transform:translateZ(128px);}
.mc10-pan-face:nth-child(2){transform:rotateY(90deg) translateZ(128px);}
.mc10-pan-face:nth-child(3){transform:rotateY(180deg) translateZ(128px);}
.mc10-pan-face:nth-child(4){transform:rotateY(-90deg) translateZ(128px);}
.mc10-pan-face:nth-child(5){transform:rotateX(90deg) translateZ(128px);}
.mc10-pan-face:nth-child(6){transform:rotateX(-90deg) translateZ(128px);}
@keyframes mc10-pan{0%{transform:scaleX(1.55) scaleY(.87) rotateX(20deg) rotateY(0deg)}50%{transform:scaleX(1.55) scaleY(.87) rotateX(27deg) rotateY(-180deg)}100%{transform:scaleX(1.55) scaleY(.87) rotateX(20deg) rotateY(-360deg)}}

#mc10-panorama:after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.10);pointer-events:none}
#mc10-menu-content{position:absolute;inset:0;text-shadow:1px 1px 0 #3f3f3f;font-size:8px}
#mc10-logo{position:absolute;top:30px;left:50%;width:274px;height:44px;transform:translateX(-50%);image-rendering:pixelated}
.mc10-splash{position:absolute;top:62px;left:calc(50% + 90px);color:#ffff00;font-size:10px;white-space:nowrap;transform:rotate(-20deg);animation:mc10-splash 1s ease-in-out infinite alternate}
@keyframes mc10-splash{from{scale:var(--splash-min)}to{scale:var(--splash-max)}}
.mc10-footer{position:absolute;bottom:5px;font-size:8px;color:#fff}.mc10-footer.left{left:2px}.mc10-footer.right{right:2px}
.mc10-screen-title{position:absolute;top:20px;left:0;width:100%;text-align:center;font-size:16px;color:#fff}
.mc10-button{position:absolute;height:20px;border:0;border-radius:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;color:#e0e0e0;font:8px monospace;text-shadow:1px 1px #3f3f3f;cursor:pointer;image-rendering:pixelated}
.mc10-button:disabled{color:#a0a0a0;cursor:default}
.mc10-button span{position:relative;z-index:1}
.mc10-button.mc10-wide{width:200px}
.mc10-button.mc10-small{width:98px}
.mc10-world-list{position:absolute;top:32px;bottom:64px;left:0;width:100%;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;background-color:#202020;background-repeat:repeat;background-size:32px 32px;background-blend-mode:multiply;background-attachment:scroll;padding-top:4px;box-sizing:border-box}
.mc10-world-list:before,.mc10-world-list:after{content:'';position:absolute;display:block;left:0;width:100%;height:4px;pointer-events:none;z-index:2}
.mc10-world-list:before{top:0;background:linear-gradient(to bottom,transparent 0%,#000 100%)}
.mc10-world-list:after{bottom:0;background:linear-gradient(to bottom,transparent 0%,#000 100%)}
.mc10-world-entry{position:relative;display:block;box-sizing:border-box;width:220px;height:36px;margin:0 auto;padding:0 2px;border:0;cursor:pointer;color:#fff;text-align:left;background:transparent}
.mc10-world-entry.selected:before{content:'';position:absolute;left:0;right:0;top:-2px;bottom:2px;border:1px solid #808080;background:#000;pointer-events:none}

.mc10-world-entry .name,.mc10-world-entry .detail,.mc10-world-entry .mode{position:absolute;left:4px;right:2px;z-index:1;font-size:8px;line-height:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc10-world-entry .name{top:1px;color:#fff}
.mc10-world-entry .detail{top:12px;color:#808080}
.mc10-world-entry .mode{top:22px;color:#808080}

.mc10-form{position:absolute;left:calc(50% - 155px);top:0;width:310px;height:100%;font-size:8px}
.mc10-label{position:absolute;left:0;color:#a0a0a0;height:12px;white-space:nowrap}
.mc10-input{position:absolute;left:50%;transform:translateX(-50%);width:200px;height:20px;padding:2px 4px;border:2px solid #a0a0a0;border-right-color:#555;border-bottom-color:#555;border-radius:0;background:#000;color:#fff;font:8px monospace;outline:none}
.mc10-input:focus{border-color:#fff}
.mc10-textbox{position:absolute;left:55px;transform:none;width:200px;height:20px;box-sizing:border-box;border:2px solid #a0a0a0;border-right-color:#555;border-bottom-color:#555;background:#000;color:#e0e0e0;padding:4px;overflow:hidden;cursor:text}
.mc10-textbox:focus-within{border-color:#fff}
.mc10-textbox .mc-text{display:inline-flex;white-space:pre;height:8px}
.mc10-textbox .mc-cursor{display:inline-block;width:1px;height:8px;background:#e0e0e0;margin-left:1px;animation:mc10-cursor .6s steps(1,end) infinite}
@keyframes mc10-cursor{50%{opacity:0}}
.mc10-textbox-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:text}
.mc10-description{position:absolute;left:0;color:#a0a0a0;line-height:12px;white-space:nowrap}
.mc10-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(300px,92vw);padding:16px 12px;background:#202020;border:2px solid #aaa;text-align:center;box-shadow:0 0 0 100vmax #0008}
.mc10-dialog p{font-size:8px;line-height:14px;margin:0 0 8px}
`;

export function el(tag, props = {}, text = '') {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (text) node.textContent = text;
  return node;
}

