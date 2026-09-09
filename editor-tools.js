(function(root) {
    'use strict';
    const core = typeof module==='object' ? require('./editor-core.js').PropertyEditor : root.PropertyEditor;
    const maps = typeof module==='object' ? require('./map-core.js').RentdleMapCore : root.RentdleMapCore;
    function today(now=new Date()) {
        const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
        const get=k=>parts.find(p=>p.type===k).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    function addDays(date,n) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
    function monthDays(month) {
        const first=month+'-01';if(!core.validDate(first))throw Error('Invalid month.');
        const start=addDays(first,-((new Date(first+'T12:00:00Z').getUTCDay()+6)%7));
        return Array.from({length:42},(_,i)=>addDays(start,i));
    }
    function audit(properties,schedule,original={},day=today()) {
        const errors=[],warnings=[],ids=new Set(),links=new Set(),photos=[];
        properties.forEach((p,i)=>{
            const label=p?.title||`Property ${i+1}`;
            if(!p||typeof p.id!=='string'||!p.id.trim()){errors.push(`${label}: missing property ID.`);return;}
            if(ids.has(p.id))errors.push(`${label}: duplicate property ID.`);ids.add(p.id);
            if(!Number.isFinite(p.actualRent)||p.actualRent<=0)errors.push(`${label}: rent must be a positive number.`);
            if(!p.title?.trim())errors.push(`${label}: missing title.`);
            const link=core.url(p.listingUrl);
            if(!link)warnings.push(`${label}: no valid listing link for the result screen.`);
            if(link&&links.has(link))errors.push(`${label}: duplicate listing link.`);if(link)links.add(link);
            if(!p.rentNote?.trim())warnings.push(`${label}: rent inclusions are unspecified.`);
            if(typeof p.details?.notes==='string'&&p.details.notes.trim())warnings.push(`${label}: source notes to review — ${p.details.notes.trim()}`);
            if(!Array.isArray(p.clues)||p.clues.length!==5){errors.push(`${label}: exactly five clues are required.`);return;}
            p.clues.forEach((c,n)=>{
                if(!c||typeof c.text!=='string'||!c.text.trim()){errors.push(`${label}: clue ${n+1} needs text.`);return;}
                const mapped = p.clues.some(clue=>clue?.type==='map');
                if(n===0 || (!mapped && n===1 && p.clueLayout!=='location-second')){
                    if(c.type!=='image'||typeof c.src!=='string'||!c.src.trim())errors.push(`${label}: clue ${n+1} needs a photo.`);
                    else photos.push({src:c.src,label});
                }else if(mapped && n===(p.clueLayout==='location-second'?1:3)){
                    if(c.type!=='map' || !maps.coordinates(p.coordinates))errors.push(`${label}: clue ${n+1} needs a map with valid coordinates.`);
                }else if(c.type!=='text')errors.push(`${label}: clue ${n+1} must be a text clue.`);
                if(/not provided|unspecified/i.test(c.text))warnings.push(`${label}: clue ${n+1} includes missing information.`);
            });
        });
        const uses=new Map();
        Object.entries(schedule).forEach(([date,id])=>{
            if(!core.validDate(date))errors.push(`Invalid schedule date: ${date}.`);
            if(!ids.has(id))errors.push(`${date}: scheduled property is missing from the catalog.`);
            if(!uses.has(id))uses.set(id,[]);uses.get(id).push(date);
        });
        for(const [id,dates] of uses)if(dates.length>1)warnings.push(`${properties.find(p=>p.id===id)?.title||id}: reused on ${dates.sort().join(', ')}. Previously seen properties are easier to guess.`);
        const gaps=Array.from({length:14},(_,i)=>addDays(day,i)).filter(date=>!schedule[date]);
        if(gaps.length)warnings.push(`Empty dates in the next 14 days: ${gaps.join(', ')}.`);
        const changed=[...new Set([...Object.keys(original),...Object.keys(schedule)])].filter(d=>d<=day&&original[d]!==schedule[d]).sort();
        if(changed.length)warnings.push(`Today or past dates changed: ${changed.join(', ')}. Existing player saves may reset and practice availability may change.`);
        return {errors,warnings,photos};
    }
    function dimensions(width,height,max=1600) {
        const scale=Math.min(1,max/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
    }
    async function optimize(file) {
        if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>15*1024*1024)throw Error('Choose a JPG, PNG or WebP photo up to 15 MB.');
        const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
        const signatures={'image/jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'image/png':[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),'image/webp':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'};
        if(!signatures[file.type])throw Error('Photo contents do not match its file type.');
        let bitmap;
        try {bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_){throw Error('This photo cannot be decoded. Try another JPG, PNG or WebP.');}
        try {
            const size=dimensions(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
            const context=canvas.getContext('2d');if(!context)throw Error('Your browser could not prepare this photo.');
            context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(bitmap,0,0,size.width,size.height);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
            if(!blob)throw Error('Your browser could not compress this photo.');
            const resized=size.width!==bitmap.width||size.height!==bitmap.height;
            const useOriginal=!resized&&file.size<=blob.size;
            const output=useOriginal?file:new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:blob.type});
            return {file:output,originalBytes:file.size,width:size.width,height:size.height,keptOriginal:useOriginal};
        } finally {bitmap.close();}
    }
    root.EditorTools={today,addDays,monthDays,audit,dimensions,optimize};
})(typeof module==='object'?module.exports:window);
