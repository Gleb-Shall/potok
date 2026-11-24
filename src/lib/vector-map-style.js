const darkLayers = {
  background: { 'background-color': '#20262c' },
  water: { 'fill-color': '#305970' },
  waterway: { 'line-color': '#5b91ac' },
  water_name: { 'text-color': '#b6def1', 'text-halo-color': '#243d50' },
  landuse_residential: { 'fill-color': '#343c43' },
  landuse_park: { 'fill-color': '#304940' },
  landcover_wood: { 'fill-color': '#365347' },
  building: { 'fill-color': '#333d48', 'fill-outline-color': '#54636d' },
  highway_path: { 'line-color': '#85999e' },
  highway_minor: { 'line-color': '#63717d' },
  highway_major_casing: { 'line-color': '#34414d' },
  highway_major_inner: { 'line-color': '#ad9880' },
  highway_major_subtle: { 'line-color': '#ad9880' },
  highway_motorway_casing: { 'line-color': '#45414a' },
  highway_motorway_inner: { 'line-color': '#d3ae7c' },
  highway_motorway_subtle: { 'line-color': '#d3ae7c' },
};

const labelPaint = {
  place: { 'text-color': '#edf1f4', 'text-halo-color': '#20262c' },
  transportation_name: { 'text-color': '#e2e8ed', 'text-halo-color': '#20262c', 'text-halo-width': 1.2 },
};

const pointOfInterest = {
  id:'potok-poi',
  type:'symbol',
  source:'openmaptiles',
  'source-layer':'poi',
  minzoom:15,
  filter:['all',['has','name'],['step',['zoom'],['<',['coalesce',['get','rank'],30],7],16,true]],
  layout:{
    'text-field':['concat','• ',['to-string',['get','name']]],
    'text-font':['Noto Sans Regular'],
    'text-size':12,
    'text-max-width':12,
    'symbol-sort-key':['coalesce',['get','rank'],30],
  },
  paint:{
    'text-color':['match',['get','class'],'shop','#f4c98b','food','#ffc0a6','hospital','#f6a7ae','#ded9ae'],
    'text-halo-color':'#20262c',
    'text-halo-width':1.4,
  },
};

function brightenDarkStyle(_previousStyle, style) {
  const layers = style.layers.map(layer => {
    const changes = darkLayers[layer.id] ?? (layer.type === 'symbol' && labelPaint[layer['source-layer']]);
    if (!changes) return layer;
    const paint = { ...layer.paint, ...changes };
    if (layer.id === 'landcover_wood') delete paint['fill-pattern'];
    return { ...layer, paint };
  });
  if (style.sources.openmaptiles?.type === 'vector' && !layers.some(layer => layer['source-layer']==='poi')) layers.push(pointOfInterest);
  return {
    ...style,
    layers,
  };
}

export function vectorMapStyle(theme) {
  const dark = theme === 'dark';
  const custom = dark ? import.meta.env.VITE_MAP_DARK_STYLE_URL : import.meta.env.VITE_MAP_STYLE_URL;
  const style = custom || `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'liberty'}`;
  return { style, transformStyle: dark && !custom ? brightenDarkStyle : undefined };
}
