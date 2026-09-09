'use strict';
const core = window.PropertyEditor;
const studio = window.EditorTools;
let catalog = propertiesDatabase.slice();
let assignments = {...puzzleSchedule};
let drafts = [];
let dirty = false;
let nextDraftId=1, revision=0, checkedRevision=-1, checkedDay='', pendingPhotos=0, busy=false, checkedWarnings=[];
let selectedDate=studio.today(), month=selectedDate.slice(0,7);
const byId = id => document.getElementById(id);
const fieldSpecs = [
    ['title','Property name','text'],['city','City','text'],['rent','Monthly rent (€)','number'],['area','Living area (m²)','number'],
    ['rooms','Total rooms','number'],['bedrooms','Bedrooms','number'],['energyLabel','Energy label (fallback for clue 5)','text'],['yearBuilt','Construction year','number'],
    ['furnishing','Furnishing','text'],['features','Standout features (optional; energy label is the fallback)','text'],['rentNote','What does the rent include?','text'],['listingUrl','Listing link','url'],['notes','Source notes / uncertainties','text']
];
const example = [{title:'Example apartment',city:'Delft',rent:1900,area:77,rooms:4,bedrooms:3,energyLabel:'E',yearBuilt:1962,furnishing:'Furnished',listingUrl:'https://example.com/listing/example-apartment',rentNote:'Monthly rent excluding bills.',notes:'Example data only — replace before exporting.'}];
function updateSummary() {
    byId('count').textContent = drafts.length ? `${drafts.length} ${drafts.length===1?'property':'properties'} to review` : 'No drafts yet';
    byId('catalog-summary').textContent = `Catalog after export: ${catalog.length+drafts.length} properties · ${Object.keys(assignments).length+drafts.filter(d=>d.date).length} scheduled dates.`;
    renderCalendar();
}
function changed() {
    dirty=true;revision++;checkedRevision=-1;byId('export-status').textContent='';byId('export-errors').textContent='';
    byId('export-warnings').replaceChildren();byId('warning-ack').checked=false;byId('warning-ack-label').hidden=true;
    byId('check-summary').textContent='Changes pending. Check your update before downloading.';syncButtons();
}
function syncButtons(){byId('check-button').disabled=busy||pendingPhotos>0;byId('export-button').disabled=busy||pendingPhotos>0||checkedRevision!==revision||(checkedWarnings.length>0&&!byId('warning-ack').checked);}
function missing(d,element) {
    const empty=['city','area','rooms','yearBuilt','furnishing'].filter(key=>!d.row[key]);
    element.textContent=empty.length ? 'Missing details: '+empty.join(', ')+'. Clues say “not provided”; fill the facts or review that wording.' : '';
}
function addCard(row) {
    const draft={uid:nextDraftId++,row,clues:core.clues(row),images:[null],date:'',urls:[null],custom:[false,false,false],photoVersions:[0],photoInfo:[null]};
    const card=byId('card-template').content.firstElementChild.cloneNode(true);
    draft.card=card;drafts.push(draft);
    card.querySelector('h3').textContent=row.title;
    const clueInputs=[];
    function updateClues(force=false) {core.clues(row).forEach((text,i)=>{if(force||!draft.custom[i]){draft.clues[i]=text;clueInputs[i].value=text;if(force)draft.custom[i]=false;}});missing(draft,card.querySelector('.missing'));}
    draft.clues.forEach((text,i)=>{
        const label=document.createElement('label');label.textContent=`Clue ${i+3}/5`;
        const input=document.createElement('input');input.value=text;input.addEventListener('input',()=>{draft.clues[i]=input.value;draft.custom[i]=true;changed()});
        label.appendChild(input);card.querySelector('.clue-fields').appendChild(label);clueInputs.push(input);
    });
    fieldSpecs.forEach(([key,title,type])=>{
        const label=document.createElement('label');label.textContent=title;if(['listingUrl','notes','rentNote'].includes(key))label.className='wide';
        const input=document.createElement('input');input.type=type;input.value=row[key];if(type==='number'){input.min='0';input.step=['rent','area'].includes(key)?'any':'1';}
        input.addEventListener('input',()=>{row[key]=input.value.trim();card.querySelector('h3').textContent=row.title||'Untitled property';updateClues();changed();if(key==='title'||key==='city')updateSummary()});
        label.appendChild(input);card.querySelector('.fields').appendChild(label);
    });
    const locationHost=document.createElement('section');locationHost.className='location-editor';
    const locationTitle=document.createElement('h4');locationTitle.textContent='Map or city · Clue 2';
    locationHost.appendChild(locationTitle);card.querySelector('.photos').after(locationHost);
    const locationEditor=window.RentdleMaps.editor(locationHost,row,value=>{Object.assign(row,value);changed()});
    ['Exterior photo · Clue 1'].forEach((title,i)=>{
        const label=document.createElement('label');label.textContent=title;
        const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
        const img=document.createElement('img');img.className='photo-preview';img.alt=title+' preview';img.hidden=true;
        const status=document.createElement('span');status.className='photo-status';status.setAttribute('role','status');
        input.addEventListener('change',async()=>{
            const version=++draft.photoVersions[i];
            if(draft.urls[i])URL.revokeObjectURL(draft.urls[i]);draft.urls[i]=null;draft.images[i]=null;draft.photoInfo[i]=null;img.hidden=true;changed();
            const file=input.files[0];status.textContent='';if(!file)return;
            pendingPhotos++;syncButtons();status.textContent='Preparing photo…';
            try {
                const result=await studio.optimize(file);
                if(version!==draft.photoVersions[i]||!drafts.includes(draft))return;
                draft.images[i]=result.file;draft.photoInfo[i]=result;draft.urls[i]=URL.createObjectURL(result.file);img.src=draft.urls[i];img.hidden=false;
                const saving=Math.round((1-result.file.size/result.originalBytes)*100);
                status.textContent=`${result.width} × ${result.height} · ${formatBytes(result.originalBytes)} → ${formatBytes(result.file.size)}${saving>0?` · ${saving}% smaller`:result.keptOriginal?' · Original already smaller':''}`;changed();
            } catch(error) {if(version===draft.photoVersions[i]&&drafts.includes(draft))status.textContent=error.message;}
            finally {pendingPhotos--;syncButtons();}
        });
        label.append(input,status,img);card.querySelector('.photos').appendChild(label);
    });
    card.querySelector('.puzzle-date').addEventListener('change',event=>{draft.date=event.target.value;changed();updateSummary()});
    card.querySelector('.regenerate').addEventListener('click',()=>{updateClues(true);changed()});
    card.querySelector('.remove').addEventListener('click',()=>{locationEditor.remove();draft.urls.filter(Boolean).forEach(url=>URL.revokeObjectURL(url));drafts=drafts.filter(d=>d!==draft);card.remove();changed();updateSummary()});
    missing(draft,card.querySelector('.missing'));byId('drafts').appendChild(card);
}
byId('example-button').addEventListener('click',()=>{
    if(byId('import-data').value.trim()) {byId('import-status').textContent='Clear the paste box first to load the example.';return;}
    byId('import-data').value=JSON.stringify(example,null,2);
});
byId('import-button').addEventListener('click',()=>{
    try{
        const rows=core.parse(byId('import-data').value);
        if(drafts.length+rows.length>50)throw Error('Keep each batch to 50 properties or fewer.');
        byId('drafts').querySelector('.empty')?.remove();rows.forEach(addCard);changed();
        byId('import-data').value='';byId('import-status').textContent=`Added ${rows.length} ${rows.length===1?'property':'properties'}. Choose photos and review the details below.`;updateSummary();
    }catch(error){byId('import-status').textContent='Could not import: '+error.message;}
});
function formatBytes(n){return n>=1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
function entriesOn(date){return [...(assignments[date]?[{key:'scheduled:'+date,title:catalog.find(p=>p.id===assignments[date])?.title||'Missing property',id:assignments[date]}]:[]),...drafts.filter(d=>d.date===date).map(d=>({key:'draft:'+d.uid,title:d.row.title+' · '+d.row.city,draft:d}))];}
function renderCalendar(){
    const day=studio.today(),grid=byId('calendar-grid');grid.replaceChildren();
    byId('calendar-month').textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
    for(const date of studio.monthDays(month)){
        const entries=entriesOn(date),button=document.createElement('button');button.type='button';button.className='calendar-day';
        button.classList.toggle('outside-month',!date.startsWith(month));button.classList.toggle('scheduled',entries.length>0);button.classList.toggle('conflict',entries.length>1);
        button.classList.toggle('today',date===day);button.classList.toggle('selected',date===selectedDate);button.setAttribute('aria-pressed',String(date===selectedDate));
        if(date===day)button.setAttribute('aria-current','date');
        const number=document.createElement('span');number.textContent=String(Number(date.slice(-2)));
        const title=document.createElement('small');title.textContent=entries.length>1?'Date conflict':entries[0]?.title||'Empty';
        button.setAttribute('aria-label',date+' · '+title.textContent);button.title=date+' · '+title.textContent;
        button.append(number,title);button.addEventListener('click',()=>{selectedDate=date;renderCalendar()});grid.appendChild(button);
    }
    const entries=entriesOn(selectedDate);byId('selected-date-title').textContent=selectedDate;
    byId('selected-date-info').textContent=(entries.length?entries.map(e=>e.title).join(' + '):'No puzzle assigned.')+(selectedDate<=day?' This is today or an earlier date. Changes will be flagged before export.':'');
    byId('clear-date').disabled=entries.length===0;
    const picker=byId('calendar-property'),old=picker.value;picker.replaceChildren();
    function option(value,text){const el=document.createElement('option');el.value=value;el.textContent=text;picker.appendChild(el);}
    option('','Choose a property…');
    for(const d of drafts)option('draft:'+d.uid,`New: ${d.row.title} · ${d.row.city}${d.date?' — '+d.date:' — unscheduled'}`);
    for(const p of catalog){
        const dates=Object.keys(assignments).filter(d=>assignments[d]===p.id).sort();
        if(!dates.length)option('catalog:'+p.id,`${p.title} — unscheduled`);
        else dates.forEach(date=>option('scheduled:'+date,`${p.title} — ${date}`));
    }
    picker.value=[...picker.options].some(o=>o.value===old)?old:'';
    const missing=Array.from({length:14},(_,i)=>studio.addDays(day,i)).filter(d=>entriesOn(d).length===0);
    byId('coverage').textContent=`${14-missing.length}/14 upcoming days filled`;
    const unscheduled=catalog.filter(p=>!Object.values(assignments).includes(p.id)).length+drafts.filter(d=>!d.date).length;
    byId('unscheduled-summary').textContent=`${unscheduled} ${unscheduled===1?'property':'properties'} waiting for a date.`;
    byId('repeat-property').disabled=!picker.value.startsWith('scheduled:');if(byId('repeat-property').disabled)byId('repeat-property').checked=false;
}
function setDraftDate(d,date){d.date=date;d.card.querySelector('.puzzle-date').value=date;}
byId('calendar-property').addEventListener('change',()=>{byId('repeat-property').disabled=!byId('calendar-property').value.startsWith('scheduled:');byId('repeat-property').checked=false;});
byId('assign-date').addEventListener('click',()=>{
    const value=byId('calendar-property').value,status=byId('calendar-status');status.textContent='';
    if(!value){status.textContent='Choose a property first.';return;}
    if(entriesOn(selectedDate).length){status.textContent='This day already has a puzzle. Clear this day before assigning another.';return;}
    const type=value.slice(0,value.indexOf(':')),key=value.slice(value.indexOf(':')+1);
    if(type==='draft'){const draft=drafts.find(d=>String(d.uid)===key);if(!draft)return;setDraftDate(draft,selectedDate);}
    else if(type==='scheduled'){if(!assignments[key])return;assignments[selectedDate]=assignments[key];if(!byId('repeat-property').checked)delete assignments[key];}
    else if(type==='catalog'&&catalog.some(p=>p.id===key))assignments[selectedDate]=key;
    else return;
    changed();updateSummary();status.textContent='Calendar updated. Check and export to save this change.';
});
byId('clear-date').addEventListener('click',()=>{delete assignments[selectedDate];drafts.filter(d=>d.date===selectedDate).forEach(d=>setDraftDate(d,''));changed();updateSummary();byId('calendar-status').textContent='Date cleared. The property is still in your catalog.';});
function moveMonth(n){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);month=d.toISOString().slice(0,7);renderCalendar();}
byId('month-prev').addEventListener('click',()=>moveMonth(-1));byId('month-next').addEventListener('click',()=>moveMonth(1));
byId('month-today').addEventListener('click',()=>{selectedDate=studio.today();month=selectedDate.slice(0,7);renderCalendar();});
byId('warning-ack').addEventListener('change',syncButtons);
function checkPhotoSource(src){return new Promise(resolve=>{
    const image=new Image();let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;resolve(ok);};
    const timer=setTimeout(()=>finish(false),10000);image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0);image.onerror=()=>finish(false);image.src=src;
});}
async function inspectUpdate(){
    const errors=core.validate(drafts,catalog,assignments);
    if(catalogLocationPending)errors.push('Save the edited pin for the existing property before checking your update.');
    // Inspect existing records even when a draft is incomplete.
    const existing=studio.audit(catalog,assignments,puzzleSchedule);
    errors.push(...existing.errors);
    let result=null,audit=existing;
    if(!errors.length){result=core.build(drafts,catalog,assignments);audit=studio.audit(result.properties,result.assignments,puzzleSchedule);errors.push(...audit.errors);}
    const newPhotos=new Set(result?.images.map(i=>i.name)||[]),sources=[...new Set(audit.photos.map(p=>p.src).filter(src=>!newPhotos.has(src)))];
    for(let i=0;i<sources.length;i+=6){
        const batch=sources.slice(i,i+6);const valid=await Promise.all(batch.map(checkPhotoSource));
        batch.forEach((src,n)=>{if(!valid[n])errors.push(`Photo could not be loaded: ${src}. Restore it in the project folder, or check your connection if editing online.`);});
    }
    return {errors:[...new Set(errors)],warnings:[...new Set(audit.warnings)],result};
}
function lockEditor(){
    const controls=[...document.querySelectorAll('button,input,select,textarea')],states=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);busy=true;
    const locations=[...document.querySelectorAll('.location-editor')];locations.forEach(el=>el.inert=true);
    return ()=>{controls.forEach((el,i)=>el.disabled=states[i]);locations.forEach(el=>el.inert=false);busy=false;syncButtons();};
}
byId('check-button').addEventListener('click',async()=>{
    if(busy||pendingPhotos)return;const unlock=lockEditor();byId('check-summary').textContent='Checking properties, dates and photos…';byId('export-errors').textContent='';byId('export-warnings').replaceChildren();byId('warning-ack').checked=false;
    try {
        const report=await inspectUpdate();checkedWarnings=report.warnings;
        byId('export-errors').textContent=report.errors.join('\n');
        report.warnings.forEach(w=>{const li=document.createElement('li');li.textContent=w;byId('export-warnings').appendChild(li);});
        byId('warning-ack-label').hidden=!report.warnings.length;
        checkedRevision=report.errors.length?-1:revision;checkedDay=studio.today();
        byId('check-summary').textContent=report.errors.length?`${report.errors.length} ${report.errors.length===1?'issue needs':'issues need'} fixing before export.`:`Checks passed.${report.warnings.length?` Review ${report.warnings.length} ${report.warnings.length===1?'warning':'warnings'} below.`:' Ready to download.'}`;
    }catch(error){checkedRevision=-1;byId('export-errors').textContent=error.message;byId('check-summary').textContent='Could not complete the checks.';}
    finally{unlock();}
});
byId('export-button').addEventListener('click',async()=>{
    if(busy||pendingPhotos||checkedRevision!==revision||(checkedWarnings.length&&!byId('warning-ack').checked))return;
    if(checkedDay!==studio.today()){changed();byId('check-summary').textContent='A new day has started. Check the calendar again before exporting.';return;}
    const unlock=lockEditor();byId('export-errors').textContent='';byId('export-status').textContent='Preparing download…';
    try {
        const result=core.build(drafts,catalog,assignments);
        const total=result.images.reduce((sum,image)=>sum+image.file.size,0);if(total>150*1024*1024)throw Error('This batch exceeds 150 MB. Export fewer properties at a time.');
        const entries=result.files.slice();
        for(const image of result.images)entries.push({name:image.name,data:new Uint8Array(await image.file.arrayBuffer())});
        entries.push({name:'UPLOAD-INSTRUCTIONS.txt',data:'Extract these files into your existing Rentdle folder. Replace properties.js and schedule.js, and add the new photos. Keep all existing photos. Upload the same files to your GitHub repository root. Reopen the editor from the updated project before starting another batch.\n'});
        const blob=core.zip(entries),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='rentdle-property-update.zip';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        byId('export-status').textContent='Download prepared. Extract the ZIP into your project, replace properties.js and schedule.js, and add the photos. Keep your existing photos. Reopen the editor from the updated project before your next batch.';dirty=false;
    }catch(error){byId('export-errors').textContent=error.message;byId('export-status').textContent='Download could not be prepared.';}finally{unlock();}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
updateSummary();

// Existing catalog entries can gain a map without re-importing their facts or photos.
let catalogLocationEditor=null,catalogLocationPending=false;
const locationPicker=byId('location-property');
catalog.forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.title;locationPicker.appendChild(option)});
locationPicker.addEventListener('change',()=>{
    catalogLocationEditor?.remove();catalogLocationEditor=null;
    catalogLocationPending=false;
    byId('location-status').textContent='';byId('save-location').disabled=true;
    const property=catalog.find(p=>p.id===locationPicker.value);if(!property)return;
    catalogLocationEditor=window.RentdleMaps.editor(byId('catalog-location'),property.coordinates,()=>{
        catalogLocationPending=true;changed();
        byId('location-status').textContent='Pin changed. Select Save pin to include it in your update.';
    });
    byId('save-location').disabled=false;
});
byId('save-location').addEventListener('click',()=>{
    const index=catalog.findIndex(p=>p.id===locationPicker.value);if(index<0||!catalogLocationEditor)return;
    try {
        catalog[index]=core.withMap(catalog[index],catalogLocationEditor.value());catalogLocationPending=false;changed();updateSummary();
        byId('location-status').textContent=(catalog[index].coordinates?'Pin saved for clue 2.':'City fallback saved for clue 2.')+' Check and download your update to save it to the project.';
    } catch(error){byId('location-status').textContent=error.message;}
});
