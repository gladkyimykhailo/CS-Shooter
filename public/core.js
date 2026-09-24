export const WEAPONS = {
  pistol: { name: 'P-12', type: 'ПІСТОЛЕТ', price: 0, damage: 25, size: 12, rate: .29, reload: 1.35, spread: .012, pellets: 1, automatic: false, icon: '▰━', description: 'Надійний запасний. 25 шкоди · 12 патронів' },
  smg: { name: 'VIPER', type: 'ПІСТОЛЕТ-КУЛЕМЕТ', price: 1200, damage: 18, size: 30, rate: .09, reload: 1.65, spread: .027, pellets: 1, automatic: true, icon: '▰▰━━', description: 'Швидкі черги. 18 шкоди · 30 патронів' },
  rifle: { name: 'RANGER', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2400, damage: 30, size: 30, rate: .14, reload: 2, spread: .016, pellets: 1, automatic: true, icon: '▰▰━━━━', description: 'Контроль дистанції. 30 шкоди · 30 патронів' },
  shotgun: { name: 'HAMMER', type: 'ДРОБОВИК', price: 1800, damage: 8, size: 6, rate: .85, reload: 2.1, spread: .11, pellets: 10, automatic: false, icon: '▰━━━━━', description: 'Близький контакт. 10 дробин × 8 · 6 патронів' },
  kalash: { name: 'KALASH', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2500, damage: 34, size: 30, rate: .11, reload: 2.2, spread: .02, pellets: 1, automatic: true, headMult: 3, icon: '▰▰━━━', description: 'Легенда штурмових. 34 шкоди · ×3 у голову · 30 патронів' },
  marksman: { name: 'LOOKOUT M7', type: 'ТОЧНА ГВИНТІВКА', price: 1900, damage: 70, size: 10, rate: .68, reload: 2.35, spread: .004, pellets: 1, automatic: false, headMult: 2, scope: .38, icon: '◄══════⊙', description: 'Швидкий точний постріл. Оптика ×2 · 10 патронів' },
  sniper: { name: 'NORTHSTAR', type: 'ВАЖКА СНАЙПЕРСЬКА', price: 3900, damage: 110, size: 5, rate: 1.12, reload: 3.05, spread: .0015, pellets: 1, automatic: false, headMult: 2, scope: .25, icon: '◄════════⊙', description: 'Один влучний постріл. Оптика ×4 · 5 патронів' }
};
// A tile-based adaptation of the supplied Mirage floor-plan reference.
// Rooms are carved from solid masonry, so routes cannot bypass the buildings.
const mirageRooms = [
  [3,4,8,8], [10,5,4,3], [12,3,20,4], [29,3,6,8], // B, apartments, back rooms
  [32,9,4,13], [33,17,5,8], [20,12,14,4], [18,12,5,14], // T, top mid, mid
  [8,10,5,3], [10,11,4,7], [12,14,8,4], [15,6,3,10], // short and underpass
  [3,14,6,7], [4,10,3,6], [2,19,4,12], [2,28,7,8], // market and CT approach
  [12,20,5,5], [16,21,4,2], [9,23,7,4], [16,24,4,6], // window, jungle, connector
  [13,27,6,4], [8,29,12,7], [19,30,9,4], [25,24,3,9], // A and ramp
  [27,22,9,5], [33,24,3,7], [30,28,6,8], [18,35,18,3] // T approach, palace, balcony
];
const mirageCallouts = [
  {name:'АПАРТАМЕНТИ',point:[22.5,4.5]}, {name:'РИНОК',point:[5.5,17.5]},
  {name:'SHORT',point:[13.5,15.5]}, {name:'ПІДЗЕМНИЙ ПРОХІД',point:[16.5,9.5]},
  {name:'ВІКНО',point:[14.5,22.5]}, {name:'КОНЕКТОР',point:[17.5,26.5]},
  {name:'JUNGLE',point:[11.5,25.5]}, {name:'РАМПА A',point:[26.5,29.5]},
  {name:'ПАЛАЦ',point:[32.5,32.5]}, {name:'БАЛКОН',point:[22.5,36.5]},
  {name:'CT',point:[5.5,32.5]}, {name:'T',point:[35.5,20.5]}
];
// Dust II reference: B and tunnels to the west, mid through the centre,
// the bent short approach and long lane converge on the elevated A courtyard.
const dust2Rooms = [
  [3,4,10,10], [12,9,6,4], [12,6,7,2], // B, B doors, separate B window
  [16,6,10,7], [23,8,8,3], // CT courtyard and A approach
  [27,3,10,10], [25,10,7,6], [25,15,4,10], [22,22,6,4], // A, short, catwalk
  [18,12,5,17], [18,26,5,9], [8,31,14,6], // mid, top mid, T courtyard
  [3,19,9,7], [5,12,4,9], [10,22,11,4], [5,25,5,10], // upper/lower tunnels
  [3,28,7,6], [6,33,7,4], // outside tunnels and the broad T approach
  [20,31,13,5], [30,25,5,10], [30,23,5,5], // T to long doors
  [34,8,4,17], [30,18,8,6], [29,16,4,5] // long A, corner, pit
];
const dust2Callouts = [
  {name:'LONG A',point:[35.5,16.5]}, {name:'SHORT A',point:[26.5,18.5]},
  {name:'ДВЕРІ LONG',point:[32.5,29.5]}, {name:'ЯМА',point:[30.5,17.5]},
  {name:'ВЕРХНІ ТУНЕЛІ',point:[7.5,22.5]}, {name:'НИЖНІ ТУНЕЛІ',point:[15.5,23.5]},
  {name:'ДВЕРІ MID',point:[20.5,15.5]}, {name:'ДВЕРІ B',point:[14.5,10.5]},
  {name:'ВІКНО B',point:[14.5,6.5]}, {name:'ЗОВНІ ТУНЕЛІВ',point:[5.5,30.5]},
  {name:'ДВІР LONG',point:[31.5,32.5]},
  {name:'TOP MID',point:[20.5,28.5]}, {name:'СХОДИ A',point:[26.5,13.5]},
  {name:'CT',point:[20.5,8.5]}, {name:'T',point:[12.5,34.5]}
];
// Photo adaptation: the park and A occupy the west, a winding connector
// separates them from B and the long canal approach on the east. Height layers
// are side by side: this renderer does not support a playable road over a tunnel.
const overpassRooms = [
  [5,4,12,9], [6,2,5,4], [15,7,7,3], [17,5,8,5], // A, bank, CT
  [3,11,4,22], [3,29,16,10], // long A and fountain park
  [12,11,5,12], [12,20,9,5], [16,22,5,13], // bathrooms and short A
  [20,9,4,21], [23,7,9,3], // connector and heaven
  [23,16,8,4], [29,8,11,10], // short B and B courtyard
  [29,18,5,15], [36,17,4,16], // canal and separate Monster approach
  [29,29,10,7], [33,34,7,8], [18,33,17,5] // lower canal, T and playground
];
const overpassCallouts = [
  {name:'БАНК',point:[8.5,3.5]}, {name:'LONG A',point:[5.5,23.5]},
  {name:'ФОНТАН',point:[10.5,31.5]}, {name:'ПАРК',point:[7.5,34.5]},
  {name:'ТУАЛЕТИ',point:[14.5,20.5]}, {name:'SHORT A',point:[18.5,28.5]},
  {name:'МАЙДАНЧИК',point:[24.5,35.5]}, {name:'HEAVEN',point:[26.5,8.5]},
  {name:'SHORT B',point:[26.5,17.5]}, {name:'КАНАЛ',point:[32.5,27.5]},
  {name:'MONSTER',point:[38.5,23.5]}, {name:'CT',point:[20.5,6.5]},
  {name:'T',point:[35.5,38.5]}
];
// Ancient photo: two temple courtyards, a central donut loop and a broad
// southern approach that splits into the western ruins and eastern cave lane.
const ancientRooms = [
  [3,4,12,10], [5,2,7,4], [13,6,10,4], [20,3,8,7], // A, temple, CT
  [26,6,12,10], [35,13,5,9], // B and long approach
  [3,12,4,15], [3,24,10,7], // western ruins
  [11,12,4,8], [11,18,10,4], [18,10,4,12], // donut loop around solid masonry
  [18,20,6,10], [11,25,11,5], // mid and T to ruins
  [22,13,8,4], [27,14,4,12], [29,23,9,6], // cave and ramp B
  [35,26,5,9], [24,31,14,5], // eastern T approach
  [6,29,5,10], [7,35,21,5], [20,36,6,6] // T stairs, spawn and rear alcove
];
const ancientCallouts = [
  {name:'ХРАМ',point:[8.5,3.5]}, {name:'РУЇНИ',point:[5.5,21.5]},
  {name:'DONUT',point:[14.5,19.5]}, {name:'ТОП MID',point:[20.5,12.5]},
  {name:'ПЕЧЕРА',point:[25.5,14.5]}, {name:'РАМПА B',point:[29.5,21.5]},
  {name:'LONG B',point:[37.5,20.5]}, {name:'ДВІР T',point:[12.5,37.5]},
  {name:'СХОДИ T',point:[8.5,32.5]}, {name:'CT',point:[23.5,5.5]},
  {name:'T',point:[22.5,38.5]}
];
// Inferno photo: the fountain courtyard is reached by a bent Banana lane;
// the long southern street splits around the apartments toward the A courtyard.
const infernoRooms = [
  [3,5,11,10], [4,2,7,5], [12,7,7,4], // B fountain, church and coffins
  [18,3,11,9], [27,7,8,4], [29,9,4,8], // CT, library and arch
  [33,8,11,11], [33,16,4,10], [39,18,5,10], // A, short and pit
  [10,13,4,9], [10,20,8,4], [14,22,4,10], // winding Banana
  [14,29,10,4], [12,32,5,10], // T ramp to Banana
  [22,16,4,21], [24,14,13,4], [25,23,11,4], // mid, top mid and short
  [24,28,19,4], [39,24,4,8], [34,30,4,11], // apartments, balcony and alt mid
  [21,37,17,4], [12,39,15,6] // lower street and T spawn
];
const infernoCallouts = [
  {name:'BANANA',point:[15.5,25.5]}, {name:'ФОНТАН B',point:[7.5,12.5]},
  {name:'ЦЕРКВА',point:[7.5,3.5]}, {name:'COFFINS',point:[15.5,8.5]},
  {name:'АРКА',point:[30.5,13.5]}, {name:'БІБЛІОТЕКА',point:[28.5,8.5]},
  {name:'TOP MID',point:[26.5,16.5]}, {name:'SHORT A',point:[31.5,24.5]},
  {name:'АПАРТАМЕНТИ',point:[36.5,29.5]}, {name:'БАЛКОН',point:[40.5,28.5]},
  {name:'ЯМА',point:[41.5,24.5]}, {name:'ALT MID',point:[35.5,35.5]},
  {name:'РАМПА T',point:[15.5,34.5]}, {name:'CT',point:[22.5,5.5]},
  {name:'T',point:[18.5,42.5]}
];
const specs = [
  { id:'mirage', name:'MIRAGE · PIXEL', desc:'За твоєю схемою: A, B, MID, палац, апартаменти, ринок і конектор. Без контейнерів.', tag:'ПІКСЕЛЬНА АДАПТАЦІЯ', label:'ПАЛАЦ · MID · АПАРТАМЕНТИ', size:40, rooms:mirageRooms, callouts:mirageCallouts,
    wall:'#c5a273', light:'#f3dfb3', sky:'#b9d4d7', floor:'#b19a77', accent:'#779c9b',
    blue:[[5.5,32.5],[4.5,31.5],[6.5,34.5]], red:[[35.5,20.5],[34.5,19.5],[36.5,22.5]],
    platforms:[{x:24,y:35,w:12,h:3,z:.9},{x:30,y:28,w:6,h:7,z:.9},{x:12,y:20,w:5,h:5,z:.6},{x:9,y:23,w:7,h:4,z:.6},{x:16,y:24,w:4,h:2,z:.6},{x:12,y:3,w:23,h:8,z:.6}],
    stairs:[
      {x:16,y:26,w:4,h:3,axis:'y',dir:-1,rise:.6},
      {x:16,y:21,w:4,h:2,axis:'x',dir:-1,rise:.6},
      {x:25,y:28,w:3,h:6,axis:'y',dir:-1,rise:.9},
      {x:25,y:24,w:3,h:4,axis:'y',dir:1,rise:.9},
      {x:33,y:24,w:3,h:4,axis:'y',dir:1,rise:.9},
      {x:19,y:35,w:5,h:3,axis:'x',dir:1,rise:.9},
      {x:10,y:5,w:4,h:3,axis:'x',dir:1,rise:.6},
      {x:32,y:9,w:4,h:4,axis:'y',dir:-1,rise:.6},
      {x:15,y:8,w:3,h:5,axis:'y',dir:-1,rise:.6}
    ],
    blocks:[[5,6,1,2,2],[8,8,1,2,2],[31,5,1,1,1],[10,31,1,2,2],[14,33,2,1,2],[17,30,1,2,2],[30,30,1,1,2],[33,34,1,1,2]] },
  {
    id:'dust2',name:'DUST II · PIXEL',desc:'За твоїм фото: двори A/B, Long, Short, яма, подвійні двері й тунелі. Піщаний макет з об’ємними сходами та вікном B.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'LONG · SHORT · ТУНЕЛІ',size:40,rooms:dust2Rooms,callouts:dust2Callouts,
    wall:'#dac9a5',light:'#f4e5c4',sky:'#c6d9dd',floor:'#bca47c',accent:'#a88d62',
    blue:[[20.5,8.5],[18.5,9.5],[21.5,10.5]],red:[[12.5,34.5],[14.5,32.5],[10.5,35.5]],
    platforms:[{x:27,y:3,w:10,h:10,z:.9},{x:25,y:10,w:4,h:12,z:.6},{x:25,y:10,w:4,h:2,z:.9},{x:34,y:14,w:4,h:11,z:.45},{x:30,y:21,w:8,h:3,z:.45},{x:3,y:19,w:9,h:7,z:.6},{x:13,y:6,w:3,h:2,z:.45}],
    stairs:[
      {x:23,y:8,w:5,h:3,axis:'x',dir:1,rise:.9},
      {x:25,y:12,w:4,h:4,axis:'y',dir:-1,base:.6,rise:.3},
      {x:25,y:21,w:4,h:4,axis:'y',dir:-1,rise:.6},
      {x:34,y:8,w:4,h:6,axis:'y',dir:-1,base:.45,rise:.45},
      {x:31,y:24,w:4,h:4,axis:'y',dir:-1,rise:.45},
      {x:30,y:18,w:3,h:4,axis:'y',dir:1,rise:.45},
      {x:5,y:13,w:4,h:6,axis:'y',dir:1,rise:.6},
      {x:5,y:25,w:5,h:4,axis:'y',dir:-1,rise:.6},
      {x:10,y:22,w:8,h:4,axis:'x',dir:-1,rise:.6},
      {x:9,y:6,w:4,h:2,axis:'x',dir:1,rise:.45},
      {x:16,y:6,w:3,h:2,axis:'x',dir:-1,rise:.45}
    ],
    blocks:[
      [3,4,2,1,1],[3,13,2,1,1],[5,6,2,1,2],[9,9,1,2,2],[4,11,1,2,2], // B courtyard
      [13,9,1,1,3],[13,12,1,1,3], // B doors leave a two-tile opening
      [27,3,2,1,1],[36,3,1,2,1],[29,5,2,1,2],[33,8,1,2,2],[35,5,1,2,2], // A cover
      [18,15,2,1,3],[22,15,1,1,3], // offset mid doors
      [30,29,2,1,3],[34,28,1,2,3], // long doors, below the stairs
      [36,22,2,1,2],[31,16,2,1,2], // long corner and pit cover
      [3,19,2,1,1],[10,19,2,1,1],[7,20,1,1,2],[8,23,1,1,2], // tunnel pillars
      [3,28,1,2,1],[8,34,1,2,2],[16,35,2,1,2],[25,33,2,1,2] // T courtyard
    ]
  },
  {
    id:'overpass',name:'OVERPASS · PIXEL',desc:'За твоїм фото: парк із фонтаном, Long A, туалети, конектор, канал і Monster. Верхня точка A та нижній двір B.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'ПАРК · КАНАЛ · MONSTER',size:44,rooms:overpassRooms,callouts:overpassCallouts,
    wall:'#999d91',light:'#ded9c2',sky:'#b6c7c8',floor:'#8d8977',accent:'#73948d',
    blue:[[19.5,6.5],[21.5,6.5],[18.5,8.5]],red:[[35.5,38.5],[37.5,39.5],[34.5,36.5]],
    platforms:[{x:3,y:2,w:22,h:11,z:.9},{x:29,y:8,w:11,h:10,z:.3},{x:23,y:7,w:9,h:3,z:.9}],
    stairs:[
      {x:3,y:13,w:4,h:6,axis:'y',dir:-1,rise:.9},
      {x:12,y:13,w:5,h:6,axis:'y',dir:-1,rise:.9},
      {x:20,y:13,w:4,h:6,axis:'y',dir:-1,rise:.9},
      {x:29,y:10,w:3,h:6,axis:'y',dir:-1,base:.3,rise:.6},
      {x:29,y:18,w:5,h:4,axis:'y',dir:-1,rise:.3},
      {x:36,y:18,w:4,h:4,axis:'y',dir:-1,rise:.3}
    ],
    blocks:[
      [5,4,2,1,1],[6,2,1,1,1],[9,6,2,1,2],[13,9,2,2,2], // A cover and bank
      [8,30,2,2,2],[14,34,1,2,2],[5,36,2,1,2], // fountain and park benches
      [3,23,1,3,1],[12,20,1,2,1],[18,23,1,2,1], // long and bathroom turns
      [34,10,2,2,3],[37,14,2,1,2],[32,16,2,1,2], // B pillar and cover
      [30,25,1,3,2],[38,26,2,1,3],[36,35,1,2,2],[38,40,2,1,1] // canal and T approach
    ]
  },
  {
    id:'ancient',name:'ANCIENT · PIXEL',desc:'За твоїм фото: зелені кам’яні руїни, храм A, Donut, MID, печера та рампа B. Сходи й двори серед стародавніх стін.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'ХРАМ · DONUT · ПЕЧЕРА',size:44,rooms:ancientRooms,callouts:ancientCallouts,
    wall:'#71815a',light:'#b0bc88',sky:'#a8b9a1',floor:'#65734b',accent:'#87966b',
    blue:[[23.5,5.5],[21.5,4.5],[25.5,7.5]],red:[[22.5,38.5],[20.5,37.5],[24.5,40.5]],
    platforms:[{x:3,y:2,w:37,h:12,z:.6},{x:11,y:14,w:11,h:8,z:.3},{x:22,y:13,w:5,h:4,z:.6},{x:26,y:6,w:12,h:10,z:.6},{x:18,y:20,w:6,h:2,z:.3},{x:6,y:35,w:34,h:7,z:.3}],
    stairs:[
      {x:3,y:14,w:4,h:6,axis:'y',dir:-1,rise:.6},
      {x:11,y:14,w:4,h:4,axis:'y',dir:-1,base:.3,rise:.3},
      {x:18,y:14,w:4,h:4,axis:'y',dir:-1,base:.3,rise:.3},
      {x:18,y:22,w:6,h:4,axis:'y',dir:-1,rise:.3},
      {x:27,y:14,w:4,h:6,axis:'y',dir:-1,rise:.6},
      {x:35,y:14,w:5,h:6,axis:'y',dir:-1,rise:.6},
      {x:6,y:29,w:5,h:6,axis:'y',dir:1,rise:.3},
      {x:24,y:31,w:4,h:4,axis:'y',dir:1,rise:.3}
    ],
    blocks:[
      [3,4,2,1,1],[5,2,1,1,1],[5,7,2,2,2],[10,10,2,1,2],
      [29,8,2,2,2],[35,10,2,1,2],[36,6,2,1,1],
      [4,25,2,2,2],[12,19,1,1,3],[19,27,1,2,2],
      [35,24,2,1,2],[36,31,1,2,2],[8,36,2,1,2],[25,36,1,1,2]
    ]
  },
  {
    id:'inferno',name:'INFERNO · PIXEL',desc:'За твоїм фото: Banana, фонтан B, MID, апартаменти, арка й двір A з ямою. Тепла штукатурка, цегляні стіни та об’ємні сходи.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'BANANA · MID · АПАРТАМЕНТИ',size:48,rooms:infernoRooms,callouts:infernoCallouts,
    wall:'#c69b75',light:'#efd4aa',sky:'#c3d2d6',floor:'#a78d72',accent:'#ac7053',
    blue:[[22.5,5.5],[20.5,4.5],[24.5,6.5]],red:[[18.5,42.5],[16.5,41.5],[20.5,43.5]],
    platforms:[{x:3,y:2,w:11,h:13,z:.3},{x:18,y:3,w:17,h:9,z:.6},{x:33,y:8,w:11,h:11,z:.6},{x:33,y:28,w:10,h:4,z:.45}],
    stairs:[
      {x:14,y:7,w:4,h:4,axis:'x',dir:1,base:.3,rise:.3},
      {x:10,y:15,w:4,h:5,axis:'y',dir:-1,rise:.3},
      {x:29,y:11,w:4,h:6,axis:'y',dir:-1,rise:.6},
      {x:33,y:19,w:4,h:5,axis:'y',dir:-1,rise:.6},
      {x:39,y:19,w:5,h:5,axis:'y',dir:-1,rise:.6},
      {x:27,y:28,w:6,h:4,axis:'x',dir:1,rise:.45},
      {x:39,y:24,w:4,h:4,axis:'y',dir:1,rise:.45},
      {x:34,y:32,w:4,h:5,axis:'y',dir:-1,rise:.45}
    ],
    blocks:[
      [7,9,2,2,2],[4,6,2,1,2],[11,6,1,2,2],[4,2,1,1,1], // B fountain and coffins
      [19,8,2,1,2],[26,4,2,1,2], // CT courtyard
      [35,10,2,2,2],[40,13,2,1,2],[42,8,2,1,1],[34,16,1,1,3], // A cover
      [10,21,1,2,2],[16,29,1,1,2],[23,20,1,1,3], // Banana and mid corners
      [35,29,1,1,2],[34,38,1,1,3], // apartments and alt mid
      [13,40,1,2,2],[22,42,2,1,2],[15,37,1,1,2] // T street
    ]
  },
  {
    id:'vertigo',name:'VERTIGO · PIXEL',desc:'За твоїм фото: бетонні майданчики A/B, рампа A, сходи B, MID, ліфти й риштування. Перепади висоти та відкриті двори будівництва.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'РАМПА A · MID · СХОДИ B',size:44,
    wall:'#999e9d',light:'#d9d9cf',sky:'#bdcfdd',floor:'#858d8e',accent:'#ba9c52',
    rooms:[[3,3,12,10],[17,3,10,7],[13,6,7,4],[25,6,14,4],[17,9,7,14],[10,18,12,5],[7,11,4,10],[3,29,13,11],[3,20,5,12],[6,24,12,5],[29,24,12,16],[17,34,15,6],[23,23,8,5],[20,22,7,7],[35,9,5,19],[13,34,8,5]],
    callouts:[{name:'РАМПА A',point:[25.5,36.5]},{name:'СХОДИ B',point:[8.5,16.5]},{name:'ЛІФТИ',point:[20.5,10.5]},{name:'РИШТУВАННЯ',point:[37.5,18.5]},{name:'SHORT A',point:[25.5,25.5]},{name:'НИЖНІЙ МАЙДАНЧИК',point:[6.5,26.5]},{name:'CT',point:[21.5,6.5]},{name:'T',point:[7.5,35.5]}],
    blue:[[21.5,6.5],[19.5,4.5],[24.5,8.5]],red:[[7.5,35.5],[5.5,37.5],[10.5,38.5]],
    platforms:[{x:3,y:3,w:37,h:10,z:.6},{x:29,y:23,w:12,h:17,z:.9}],
    stairs:[{x:17,y:13,w:7,h:6,axis:'y',dir:-1,rise:.6},{x:7,y:13,w:4,h:6,axis:'y',dir:-1,rise:.6},{x:23,y:34,w:6,h:6,axis:'x',dir:1,rise:.9},{x:23,y:23,w:6,h:5,axis:'x',dir:1,rise:.9},{x:35,y:13,w:5,h:10,axis:'y',dir:1,base:.6,rise:.3}],
    blocks:[[5,5,2,2,2],[11,8,2,1,2],[3,10,1,1,3],[25,4,1,1,3],[18,20,1,2,2],[4,24,1,2,3],[11,31,2,2,2],[4,38,1,1,3],[31,28,2,2,2],[37,32,2,1,2],[39,37,1,2,3],[30,37,1,1,2]]
  },
  {
    id:'office',name:'OFFICE · PIXEL',desc:'За твоїм фото: кабінети, переговорна, довгі коридори, склад паперу та гараж. Офісні перегородки, столи й кілька обходів.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'КАБІНЕТИ · КОРИДОРИ · ГАРАЖ',size:44,
    wall:'#a2aab2',light:'#e1e6e5',sky:'#b9c9d5',floor:'#69777e',accent:'#7b8f9d',
    rooms:[[4,3,10,8],[28,3,12,9],[18,4,7,10],[12,7,8,3],[23,7,8,3],[18,12,7,20],[4,15,11,10],[12,17,8,4],[9,10,4,8],[29,16,11,10],[23,18,8,4],[35,10,4,10],[3,30,13,10],[13,29,12,5],[26,30,14,11],[23,34,6,4],[13,37,16,4],[4,23,4,10],[35,24,5,9]],
    callouts:[{name:'ПЕРЕГОВОРНА',point:[9.5,6.5]},{name:'ПАПІР',point:[6.5,20.5]},{name:'ДОВГИЙ КОРИДОР',point:[21.5,15.5]},{name:'ПРОЄКТОР',point:[33.5,20.5]},{name:'РЕСЕПШН',point:[20.5,30.5]},{name:'ЗАДНІЙ ДВІР',point:[33.5,36.5]},{name:'ГАРАЖ',point:[11.5,35.5]},{name:'CT',point:[7.5,35.5]},{name:'T',point:[34.5,6.5]}],
    blue:[[7.5,35.5],[5.5,37.5],[9.5,38.5]],red:[[34.5,6.5],[31.5,4.5],[37.5,8.5]],
    platforms:[{x:3,y:3,w:38,h:23,z:.3}],
    stairs:[{x:18,y:26,w:7,h:6,axis:'y',dir:-1,rise:.3},{x:4,y:25,w:4,h:6,axis:'y',dir:-1,rise:.3},{x:35,y:26,w:5,h:5,axis:'y',dir:-1,rise:.3}],
    blocks:[[6,5,2,1,2],[11,4,1,3,3],[29,5,1,2,3],[36,9,2,1,2],[5,17,2,1,2],[10,21,2,2,2],[13,23,1,1,3],[19,23,1,2,3],[30,18,2,1,2],[36,22,2,1,2],[38,17,1,2,3],[4,32,2,1,2],[12,37,2,1,2],[29,33,2,2,2],[37,38,2,1,2]]
  },
  {
    id:'cache',name:'CACHE · PIXEL',desc:'За твоїм фото: промислові двори A/B, A Main, Squeaky, MID, вентиляція, Checkers і Heaven. Кам’яні та металеві укриття.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'A MAIN · MID · CHECKERS',size:44,
    wall:'#b4b39a',light:'#e5dfbf',sky:'#bac9c5',floor:'#94977c',accent:'#668878',
    rooms:[[3,3,12,12],[29,3,12,12],[18,3,8,8],[13,6,7,4],[24,6,7,4],[18,13,8,14],[20,9,4,7],[5,13,5,18],[3,29,12,11],[33,13,5,20],[29,30,12,10],[12,34,20,6],[19,25,6,12],[12,18,8,4],[24,18,11,4],[12,12,4,8],[27,12,8,5],[27,15,4,7]],
    callouts:[{name:'A MAIN',point:[7.5,24.5]},{name:'SQUEAKY',point:[13.5,14.5]},{name:'ВЕНТИЛЯЦІЯ',point:[16.5,19.5]},{name:'CHECKERS',point:[29.5,14.5]},{name:'HEAVEN',point:[34.5,16.5]},{name:'B MAIN',point:[35.5,26.5]},{name:'ГАРАЖ T',point:[8.5,34.5]},{name:'СКЛАД',point:[35.5,35.5]},{name:'CT',point:[21.5,5.5]},{name:'T',point:[21.5,37.5]}],
    blue:[[21.5,5.5],[19.5,4.5],[23.5,7.5]],red:[[21.5,37.5],[17.5,36.5],[25.5,38.5]],
    platforms:[{x:3,y:3,w:13,h:12,z:.3},{x:27,y:3,w:14,h:14,z:.3},{x:13,y:3,w:18,h:8,z:.3}],
    stairs:[{x:5,y:15,w:5,h:6,axis:'y',dir:-1,rise:.3},{x:12,y:15,w:4,h:5,axis:'y',dir:-1,rise:.3},{x:33,y:17,w:5,h:5,axis:'y',dir:-1,rise:.3},{x:27,y:17,w:4,h:5,axis:'y',dir:-1,rise:.3},{x:20,y:11,w:4,h:5,axis:'y',dir:-1,rise:.3}],
    blocks:[[5,5,2,2,2],[10,9,2,1,2],[3,12,1,2,3],[31,6,2,2,2],[37,10,2,1,2],[39,4,1,2,3],[20,19,2,1,2],[23,23,1,2,3],[6,31,2,2,2],[12,36,1,2,3],[32,35,2,2,2],[38,31,1,2,3],[28,37,1,2,2]]
  },
  {
    id:'nuke',name:'NUKE · PIXEL',desc:'За твоїм фото: реакторний зал A, нижній сектор B, двір із силосом, Lobby, Hut, Ramp і Secret. Металеві стіни та сходові переходи.',
    tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'OUTSIDE · RAMP · SECRET',size:48,
    wall:'#8e9fa7',light:'#d9e1df',sky:'#b9cddd',floor:'#7a878d',accent:'#d0b85f',
    rooms:[[3,3,8,10],[5,10,5,11],[8,16,6,4],[11,16,9,10],[20,15,12,13],[35,15,10,13],[29,9,11,9],[18,10,14,8],[16,21,6,7],[17,27,7,5],[3,20,10,17],[10,30,28,9],[3,35,12,8],[35,35,7,10],[36,26,6,12],[28,26,6,9],[31,24,6,5],[24,26,4,7]],
    callouts:[{name:'СИЛОС',point:[8.5,25.5]},{name:'OUTSIDE',point:[16.5,34.5]},{name:'LOBBY',point:[15.5,18.5]},{name:'HUT',point:[18.5,23.5]},{name:'SQUEAKY',point:[18.5,29.5]},{name:'RAMP',point:[36.5,13.5]},{name:'SECRET',point:[30.5,30.5]},{name:'ВЕНТИЛЯЦІЯ',point:[25.5,29.5]},{name:'ГАРАЖ',point:[9.5,38.5]},{name:'CT',point:[7.5,6.5]},{name:'T',point:[38.5,41.5]}],
    blue:[[7.5,6.5],[5.5,4.5],[8.5,9.5]],red:[[38.5,41.5],[36.5,39.5],[40.5,43.5]],
    platforms:[{x:3,y:3,w:29,h:15,z:.3},{x:11,y:16,w:9,h:10,z:.3},{x:20,y:15,w:12,h:13,z:.9},{x:29,y:9,w:11,h:3,z:.3}],
    stairs:[{x:5,y:14,w:5,h:6,axis:'y',dir:-1,rise:.3},{x:11,y:20,w:5,h:4,axis:'x',dir:1,rise:.3},{x:20,y:12,w:6,h:6,axis:'y',dir:1,base:.3,rise:.6},{x:16,y:21,w:6,h:5,axis:'x',dir:1,base:.3,rise:.6},{x:20,y:28,w:4,h:4,axis:'y',dir:-1,rise:.9},{x:24,y:28,w:4,h:5,axis:'y',dir:-1,rise:.9},{x:35,y:12,w:5,h:6,axis:'y',dir:-1,rise:.3}],
    blocks:[[4,10,1,2,3],[12,17,1,2,2],[5,23,2,2,2],[10,27,2,1,3],[23,20,2,2,2],[28,24,2,2,2],[36,20,2,2,2],[41,24,2,1,2],[30,10,1,1,3],[13,34,2,1,2],[5,38,2,2,2],[29,36,2,1,2],[38,37,2,1,2]]
  }
];
const TACTICAL_LAYOUTS = {
  vertigo:{a:{name:'A SITE',point:[35.5,29.5]},mid:{name:'MID',point:[20.5,20.5]},b:{name:'B SITE',point:[8.5,7.5]}},
  office:{a:{name:'ПЕРЕГОВОРНА',point:[9.5,8.5]},mid:{name:'КОРИДОР',point:[21.5,21.5]},b:{name:'КАБІНЕТИ',point:[33.5,9.5]}},
  cache:{a:{name:'A SITE',point:[9.5,7.5]},mid:{name:'MID',point:[22.5,22.5]},b:{name:'B SITE',point:[35.5,8.5]}},
  nuke:{a:{name:'РЕАКТОР A',point:[27.5,20.5]},mid:{name:'LOBBY',point:[16.5,19.5]},b:{name:'СЕКТОР B',point:[40.5,21.5]}},
  inferno:{a:{name:'A SITE',point:[38.5,15.5]},mid:{name:'MID',point:[23.5,26.5]},b:{name:'B SITE',point:[9.5,7.5]}},
  dust2:{a:{name:'A SITE',point:[32.5,6.5]},mid:{name:'MID',point:[20.5,19.5]},b:{name:'B SITE',point:[7.5,9.5]}},
  mirage:{a:{name:'A SITE',point:[13.5,31.5]},mid:{name:'MID',point:[20.5,19.5]},b:{name:'B SITE',point:[7.5,9.5]}},
  ancient:{a:{name:'A SITE',point:[9.5,8.5]},mid:{name:'MID',point:[20.5,24.5]},b:{name:'B SITE',point:[33.5,11.5]}},
  overpass:{a:{name:'A SITE',point:[10.5,9.5]},mid:{name:'КОНЕКТОР',point:[21.5,22.5]},b:{name:'B SITE',point:[35.5,15.5]}}
};
function nearestOpen(grid,[x,y]){
  let point=[1.5,1.5],distance=Infinity;
  for(let gy=1;gy<grid.length-1;gy++)for(let gx=1;gx<grid[gy].length-1;gx++)if(grid[gy][gx]===0){const next=(gx+.5-x)**2+(gy+.5-y)**2;if(next<distance){distance=next;point=[gx+.5,gy+.5];}}
  return point;
}
export const MAPS = specs.map(s=>{
  const size=s.size||24;
  const grid = Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>s.rooms||x===0||y===0||x===size-1||y===size-1?1:0));
  for(const [x,y,w,h] of s.rooms||[])for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=0;
  for(const [x,y,w,h,t] of s.blocks) for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) grid[j][i]=t;
  const tactical=TACTICAL_LAYOUTS[s.id],mark=area=>({name:area.name,point:nearestOpen(grid,area.point)});
  const sites={a:mark(tactical.a),b:mark(tactical.b)};
  const ground=Array.from({length:size},()=>Array(size).fill(0));
  if(s.platforms){
    for(const [id,site] of [[1,sites.a],[2,sites.b]]){
      const [cx,cy]=site.point.map(Math.floor);
      for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(grid[y]?.[x]===0)ground[y][x]=id;
    }
    for(const stair of s.stairs)for(let y=stair.y;y<stair.y+stair.h;y++)for(let x=stair.x;x<stair.x+stair.w;x++)if(grid[y][x]===0)ground[y][x]=stair.axis==='x'?3:4;
  }
  // Three physical treads per map tile. The same height field drives movement,
  // visibility, projection and remote actors; no client-supplied altitude is needed.
  const heightScale=3;
  const heights=s.platforms?Array.from({length:size*heightScale},(_,y)=>Array.from({length:size*heightScale},(_,x)=>{
    const px=(x+.5)/heightScale,py=(y+.5)/heightScale;
    let z=0;
    for(const p of s.platforms)if(px>=p.x&&px<p.x+p.w&&py>=p.y&&py<p.y+p.h)z=p.z;
    for(const p of s.stairs)if(px>=p.x&&px<p.x+p.w&&py>=p.y&&py<p.y+p.h){
      const length=p.axis==='x'?p.w:p.h,offset=p.axis==='x'?px-p.x:py-p.y;
      const step=Math.floor(offset*heightScale),count=length*heightScale;
      z=(p.base||0)+p.rise*(p.dir===1?step+1:count-step)/count;
    }
    return z;
  })):null;
  return {...s,size,sites,ground,heights,heightScale,mid:mark(tactical.mid),routes:['ЛІВИЙ','MID','ПРАВИЙ'],grid,blue:s.blue||[[2.5,3.5],[3.5,2.5],[3.5,4.5]],red:s.red||[[21.5,20.5],[20.5,21.5],[20.5,19.5]]};
});
export const SKINS = [{name:'Ліс',color:'#657f67'},{name:'Ніч',color:'#546477'},{name:'Пісок',color:'#ab9970'}];
export const GLOVES = [{name:'Графіт',color:'#333b37'},{name:'Олива',color:'#60714b'},{name:'Койот',color:'#93724e'}];
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
// Viewmodel mass, spring response, recoil impulse and barrel reach (map units).
export const WEAPON_PHYSICS = {
  pistol: { mass:.8, frequency:20, kick:1, reach:.55 },
  smg: { mass:1.1, frequency:19, kick:.65, reach:.7 },
  rifle: { mass:1.6, frequency:17, kick:1.1, reach:.95 },
  shotgun: { mass:2, frequency:15, kick:2.1, reach:1.05 },
  kalash: { mass:1.8, frequency:16, kick:1.4, reach:1 },
  marksman: { mass:2.1, frequency:14, kick:2.25, reach:1.22 },
  sniper: { mass:2.7, frequency:14, kick:3.1, reach:1.42 }
};
export function createWeaponMotion(){
  return Object.fromEntries(['x','y','roll','kick','aim','wall'].map(key=>[key,{value:0,velocity:0}]));
}
// Exact damped-spring solution for a constant target: stable across frame rates.
function weaponSpring(axis,target,frequency,dt){
  const damping=frequency*.72,omega=frequency*Math.sqrt(1-.72**2);
  const offset=axis.value-target,b=(axis.velocity+damping*offset)/omega;
  const decay=Math.exp(-damping*dt),cos=Math.cos(omega*dt),sin=Math.sin(omega*dt);
  axis.value=target+decay*(offset*cos+b*sin);
  axis.velocity=decay*((-damping*offset+omega*b)*cos+(-damping*b-omega*offset)*sin);
}
export function kickWeaponMotion(motion,id,aiming=false){
  const force=WEAPON_PHYSICS[id].kick*(aiming?.6:1);
  motion.kick.velocity=Math.min(600,motion.kick.velocity+force*220);
  motion.roll.velocity=Math.max(-3,motion.roll.velocity-force*.85);
}
export function stepWeaponMotion(motion,id,input,dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  const profile=WEAPON_PHYSICS[id],steady=input.aiming?.35:1;
  const turn=clamp(input.turn||0,-6,6),look=clamp(input.look||0,-3,3);
  const side=clamp(input.side||0,-1,1),forward=clamp(input.forward||0,-1,1);
  const bob=input.moving?Math.sin(input.walk||0):0;
  const targets={
    x:(-turn*4*profile.mass-side*7+bob*5)*steady,
    y:(look*13*profile.mass+forward*4+Math.abs(bob)*4-(input.lift||0)*10)*steady,
    roll:(-turn*.012*profile.mass-side*.035)*steady,
    kick:0,aim:input.aiming?1:0,wall:clamp(input.wall||0,0,1)
  };
  if(input.landing)motion.y.velocity+=Math.min(3,Math.abs(input.landing))*65*profile.mass;
  for(const key of Object.keys(targets))weaponSpring(motion[key],targets[key],profile.frequency,dt);
}
export function weaponWallProximity(map,x,y,angle,id){
  const reach=WEAPON_PHYSICS[id].reach;
  for(let distance=.1;distance<=reach;distance+=.05){
    // A narrow barrel volume catches corners as well as walls directly ahead.
    for(const side of [-.08,0,.08]){
      if(blocked(map,x+Math.cos(angle)*distance-Math.sin(angle)*side,y+Math.sin(angle)*distance+Math.cos(angle)*side))return 1-distance/reach;
    }
  }
  return 0;
}
export function blocked(map,x,y){ return (map.grid[Math.floor(y)]?.[Math.floor(x)]??1)!==0; }
export function canStand(map,x,y,r=.21){return !blocked(map,x-r,y-r)&&!blocked(map,x+r,y-r)&&!blocked(map,x-r,y+r)&&!blocked(map,x+r,y+r);}
export function floorHeight(map,x,y){return map.heights?.[Math.floor(y*map.heightScale)]?.[Math.floor(x*map.heightScale)]||0;}
export function actorHeight(map,a){
  const floor=floorHeight(map,a.x,a.y);
  if(!Number.isFinite(a.z))return floor;
  return a.grounded===false?a.z:Math.max(floor,Math.min(a.z,Math.max(supportHeight(map,a.x,a.y),a.bodySupport||0)));
}
export function resetActorHeight(map,a){a.z=floorHeight(map,a.x,a.y);a.vz=0;a.grounded=true;a.landingSpeed=0;a.bodySupport=0;}
export const ACTOR_RADIUS=.24,ACTOR_HEIGHT=1.05;
// Swept upright bodies: both teams block movement, dead actors do not.
// An overlapping spawn can separate instead of trapping both actors forever.
export function actorPathClear(map,a,x,y,bodies=[]){
  const z=actorHeight(map,a),dx=x-a.x,dy=y-a.y,length2=dx*dx+dy*dy;
  for(const b of bodies){
    if(b===a||b.hp<=0||b.alive===false)continue;
    const bz=actorHeight(map,b);
    if(z>=bz+ACTOR_HEIGHT-.001||bz>=z+ACTOR_HEIGHT-.001)continue;
    const start2=(a.x-b.x)**2+(a.y-b.y)**2,end2=(x-b.x)**2+(y-b.y)**2;
    const radius2=(ACTOR_RADIUS*2)**2;
    if(start2<radius2-1e-8&&end2>start2+1e-8&&(a.x-b.x)*dx+(a.y-b.y)*dy>=-1e-9)continue;
    const t=length2?clamp(((b.x-a.x)*dx+(b.y-a.y)*dy)/length2,0,1):0;
    if((a.x+dx*t-b.x)**2+(a.y+dy*t-b.y)**2<radius2-1e-8)return false;
  }
  return true;
}
const JUMP_SPEED=4.2,GRAVITY=12;
function supportHeight(map,x,y,r=.21){
  return Math.max(floorHeight(map,x,y),...[[r,r],[r,-r],[-r,r],[-r,-r]].map(([dx,dy])=>floorHeight(map,x+dx,y+dy)));
}
function actorSupportHeight(map,a,bodies,feet=a.z){
  let support=0;
  for(const b of bodies){
    if(b===a||b.hp<=0||b.alive===false)continue;
    const top=actorHeight(map,b)+ACTOR_HEIGHT;
    if(Math.hypot(a.x-b.x,a.y-b.y)<ACTOR_RADIUS*2&&feet>=top-.001)support=Math.max(support,top);
  }
  a.bodySupport=support;
  return Math.max(supportHeight(map,a.x,a.y),support);
}
export function jumpActor(map,a){
  if(a.grounded===false||!canStand(map,a.x,a.y))return false;
  a.z=actorHeight(map,a);a.vz=JUMP_SPEED;a.grounded=false;a.landingSpeed=0;
  return true;
}
// Feet have a world-space height. Substeps prevent fast frames from passing
// through a riser; airborne actors can clear low platforms, never solid walls.
export function stepActor(map,a,dx,dy,dt,bodies=[]){
  if(!Number.isFinite(dt)||dt<=0)return;
  a.z=actorHeight(map,a);a.vz??=0;a.grounded??=true;a.landingSpeed=0;
  const count=Math.max(1,Math.ceil(dt*120),Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.05)),h=dt/count;
  for(let i=0;i<count;i++){
    if(!a.grounded){
      const previousZ=a.z;
      a.z+=a.vz*h-GRAVITY*h*h*.5;a.vz-=GRAVITY*h;
      const ground=actorSupportHeight(map,a,bodies,previousZ);
      if(a.vz>0)for(const b of bodies){
        if(b===a||b.hp<=0||b.alive===false)continue;
        const bottom=actorHeight(map,b);
        if(Math.hypot(a.x-b.x,a.y-b.y)<ACTOR_RADIUS*2&&previousZ+ACTOR_HEIGHT<=bottom+.001&&a.z+ACTOR_HEIGHT>bottom){a.z=bottom-ACTOR_HEIGHT;a.vz=0;}
      }
      if(a.vz<=0&&a.z<=ground){a.z=ground;a.landingSpeed=-a.vz;a.vz=0;a.grounded=true;}
    }
    for(const [axis,delta] of [['x',dx/count],['y',dy/count]]){
      if(!delta)continue;
      const x=a.x+(axis==='x'?delta:0),y=a.y+(axis==='y'?delta:0);
      if(!canStand(map,x,y)||supportHeight(map,x,y)>a.z+(a.grounded?.181:.001)||!actorPathClear(map,a,x,y,bodies))continue;
      a[axis]+=delta;
      if(a.grounded){
        const ground=actorSupportHeight(map,a,bodies);
        if(a.z-ground>.181){a.grounded=false;a.vz=0;}else a.z=ground;
      }
    }
    if(a.grounded&&a.z-actorSupportHeight(map,a,bodies)>.181){a.grounded=false;a.vz=0;}
  }
}
export function canTraverse(map,x,y,tx,ty,r=.21){
  const count=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/.08));let z=floorHeight(map,x,y);
  for(let i=1;i<=count;i++){
    const px=x+(tx-x)*i/count,py=y+(ty-y)*i/count,next=floorHeight(map,px,py);
    if(!canStand(map,px,py,r)||Math.abs(next-z)>.181)return false;
    // Do not enter a high riser from its side or hang over a platform edge.
    for(const [dx,dy] of [[-r,-r],[r,-r],[-r,r],[r,r]])if(Math.abs(floorHeight(map,px+dx,py+dy)-next)>.181)return false;
    z=next;
  }
  return true;
}
export function moveActor(map,a,dx,dy,bodies=[]){
  if(!map.heights){if(canStand(map,a.x+dx,a.y)&&actorPathClear(map,a,a.x+dx,a.y,bodies))a.x+=dx;if(canStand(map,a.x,a.y+dy)&&actorPathClear(map,a,a.x,a.y+dy,bodies))a.y+=dy;return;}
  const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.08));
  for(let i=0;i<count;i++){if(canTraverse(map,a.x,a.y,a.x+dx/count,a.y)&&actorPathClear(map,a,a.x+dx/count,a.y,bodies))a.x+=dx/count;if(canTraverse(map,a.x,a.y,a.x,a.y+dy/count)&&actorPathClear(map,a,a.x,a.y+dy/count,bodies))a.y+=dy/count;}
  a.z=floorHeight(map,a.x,a.y);
}
export function lineOfSight(map,x,y,tx,ty,z=floorHeight(map,x,y)+.5,tz=floorHeight(map,tx,ty)+.5){
  const d=Math.hypot(tx-x,ty-y);
  for(let s=.08;s<d;s+=.08){const px=x+(tx-x)*s/d,py=y+(ty-y)*s/d;if(blocked(map,px,py)||floorHeight(map,px,py)>z+(tz-z)*s/d+.001)return false;}
  return true;
}
const pathWorkspaces=new WeakMap();
const pathDirections=[[1,0],[0,1],[-1,0],[0,-1]];
export function findPath(map,sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  const n=map.size;
  if(![sx,sy,tx,ty].every(Number.isFinite)||sx<0||sy<0||sx>=n||sy>=n||blocked(map,tx,ty))return [];
  if(sx===tx&&sy===ty)return [];
  let work=pathWorkspaces.get(map);
  if(!work||work.grid!==map.grid||work.heights!==map.heights||work.n!==n){
    work={grid:map.grid,heights:map.heights,n,edges:new Int8Array(n*n).fill(-1),queue:new Int32Array(n*n),prev:new Int32Array(n*n)};
    // Built-in geometry is static. Custom/edited maps get a fresh graph so
    // callers can change their cells between searches without stale routes.
    if(MAPS.includes(map))pathWorkspaces.set(map,work);
  }
  const {edges,queue,prev}=work,start=sy*n+sx,target=ty*n+tx;
  prev.fill(-2);prev[start]=-1;queue[0]=start;let length=1;
  for(let i=0;i<length;i++){
    const key=queue[i],x=key%n,y=Math.floor(key/n);
    if(key===target){const path=[];for(let k=key;prev[k]!==-1;k=prev[k])path.push({x:k%n+.5,y:Math.floor(k/n)+.5});return path.reverse();}
    if(edges[key]===-1){
      let mask=0;
      for(let d=0;d<4;d++){
        const [dx,dy]=pathDirections[d],nx=x+dx,ny=y+dy;
        if(nx>=0&&ny>=0&&nx<n&&ny<n&&!blocked(map,nx+.5,ny+.5)&&(!map.heights||canTraverse(map,x+.5,y+.5,nx+.5,ny+.5)))mask|=1<<d;
      }
      edges[key]=mask;
    }
    for(let d=0;d<4;d++)if(edges[key]&(1<<d)){
      const next=key+pathDirections[d][0]+pathDirections[d][1]*n;
      if(prev[next]===-2){prev[next]=key;queue[length++]=next;}
    }
  }return [];
}
export function applyDamage(actor,damage,head=false){const absorbed=head?0:Math.min(actor.armor,damage*.5);actor.armor-=absorbed;actor.hp=Math.max(0,actor.hp-damage+absorbed);return actor.hp;}
export function purchase(player,id){
  if(id==='armor'){if(player.armor>=50)return {ok:false,message:'Броня вже повна'};if(player.money<650)return {ok:false,message:'Недостатньо кредитів'};player.money-=650;player.armor=50;return {ok:true};}
  const w=WEAPONS[id];if(!w||!w.price)return {ok:false,message:'Недоступна зброя'};
  if(player.primary===id)return {ok:false,message:'Уже в спорядженні'};
  if(player.money<w.price)return {ok:false,message:'Недостатньо кредитів'};
  player.money-=w.price;player.primary=id;player.weapon=id;player.inventory[id]={ammo:w.size,reserve:w.size*3};return {ok:true};
}
export function roundWinner(actors,timedOut=false){
  const blue=actors.filter(a=>a.team===0&&a.hp>0),red=actors.filter(a=>a.team===1&&a.hp>0);
  if(!blue.length&&!red.length)return -1;if(!blue.length)return 1;if(!red.length)return 0;
  if(!timedOut)return null;if(blue.length!==red.length)return blue.length>red.length?0:1;
  const diff=blue.reduce((s,a)=>s+a.hp,0)-red.reduce((s,a)=>s+a.hp,0);return diff===0?-1:diff>0?0:1;
}
