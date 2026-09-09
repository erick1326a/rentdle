const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {RentdleMapCore: maps} = require('../map-core.js');
const {PropertyEditor: core} = require('../editor-core.js');
const {EditorTools: studio} = require('../editor-tools.js');
const {RentdlePlayer: player} = require('../player-core.js');
const legacy = vm.runInNewContext(fs.readFileSync(require.resolve('../properties.js'),'utf8')+'; JSON.parse(JSON.stringify(propertiesDatabase))');
const row = () => core.parse(JSON.stringify({title:'Map test',city:'Delft',rent:1800,area:70,rooms:3,bedrooms:2,yearBuilt:1970,furnishing:'Furnished',listingUrl:'https://example.com/map-test',rentNote:'Excluding bills',coordinates:{latitude:52.01,longitude:4.36}}))[0];
const draft = () => {const r=row();return {row:r,clues:core.clues(r),images:[{type:'image/jpeg',size:100}],date:'2099-10-10'};};

test('coordinates reject missing, non-numeric and out-of-range values; accept zero',()=>{
    for(const value of [null,{}, {latitude:'',longitude:4},{latitude:' ',longitude:4},{latitude:true,longitude:4},{latitude:Infinity,longitude:4},{latitude:86,longitude:4},{latitude:52,longitude:181}])assert.equal(maps.coordinates(value),null);
    assert.deepEqual(maps.coordinates({latitude:'0',longitude:0}),{latitude:0,longitude:0});
});
test('editor imports both coordinate formats',()=>{
    assert.equal(row().latitude,'52.01');
    assert.equal(core.parse('{"title":"x","latitude":52,"longitude":4}')[0].longitude,'4');
    assert.equal(core.parse('{"title":"x"}')[0].latitude,'');
});
test('new export has one photo, numeric coordinates, five clues, map second',()=>{
    const result=core.build([draft()],[],{}), p=result.properties[0];
    assert.deepEqual(p.coordinates,{latitude:52.01,longitude:4.36});
    assert.deepEqual(p.clues.map(c=>c.type),['image','map','text','text','text']);
    assert.equal(result.images.length,1);
    assert.match(p.clues[1].text,/Clue 2\/5: Neighbourhood/);
    assert.match(p.clues[2].text,/Clue 3\/5: 70 m²/);
    assert.match(p.clues[3].text,/Clue 4\/5: Built in 1970/);
    assert.equal(studio.audit(result.properties,result.assignments).errors.length,0);
    assert.equal(player.playable(p.id,result.properties),p);
    assert.ok(result.files[0].data.includes('"latitude": 52.01'));
});
test('export blocks partial coordinates and missing exterior',()=>{
    const d=draft();d.row.latitude='';
    assert.throws(()=>core.build([d],[],{}),/both valid coordinates/);
    d.row.latitude='52';d.images=[null];assert.throws(()=>core.build([d],[],{}),/exterior photo/);
});
test('blank coordinates export a playable city clue with no map',()=>{
    const d=draft();d.row.latitude='';d.row.longitude='';
    const result=core.build([d],[],{}),p=result.properties[0];
    assert.equal(p.coordinates,undefined);
    assert.equal(p.clues[1].text,'Clue 2/5: City: Delft');
    assert.deepEqual(p.clues.map(c=>c.type),['image','text','text','text','text']);
    assert.equal(player.playable(p.id,[p]),p);
    assert.deepEqual(studio.audit(result.properties,result.assignments).errors,[]);
});
test('final clue prefers features, then a known energy label, without inventing facts',()=>{
    assert.equal(core.clues({...row(),features:'Private balcony',energyLabel:'B'})[2],'Private balcony');
    assert.equal(core.clues({...row(),energyLabel:'B'})[2],'Energy label: B');
    assert.equal(core.clues({...row(),energyLabel:'Not provided'})[2],'Additional features not provided');
});
test('removing a pin preserves custom clues and clears stored coordinates',()=>{
    const d=draft();d.clues[2]='Custom final clue';
    const p=core.build([d],[],{}).properties[0];
    const cleared=core.withMap(p,{latitude:'',longitude:''});
    assert.equal(cleared.coordinates,undefined);assert.equal(cleared.details.latitude,undefined);
    assert.equal(cleared.clues[1].text,'Clue 2/5: City: Delft');
    assert.equal(cleared.clues[4].text,'Clue 5/5: Custom final clue');
});
test('old image-first and fourth-map layouts migrate while retaining known facts',()=>{
    const p={id:'legacy',title:'Home · Delft',details:{city:'Delft'},clues:[
        {type:'image',src:'outside.jpg',text:'Clue 1/5: Exterior'},
        {type:'image',src:'inside.jpg',text:'Clue 2/5: Interior'},
        {type:'text',text:'Clue 3/5: Energy label E'},
        {type:'text',text:'Clue 4/5: 70 m², 3 rooms'},
        {type:'text',text:'Clue 5/5: Built in 1970, furnished'}]};
    const result=core.withMap(p,null);
    assert.equal(result.clues[1].text,'Clue 2/5: City: Delft');
    assert.equal(result.clues[4].text,'Clue 5/5: Energy label: E');
    const mapped={...p,clues:[p.clues[0],p.clues[2],p.clues[3],{type:'map',text:'Neighbourhood'},p.clues[4]]};
    assert.equal(core.withMap(mapped,{latitude:52,longitude:4}).clues[1].type,'map');
});
test('converting existing property preserves ID, text facts and original data',()=>{
    const before=JSON.stringify(legacy[0]);
    const converted=core.withMap(legacy[0],{latitude:52,longitude:4});
    assert.equal(converted.id,legacy[0].id);
    assert.equal(converted.clues[0].src,legacy[0].clues[0].src);
    assert.equal(converted.clues.filter(c=>c.type==='text').length,3);
    assert.equal(converted.clues.filter(c=>c.type==='image').length,1);
    assert.equal(JSON.stringify(legacy[0]),before);
    const revised=core.withMap(converted,{latitude:53,longitude:5});
    assert.equal(revised.clues.length,5);
    assert.equal(revised.coordinates.latitude,53);
});
test('legacy catalog remains playable and passes clue validation',()=>{
    for(const p of legacy)assert.equal(player.playable(p.id,legacy),p);
    assert.deepEqual(studio.audit(legacy,{}).errors,[]);
});
test('invalid map coordinates block audit and playback',()=>{
    const p=core.build([draft()],[],{}).properties[0];p.coordinates.longitude='';
    assert.equal(player.playable(p.id,[p]),null);
    assert.ok(studio.audit([p],{}).errors.some(e=>e.includes('coordinates')));
});
test('map puzzles remain available in practice and next-puzzle selection',()=>{
    const result=core.build([draft()],[],{}),id=result.properties[0].id;
    assert.deepEqual(player.archive({'2020-01-01':id},result.properties,'2020-01-02'),['2020-01-01']);
    assert.equal(player.nextPuzzle(result.assignments,result.properties,new Date('2099-10-09T12:00:00Z')).date,'2099-10-10');
});
