function compileShader(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  return shader;
}

export function createScale2x(canvas,sourceCanvas){
  const gl=canvas.getContext("webgl2",{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
  if(gl){
    const vertex=compileShader(gl,gl.VERTEX_SHADER,"#version 300 es\nvoid main(){vec2 p=gl_VertexID==0?vec2(-1.,-1.):gl_VertexID==1?vec2(3.,-1.):vec2(-1.,3.);gl_Position=vec4(p,0.,1.);}");
    const fragment=compileShader(gl,gl.FRAGMENT_SHADER,"#version 300 es\nprecision highp float;precision highp int;uniform sampler2D uFrame;out vec4 outColor;void main(){ivec2 q=ivec2(gl_FragCoord.xy);ivec2 size=textureSize(uFrame,0);ivec2 p=clamp(q/2,ivec2(0),size-1);vec4 e=texelFetch(uFrame,p,0);vec4 b=texelFetch(uFrame,clamp(p+ivec2(0,1),ivec2(0),size-1),0);vec4 d=texelFetch(uFrame,clamp(p+ivec2(-1,0),ivec2(0),size-1),0);vec4 f=texelFetch(uFrame,clamp(p+ivec2(1,0),ivec2(0),size-1),0);vec4 h=texelFetch(uFrame,clamp(p+ivec2(0,-1),ivec2(0),size-1),0);vec4 c=e;if(!all(equal(b,h))&&!all(equal(d,f))){bool right=(q.x&1)==1;bool top=(q.y&1)==1;if(top)c=right?(all(equal(b,f))?f:e):(all(equal(d,b))?d:e);else c=right?(all(equal(h,f))?h:e):(all(equal(d,h))?d:e);}outColor=c;}");
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.useProgram(program);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sourceCanvas.width,sourceCanvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.uniform1i(gl.getUniformLocation(program,"uFrame"),0);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.DITHER);
    return{
      draw(){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,sourceCanvas);gl.drawArrays(gl.TRIANGLES,0,3);},
      clear(){gl.clearColor(0.043,0.039,0.063,1);gl.clear(gl.COLOR_BUFFER_BIT);}
    };
  }
  const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
  const output=ctx.createImageData(canvas.width,canvas.height),dst=new Uint32Array(output.data.buffer),outW=canvas.width;
  return{
    draw(){
      const image=sourceCanvas.getContext("2d").getImageData(0,0,sourceCanvas.width,sourceCanvas.height),src=new Uint32Array(image.data.buffer),w=sourceCanvas.width,h=sourceCanvas.height;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x,e=src[i],b=src[y?i-w:i],d=src[x?i-1:i],f=src[x<w-1?i+1:i],below=src[y<h-1?i+w:i],o=(y*2)*outW+x*2;
        if(b!==below&&d!==f){dst[o]=d===b?d:e;dst[o+1]=b===f?f:e;dst[o+outW]=d===below?d:e;dst[o+outW+1]=below===f?below:e;}
        else dst[o]=dst[o+1]=dst[o+outW]=dst[o+outW+1]=e;
      }
      ctx.putImageData(output,0,0);
    },
    clear(){ctx.fillStyle="#0b0a10";ctx.fillRect(0,0,canvas.width,canvas.height);}
  };
}
