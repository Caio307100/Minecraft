const VERTEX = `
attribute vec3 position;
attribute vec2 texCoord;
uniform mat4 mvp;
uniform vec2 jitter;
varying vec2 uv;
void main(){ vec4 p=mvp*vec4(position,1.0); p.xy+=jitter*p.w; gl_Position=p; uv=texCoord; }
`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D image;
uniform float opacity;
varying vec2 uv;
void main(){ vec4 c=texture2D(image,uv); gl_FragColor=vec4(c.rgb,opacity); }
`;
const QUAD = new Float32Array([
 -1,-1,1, 0,0,  1,-1,1, 1,0,  1,1,1, 1,1,  -1,1,1, 0,1
]);
const INDICES = new Uint16Array([0,1,2,0,2,3]);
function matMul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function rotateXDegrees(degrees){const d=degrees*Math.PI/180,c=Math.cos(d),s=Math.sin(d);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function rotateYDegrees(degrees){const d=degrees*Math.PI/180,c=Math.cos(d),s=Math.sin(d);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
function translate(x,y,z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);}
function perspective(){const f=1/Math.tan(Math.PI/3),n=.05,far=10;return new Float32Array([f,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);}
// Minecraft 1.0 me.a(float): 65,536-entry sine lookup table.
const SIN_TABLE=Float32Array.from({length:65536},(_,i)=>Math.fround(Math.sin(i*Math.PI*2/65536)));
function f32(value){return Math.fround(value);}
function vanillaSin(value){const javaInput=f32(value);const index=(Math.trunc(f32(javaInput*f32(10430.378)))|0)&65535;return SIN_TABLE[index];}
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl,v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export async function createVanillaPanorama(canvas,asset){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,premultipliedAlpha:false});
 if(!gl)return ()=>{};
 const images=await Promise.all(Array.from({length:6},async(_,i)=>{const im=new Image();im.src=asset('title/bg/panorama'+i+'.png');await im.decode();return im;}));
 const p=program(gl,VERTEX,FRAGMENT),vb=gl.createBuffer(),ib=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,QUAD,gl.STATIC_DRAW);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,INDICES,gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(p,'position'),uv=gl.getAttribLocation(p,'texCoord');
 const mvpLoc=gl.getUniformLocation(p,'mvp'),jitterLoc=gl.getUniformLocation(p,'jitter'),opacityLoc=gl.getUniformLocation(p,'opacity');
 const textures=images.map(im=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);return t;});
 const renderTex=gl.createTexture(),snapshot=gl.createTexture();
 const setupTex=t=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);};
 setupTex(renderTex);setupTex(snapshot);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,renderTex,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Panorama framebuffer incomplete');
 const blurP=program(gl,`attribute vec2 xy;attribute vec2 tex;varying vec2 uv;uniform float shift;void main(){uv=tex+vec2(shift,0.0);gl_Position=vec4(xy,0.0,1.0);}`,`precision mediump float;varying vec2 uv;uniform sampler2D src;uniform float alpha;void main(){gl_FragColor=vec4(texture2D(src,uv).rgb,alpha);}`);
 const blurV=gl.createBuffer();
 const fullscreenData=new Float32Array([-1,-1,0,0, 1,-1,1,0, 1,1,1,1, -1,1,0,1]);
 gl.bindBuffer(gl.ARRAY_BUFFER,blurV);gl.bufferData(gl.ARRAY_BUFFER,fullscreenData,gl.STATIC_DRAW);
 const blurI=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,blurI);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,INDICES,gl.STATIC_DRAW);
 const bl=gl.getAttribLocation(blurP,'xy'),bt=gl.getAttribLocation(blurP,'tex'),srcLoc=gl.getUniformLocation(blurP,'src'),shiftLoc=gl.getUniformLocation(blurP,'shift'),alphaLoc=gl.getUniformLocation(blurP,'alpha');
 const projection=perspective(),flip=rotateXDegrees(180),faceRot=[
  [0,0],[0,90],[0,180],[0,-90],[90,0],[-90,0]
 ];
 function drawCube(ticks){
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,256,256);gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.colorMask(true,true,true,false);
  // GuiMainMenu.b(): R(180° X), T(jitter), R(pitch X), R(yaw Y), then face rotation.
  // Reproduce Java float operations from eh.b(int,int,float), in source order.
  const tickFloat=f32(ticks);
  const pitchArg=f32(f32(tickFloat)/f32(400.0));
  const pitchDegrees=f32(f32(vanillaSin(pitchArg)*f32(25.0))+f32(20.0));
  const yawDegrees=f32(f32(-tickFloat)*f32(0.1));
  const pitch=pitchDegrees;
  const yaw=yawDegrees;
  for(let pass=0;pass<64;pass++){
   const x=((pass%8)/8-.5)/64,y=((Math.floor(pass/8))/8-.5)/64;
   const passMatrix=matMul(flip,matMul(translate(x,y,0),matMul(rotateXDegrees(pitch),rotateYDegrees(yaw))));
   for(let face=0;face<6;face++){
    const [rx,ry]=faceRot[face];
    const faceMatrix=rx!==0?rotateXDegrees(rx):rotateYDegrees(ry);
    gl.uniformMatrix4fv(mvpLoc,false,matMul(projection,matMul(passMatrix,faceMatrix)));
    gl.uniform2f(jitterLoc,0,0);gl.uniform1f(opacityLoc,Math.floor(255/(pass+1))/255);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[face]);gl.uniform1i(gl.getUniformLocation(p,'image'),0);
    gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
   }
  }
  gl.colorMask(true,true,true,true);gl.depthMask(true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
 }
 function postProcess(){
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.bindTexture(gl.TEXTURE_2D,snapshot);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,256,256);
  gl.useProgram(blurP);gl.bindBuffer(gl.ARRAY_BUFFER,blurV);gl.bufferData(gl.ARRAY_BUFFER,fullscreenData,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(bl);gl.vertexAttribPointer(bl,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(bt);gl.vertexAttribPointer(bt,2,gl.FLOAT,false,16,8);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,blurI);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,snapshot);gl.uniform1i(srcLoc,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.colorMask(true,true,true,false);
  for(let i=0;i<3;i++){gl.uniform1f(alphaLoc,1/(i+1));gl.uniform1f(shiftLoc,(i-1)/256);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);}
  gl.colorMask(true,true,true,true);gl.disable(gl.BLEND);
 }
 function present(){
  const displayWidth=Math.max(1,Math.round(canvas.clientWidth*devicePixelRatio));
  const displayHeight=Math.max(1,Math.round(canvas.clientHeight*devicePixelRatio));
  if(canvas.width!==displayWidth)canvas.width=displayWidth;
  if(canvas.height!==displayHeight)canvas.height=displayHeight;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
  gl.useProgram(blurP);gl.bindBuffer(gl.ARRAY_BUFFER,blurV);gl.enableVertexAttribArray(bl);gl.vertexAttribPointer(bl,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(bt);gl.vertexAttribPointer(bt,2,gl.FLOAT,false,16,8);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,blurI);
  const w=canvas.width,h=canvas.height,scale=120/Math.max(w,h),f4=h*scale/256,f5=w*scale/256;
  const data=new Float32Array([-1,-1,.5+f4,.5+f5, 1,-1,.5+f4,.5-f5, 1,1,.5-f4,.5-f5, -1,1,.5-f4,.5+f5]);
  gl.bindBuffer(gl.ARRAY_BUFFER,blurV);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,renderTex);gl.uniform1i(srcLoc,0);gl.uniform1f(alphaLoc,1);gl.uniform1f(shiftLoc,0);gl.disable(gl.BLEND);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
 }
 let frame=0,active=true,lastTime=performance.now(),tickCount=0,partialTick=0;
 // Vanilla Timer: accumulate real elapsed time into 50 ms game ticks.
 const tick=()=>{if(!active)return;const now=performance.now();const delta=Math.max(0,Math.min(now-lastTime,1000));lastTime=now;const elapsed=f32(f32(partialTick)+f32(delta/50));const wholeTicks=Math.floor(elapsed);tickCount+=wholeTicks;partialTick=f32(elapsed-wholeTicks);const ticks=f32(f32(tickCount)+partialTick);drawCube(ticks);for(let i=0;i<8;i++)postProcess();present();frame=requestAnimationFrame(tick);};
 tick();return ()=>{active=false;cancelAnimationFrame(frame);};
}
