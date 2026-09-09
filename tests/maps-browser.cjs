// Run with Playwright available in NODE_PATH. All map tiles are mocked: these
// checks never fetch or prefetch imagery from the community tile servers.
const {chromium} = require('playwright');
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {PropertyEditor:core}=require('../editor-core.js');
const root=path.resolve(__dirname,'..');
const fixture=core.withMap({id:'map-browser-fixture',title:'Map test',actualRent:1800,listingUrl:'https://example.com/test',rentNote:'Excluding bills',clues:[{type:'image',src:'03092026.JPG',text:'Exterior'},...['City: Delft','70 m², 3 rooms','Built in 1970, furnished'].map(text=>({type:'text',text}))]}, {latitude:52.01,longitude:4.36});
const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try {
        let data=fs.readFileSync(file);
        if(name==='properties.js')data=Buffer.concat([data,Buffer.from('\npropertiesDatabase.push('+JSON.stringify(fixture)+');')]);
        if(name==='schedule.js')data=Buffer.concat([data,Buffer.from('\npuzzleSchedule["2099-10-10"]="map-browser-fixture";')]);
        res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.jpg':'image/jpeg','.JPG':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(data);
    }catch{res.writeHead(404).end();}
});
function zipText(bytes,name){
    let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){
        const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
        const entry=bytes.subarray(offset+30,offset+30+length).toString(),start=offset+30+length+extra;
        if(entry===name)return bytes.subarray(start,start+size).toString();offset=start+size;
    }throw Error('ZIP entry missing: '+name);
}
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await chromium.launch({headless:true,channel:process.env.RENTDLE_BROWSER_CHANNEL||'msedge'});
        const context=await browser.newContext({acceptDownloads:true});let requests=0;
        await context.route('https://tile.openstreetmap.org/**',route=>{requests++;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3e9dd"/><path d="M0 120h256M130 0v256" stroke="white" stroke-width="12"/></svg>'});});
        const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
        const origin='http://127.0.0.1:'+server.address().port;
        await page.goto(origin+'/index.html?test=1&date=2099-10-10');
        assert.equal(requests,0);assert.equal(await page.locator('script[src*="leaflet"]').count(),0);
        await page.locator('#skip-clue').click();
        await page.locator('.leaflet-tile-loaded').first().waitFor();
        assert.ok(requests>0);assert.equal(await page.locator('#clue-text').textContent(),'Clue 2/5: Neighbourhood');
        assert.equal(await page.locator('.map-credit a').getAttribute('href'),'https://www.openstreetmap.org/copyright');
        await page.locator('#prev-clue').click();assert.equal(await page.locator('.rentdle-map').count(),0);
        await page.locator('#next-clue').click();await page.locator('.leaflet-marker-icon').waitFor();
        await page.reload();await page.locator('.leaflet-marker-icon').waitFor(); // restored visible clue
        await page.setViewportSize({width:375,height:812});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.ok((await page.locator('.rentdle-map').boundingBox()).width>300);
        await page.locator('.leaflet-tile-loaded').first().waitFor();
        await page.screenshot({path:path.join(root,'tests/map-mobile.png')});
        await page.locator('#restart-preview').click();
        const beforeWin=requests;
        await page.locator('#guess-input').fill('1800');await page.locator('#submit-guess').click();
        assert.equal(requests,beforeWin);await page.locator('#close-modal').click();
        await page.locator('#next-clue').click();
        await page.locator('.leaflet-marker-icon').waitFor();
        await page.goto(origin+'/editor.html');await page.setViewportSize({width:1100,height:900});
        const beforeEditor=requests;
        await page.locator('#import-data').fill(JSON.stringify({title:'Browser import test',city:'Delft',rent:1700,area:65,rooms:3,bedrooms:2,yearBuilt:1980,furnishing:'Furnished',listingUrl:'https://example.com/browser-test',rentNote:'Excluding bills',latitude:52.01,longitude:4.36}));
        await page.locator('#import-button').click();assert.equal(requests,beforeEditor);
        const card=page.locator('.property-card');assert.equal(await card.locator('input[type=file]').count(),1);
        await card.locator('input[type=file]').setInputFiles(path.join(root,'03092026.JPG'));
        await card.locator('.photo-preview:not([hidden])').waitFor();
        await card.getByRole('button',{name:'Open map to place pin'}).click();
        await card.locator('.leaflet-marker-icon').waitFor();
        await card.locator('.rentdle-map').click({position:{x:180,y:120}});
        const newLatitude=Number(await card.getByLabel('Latitude',{exact:true}).inputValue());
        assert.notEqual(newLatitude,52.01);
        await card.getByLabel('Standout features (optional; energy label is the fallback)',{exact:true}).fill('Private balcony');
        assert.equal(await card.locator('.clue-fields input').last().inputValue(),'Private balcony');
        await page.locator('#check-button').click();await page.getByText(/^Checks passed\./).waitFor();
        await page.locator('#location-property').selectOption('delft-original');
        await page.locator('#catalog-location').getByLabel('Latitude',{exact:true}).fill('');
        await page.locator('#catalog-location').getByLabel('Longitude',{exact:true}).fill('');
        await page.locator('#save-location').click();assert.match(await page.locator('#location-status').textContent(),/City fallback saved/);
        await page.locator('#check-button').click();await page.getByText(/^Checks passed\./).waitFor();
        const fallback=await context.newPage();const beforeFallback=requests;
        await fallback.goto(origin+'/index.html?test=1&date=2026-09-09');
        await fallback.locator('#skip-clue').click();
        assert.equal(await fallback.locator('#clue-text').textContent(),'Clue 2/5: City: Delft');
        assert.equal(await fallback.locator('script[src*="leaflet"]').count(),0);assert.equal(requests,beforeFallback);
        await fallback.close();
        if(await page.locator('#warning-ack').isVisible())await page.locator('#warning-ack').check();
        const downloaded=page.waitForEvent('download');await page.locator('#export-button').click();
        const download=await downloaded;const bytes=fs.readFileSync(await download.path());
        const data=zipText(bytes,'properties.js');assert.ok(data.includes('"latitude": '+newLatitude));assert.ok(data.includes('"type": "map"'));
        await page.locator('#location-property').selectOption('delft-original');
        await page.locator('#catalog-location').getByLabel('Latitude',{exact:true}).fill('52.02');
        await page.locator('#catalog-location').getByLabel('Longitude',{exact:true}).fill('4.37');
        assert.ok(await page.locator('#export-button').isDisabled());
        await page.locator('#save-location').click();assert.match(await page.locator('#location-status').textContent(),/Pin saved/);
        await page.locator('#check-button').click();await page.getByText(/^Checks passed\./).waitFor();
        const race=await context.newPage();
        await race.route('**/vendor/leaflet/leaflet.js',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();});
        await race.goto(origin+'/index.html?test=1&date=2099-10-10');
        if(await race.locator('#result-modal').evaluate(el=>el.open))await race.locator('#close-modal').click();
        await race.locator('#restart-preview').click();
        const beforeRace=requests;
        await race.locator('#skip-clue').click();
        await race.locator('#prev-clue').click();
        await race.waitForFunction(()=>Boolean(window.L));
        assert.equal(requests,beforeRace);assert.equal(await race.locator('.rentdle-map').count(),0);
        await race.close();
        assert.deepEqual(errors,[]);
        console.log('PASS: lazy loading, navigation, restored game, early win, mobile layout, editor pin placement, export, existing-property conversion; no runtime errors. Tile requests mocked.');
    }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
