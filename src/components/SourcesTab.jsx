import { useState } from "react";
import { SK, sSet } from "../storage.js";
import { SOURCES, EM_SOURCES } from "../data/sources.js";
import { COUNTRIES, EM_COUNTRIES } from "../data/markets.js";
import { Dots, timeAgo } from "./helpers.jsx";
import ArticleCard from "./ArticleCard.jsx";
import BriefRenderer from "./BriefRenderer.jsx";

const SOURCE_RANK = {
  US: ["reuters","bloomberg","bloomberg2","wsj","wsj2","wsj_heard","wsj_mkt","wsj_global_equities","wsj_global_commodities","ft","wapo","wapo_politics","nyt","barrons","marketwatch","axios_biz","semafor","politico","benzinga_upgrades","benzinga_downgrades","benzinga_pt","benzinga_initiation","sa_wsb","sa_currents","ft_alphaville","investing_ratings","openinsider","benzinga_ideas","seekalpha","prnewswire"],
  GB: ["reuters_uk","bloom_uk","cityam","investors_chron","telegraph_biz","thisismoney"],
  DE: ["reuters_de","bloom_de","handelsblatt","handelsblatt_en","faz","faz_finance","spiegel_de","sz_de","dw_de"],
  FR: ["reuters_fr","bloom_fr","lesechos","lesechos_en"],
  IT: ["reuters_it","bloom_it","sole24ore"],
  CH: ["reuters_ch","bloom_ch","nzz","nzz_en"],
  EU: ["reuters_eu","bloom_eu","politico_eu","euractiv"],
  CA: ["reuters_ca","bloom_ca","globe_mail","globe_itm","stockchase","fin_post","bnn"],
  SG: ["reuters_sg","bloom_sg","bt_sg","bt_stocks_watch","edge_sg_stocks_watch","edge_sg_focus","sginvestors","edge_sg","cna_sg","sgx_annc","sg_biz_review"],
  HK: ["reuters_hk","bloom_hk","asia_broker_calls","reuters_asia","hkex_news","scmp","scmp_markets","scmp_china","mingtiandi","aastocks_hk","etnet_hk","hket","mingpao"],
  KR: ["reuters_kr","bloom_kr","kr_analyst_calls","kr_herald","yonhap","yonhap2","ktimes","ked","hankyung","maeil","chosunbiz"],
  TW: ["reuters_tw","bloom_tw","focus_tw","taipei_t","digitimes","udn_money","ctee"],
  IN: ["reuters_in","bloom_in","econ_times","mint","mint2","mint3","biz_std","hindubiz","fin_exp","cnbctv18","moneyctrl","forbes_in"],
  AU: ["reuters_au","bloom_au","afr","afr_street_talk","market_herald","smh","abc_au","stockhead_top10","fnarena","stockhead_au","guardian_au","the_aus"],
  CN: ["reuters_cn","bloom_cn","xinhua","cgtn","chinadaily","caixin","caixin_briefs","kr36","globaltimes","yicai","peoples_d"],
  IL: ["globes_il","reuters_il","bloom_il","jpost_il","toi_il","haaretz_il","ctech_il","calcalist"],
  ME: ["aljazeera","aljazeera_biz","reuters_me","bloom_me","arabnews","arabnews_biz","national_ae","gulfnews","arabianbiz","agbi","tradearabia","alarabiya","zawya","gulfbiz","gulftimes","khaleej","saudigazette","menafn_sa","menafn_uae","menafn_qa","menafn_kw","menafn_bh","menafn_om","alarabiya_ar"],
  IR: ["iranintl","reuters_ir","bloom_ir","tehrantimes","fin_trib","irna_en","tasnim","ifpnews","mehrnews","entekhab","tabnak"],
  JP: ["reuters_jp","nikkei_asia","nikkei_biz_spotlight","jp_analyst_calls"],
  // Emerging Markets
  BR: ["reuters_br","infomoney","valor_br","reuters_latam","mercopress","bnnlatam"],
  MX: ["reuters_mx","elfinanciero_mx","reuters_latam"],
  AR: ["reuters_ar","ambito","mercopress","reuters_latam"],
  CL: ["reuters_cl","df_cl","reuters_latam"],
  CO: ["reuters_co","la_republica_co","reuters_latam"],
  PE: ["reuters_pe","gestion_pe","reuters_latam"],
  PL: ["reuters_pl","parkiet_pl","emerging_europe","reuters_cee"],
  TR: ["reuters_tr","daily_sabah_biz","hurriyet_biz","reuters_cee"],
  HU: ["reuters_hu","reuters_cee","emerging_europe"],
  CZ: ["reuters_cz","reuters_cee","emerging_europe"],
  RO: ["reuters_ro","reuters_cee","emerging_europe"],
  GR: ["reuters_gr","ekathimerini","reuters_cee"],
  ZA: ["reuters_za","fin24_za","businessday_za","reuters_africa","african_business"],
  NG: ["reuters_ng","businessday_ng","punch_biz_ng","reuters_africa"],
  KE: ["reuters_ke","businessdailyafrica","reuters_africa"],
  EG: ["reuters_eg","egypt_independent","reuters_africa"],
  MA: ["reuters_ma","reuters_africa"],
  ID: ["reuters_id","bisnis_id","reuters_emasia","nikkei_sea"],
  TH: ["reuters_th","bangkokpost_biz","reuters_emasia"],
  MY: ["reuters_my","edge_my","reuters_emasia"],
  PH: ["reuters_ph","inquirer_ph","reuters_emasia"],
  VN: ["reuters_vn","vnexpress_biz","reuters_emasia"],
};

