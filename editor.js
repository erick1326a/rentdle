'use strict';
const core = window.PropertyEditor;
let catalog = propertiesDatabase.slice();
let assignments = {...puzzleSchedule};
let drafts = [];
let dirty = false;
const byId = id => document.getElementById(id);
const fieldSpecs = [
    ['title','Property name','text'],['city','City','text'],['rent','Monthly rent (€)','number'],['area','Living area (m²)','number'],
    ['rooms','Total rooms','number'],['bedrooms','Bedrooms','number'],['energyLabel','Energy label','text'],['yearBuilt','Construction year','number'],
    ['furnishing','Furnishing','text'],['rentNote','What does the rent include?','text'],['listingUrl','Listing link','url'],['notes','Source notes / uncertainties','text']
];
const example = [{title:'Example apartment',city:'Delft',rent:1900,area:77,rooms:4,bedrooms:3,energyLabel:'E',yearBuilt:1962,furnishing:'Furnished',listingUrl:'https://example.com/listing/example-apartment',rentNote:'Monthly rent excluding bills.',notes:'Example data only — replace before exporting.'}];
function updateSummary() {
    byId('count').textContent = drafts.length ? `${drafts.length} ${drafts.length===1?'property':'properties'} to review` : 'No drafts yet';
    byId('catalog-summary').textContent = `Current catalog: ${catalog.length} properties · ${Object.keys(assignments).length} scheduled dates. Existing entries will be preserved.`;
}
function missing(d,element) {
    const empty=['area','rooms','energyLabel','yearBuilt','furnishing'].filter(key=>!d.row[key]);
    element.textContent=empty.length ? 'Missing details: '+empty.join(', ')+'. Clues say “not provided”; fill the facts or review that wording.' : '';
}
function addCard(row) {
    const draft={row,clues:core.clues(row),images:[null,null],date:'',urls:[null,null],custom:[false,false,false]};
    const card=byId('card-template').content.firstElementChild.cloneNode(true);
    draft.card=card;drafts.push(draft);
    card.querySelector('h3').textContent=row.title;
    const clueInputs=[];
    function changed() {dirty=true;byId('export-status').textContent='';byId('export-errors').textContent='';}
    function updateClues(force=false) {core.clues(row).forEach((text,i)=>{if(force||!draft.custom[i]){draft.clues[i]=text;clueInputs[i].value=text;if(force)draft.custom[i]=false;}});missing(draft,card.querySelector('.missing'));}
    draft.clues.forEach((text,i)=>{
        const label=document.createElement('label');label.textContent=`Clue ${i+3}/5`;
        const input=document.createElement('input');input.value=text;input.addEventListener('input',()=>{draft.clues[i]=input.value;draft.custom[i]=true;changed()});
        label.appendChild(input);card.querySelector('.clue-fields').appendChild(label);clueInputs.push(input);
    });
    fieldSpecs.forEach(([key,title,type])=>{
        const label=document.createElement('label');label.textContent=title;if(['listingUrl','notes','rentNote'].includes(key))label.className='wide';
        const input=document.createElement('input');input.type=type;input.value=row[key];if(type==='number'){input.min='0';input.step=['rent','area'].includes(key)?'any':'1';}
        input.addEventListener('input',()=>{row[key]=input.value.trim();card.querySelector('h3').textContent=row.title||'Untitled property';updateClues();changed()});
        label.appendChild(input);card.querySelector('.fields').appendChild(label);
    });
    ['Exterior photo · Clue 1','Interior photo · Clue 2'].forEach((title,i)=>{
        const label=document.createElement('label');label.textContent=title;
        const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
        const img=document.createElement('img');img.className='photo-preview';img.alt=title+' preview';img.hidden=true;
        input.addEventListener('change',()=>{
            if(draft.urls[i])URL.revokeObjectURL(draft.urls[i]);draft.urls[i]=null;draft.images[i]=input.files[0]||null;img.hidden=true;
            const file=draft.images[i];if(file&&['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=15*1024*1024){draft.urls[i]=URL.createObjectURL(file);img.src=draft.urls[i];img.hidden=false;}
            changed();
        });
        label.append(input,img);card.querySelector('.photos').appendChild(label);
    });
    card.querySelector('.puzzle-date').addEventListener('change',event=>{draft.date=event.target.value;changed();const errors=core.validate(drafts,catalog,assignments).filter(e=>e.includes('already has a puzzle'));byId('export-errors').textContent=errors.join('\n')});
    card.querySelector('.regenerate').addEventListener('click',()=>{updateClues(true);changed()});
    card.querySelector('.remove').addEventListener('click',()=>{draft.urls.filter(Boolean).forEach(url=>URL.revokeObjectURL(url));drafts=drafts.filter(d=>d!==draft);card.remove();dirty=drafts.length>0;updateSummary()});
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
        byId('drafts').querySelector('.empty')?.remove();rows.forEach(addCard);dirty=true;
        byId('import-data').value='';byId('import-status').textContent=`Added ${rows.length} ${rows.length===1?'property':'properties'}. Choose photos and review the details below.`;updateSummary();
    }catch(error){byId('import-status').textContent='Could not import: '+error.message;}
});
async function validatePhoto(file) {
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!({'image/jpeg':jpeg,'image/png':png,'image/webp':webp}[file.type]))throw Error(`${file.name}: image contents do not match the file type.`);
    const image=await createImageBitmap(file);image.close();
}
byId('export-button').addEventListener('click',async()=>{
    const button=byId('export-button');byId('export-errors').textContent='';byId('export-status').textContent='';
    const errors=core.validate(drafts,catalog,assignments);if(errors.length){byId('export-errors').textContent=errors.join('\n');return;}
    button.disabled=true;
    // Lock edits while reading images, so the exported snapshot is consistent.
    const controls=[...document.querySelectorAll('#drafts input, #drafts button, #import-button, #example-button, #import-data')];controls.forEach(el=>el.disabled=true);
    try{
        const result=core.build(drafts,catalog,assignments);
        const total=result.images.reduce((sum,image)=>sum+image.file.size,0);if(total>150*1024*1024)throw Error('This batch exceeds 150 MB. Export fewer properties at a time.');
        const entries=result.files.slice();
        for(const image of result.images){await validatePhoto(image.file);entries.push({name:image.name,data:new Uint8Array(await image.file.arrayBuffer())});}
        entries.push({name:'UPLOAD-INSTRUCTIONS.txt',data:'Extract these files into your existing Rentdle folder. Replace properties.js and schedule.js, and add all photos. Upload the same files to your GitHub repository root. Keep your existing photos. This update requires the version of index.html that loads properties.js.\n'});
        const blob=core.zip(entries),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='rentdle-property-update.zip';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        byId('export-status').textContent='Download prepared. Save and extract the ZIP, then replace properties.js and schedule.js and add the photos to your project. This page keeps your drafts so you can download again. Start a new session from the updated project before adding another batch.';
        dirty=false;
    }catch(error){byId('export-errors').textContent=error.message;}finally{button.disabled=false;controls.forEach(el=>el.disabled=false);}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
updateSummary();
