(function(root) {
    'use strict';
    const fields = ['title','city','rent','area','rooms','bedrooms','energyLabel','yearBuilt','furnishing','listingUrl','rentNote','notes'];
    function parse(text) {
        text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.properties) ? parsed.properties : [parsed];
        if (!rows.length || rows.length > 50) throw Error('Paste between 1 and 50 properties.');
        return rows.map((row, index) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error(`Property ${index + 1} must be an object.`);
            const result = {};
            fields.forEach(key => {
                const value = row[key];
                if (value != null && !['number','string'].includes(typeof value)) throw Error(`Property ${index + 1}: ${key} must be text or a number.`);
                result[key] = value == null ? '' : String(value);
            });
            if (!result.title) throw Error(`Property ${index + 1} needs a title. Use the example format.`);
            return result;
        });
    }
    function url(value) {
        try { const u=new URL(value); if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return ''; return u.origin+u.pathname; } catch (_) { return ''; }
    }
    function id(row) { return (row.title+'-'+row.city).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90); }
    function clues(row) {
        return [row.energyLabel ? `Energy label ${row.energyLabel}` : 'Energy label not provided',
            [row.area ? `${row.area} m²` : 'Area not provided',row.rooms ? `${row.rooms} rooms${row.bedrooms ? ` (${row.bedrooms} bedrooms)` : ''}` : 'Room count not provided',row.city].filter(Boolean).join(', '),
            [row.yearBuilt ? `Built in ${row.yearBuilt}` : 'Construction year not provided',row.furnishing || 'Furnishing not provided'].join(', ')];
    }
    function validDate(date) { const d=new Date(date+'T12:00:00Z'); return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===date; }
    function validate(drafts, catalog, schedule) {
        const errors=[];const ids=new Set(catalog.map(p=>p.id));const urls=new Set(catalog.map(p=>url(p.listingUrl)).filter(Boolean));const dates=new Set(Object.keys(schedule));
        if (!drafts.length) return ['Paste at least one property first.'];
        drafts.forEach((d,i)=>{
            const r=d.row, label=`Property ${i+1} (${r.title || 'untitled'})`;
            const check=(ok,message)=>{if(!ok) errors.push(`${label}: ${message}`)};
            check(r.title.trim() && r.city.trim(),'enter a title and city.');
            check(Number.isFinite(Number(r.rent)) && Number(r.rent)>0,'enter a positive monthly rent.');
            check(r.rentNote.trim(),'explain what the rent includes, or state that it is unspecified.');
            const link=url(r.listingUrl);check(link,'enter a valid http(s) listing link.');
            check(!link || !urls.has(link),'this listing is already in the catalog or batch.');if(link)urls.add(link);
            const key=id(r);check(key && !ids.has(key),'this property name and city already exist; use a distinct title.');ids.add(key);
            for(const field of ['area','rooms','bedrooms','yearBuilt']) {
                if(r[field]!=='') check(Number.isFinite(Number(r[field])) && Number(r[field])>0 && (field==='area'||Number.isInteger(Number(r[field]))),`${field} must be a positive ${field==='area'?'number':'whole number'}.`);
            }
            if(r.rooms && r.bedrooms)check(Number(r.bedrooms)<=Number(r.rooms),'bedrooms cannot exceed total rooms.');
            check(d.clues.length===3 && d.clues.every(c=>c.trim()),'fill in all three text clues.');
            check(d.images.length===2 && d.images.every(Boolean),'choose both photos.');
            d.images.filter(Boolean).forEach(f=>check(['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size>0&&f.size<=15*1024*1024,'photos must be JPG, PNG or WebP, up to 15 MB each.'));
            if(d.date){check(validDate(d.date),'choose a valid puzzle date.');check(!dates.has(d.date),`${d.date} already has a puzzle. Choose another date.`);dates.add(d.date);}
        });return errors;
    }
    function build(drafts,catalog,schedule) {
        const errors=validate(drafts,catalog,schedule);if(errors.length)throw Error(errors.join('\n'));
        const properties=catalog.slice(), assignments={...schedule}, images=[];
        drafts.forEach(d=>{
            const key=id(d.row);const photoClues=d.images.map((file,i)=>{
                const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
                const name=`${key}-${i===0?'exterior':'interior'}.${extension}`;
                if(catalog.some(p=>p.clues?.some(c=>c.src===name)))throw Error(`Photo filename already exists: ${name}`);
                images.push({name,file});return {type:'image',src:name,text:`Clue ${i+1}/5: ${i===0?'Exterior':'Interior'}`};
            });
            properties.push({id:key,actualRent:Number(d.row.rent),title:`${d.row.title} · ${d.row.city}`,listingUrl:url(d.row.listingUrl),rentNote:d.row.rentNote,details:{...d.row},clues:[...photoClues,...d.clues.map((text,i)=>({type:'text',text:`Clue ${i+3}/5: ${text}`}))]});
            if(d.date)assignments[d.date]=key;
        });
        const files=[{name:'properties.js',data:'const propertiesDatabase = '+JSON.stringify(properties,null,4)+';\n'}, {name:'schedule.js',data:'// Puzzle dates use Europe/Amsterdam time.\nconst puzzleSchedule = '+JSON.stringify(Object.fromEntries(Object.entries(assignments).sort()),null,4)+';\n'}];
        return {files,images,properties,assignments};
    }
    // Store-only ZIP: no external libraries or network access needed.
    function zip(entries) {
        const encoder=new TextEncoder(), chunks=[],central=[];let offset=0;
        const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
        for(const entry of entries){
            const name=encoder.encode(entry.name),data=typeof entry.data==='string'?encoder.encode(entry.data):entry.data,checksum=crc(data);
            const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
            v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
            const header=new Uint8Array(46+name.length),h=new DataView(header.buffer);
            h.setUint32(0,0x02014b50,true);h.setUint16(4,20,true);h.setUint16(6,20,true);h.setUint16(8,0x800,true);h.setUint16(14,33,true);h.setUint32(16,checksum,true);h.setUint32(20,data.length,true);h.setUint32(24,data.length,true);h.setUint16(28,name.length,true);h.setUint32(42,offset,true);header.set(name,46);
            chunks.push(local,data);central.push(header);offset+=local.length+data.length;
        }
        const size=central.reduce((sum,x)=>sum+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
        e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
        return new Blob([...chunks,...central,end],{type:'application/zip'});
    }
    root.PropertyEditor={parse,clues,id,url,validate,build,zip};
})(typeof module==='object'?module.exports:window);
