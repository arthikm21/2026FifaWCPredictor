import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  Trophy, Plus, Minus, RotateCcw, Sparkles, Check, Lock, Shuffle,
  ChevronRight, ChevronDown, ArrowRight, X, Star, Circle, Flag
} from "lucide-react";

/* ============================================================
   FIFA WORLD CUP 2026 — PREDICTOR
   Real draw · real bracket logic · group stage → the trophy
   ============================================================ */

// ---- Teams (the actual Dec-2025 final draw) -------------------------
const TEAMS = {
  A: [["Mexico","MEX","🇲🇽",78,"CONCACAF"],["South Africa","RSA","🇿🇦",62,"CAF"],["Korea Republic","KOR","🇰🇷",73,"AFC"],["Czechia","CZE","🇨🇿",71,"UEFA"]],
  B: [["Canada","CAN","🇨🇦",74,"CONCACAF"],["Bosnia & Herzegovina","BIH","🇧🇦",70,"UEFA"],["Qatar","QAT","🇶🇦",64,"AFC"],["Switzerland","SUI","🇨🇭",78,"UEFA"]],
  C: [["Brazil","BRA","🇧🇷",90,"CONMEBOL"],["Morocco","MAR","🇲🇦",83,"CAF"],["Haiti","HAI","🇭🇹",56,"CONCACAF"],["Scotland","SCO","🏴󠁧󠁢󠁳󠁣󠁴󠁿",71,"UEFA"]],
  D: [["United States","USA","🇺🇸",76,"CONCACAF"],["Paraguay","PAR","🇵🇾",70,"CONMEBOL"],["Australia","AUS","🇦🇺",70,"AFC"],["Türkiye","TUR","🇹🇷",76,"UEFA"]],
  E: [["Germany","GER","🇩🇪",86,"UEFA"],["Curaçao","CUW","🇨🇼",54,"CONCACAF"],["Côte d'Ivoire","CIV","🇨🇮",73,"CAF"],["Ecuador","ECU","🇪🇨",76,"CONMEBOL"]],
  F: [["Netherlands","NED","🇳🇱",87,"UEFA"],["Japan","JPN","🇯🇵",79,"AFC"],["Sweden","SWE","🇸🇪",72,"UEFA"],["Tunisia","TUN","🇹🇳",69,"CAF"]],
  G: [["Belgium","BEL","🇧🇪",84,"UEFA"],["Egypt","EGY","🇪🇬",73,"CAF"],["Iran","IRN","🇮🇷",73,"AFC"],["New Zealand","NZL","🇳🇿",60,"OFC"]],
  H: [["Spain","ESP","🇪🇸",92,"UEFA"],["Cabo Verde","CPV","🇨🇻",62,"CAF"],["Saudi Arabia","KSA","🇸🇦",64,"AFC"],["Uruguay","URU","🇺🇾",81,"CONMEBOL"]],
  I: [["France","FRA","🇫🇷",91,"UEFA"],["Senegal","SEN","🇸🇳",80,"CAF"],["Iraq","IRQ","🇮🇶",61,"AFC"],["Norway","NOR","🇳🇴",80,"UEFA"]],
  J: [["Argentina","ARG","🇦🇷",93,"CONMEBOL"],["Algeria","ALG","🇩🇿",73,"CAF"],["Austria","AUT","🇦🇹",76,"UEFA"],["Jordan","JOR","🇯🇴",66,"AFC"]],
  K: [["Portugal","POR","🇵🇹",88,"UEFA"],["DR Congo","COD","🇨🇩",68,"CAF"],["Uzbekistan","UZB","🇺🇿",65,"AFC"],["Colombia","COL","🇨🇴",82,"CONMEBOL"]],
  L: [["England","ENG","🏴󠁧󠁢󠁥󠁮󠁧󠁿",89,"UEFA"],["Croatia","CRO","🇭🇷",80,"UEFA"],["Ghana","GHA","🇬🇭",70,"CAF"],["Panama","PAN","🇵🇦",66,"CONCACAF"]],
};
const GROUP_LETTERS = Object.keys(TEAMS);

// build team objects with stable ids
const TEAM = {};
GROUP_LETTERS.forEach((g) => {
  TEAMS[g].forEach((t, i) => {
    const id = `${g}${i}`;
    TEAM[id] = { id, name: t[0], code: t[1], flag: t[2], rk: t[3], conf: t[4], group: g };
  });
});

// round-robin pairings for indices 0..3
const RR = [[0,1],[2,3],[0,3],[1,2],[0,2],[3,1]];
const GROUP_MATCHES = [];
GROUP_LETTERS.forEach((g) => {
  RR.forEach((p, i) => {
    GROUP_MATCHES.push({ id: `g-${g}-${i}`, group: g, a: `${g}${p[0]}`, b: `${g}${p[1]}` });
  });
});

// third-place slot eligibility (verified vs official FIFA Annex C)
const THIRD_SLOTS = [
  { win: "A", elig: ["C","E","F","H","I"] },
  { win: "B", elig: ["E","F","G","I","J"] },
  { win: "D", elig: ["B","E","F","I","J"] },
  { win: "E", elig: ["A","B","C","D","F"] },
  { win: "G", elig: ["A","E","H","I","J"] },
  { win: "I", elig: ["C","D","F","G","H"] },
  { win: "K", elig: ["D","E","I","J","L"] },
  { win: "L", elig: ["E","H","I","J","K"] },
];

// knockout tree — ordered so every source refers to an earlier match
// source codes: "1X"/"2X" group pos, "TX" third assigned to winner-of-group-X slot,
//               "W:id"/"L:id" winner/loser of a prior match
const KO = [
  // ----- Round of 32 (visual order, left-top → left-bottom → right-top → right-bottom)
  { id:"r32_1",  round:"R32", a:"1E", b:"TE", date:"Jun 29" },
  { id:"r32_2",  round:"R32", a:"1I", b:"TI", date:"Jun 30" },
  { id:"r32_3",  round:"R32", a:"2A", b:"2B", date:"Jun 28" },
  { id:"r32_4",  round:"R32", a:"1F", b:"2C", date:"Jun 29" },
  { id:"r32_5",  round:"R32", a:"2K", b:"2L", date:"Jul 2" },
  { id:"r32_6",  round:"R32", a:"1H", b:"2J", date:"Jul 2" },
  { id:"r32_7",  round:"R32", a:"1D", b:"TD", date:"Jul 1" },
  { id:"r32_8",  round:"R32", a:"1G", b:"TG", date:"Jul 1" },
  { id:"r32_9",  round:"R32", a:"1C", b:"2F", date:"Jun 29" },
  { id:"r32_10", round:"R32", a:"2E", b:"2I", date:"Jun 30" },
  { id:"r32_11", round:"R32", a:"1A", b:"TA", date:"Jun 30" },
  { id:"r32_12", round:"R32", a:"1L", b:"TL", date:"Jul 1" },
  { id:"r32_13", round:"R32", a:"1J", b:"2H", date:"Jul 3" },
  { id:"r32_14", round:"R32", a:"2D", b:"2G", date:"Jul 3" },
  { id:"r32_15", round:"R32", a:"1B", b:"TB", date:"Jul 2" },
  { id:"r32_16", round:"R32", a:"1K", b:"TK", date:"Jul 3" },
  // ----- Round of 16
  { id:"r16_1", round:"R16", a:"W:r32_1",  b:"W:r32_2",  date:"Jul 4" },
  { id:"r16_2", round:"R16", a:"W:r32_3",  b:"W:r32_4",  date:"Jul 4" },
  { id:"r16_3", round:"R16", a:"W:r32_5",  b:"W:r32_6",  date:"Jul 6" },
  { id:"r16_4", round:"R16", a:"W:r32_7",  b:"W:r32_8",  date:"Jul 6" },
  { id:"r16_5", round:"R16", a:"W:r32_9",  b:"W:r32_10", date:"Jul 5" },
  { id:"r16_6", round:"R16", a:"W:r32_11", b:"W:r32_12", date:"Jul 5" },
  { id:"r16_7", round:"R16", a:"W:r32_13", b:"W:r32_14", date:"Jul 7" },
  { id:"r16_8", round:"R16", a:"W:r32_15", b:"W:r32_16", date:"Jul 7" },
  // ----- Quarterfinals
  { id:"qf_1", round:"QF", a:"W:r16_1", b:"W:r16_2", date:"Jul 9" },
  { id:"qf_2", round:"QF", a:"W:r16_3", b:"W:r16_4", date:"Jul 10" },
  { id:"qf_3", round:"QF", a:"W:r16_5", b:"W:r16_6", date:"Jul 11" },
  { id:"qf_4", round:"QF", a:"W:r16_7", b:"W:r16_8", date:"Jul 11" },
  // ----- Semifinals
  { id:"sf_1", round:"SF", a:"W:qf_1", b:"W:qf_2", date:"Jul 14" },
  { id:"sf_2", round:"SF", a:"W:qf_3", b:"W:qf_4", date:"Jul 15" },
  // ----- Final + Bronze
  { id:"final",  round:"FINAL",  a:"W:sf_1", b:"W:sf_2", date:"Jul 19" },
  { id:"bronze", round:"BRONZE", a:"L:sf_1", b:"L:sf_2", date:"Jul 18" },
];
const KO_BY_ID = Object.fromEntries(KO.map((m) => [m.id, m]));

