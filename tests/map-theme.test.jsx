import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render} from 'preact';
import {act} from 'preact/test-utils';
const sdk=vi.hoisted(()=>({maps:[]}));
vi.mock('maplibre-gl',()=>({
 setWorkerUrl:vi.fn(),Marker:class {},LngLatBounds:class {},
 Map:class {constructor(options){this.options=options;this.setStyle=vi.fn();this.remove=vi.fn();sdk.maps.push(this);}on(){}resize(){}},
}));
import VectorMapCanvas from '../src/components/VectorMapCanvas.jsx';
let root;
beforeEach(()=>{sdk.maps.length=0;root=document.createElement('div');document.body.append(root);vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});});
afterEach(async()=>{await act(()=>render(null,root));root.remove();delete document.documentElement.dataset.theme;vi.unstubAllGlobals();});
it('loads the dark vector style and switches theme without another GPU map instance',async()=>{
 document.documentElement.dataset.theme='dark';
 await act(()=>render(<VectorMapCanvas/>,root));
 expect(sdk.maps[0].options.style).toBe('https://tiles.openfreemap.org/styles/dark');
 const original={sources:{},layers:[
  {id:'water',type:'fill',paint:{'fill-color':'#151515','fill-opacity':.7}},
  {id:'place_city',type:'symbol','source-layer':'place',paint:{'text-color':'#555555'}},
  {id:'unrelated',type:'fill',paint:{'fill-color':'#202020'}},
 ]};
 const styled=sdk.maps[0].options.transformStyle(undefined,original);
 expect(styled.layers[0].paint).toEqual({'fill-color':'#305970','fill-opacity':.7});
 expect(styled.layers[1].paint['text-color']).toBe('#edf1f4');
 expect(styled.layers[2]).toBe(original.layers[2]);
 expect(original.layers[0].paint['fill-color']).toBe('#151515');
 await act(async()=>{document.documentElement.dataset.theme='light';await Promise.resolve();});
 await vi.waitFor(()=>expect(sdk.maps[0].setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/liberty',{transformStyle:undefined}));
 expect(sdk.maps).toHaveLength(1);
 await act(()=>render(null,root));expect(sdk.maps[0].remove).toHaveBeenCalledOnce();
});