export default function SourcesTab({canonical, lastFetch, briefs, setBriefs, generateBrief}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[1].code);
  const [selectedSource,  setSelectedSource]  = useState("ALL");
  const [selectedTier,    setSelectedTier]    = useState(0);
  const [briefLoading,    setBriefLoading]    = useState({});
  const TIER_COLORS = {1:"#2e7d32", 2:"#1565c0", 3:"#6a1b9a"};

  const ALL_SOURCES = [...SOURCES, ...EM_SOURCES];
  const countryObj   = COUNTRIES.find(c => c.code === selectedCountry) || EM_COUNTRIES.find(c => c.code === selectedCountry);
  const rankOrder    = SOURCE_RANK[selectedCountry] || [];
  const allCountrySources = ALL_SOURCES.filter(s => s.country === selectedCountry);
  const rankedSources = [
    ...rankOrder.map(id => allCountrySources.find(s => s.id === id)).filter(Boolean),
    ...allCountrySources.filter(s => !rankOrder.includes(s.id)),
  ];
  const tierFilteredSources = selectedTier === 0 ? rankedSources : rankedSources.filter(s => (s.tier||3) === selectedTier);
  const visibleSources = selectedSource === "ALL" ? tierFilteredSources : tierFilteredSources.filter(s => s.id === selectedSource);
  const countryArts = canonical.filter(a => a.country === selectedCountry);
  const briefKey = `sources_country_${selectedCountry}`;
  const briefData = briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData === "string" ? briefData : null);
  const briefArts = briefData?.articles ?? countryArts;

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"12px 18px",flexWrap:"wrap"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>COUNTRY</span>
        <div style={{position:"relative"}}>
          <select value={selectedCountry} onChange={e=>{setSelectedCountry(e.target.value);setSelectedSource("ALL");}}
            style={{appearance:"none",background:"#fff",border:"1px solid #c0392b",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:180}}>
            <optgroup label="Developed Markets">
              {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>(<option key={c.code} value={c.code}>{c.flag} {c.label}</option>))}
            </optgroup>
            <optgroup label="Emerging Markets">
              {EM_COUNTRIES.map(c=>(<option key={c.code} value={c.code}>{c.flag} {c.label}</option>))}
            </optgroup>
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#c0392b",fontSize:10}}>▼</span>
        </div>
        <div style={{display:"flex",gap:4,marginLeft:4,flexWrap:"wrap"}}>
          {[0,1,2,3].map(t=>(
            <button key={t} onClick={()=>{setSelectedTier(t);setSelectedSource("ALL");}}
              style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:3,cursor:"pointer",
                border: selectedTier===t ? `1px solid ${t===0?"#888":TIER_COLORS[t]}` : "1px solid #ddd",
                background: selectedTier===t ? (t===0?"#888":TIER_COLORS[t]) : "#fff",
                color: selectedTier===t ? "#fff" : "#888"}}>
              {t===0?"All tiers":`T${t}`}
            </button>
          ))}
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap",marginLeft:8}}>SOURCE</span>
        <div style={{position:"relative"}}>
          <select value={selectedSource} onChange={e=>setSelectedSource(e.target.value)}
            style={{appearance:"none",background:"#fff",border:"1px solid #bbb",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:200}}>
            <option value="ALL">All sources ({rankedSources.length})</option>
            {rankedSources.map((s,i)=>(<option key={s.id} value={s.id}>#{i+1} {s.name} ({canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id).length})</option>))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",marginLeft:4}}>
          <span style={{color:"#c0392b",fontWeight:600}}>{countryArts.length}</span> articles
        </span>
        <button onClick={async()=>{
            setBriefLoading(p=>({...p,[briefKey]:true}));
            const b = await generateBrief(countryArts, `${countryObj?.flag} ${countryObj?.label} Markets`);
            setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
            setBriefLoading(p=>({...p,[briefKey]:false}));
          }}
          disabled={briefLoading[briefKey]||!countryArts.length}
          style={{marginLeft:"auto",padding:"7px 16px",background:brief?"none":"#fdecea",border:"1px solid #c0392b",color:"#c0392b",borderRadius:6,cursor:(!countryArts.length)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,opacity:!countryArts.length?0.4:1,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background=brief?"none":"#fdecea"}>
          {briefLoading[briefKey] ? <><Dots/> generating…</> : brief ? "↺ refresh brief" : "✦ generate country brief"}
        </button>
      </div>
      {brief && (
        <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em",marginBottom:2}}>AI INVESTMENT BRIEF · {countryArts.length} articles analysed{briefData?.generatedAt ? ` · generated ${new Date(briefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
          <BriefRenderer text={brief} articles={briefArts}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {visibleSources.map((src, idx)=>{
          const arts = canonical.filter(a=>a.sourceId===src.id||a.originalSourceId===src.id);
          const rank = rankOrder.indexOf(src.id);
          const rankLabel = rank >= 0 ? `#${rank+1}` : null;
          return (
            <div key={src.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"14px 16px",borderTop:`3px solid ${rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#ddd"}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #f0ece4"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  {rankLabel&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#999",fontWeight:700,background:rank<3?"#fafafa":"none",padding:"1px 5px",borderRadius:3,border:"1px solid #eee"}}>{rankLabel}</span>}
                  <div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#c0392b",fontWeight:600,letterSpacing:"0.04em"}}>{src.flag} {src.name}</span>
                    {src.desc&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",marginTop:2,lineHeight:1.4,maxWidth:460}}>{src.desc}</div>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  {lastFetch[src.id]&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#aaa"}}>{timeAgo(lastFetch[src.id])}</span>}
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f5f5f5",padding:"2px 7px",borderRadius:10}}>{arts.length}</span>
                </div>
              </div>
              {arts.length===0?<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#bbb",padding:"12px 0",textAlign:"center"}}>no recent articles</div>:(
                <>
                  {src.paywall&&arts.some(a=>a.originalSourceId===src.id)&&(
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f9f6f0",border:"1px solid #e8e0d0",borderRadius:4,padding:"5px 10px",marginBottom:8}}>
                      ✦ includes free versions of {src.name} stories from other outlets
                    </div>
                  )}
                  {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