// ---- tiny deterministic RNG --------------------------------------
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

// ---- standings engine --------------------------------------------
function emptyStat(id){return{id,pld:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};}
// Interpret a stored entry under the active mode. Works across both shapes
// ({a,b} scoreline or {r} winner) so switching modes never loses your picks.
function outcome(s, mode){
  if(!s)return null;
  const hasScore=s.a!=null||s.b!=null;
  if(mode==="winner"){
    let r=s.r;
    if(!r&&hasScore){const a=s.a??0,b=s.b??0;r=a>b?"a":a<b?"b":"d";}
    if(!r)return null;
    return{r,ga:0,gb:0,pa:r==="a"?3:r==="d"?1:0,pb:r==="b"?3:r==="d"?1:0};
  }
  let a,b;
  if(hasScore){a=s.a??0;b=s.b??0;}
  else if(s.r){const m={a:[1,0],d:[1,1],b:[0,1]}[s.r];a=m[0];b=m[1];}
  else return null;
  return{ga:a,gb:b,pa:a>b?3:a===b?1:0,pb:b>a?3:a===b?1:0,r:a>b?"a":a<b?"b":"d"};
}
function computeGroup(group, scores, mode){
  const stats={};
  TEAMS[group].forEach((_,i)=>{stats[`${group}${i}`]=emptyStat(`${group}${i}`);});
  const ms=GROUP_MATCHES.filter((m)=>m.group===group);
  let played=0;
  ms.forEach((m)=>{
    const o=outcome(scores[m.id],mode);
    if(!o)return;
    played++;
    const A=stats[m.a],B=stats[m.b];
    A.pld++;B.pld++;A.gf+=o.ga;A.ga+=o.gb;B.gf+=o.gb;B.ga+=o.ga;A.pts+=o.pa;B.pts+=o.pb;
    if(o.pa===3){A.w++;B.l++;}else if(o.pb===3){B.w++;A.l++;}else{A.d++;B.d++;}
  });
  Object.values(stats).forEach((t)=>{t.gd=t.gf-t.ga;});
  // h2h mini-table helper for a block of tied ids
  const h2h=(ids)=>{
    const mini={};ids.forEach((id)=>mini[id]=emptyStat(id));
    ms.forEach((m)=>{
      if(!ids.includes(m.a)||!ids.includes(m.b))return;
      const o=outcome(scores[m.id],mode);if(!o)return;
      const A=mini[m.a],B=mini[m.b];A.gf+=o.ga;A.ga+=o.gb;B.gf+=o.gb;B.ga+=o.ga;A.pts+=o.pa;B.pts+=o.pb;
    });
    Object.values(mini).forEach((t)=>t.gd=t.gf-t.ga);
    return mini;
  };
  const base=Object.values(stats).sort((x,y)=>
    y.pts-x.pts||y.gd-x.gd||y.gf-x.gf||TEAM[y.id].rk-TEAM[x.id].rk||TEAM[x.id].name.localeCompare(TEAM[y.id].name));
  // re-sort blocks identical on pts/gd/gf by head-to-head
  const out=[];let i=0;
  while(i<base.length){
    let j=i+1;
    while(j<base.length&&base[j].pts===base[i].pts&&base[j].gd===base[i].gd&&base[j].gf===base[i].gf)j++;
    if(j-i>1){
      const block=base.slice(i,j);const ids=block.map((b)=>b.id);const mini=h2h(ids);
      block.sort((x,y)=>mini[y.id].pts-mini[x.id].pts||mini[y.id].gd-mini[x.id].gd||mini[y.id].gf-mini[x.id].gf||TEAM[y.id].rk-TEAM[x.id].rk||TEAM[x.id].name.localeCompare(TEAM[y.id].name));
      out.push(...block);
    } else out.push(base[i]);
    i=j;
  }
  return { table: out, played, complete: played===6 };
}

// assign 8 qualifying thirds to the 8 winner-vs-third slots
function assignThirds(qGroups){
  const slots=THIRD_SLOTS.map((s)=>({...s,opts:s.elig.filter((g)=>qGroups.includes(g))}))
    .sort((a,b)=>a.opts.length-b.opts.length); // most constrained first
  const used={};const res={};
  const bt=(k)=>{
    if(k===slots.length)return true;
    const s=slots[k];
    for(const g of s.opts){
      if(used[g])continue;
      used[g]=true;res[s.win]=g;
      if(bt(k+1))return true;
      used[g]=false;delete res[s.win];
    }
    return false;
  };
  bt(0);
  return res; // {winGroup: thirdGroup}
}

const ROUND_LABEL={R32:"Round of 32",R16:"Round of 16",QF:"Quarterfinals",SF:"Semifinals",FINAL:"Final",BRONZE:"Third place"};
const SAVE_KEY="wc26-predictor-v1";

