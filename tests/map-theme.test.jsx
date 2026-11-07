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
 await act(async()=>{document.documentElement.dataset.theme='light';await Promise.resolve();});
 await vi.waitFor(()=>expect(sdk.maps[0].setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/liberty'));
 expect(sdk.maps).toHaveLength(1);
 await act(()=>render(null,root));expect(sdk.maps[0].remove).toHaveBeenCalledOnce();
});
