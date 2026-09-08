(function(root) {
    'use strict';
    function dateKey(now=new Date()) {
        const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
        const get=key=>parts.find(p=>p.type===key).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    function validDate(value) {const d=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
    function previousDay(value) {const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
    function playable(id,properties) {
        const matches=properties.filter(p=>p.id===id),p=matches.length===1?matches[0]:null;
        return p&&Number.isFinite(p.actualRent)&&p.actualRent>0&&Array.isArray(p.clues)&&p.clues.length===5&&p.clues.every(c=>c&&['image','text'].includes(c.type)&&typeof c.text==='string')?p:null;
    }
    function archive(schedule,properties,today) {
        const unreleased=new Set(Object.entries(schedule).filter(([date])=>validDate(date)&&date>=today).map(([,id])=>id));
        return Object.keys(schedule).filter(date=>validDate(date)&&date<today&&!unreleased.has(schedule[date])&&playable(schedule[date],properties)).sort().reverse();
    }
    function midnight(date) {
        let low=Date.parse(date+'T00:00:00Z')-36*3600000,high=low+72*3600000;
        while(high-low>1){const mid=Math.floor((low+high)/2);if(dateKey(new Date(mid))<date)low=mid;else high=mid;}
        return high;
    }
    function nextPuzzle(schedule,properties,now=new Date()) {
        const today=dateKey(now),date=Object.keys(schedule).filter(d=>validDate(d)&&d>today&&playable(schedule[d],properties)).sort()[0];
        return date?{date,time:midnight(date)}:null;
    }
    function result(saved,date) {
        if(!saved||saved.puzzleId!==date||typeof saved.propertyId!=='string'||!['25','50','100'].includes(saved.difficulty)||!saved.gameOver||!Array.isArray(saved.guesses)||saved.guesses.length<1||saved.guesses.length>5)return null;
        let win=false;
        for(let i=0;i<saved.guesses.length;i++){
            const g=saved.guesses[i];if(!g||!['Correct!','Too high','Too low','-'].includes(g.feedback))return null;
            if(g.guess==='Skipped'){if(g.feedback!=='-')return null;}
            else if(!Number.isFinite(g.guess)||g.guess<=0||g.feedback==='-')return null;
            if(g.feedback==='Correct!'){if(i!==saved.guesses.length-1)return null;win=true;}
        }
        if(saved.isWin!==win||(!win&&saved.guesses.length!==5))return null;
        return {win,attempts:saved.guesses.length};
    }
    function statistics(records,today) {
        const results=Object.entries(records).filter(([d])=>validDate(d)&&d<=today).map(([d,s])=>[d,result(s,d)]).filter(([,r])=>r).sort(([a],[b])=>a.localeCompare(b));
        const byDate=new Map(results),distribution=[0,0,0,0,0];let wins=0,best=0,run=0,last=null;
        for(const [date,r] of results){if(r.win){wins++;distribution[r.attempts-1]++;run=last===previousDay(date)?run+1:1;best=Math.max(best,run);}else run=0;last=date;}
        let cursor=byDate.has(today)?today:previousDay(today),current=0;
        while(byDate.get(cursor)?.win){current++;cursor=previousDay(cursor);}
        return {played:results.length,wins,winRate:results.length?Math.round(wins/results.length*100):0,current,best,distribution};
    }
    root.RentdlePlayer={dateKey,validDate,playable,archive,midnight,nextPuzzle,result,statistics};
})(typeof module==='object'?module.exports:window);