export default function App(){
  const [tab,setTab]=useState("overview");
  const [mode,setMode]=useState("score"); // "winner" | "score"
  const [chooser,setChooser]=useState(false);
  const [gScores,setGScores]=useState({});
  const [kScores,setKScores]=useState({});
  const [openGroup,setOpenGroup]=useState(null);
  const [hydrated,setHydrated]=useState(false);
  const [resetAsk,setResetAsk]=useState(false);

  // ---- persistence (best-effort) ----
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        if(window.storage&&typeof window.storage.get==="function"){
          const r=await window.storage.get(SAVE_KEY);
          if(alive&&r&&r.value){const d=JSON.parse(r.value);setGScores(d.g||{});setKScores(d.k||{});if(d.mode)setMode(d.mode);}
        }
      }catch(e){/* no-op */}
      if(alive)setHydrated(true);
    })();
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    const t=setTimeout(async()=>{
      try{ if(window.storage&&typeof window.storage.set==="function")
        await window.storage.set(SAVE_KEY,JSON.stringify({g:gScores,k:kScores,mode})); }catch(e){}
    },400);
    return()=>clearTimeout(t);
  },[gScores,kScores,mode,hydrated]);

  // ---- derived: standings ----
  const groups=useMemo(()=>{
    const o={};GROUP_LETTERS.forEach((g)=>{o[g]=computeGroup(g,gScores,mode);});return o;
  },[gScores,mode]);

  const allGroupsComplete=GROUP_LETTERS.every((g)=>groups[g].complete);
  const groupDone=Object.values(gScores).filter((s)=>s&&(s.a!=null||s.b!=null||s.r)).length;

  // thirds
  const thirds=useMemo(()=>{
    if(!allGroupsComplete)return{ranked:[],qualGroups:[],assign:{}};
    const list=GROUP_LETTERS.map((g)=>({g,stat:groups[g].table[2]}));
    list.sort((x,y)=>y.stat.pts-x.stat.pts||y.stat.gd-x.stat.gd||y.stat.gf-x.stat.gf||TEAM[y.stat.id].rk-TEAM[x.stat.id].rk);
    const qualGroups=list.slice(0,8).map((x)=>x.g);
    const assign=assignThirds(qualGroups);
    return{ranked:list,qualGroups,assign};
  },[groups,allGroupsComplete]);

  // ---- resolve knockout ----
  const ko=useMemo(()=>{
    const out={};
    const teamFromCode=(code)=>{
      if(!code)return null;
      if(code[0]==="W"||code[0]==="L"){
        const id=code.slice(2);const m=out[id];if(!m)return null;
        return code[0]==="W"?m.winner:m.loser;
      }
      if(code[0]==="T"){ // third assigned to winner-of-group slot
        if(!allGroupsComplete)return null;
        const wg=code[1];const tg=thirds.assign[wg];if(!tg)return null;
        return groups[tg].table[2].id;
      }
      // group position 1X / 2X
      const pos=parseInt(code[0],10);const g=code[1];
      if(!allGroupsComplete)return null;
      return groups[g].table[pos-1].id;
    };
    KO.forEach((m)=>{
      const a=teamFromCode(m.a), b=teamFromCode(m.b);
      const s=kScores[m.id]||{};
      const touched=s.a!=null||s.b!=null;
      const ea=s.a??0,eb=s.b??0;
      let winner=null,loser=null,decided=false;
      if(a&&b&&s.pick==="a"){winner=a;loser=b;decided=true;}
      else if(a&&b&&s.pick==="b"){winner=b;loser=a;decided=true;}
      else if(a&&b&&touched){
        if(ea>eb){winner=a;loser=b;decided=true;}
        else if(eb>ea){winner=b;loser=a;decided=true;}
        else if(s.pen==="a"){winner=a;loser=b;decided=true;}
        else if(s.pen==="b"){winner=b;loser=a;decided=true;}
      }
      out[m.id]={...m,teamA:a,teamB:b,score:s,winner,loser,decided,tie:!!(a&&b&&touched&&ea===eb&&!s.pick)};
    });
    return out;
  },[kScores,groups,thirds,allGroupsComplete]);

  const koCount=KO.filter((m)=>m.id!=="bronze").length; // 31
  const koDone=KO.filter((m)=>m.id!=="bronze"&&ko[m.id]&&ko[m.id].decided).length;
  const champion=ko.final&&ko.final.winner?TEAM[ko.final.winner]:null;

  // ---- actions ----
  const setGoal=(matchId,side,val)=>setGScores((p)=>{
    const cur=p[matchId]||{a:null,b:null};
    return{...p,[matchId]:{...cur,[side]:val}};
  });
  // winner-mode group pick: A win / draw / B win
  const setResult=(matchId,r)=>setGScores((p)=>{
    const o=outcome(p[matchId],"winner");
    if(o&&o.r===r){const nx={...p};delete nx[matchId];return nx;} // tap again to clear
    return{...p,[matchId]:{r}};
  });
  const setKGoal=(matchId,side,val)=>setKScores((p)=>{
    const cur=p[matchId]||{a:null,b:null};
    const nx={...cur,[side]:val};
    delete nx.pick; // entering a score overrides a quick name-pick
    const touched=nx.a!=null||nx.b!=null;
    if(!touched||(nx.a??0)!==(nx.b??0))delete nx.pen;
    return{...p,[matchId]:nx};
  });
  const setPen=(matchId,who)=>setKScores((p)=>({...p,[matchId]:{...(p[matchId]||{}),pen:who}}));
  // quick pick: choosing a team by name advances them with no scoreline
  const setPick=(matchId,who)=>setKScores((p)=>{
    const cur=p[matchId]||{};
    if(cur.pick===who){const nx={...cur};delete nx.pick;return{...p,[matchId]:nx};} // tap again to clear
    return{...p,[matchId]:{pick:who}};
  });

  const smartFill=()=>{
    setGScores((prev)=>{
      const nx={...prev};
      GROUP_MATCHES.forEach((m)=>{
        const ex=nx[m.id];if(ex&&(ex.a!=null||ex.b!=null||ex.r))return;
        const rng=mulberry32(hashStr(m.id));
        const ra=TEAM[m.a].rk,rb=TEAM[m.b].rk;const edge=(ra-rb)/45;
        const la=clamp(1.15+edge,0.2,3.1),lb=clamp(1.15-edge,0.2,3.1);
        const ga=clamp(Math.round(la+(rng()-0.5)*1.8),0,5);
        const gb=clamp(Math.round(lb+(rng()-0.5)*1.8),0,5);
        nx[m.id]={a:ga,b:gb};
      });
      return nx;
    });
  };
  const randomize=()=>{
    setGScores(()=>{
      const nx={};GROUP_MATCHES.forEach((m)=>{nx[m.id]={a:Math.floor(Math.random()*4),b:Math.floor(Math.random()*4)};});return nx;
    });
    setKScores({});
  };
  const resetAll=()=>{setGScores({});setKScores({});setResetAsk(false);setOpenGroup(null);};

  // champion route
  const route=useMemo(()=>{
    if(!champion)return[];
    const order=["r32","r16","qf","sf","final"];const steps=[];
    KO.forEach((m)=>{
      if(m.id==="bronze")return;
      const r=ko[m.id];if(!r||r.winner!==champion.id)return;
      const opp=r.teamA===champion.id?r.teamB:r.teamA;
      steps.push({round:m.round,opp:opp?TEAM[opp]:null,score:r.score});
    });
    return steps;
  },[ko,champion]);

  return(
    <div className="wc-root">
      <Style/>
      <Atmosphere/>

      {/* ---------- NAV ---------- */}
      <nav className="wc-nav">
        <div className="wc-brand" onClick={()=>setTab("overview")}>
          <span className="wc-mark">26</span>
          <span className="wc-brandtext">WORLD&nbsp;CUP<small>PREDICTOR</small></span>
        </div>
        <div className="wc-tabs">
          {[["overview","Overview"],["groups","Groups"],["knockout","Knockout"],["champion","Champion"]].map(([k,l])=>(
            <button key={k} className={`wc-tab ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <button className="wc-reset" onClick={()=>setResetAsk(true)} title="Reset all picks"><RotateCcw size={15}/></button>
      </nav>

      {/* ---------- OVERVIEW ---------- */}
      {tab==="overview"&&(
        <section className="wc-wrap wc-hero">
          <div className="wc-hosts"><span>🇨🇦</span><span>🇲🇽</span><span>🇺🇸</span></div>
          <h1 className="wc-h1">PREDICT THE<br/><span className="grad">ENTIRE</span> WORLD&nbsp;CUP</h1>
          <p className="wc-sub">Call every result from the 72 group games — the table sorts itself, the eight best third-place teams seed automatically, and your picks flow all the way to the trophy at MetLife on July&nbsp;19.</p>

          <div className="wc-rings">
            <Ring label="Group picks" value={groupDone} max={72} color="var(--gold)"/>
            <Ring label="Knockout calls" value={koDone} max={koCount} color="var(--green)"/>
          </div>

          <div className="wc-cta">
            <button className="btn gold" onClick={()=>setChooser(true)}>Start predicting <ArrowRight size={16}/></button>
            <button className="btn ghost" onClick={smartFill}><Sparkles size={15}/> Smart-fill groups</button>
            <button className="btn ghost" onClick={randomize}><Shuffle size={15}/> Randomize</button>
          </div>

          <div className="wc-facts">
            <Fact n="48" t="teams"/><Fact n="12" t="groups"/><Fact n="104" t="matches"/><Fact n="16" t="host cities"/>
          </div>
          {champion&&(
            <div className="wc-prechamp" onClick={()=>setTab("champion")}>
              <Trophy size={16}/> Your champion: <b>{champion.flag} {champion.name}</b> <ChevronRight size={15}/>
            </div>
          )}
        </section>
      )}

      {/* ---------- GROUPS ---------- */}
      {tab==="groups"&&(
        <section className="wc-wrap">
          <Header title="Group Stage" sub={mode==="winner"?`${groupDone} / 72 games called · pick a winner (or draw) for each match — top 2 of every group advance, plus the 8 best 3rd-place teams`:`${groupDone} / 72 results predicted · set a scoreline for each match — top 2 of every group advance, plus the 8 best 3rd-place teams`}/>
          <div className="wc-toolbar">
            <div className="wc-modeseg">
              <button className={mode==="winner"?"on":""} onClick={()=>setMode("winner")}>Winner only</button>
              <button className={mode==="score"?"on":""} onClick={()=>setMode("score")}>By scoreline</button>
            </div>
            <button className="btn ghost sm" onClick={smartFill}><Sparkles size={14}/> Smart-fill</button>
            <button className="btn ghost sm" onClick={randomize}><Shuffle size={14}/> Randomize</button>
          </div>
          <div className="wc-grid">
            {GROUP_LETTERS.map((g)=>(
              <GroupCard key={g} g={g} data={groups[g]} thirds={thirds} onOpen={()=>setOpenGroup(g)} allComplete={allGroupsComplete}/>
            ))}
          </div>
        </section>
      )}

      {/* ---------- KNOCKOUT ---------- */}
      {tab==="knockout"&&(
        <section className="wc-wrap">
          <Header title="Knockout Bracket" sub={allGroupsComplete?(mode==="winner"?`${koDone} / ${koCount} matches called · tap a team to send it through to the next round`:`${koDone} / ${koCount} matches called · two ways to advance a team — tap its name for a quick pick, or set a scoreline (draws go to your penalty pick)`):"Finish all 72 group games to unlock real teams — the bracket below mirrors the official slots until then"}/>
          {!allGroupsComplete&&(
            <div className="wc-lockbar"><Lock size={14}/> {72-groupDone} group result{72-groupDone===1?"":"s"} left. <button className="linkbtn" onClick={smartFill}>Smart-fill the rest</button></div>
          )}
          <Bracket ko={ko} mode={mode} setKGoal={setKGoal} setPen={setPen} setPick={setPick} unlocked={allGroupsComplete} champion={champion}/>
        </section>
      )}

      {/* ---------- CHAMPION ---------- */}
      {tab==="champion"&&(
        <section className="wc-wrap wc-champ">
          {!champion?(
            <div className="wc-empty">
              <Trophy size={42}/>
              <h2>No champion yet</h2>
              <p>Predict your way through the bracket — your winner will be crowned here.</p>
              <button className="btn gold" onClick={()=>setTab(allGroupsComplete?"knockout":"groups")}>{allGroupsComplete?"Go to bracket":"Finish the groups"} <ArrowRight size={16}/></button>
            </div>
          ):(
            <ChampionView champion={champion} ko={ko} route={route}/>
          )}
        </section>
      )}

      {/* ---------- GROUP SHEET ---------- */}
      {openGroup&&(
        <GroupSheet g={openGroup} data={groups[openGroup]} scores={gScores} mode={mode} setGoal={setGoal} setResult={setResult} thirds={thirds} allComplete={allGroupsComplete} onClose={()=>setOpenGroup(null)}/>
      )}

      {/* ---------- MODE CHOOSER ---------- */}
      {chooser&&(
        <div className="wc-modalbg" onClick={()=>setChooser(false)}>
          <div className="wc-chooser" onClick={(e)=>e.stopPropagation()}>
            <button className="wc-x ch-x" onClick={()=>setChooser(false)}><X size={18}/></button>
            <h3 className="ch-title">How do you want to predict?</h3>
            <p className="ch-sub">You can switch anytime from the Groups tab.</p>
            <div className="ch-cards">
              <button className="ch-card" onClick={()=>{setMode("winner");setChooser(false);setTab("groups");}}>
                <div className="ch-ico"><Check size={22}/></div>
                <b>Only predict the winner</b>
                <span>Pick who wins each game — fast. Choose a winner or draw in the groups, and tap a team to advance it in the bracket.</span>
                <span className="ch-go">Pick winners <ArrowRight size={14}/></span>
              </button>
              <button className="ch-card" onClick={()=>{setMode("score");setChooser(false);setTab("groups");}}>
                <div className="ch-ico score"><span>2-1</span></div>
                <b>Predict each scoreline</b>
                <span>Set exact scores for every game. Goal difference breaks group ties, and draws in the knockout go to your penalty pick.</span>
                <span className="ch-go">Predict scores <ArrowRight size={14}/></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- RESET DIALOG ---------- */}
      {resetAsk&&(
        <div className="wc-modalbg" onClick={()=>setResetAsk(false)}>
          <div className="wc-dialog" onClick={(e)=>e.stopPropagation()}>
            <h3>Clear every prediction?</h3>
            <p>This wipes all group scores and knockout picks. Can’t be undone.</p>
            <div className="wc-dialogbtns">
              <button className="btn ghost" onClick={()=>setResetAsk(false)}>Cancel</button>
              <button className="btn danger" onClick={resetAll}>Reset everything</button>
            </div>
          </div>
        </div>
      )}

      <footer className="wc-foot">Unofficial fan predictor · real 2026 draw &amp; bracket rules · not affiliated with FIFA</footer>
    </div>
  );
}

/* ============================= COMPONENTS ============================= */

function Header({title,sub}){
  return(<div className="wc-sechead"><h2 className="wc-h2">{title}</h2><p className="wc-secsub">{sub}</p></div>);
}
function Fact({n,t}){return(<div className="wc-fact"><b>{n}</b><span>{t}</span></div>);}

function Ring({label,value,max,color}){
  const pct=max?value/max:0;const R=34,C=2*Math.PI*R;
  return(
    <div className="wc-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="7"/>
        <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C*(1-pct)} transform="rotate(-90 42 42)" style={{transition:"stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"}}/>
        <text x="42" y="40" textAnchor="middle" className="ring-n">{value}</text>
        <text x="42" y="54" textAnchor="middle" className="ring-d">/ {max}</text>
      </svg>
      <span className="wc-ringlabel">{label}</span>
    </div>
  );
}

function statusOf(data){
  if(data.complete)return{t:"Complete",c:"ok"};
  if(data.played>0)return{t:`${data.played}/6`,c:"mid"};
  return{t:"Not started",c:"off"};
}

function GroupCard({g,data,thirds,onOpen,allComplete}){
  const st=statusOf(data);
  const qualThird=allComplete&&thirds.qualGroups.includes(g);
  return(
    <button className="wc-gcard" onClick={onOpen}>
      <div className="wc-gcardtop">
        <span className="wc-gletter">{g}</span>
        <span className={`wc-pill ${st.c}`}>{st.c==="ok"&&<Check size={11}/>}{st.t}</span>
      </div>
      <div className="wc-glist">
        {data.table.map((row,i)=>{
          const t=TEAM[row.id];
          const adv=data.complete&&i<2;
          const third=data.complete&&i===2;
          return(
            <div key={row.id} className={`wc-grow ${adv?"adv":""} ${third?"third":""}`}>
              <span className="wc-pos">{i+1}</span>
              <span className="wc-flag">{t.flag}</span>
              <span className="wc-tname">{t.name}</span>
              {third&&qualThird&&<span className="wc-q3" title="Among the 8 best 3rd-place teams">3rd ✓</span>}
              {third&&!qualThird&&allComplete&&<span className="wc-q3 out">out</span>}
              <span className="wc-pts">{data.played?row.pts:"–"}</span>
            </div>
          );
        })}
      </div>
      <span className="wc-gopen">Edit results <ChevronRight size={13}/></span>
    </button>
  );
}

function Stepper({val,onChange,size}){
  const set=(d)=>{
    let base=val==null?0:val;
    let nx=base+d;if(nx<0)nx=0;else if(nx>9)nx=9;
    onChange(nx);
  };
  return(
    <div className={`wc-step ${size||""}`}>
      <button onClick={(e)=>{e.stopPropagation();set(-1);}} aria-label="minus"><Minus size={size==="sm"?12:14}/></button>
      <span className="wc-stepn">{val==null?0:val}</span>
      <button onClick={(e)=>{e.stopPropagation();set(1);}} aria-label="plus"><Plus size={size==="sm"?12:14}/></button>
    </div>
  );
}

function MatchRow({m,scores,mode,setGoal,setResult}){
  const s=scores[m.id]||{a:null,b:null};
  const A=TEAM[m.a],B=TEAM[m.b];
  const o=outcome(s,mode);
  const done=!!o;
  const aw=done&&o.pa===3, bw=done&&o.pb===3, dr=done&&o.pa===1&&o.pb===1;
  if(mode==="winner"){
    const r=o?o.r:null;
    return(
      <div className={`wc-match wm ${done?"done":""}`}>
        <div className={`wc-mteam left ${aw?"win":""} ${dr?"draw":""}`}>
          <span className="wc-tname">{A.name}</span><span className="wc-flag">{A.flag}</span>
        </div>
        <div className="wc-wdl">
          <button className={r==="a"?"on":""} onClick={()=>setResult(m.id,"a")} title={`${A.name} win`}>{A.code}</button>
          <button className={`d ${r==="d"?"on":""}`} onClick={()=>setResult(m.id,"d")}>Draw</button>
          <button className={r==="b"?"on":""} onClick={()=>setResult(m.id,"b")} title={`${B.name} win`}>{B.code}</button>
        </div>
        <div className={`wc-mteam right ${bw?"win":""} ${dr?"draw":""}`}>
          <span className="wc-flag">{B.flag}</span><span className="wc-tname">{B.name}</span>
        </div>
      </div>
    );
  }
  return(
    <div className={`wc-match ${done?"done":""}`}>
      <div className={`wc-mteam left ${aw?"win":""} ${dr?"draw":""}`}>
        <span className="wc-tname">{A.name}</span><span className="wc-flag">{A.flag}</span>
      </div>
      <Stepper val={s.a} onChange={(v)=>setGoal(m.id,"a",v)}/>
      <span className="wc-vs">v</span>
      <Stepper val={s.b} onChange={(v)=>setGoal(m.id,"b",v)}/>
      <div className={`wc-mteam right ${bw?"win":""} ${dr?"draw":""}`}>
        <span className="wc-flag">{B.flag}</span><span className="wc-tname">{B.name}</span>
      </div>
    </div>
  );
}

function GroupSheet({g,data,scores,mode,setGoal,setResult,thirds,allComplete,onClose}){
  const ms=GROUP_MATCHES.filter((m)=>m.group===g);
  const wm=mode==="winner";
  // FLIP animation for standings reorder
  const rowRefs=useRef({});const prev=useRef({});
  useLayoutEffect(()=>{
    const cur={};
    Object.entries(rowRefs.current).forEach(([id,el])=>{if(el)cur[id]=el.getBoundingClientRect().top;});
    Object.entries(cur).forEach(([id,top])=>{
      const p=prev.current[id];const el=rowRefs.current[id];
      if(p!=null&&el&&Math.abs(p-top)>1){
        el.style.transition="none";el.style.transform=`translateY(${p-top}px)`;
        requestAnimationFrame(()=>{el.style.transition="transform .45s cubic-bezier(.2,.8,.2,1)";el.style.transform="";});
      }
    });
    prev.current=cur;
  });
  return(
    <div className="wc-modalbg" onClick={onClose}>
      <div className="wc-sheet" onClick={(e)=>e.stopPropagation()}>
        <div className="wc-sheethead">
          <div><span className="wc-gletter big">{g}</span><h3>Group {g}</h3></div>
          <button className="wc-x" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="wc-sheetcols">
          <div className="wc-matches">
            <div className="wc-coltitle">{wm?"Fixtures — tap a winner or draw":"Fixtures — tap to set scores"}</div>
            {ms.map((m)=><MatchRow key={m.id} m={m} scores={scores} mode={mode} setGoal={setGoal} setResult={setResult}/>)}
          </div>

          <div className="wc-standwrap">
            <div className="wc-coltitle">Live table</div>
            <div className={`wc-standhead ${wm?"wm":""}`}><span>#</span><span>Team</span><span>P</span>{!wm&&<span>GD</span>}<span>Pts</span></div>
            <div className="wc-stand">
              {data.table.map((row,i)=>{
                const t=TEAM[row.id];const adv=data.complete&&i<2;const third=data.complete&&i===2;
                const q3=third&&allComplete&&thirds.qualGroups.includes(g);
                return(
                  <div key={row.id} ref={(el)=>rowRefs.current[row.id]=el}
                    className={`wc-standrow ${wm?"wm":""} ${adv?"adv":""} ${third?"third":""} ${q3?"q3row":""}`}>
                    <span className="wc-pos">{i+1}</span>
                    <span className="wc-stteam"><span className="wc-flag">{t.flag}</span>{t.name}{q3&&<em className="wc-q3 tiny">3rd ✓</em>}</span>
                    <span>{row.played?row.pld:"–"}</span>
                    {!wm&&<span>{row.played?(row.gd>0?"+":"")+row.gd:"–"}</span>}
                    <span className="wc-stpts">{row.played?row.pts:"–"}</span>
                  </div>
                );
              })}
            </div>
            <p className="wc-standnote">{wm?"Tiebreak: points → head-to-head → seeding.":"Tiebreak: points → goal difference → goals scored → head-to-head → seeding."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- BRACKET -------------------- */
function slotLabel(code){
  if(!code)return"";
  if(code[0]==="W")return"Winner "+code.slice(2).replace("r32","R32 #").replace("r16","R16 #").replace("qf","QF #").replace("sf","SF #");
  if(code[0]==="L")return"Loser "+code.slice(2).replace("sf","SF #");
  if(code[0]==="T"){const s=THIRD_SLOTS.find((x)=>x.win===code[1]);return"3rd "+(s?s.elig.join("/"):"");}
  return(code[0]==="1"?"Winner ":"Runner-up ")+"Group "+code[1];
}

function KoTeam({teamId,code,side,win,lose,onPick,canPick}){
  const t=teamId?TEAM[teamId]:null;
  return(
    <div className={`ko-team ${win?"win":""} ${lose?"lose":""} ${canPick?"pickable":""}`} onClick={canPick?onPick:undefined}>
      {t?<><span className="wc-flag">{t.flag}</span><span className="ko-name">{t.name}</span></>
        :<span className="ko-ph">{slotLabel(code)}</span>}
    </div>
  );
}

function KoMatch({m,mode,setKGoal,setPen,setPick,unlocked}){
  const s=m.score||{};
  const ready=m.teamA&&m.teamB&&unlocked;
  const final=m.round==="FINAL",bronze=m.round==="BRONZE";
  const wm=mode==="winner";
  const byPick=!!s.pick;
  return(
    <div className={`ko-match ${final?"is-final":""} ${bronze?"is-bronze":""} ${m.decided?"decided":""} ${!wm&&byPick?"bypick":""}`}>
      {(final||bronze)&&<div className={`ko-tag ${final?"f":"b"}`}>{final?"FINAL":"3RD PLACE"}</div>}
      <div className="ko-row">
        <KoTeam teamId={m.teamA} code={m.a} win={m.decided&&m.winner===m.teamA} lose={m.decided&&m.winner!==m.teamA} canPick={ready} onPick={()=>setPick(m.id,"a")}/>
        {!wm&&(ready?<Stepper val={s.a} size="sm" onChange={(v)=>setKGoal(m.id,"a",v)}/>:<span className="ko-dash">–</span>)}
      </div>
      <div className="ko-row">
        <KoTeam teamId={m.teamB} code={m.b} win={m.decided&&m.winner===m.teamB} lose={m.decided&&m.winner!==m.teamB} canPick={ready} onPick={()=>setPick(m.id,"b")}/>
        {!wm&&(ready?<Stepper val={s.b} size="sm" onChange={(v)=>setKGoal(m.id,"b",v)}/>:<span className="ko-dash">–</span>)}
      </div>
      {!wm&&ready&&m.tie&&(
        <div className="ko-pens">
          <span>Penalties:</span>
          <button className={s.pen==="a"?"on":""} onClick={()=>setPen(m.id,"a")}>{TEAM[m.teamA].code}</button>
          <button className={s.pen==="b"?"on":""} onClick={()=>setPen(m.id,"b")}>{TEAM[m.teamB].code}</button>
        </div>
      )}
      <div className="ko-foot">
        {!wm&&byPick&&<span className="ko-pickbadge">PICKED</span>}
        <span className="ko-date">{m.date}</span>
      </div>
    </div>
  );
}

function Bracket({ko,mode,setKGoal,setPen,setPick,unlocked,champion}){
  const col=(ids,cls)=>(
    <div className={`ko-col ${cls||""}`}>
      {ids.map((id)=><KoMatch key={id} m={ko[id]} mode={mode} setKGoal={setKGoal} setPen={setPen} setPick={setPick} unlocked={unlocked}/>)}
    </div>
  );
  return(
    <div className="ko-scroll">
      <div className="ko-board">
        {/* left half */}
        {col(["r32_1","r32_2","r32_3","r32_4","r32_5","r32_6","r32_7","r32_8"],"r32")}
        {col(["r16_1","r16_2","r16_3","r16_4"],"r16")}
        {col(["qf_1","qf_2"],"qf")}
        {col(["sf_1"],"sf")}
        {/* center */}
        <div className="ko-col center">
          <div className="ko-trophy">
            <Trophy size={30}/>
            <div className="ko-trophylabel">{champion?<>{champion.flag}<br/>{champion.name}</>:"CHAMPION"}</div>
          </div>
          <KoMatch m={ko.final} mode={mode} setKGoal={setKGoal} setPen={setPen} setPick={setPick} unlocked={unlocked}/>
          <KoMatch m={ko.bronze} mode={mode} setKGoal={setKGoal} setPen={setPen} setPick={setPick} unlocked={unlocked}/>
        </div>
        {/* right half */}
        {col(["sf_2"],"sf")}
        {col(["qf_3","qf_4"],"qf")}
        {col(["r16_5","r16_6","r16_7","r16_8"],"r16")}
        {col(["r32_9","r32_10","r32_11","r32_12","r32_13","r32_14","r32_15","r32_16"],"r32")}
      </div>
    </div>
  );
}

function ChampionView({champion,ko,route}){
  const runnerUp=ko.final&&ko.final.loser?TEAM[ko.final.loser]:null;
  const third=ko.bronze&&ko.bronze.winner?TEAM[ko.bronze.winner]:null;
  return(
    <div className="champ-stage">
      <div className="champ-burst"/>
      <div className="champ-trophy"><Trophy size={56}/></div>
      <div className="champ-label">WORLD CHAMPIONS · 2026</div>
      <div className="champ-flag">{champion.flag}</div>
      <h1 className="champ-name">{champion.name}</h1>

      <div className="podium">
        {runnerUp&&<div className="pod silver"><span className="wc-flag">{runnerUp.flag}</span><b>{runnerUp.name}</b><small>Runner-up</small></div>}
        <div className="pod gold"><span className="wc-flag">{champion.flag}</span><b>{champion.name}</b><small>Champion</small></div>
        {third&&<div className="pod bronze"><span className="wc-flag">{third.flag}</span><b>{third.name}</b><small>3rd place</small></div>}
      </div>

      {route.length>0&&(
        <div className="champ-route">
          <div className="wc-coltitle center">Road to glory</div>
          {route.map((s,i)=>{
            const sc=s.score||{};
            const hasScore=(sc.a!=null||sc.b!=null)&&!sc.pick;
            return(
            <div key={i} className="route-step">
              <span className="route-round">{ROUND_LABEL[s.round]}</span>
              <span className="route-mid">{champion.code} {hasScore?<b>{sc.a??0}–{sc.b??0}</b>:<b>def.</b>}{hasScore&&sc.pen?" (pens)":""} {s.opp?s.opp.code:"?"}</span>
              <span className="route-opp">{s.opp?<>{s.opp.flag} {s.opp.name}</>:"—"}</span>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Atmosphere(){return <div className="wc-atmos" aria-hidden/>;}

/* ============================== STYLES ============================== */
function Style(){
  return(<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');
  :root{
    --bg:#f5f5f7; --bg2:#ffffff; --card:#ffffff; --card2:#ffffff;
    --line:rgba(0,0,0,.08); --line2:rgba(0,0,0,.14);
    --txt:#1d1d1f; --muted:#6e6e73; --faint:#a1a1a6;
    --gold:#FFCC00; --gold2:#FFB800; --goldink:#B07A00; --goldtint:rgba(255,204,0,.18);
    --green:#34C759; --greenink:#1a8a3c; --greentint:rgba(52,199,89,.16);
    --blue:#0A84FF; --red:#FF3B30; --silver:#8e8e93; --bronze:#c77e3a;
    --fest:linear-gradient(102deg,#FF3B30,#FF9F0A 30%,#34C759 64%,#0A84FF);
    --r:20px; --disp:'Anton',Impact,sans-serif; --body:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,sans-serif;
    --sh:0 1px 2px rgba(0,0,0,.04),0 10px 30px rgba(17,24,39,.06);
    --shh:0 2px 8px rgba(0,0,0,.06),0 20px 46px rgba(17,24,39,.12);
  }
  *{box-sizing:border-box;}
  .wc-root{font-family:var(--body);color:var(--txt);background:var(--bg);min-height:100vh;position:relative;overflow-x:hidden;-webkit-font-smoothing:antialiased;letter-spacing:.005em;}
  .wc-atmos{position:fixed;inset:0;pointer-events:none;z-index:0;
    background:
      radial-gradient(620px 460px at 8% -6%, rgba(255,204,0,.30), transparent 62%),
      radial-gradient(560px 480px at 94% 0%, rgba(52,199,89,.22), transparent 60%),
      radial-gradient(720px 620px at 84% 110%, rgba(10,132,255,.16), transparent 60%),
      radial-gradient(560px 520px at 2% 112%, rgba(255,59,48,.12), transparent 60%),
      var(--bg);}
  .wc-wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:26px 20px 60px;}

  /* nav */
  .wc-nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;padding:11px 18px;
    background:rgba(255,255,255,.72);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);
    border-bottom:1px solid var(--line);}
  .wc-brand{display:flex;align-items:center;gap:10px;cursor:pointer;}
  .wc-mark{font-family:var(--disp);font-size:22px;line-height:1;color:#1d1d1f;background:var(--gold);
    padding:6px 9px 4px;border-radius:9px;box-shadow:0 4px 16px rgba(255,204,0,.5);}
  .wc-brandtext{font-family:var(--disp);font-size:18px;letter-spacing:.04em;display:flex;flex-direction:column;line-height:.92;}
  .wc-brandtext small{font-family:var(--body);font-weight:800;font-size:9px;letter-spacing:.34em;color:var(--goldink);}
  .wc-tabs{display:flex;gap:3px;margin-left:auto;background:rgba(0,0,0,.05);padding:4px;border-radius:13px;}
  .wc-tab{font-family:var(--body);font-weight:700;font-size:13px;color:var(--muted);background:none;border:0;
    padding:7px 14px;border-radius:9px;cursor:pointer;transition:.2s;}
  .wc-tab:hover{color:var(--txt);}
  .wc-tab.on{color:var(--txt);background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.14);}
  .wc-reset{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;border:1px solid var(--line);
    background:#fff;color:var(--muted);cursor:pointer;transition:.2s;box-shadow:var(--sh);}
  .wc-reset:hover{color:var(--red);border-color:rgba(255,59,48,.4);}

  /* hero */
  .wc-hero{text-align:center;padding-top:48px;}
  .wc-hosts{display:flex;justify-content:center;gap:10px;font-size:30px;margin-bottom:18px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.12));animation:floaty 5s ease-in-out infinite;}
  @keyframes floaty{50%{transform:translateY(-5px);}}
  .wc-h1{font-family:var(--disp);font-size:clamp(40px,8.5vw,86px);line-height:.92;letter-spacing:.01em;margin:0 0 18px;color:var(--txt);}
  .grad{background:var(--fest);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .wc-sub{max-width:620px;margin:0 auto 34px;color:var(--muted);font-size:16px;line-height:1.6;}
  .wc-rings{display:flex;justify-content:center;gap:40px;margin-bottom:34px;}
  .wc-ring{display:flex;flex-direction:column;align-items:center;gap:8px;}
  .ring-n{fill:var(--txt);font-family:var(--disp);font-size:22px;}
  .ring-d{fill:var(--faint);font-size:10px;font-weight:700;}
  .wc-ringlabel{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.04em;}
  .wc-cta{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:46px;}
  .btn{font-family:var(--body);font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:8px;
    padding:12px 20px;border-radius:980px;border:1px solid var(--line);background:#fff;color:var(--txt);cursor:pointer;transition:.18s;box-shadow:var(--sh);}
  .btn:hover{transform:translateY(-2px);box-shadow:var(--shh);}
  .btn:active{transform:translateY(0) scale(.98);}
  .btn.gold{background:linear-gradient(180deg,var(--gold),var(--gold2));color:#1d1d1f;border-color:transparent;box-shadow:0 8px 24px rgba(255,204,0,.45);}
  .btn.ghost{background:#fff;}
  .btn.danger{background:var(--red);color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(255,59,48,.35);}
  .btn.sm{padding:9px 14px;font-size:13px;}
  .wc-facts{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;}
  .wc-fact{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 22px;min-width:96px;box-shadow:var(--sh);}
  .wc-fact b{font-family:var(--disp);font-size:30px;display:block;color:var(--goldink);}
  .wc-fact span{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}
  .wc-prechamp{margin-top:34px;display:inline-flex;align-items:center;gap:9px;cursor:pointer;color:var(--goldink);
    background:var(--goldtint);border:1px solid rgba(255,204,0,.45);padding:11px 18px;border-radius:980px;font-weight:800;font-size:14px;}

  /* section heads */
  .wc-sechead{margin-bottom:18px;}
  .wc-h2{font-family:var(--disp);font-size:clamp(30px,5vw,46px);margin:0 0 6px;letter-spacing:.01em;color:var(--txt);}
  .wc-secsub{color:var(--muted);font-size:14px;max-width:760px;line-height:1.55;}
  .wc-toolbar{display:flex;gap:9px;margin-bottom:18px;flex-wrap:wrap;align-items:center;}
  .wc-modeseg{display:flex;gap:3px;background:rgba(0,0,0,.05);padding:4px;border-radius:12px;margin-right:auto;}
  .wc-modeseg button{font-family:var(--body);font-weight:800;font-size:12.5px;color:var(--muted);background:none;border:0;padding:8px 14px;border-radius:9px;cursor:pointer;transition:.18s;}
  .wc-modeseg button:hover{color:var(--txt);}
  .wc-modeseg button.on{color:var(--txt);background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.14);}

  /* group grid */
  .wc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:14px;}
  .wc-gcard{text-align:left;font-family:var(--body);color:var(--txt);background:#fff;border:1px solid var(--line);
    border-radius:var(--r);padding:16px;cursor:pointer;transition:.22s;display:flex;flex-direction:column;gap:11px;box-shadow:var(--sh);}
  .wc-gcard:hover{transform:translateY(-4px);box-shadow:var(--shh);}
  .wc-gcardtop{display:flex;align-items:center;justify-content:space-between;}
  .wc-gletter{font-family:var(--disp);font-size:30px;line-height:1;color:var(--goldink);}
  .wc-gletter.big{font-size:46px;}
  .wc-pill{font-size:11px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
  .wc-pill.ok{background:var(--greentint);color:var(--greenink);}
  .wc-pill.mid{background:var(--goldtint);color:var(--goldink);}
  .wc-pill.off{background:rgba(0,0,0,.05);color:var(--faint);}
  .wc-glist{display:flex;flex-direction:column;gap:2px;}
  .wc-grow{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:9px;font-size:13.5px;transition:.3s;}
  .wc-grow.adv{background:var(--goldtint);}
  .wc-grow.third{background:rgba(0,0,0,.03);}
  .wc-pos{width:15px;text-align:center;color:var(--faint);font-weight:800;font-size:11px;}
  .wc-flag{font-size:17px;line-height:1;}
  .wc-tname{font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .wc-grow.adv .wc-tname{font-weight:800;}
  .wc-pts{font-weight:800;font-size:13px;color:var(--muted);min-width:16px;text-align:right;}
  .wc-q3{font-size:9.5px;font-weight:800;letter-spacing:.03em;color:var(--greenink);background:var(--greentint);padding:2px 6px;border-radius:10px;}
  .wc-q3.out{color:var(--faint);background:rgba(0,0,0,.05);}
  .wc-q3.tiny{margin-left:6px;font-size:9px;padding:1px 5px;}
  .wc-gopen{font-size:12px;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:3px;margin-top:auto;}

  /* modal + sheet */
  .wc-modalbg{position:fixed;inset:0;z-index:50;background:rgba(20,22,28,.42);backdrop-filter:blur(8px);
    display:grid;place-items:center;padding:18px;animation:fade .25s ease;}
  @keyframes fade{from{opacity:0;}}
  .wc-sheet{width:100%;max-width:900px;max-height:90vh;overflow:auto;background:#fff;
    border:1px solid var(--line);border-radius:26px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.28);animation:pop .3s cubic-bezier(.2,.9,.2,1);}
  @keyframes pop{from{opacity:0;transform:translateY(18px) scale(.98);}}
  .wc-sheethead{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
  .wc-sheethead>div{display:flex;align-items:center;gap:14px;}
  .wc-sheethead h3{font-family:var(--disp);font-size:26px;margin:0;letter-spacing:.02em;color:var(--txt);}
  .wc-x{width:36px;height:36px;border-radius:11px;border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer;display:grid;place-items:center;}
  .wc-x:hover{color:var(--txt);background:rgba(0,0,0,.04);}
  .wc-sheetcols{display:grid;grid-template-columns:1.25fr 1fr;gap:22px;}
  .wc-coltitle{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:11px;}
  .wc-coltitle.center{text-align:center;}
  .wc-matches{display:flex;flex-direction:column;gap:7px;}
  .wc-match{display:grid;grid-template-columns:1fr auto auto auto 1fr;align-items:center;gap:7px;    background:#fff;border:1px solid var(--line);border-radius:13px;padding:8px 11px;transition:.2s;}
  .wc-match.done{border-color:rgba(255,204,0,.55);box-shadow:0 2px 10px rgba(255,204,0,.12);}
  .wc-mteam{display:flex;align-items:center;gap:7px;font-size:13px;min-width:0;}
  .wc-mteam .wc-tname{font-weight:600;}
  .wc-mteam.left{justify-content:flex-end;text-align:right;}
  .wc-mteam.win .wc-tname{color:var(--goldink);font-weight:800;}
  .wc-mteam.draw .wc-tname{color:var(--muted);}
  .wc-vs{font-size:10px;color:var(--faint);font-weight:800;}
  .wc-step{display:flex;align-items:center;gap:1px;background:#f0f0f3;border:1px solid var(--line);border-radius:10px;padding:2px;}
  .wc-step button{width:24px;height:24px;border:0;background:none;color:var(--muted);cursor:pointer;border-radius:7px;display:grid;place-items:center;transition:.15s;}
  .wc-step button:hover{background:rgba(0,0,0,.07);color:var(--txt);}
  .wc-step.sm button{width:20px;height:20px;}
  .wc-stepn{min-width:18px;text-align:center;font-family:var(--disp);font-size:17px;color:var(--txt);}
  .wc-step.sm .wc-stepn{font-size:14px;min-width:14px;}
  .wc-match.wm{grid-template-columns:1fr auto 1fr;}
  .wc-wdl{display:flex;gap:3px;background:#f0f0f3;border:1px solid var(--line);border-radius:11px;padding:3px;}
  .wc-wdl button{font-family:var(--body);font-weight:800;font-size:12px;color:var(--muted);background:none;border:0;padding:6px 11px;border-radius:8px;cursor:pointer;transition:.15s;min-width:34px;}
  .wc-wdl button.d{min-width:0;padding:6px 9px;font-size:11px;}
  .wc-wdl button:hover{color:var(--txt);background:rgba(0,0,0,.05);}
  .wc-wdl button.on{color:#1d1d1f;background:var(--gold);box-shadow:0 2px 8px rgba(255,204,0,.4);}
  .wc-wdl button.d.on{background:var(--muted);color:#fff;box-shadow:none;}

  /* standings */
  .wc-standhead,.wc-standrow{display:grid;grid-template-columns:24px 1fr 28px 38px 36px;align-items:center;gap:4px;}
  .wc-standhead.wm,.wc-standrow.wm{grid-template-columns:24px 1fr 28px 36px;}
  .wc-standhead{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:0 9px 7px;}
  .wc-stand{display:flex;flex-direction:column;gap:4px;}
  .wc-standrow{background:#f7f7f9;border:1px solid transparent;border-radius:11px;padding:9px;font-size:13px;will-change:transform;}
  .wc-standrow.adv{background:var(--goldtint);border-color:rgba(255,204,0,.5);}
  .wc-standrow.q3row{background:var(--greentint);border-color:rgba(52,199,89,.5);}
  .wc-stteam{display:flex;align-items:center;gap:7px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .wc-standrow.adv .wc-stteam{font-weight:800;}
  .wc-stteam em{font-style:normal;}
  .wc-standrow span:nth-child(3),.wc-standrow span:nth-child(4){text-align:center;color:var(--muted);font-weight:700;}
  .wc-stpts{text-align:center;font-family:var(--disp);font-size:16px;color:var(--goldink);}
  .wc-standnote{font-size:11px;color:var(--faint);margin-top:12px;line-height:1.5;}

  .wc-lockbar{display:flex;align-items:center;gap:8px;background:var(--goldtint);border:1px solid rgba(255,204,0,.5);
    color:var(--goldink);padding:11px 15px;border-radius:13px;font-size:13.5px;font-weight:700;margin-bottom:20px;}
  .linkbtn{background:none;border:0;color:var(--goldink);text-decoration:underline;font-weight:800;cursor:pointer;font-family:var(--body);font-size:13.5px;}

  /* bracket */
  .ko-scroll{overflow-x:auto;padding-bottom:18px;margin:0 -20px;padding-left:20px;padding-right:20px;}
  .ko-board{display:flex;gap:18px;min-width:1500px;align-items:stretch;}
  .ko-col{display:flex;flex-direction:column;justify-content:space-around;gap:10px;flex:1;min-width:148px;}
  .ko-col.center{flex:0 0 188px;justify-content:flex-start;gap:18px;padding-top:8px;}
  .ko-col.sf,.ko-col.qf{min-width:160px;}
  .ko-match{position:relative;background:#fff;border:1px solid var(--line);border-radius:13px;padding:8px;display:flex;flex-direction:column;gap:5px;transition:.2s;box-shadow:var(--sh);}
  .ko-match.decided{border-color:rgba(255,204,0,.55);}
  .ko-match.is-final{background:linear-gradient(180deg,rgba(255,204,0,.22),#fff);border-color:rgba(255,204,0,.7);box-shadow:0 10px 30px rgba(255,204,0,.25);}
  .ko-match.is-bronze{background:linear-gradient(180deg,rgba(199,126,58,.14),#fff);border-color:rgba(199,126,58,.4);}
  .ko-row{display:flex;align-items:center;justify-content:space-between;gap:6px;}
  .ko-team{display:flex;align-items:center;gap:6px;font-size:12.5px;flex:1;min-width:0;padding:3px 5px;border-radius:7px;}
  .ko-team.win{color:var(--goldink);font-weight:800;background:var(--goldtint);}
  .ko-team.lose{opacity:.4;}
  .ko-team.pickable{cursor:pointer;transition:background .15s,transform .1s;}
  .ko-team.pickable:not(.win):hover{background:rgba(0,0,0,.06);}
  .ko-team.pickable:active{transform:scale(.97);}
  .ko-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;}
  .ko-ph{font-size:10px;color:var(--faint);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ko-dash{color:var(--faint);font-weight:800;padding-right:6px;}
  .ko-date{font-size:9.5px;color:var(--faint);font-weight:700;letter-spacing:.05em;}
  .ko-foot{display:flex;align-items:center;gap:6px;}
  .ko-foot .ko-date{margin-left:auto;}
  .ko-pickbadge{font-size:8.5px;font-weight:800;letter-spacing:.12em;color:var(--goldink);background:var(--goldtint);padding:2px 7px;border-radius:20px;}
  .ko-match.bypick .wc-step{opacity:.4;}
  .ko-pens{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);font-weight:700;}
  .ko-pens button{font-family:var(--body);font-weight:800;font-size:10px;padding:3px 8px;border-radius:7px;border:1px solid var(--line);background:#f0f0f3;color:var(--muted);cursor:pointer;}
  .ko-pens button.on{background:var(--gold);color:#1d1d1f;border-color:transparent;}
  .ko-tag{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:800;letter-spacing:.12em;padding:2px 9px;border-radius:20px;}
  .ko-tag.f{background:var(--gold);color:#1d1d1f;box-shadow:0 3px 10px rgba(255,204,0,.5);}
  .ko-tag.b{background:var(--bronze);color:#fff;}
  .ko-trophy{text-align:center;color:var(--goldink);background:radial-gradient(circle at 50% 30%,rgba(255,204,0,.3),transparent 70%);padding:14px 8px 8px;border-radius:16px;}
  .ko-trophylabel{font-family:var(--disp);font-size:13px;letter-spacing:.06em;margin-top:6px;color:var(--txt);line-height:1.2;}

  /* champion */
  .wc-champ{display:flex;justify-content:center;}
  .wc-empty{text-align:center;color:var(--muted);padding:60px 20px;display:flex;flex-direction:column;align-items:center;gap:14px;}
  .wc-empty>svg{color:var(--goldink);}
  .wc-empty h2{font-family:var(--disp);font-size:34px;color:var(--txt);margin:0;}
  .champ-stage{position:relative;text-align:center;padding:30px 10px;max-width:760px;width:100%;}
  .champ-burst{position:absolute;top:-30px;left:50%;width:560px;height:560px;transform:translateX(-50%);
    background:radial-gradient(circle,rgba(255,204,0,.32),transparent 62%);pointer-events:none;animation:pulse 4s ease-in-out infinite;}
  @keyframes pulse{50%{opacity:.55;}}
  .champ-trophy{color:var(--gold2);filter:drop-shadow(0 10px 26px rgba(255,184,0,.55));animation:floaty 4s ease-in-out infinite;position:relative;}
  .champ-label{font-size:12px;font-weight:800;letter-spacing:.34em;color:var(--goldink);margin-top:14px;}
  .champ-flag{font-size:74px;margin:8px 0;line-height:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.18));}
  .champ-name{font-family:var(--disp);font-size:clamp(44px,9vw,82px);margin:0 0 8px;line-height:.95;
    background:var(--fest);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .podium{display:flex;justify-content:center;align-items:flex-end;gap:12px;margin:36px 0;flex-wrap:wrap;}
  .pod{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:120px;box-shadow:var(--sh);}
  .pod .wc-flag{font-size:34px;}
  .pod b{font-size:15px;}
  .pod small{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;}
  .pod.gold{border-color:var(--gold);background:var(--goldtint);transform:translateY(-12px);box-shadow:0 18px 40px rgba(255,204,0,.3);}
  .pod.gold small{color:var(--goldink);}
  .pod.silver small{color:var(--silver);}
  .pod.bronze small{color:var(--bronze);}
  .champ-route{margin-top:24px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--sh);}
  .route-step{display:grid;grid-template-columns:130px 1fr 1fr;align-items:center;gap:10px;padding:9px 6px;border-top:1px solid var(--line);font-size:13px;}
  .route-step:first-of-type{border-top:0;}
  .route-round{font-weight:800;color:var(--muted);font-size:12px;}
  .route-mid{font-weight:600;color:var(--txt);}
  .route-mid b{font-family:var(--disp);color:var(--goldink);}
  .route-opp{text-align:right;font-weight:600;color:var(--muted);}

  .wc-dialog{background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;max-width:380px;text-align:center;animation:pop .3s ease;box-shadow:0 30px 70px rgba(0,0,0,.28);}
  .wc-chooser{position:relative;background:#fff;border:1px solid var(--line);border-radius:26px;padding:28px;max-width:680px;width:100%;animation:pop .3s cubic-bezier(.2,.9,.2,1);box-shadow:0 30px 80px rgba(0,0,0,.28);}
  .ch-x{position:absolute;top:16px;right:16px;}
  .ch-title{font-family:var(--disp);font-size:30px;margin:0 0 4px;text-align:center;letter-spacing:.01em;}
  .ch-sub{text-align:center;color:var(--muted);font-size:13.5px;margin:0 0 22px;}
  .ch-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .ch-card{text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:9px;transition:.2s;font-family:var(--body);color:var(--txt);}
  .ch-card:hover{transform:translateY(-4px);border-color:var(--gold);box-shadow:0 18px 44px rgba(0,0,0,.12);}
  .ch-ico{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:var(--greentint);color:var(--greenink);}
  .ch-ico.score{background:var(--goldtint);color:var(--goldink);font-family:var(--disp);font-size:15px;}
  .ch-card b{font-size:17px;}
  .ch-card>span{font-size:13px;color:var(--muted);line-height:1.5;}
  .ch-go{margin-top:auto;display:inline-flex;align-items:center;gap:5px;color:var(--goldink);font-weight:800;font-size:13px;}
  @media(max-width:640px){.ch-cards{grid-template-columns:1fr;}}
  .wc-dialog h3{font-family:var(--disp);font-size:24px;margin:0 0 8px;color:var(--txt);}
  .wc-dialog p{color:var(--muted);font-size:14px;margin:0 0 20px;}
  .wc-dialogbtns{display:flex;gap:10px;justify-content:center;}

  .wc-foot{position:relative;z-index:1;text-align:center;color:var(--faint);font-size:11.5px;padding:30px 20px 40px;}

  @media(max-width:760px){
    .wc-sheetcols{grid-template-columns:1fr;}
    .wc-tabs{order:3;width:100%;margin-left:0;justify-content:space-between;}
    .wc-nav{flex-wrap:wrap;}
    .wc-match{grid-template-columns:1fr auto auto auto 1fr;font-size:12px;}
    .route-step{grid-template-columns:1fr;gap:2px;text-align:left;}
    .route-opp{text-align:left;}
  }
  `}</style>);
}
