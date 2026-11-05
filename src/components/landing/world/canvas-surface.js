import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter } from 'three';
import { paintSurface } from './dom-surface.js';

export function createSurface() {
  const canvas=document.createElement('canvas');
  const makeTexture=()=>{
    const result=new CanvasTexture(canvas);
    result.colorSpace=SRGBColorSpace;
    result.generateMipmaps=true;result.minFilter=LinearMipmapLinearFilter;
    return result;
  };
  let texture=makeTexture();
  return {
    get texture(){return texture;},
    update(element,ratio){
      if(!texture) return null;
      const width=canvas.width,height=canvas.height;
      if(paintSurface(element,canvas,ratio)){
        // GPU texture storage cannot be resized in place.
        if(canvas.width!==width || canvas.height!==height){texture.dispose();texture=makeTexture();}
        else texture.needsUpdate=true;
      }
      return texture;
    },
    dispose(){
      if(!texture) return;
      texture.dispose();texture.image=null;texture=null;
      canvas.width=canvas.height=0;
    },
  };
}
