import { useState, useEffect, useRef } from "react";

const MY_SKILLS = [
  { id: 1, name: "PDF Architect", version: "2.4.1", status: "published", installs: 12400, rating: 4.9, reviews: 342, revenue: 0, price: "Free", updated: "2d ago", views: 34200, runs: 89400, license: "MIT", size: "24KB", trend: +12 },
  { id: 2, name: "Docx Formatter", version: "4.1.2", status: "published", installs: 8900, rating: 4.6, reviews: 245, revenue: 0, price: "Free", updated: "1d ago", views: 21800, runs: 45600, license: "MIT", size: "33KB", trend: +8 },
  { id: 3, name: "Slide Deck Maker", version: "3.0.1", status: "published", installs: 7800, rating: 4.6, reviews: 203, revenue: 4245.50, price: "$5.99", updated: "1w ago", views: 18400, runs: 31200, license: "Proprietary", size: "67KB", trend: +3 },
  { id: 4, name: "Invoice Generator", version: "1.0.0-beta", status: "review", installs: 0, rating: 0, reviews: 0, revenue: 0, price: "$3.99", updated: "3h ago", views: 0, runs: 0, license: "MIT", size: "19KB", trend: 0 },
  { id: 5, name: "Email Template Pro", version: "0.9.0", status: "draft", installs: 0, rating: 0, reviews: 0, revenue: 0, price: "Free", updated: "5d ago", views: 0, runs: 0, license: "MIT", size: "12KB", trend: 0 },
];

const ACTIVITY = [
  { type: "install", text: "neural_ops installed PDF Architect", time: "2m ago" },
  { type: "review", text: "flowstate left a 5★ review on Docx Formatter", time: "18m ago" },
  { type: "revenue", text: "$5.99 earned — Slide Deck Maker purchased by qa_forge", time: "1h ago" },
  { type: "fork", text: "component_lab forked PDF Architect", time: "2h ago" },
  { type: "pr", text: "Pull request #14 opened on Docx Formatter", time: "4h ago" },
  { type: "install", text: "arxiv_reader installed Slide Deck Maker", time: "5h ago" },
  { type: "review", text: "cloud_native left a 4★ review on PDF Architect", time: "6h ago" },
  { type: "revenue", text: "$5.99 earned — Slide Deck Maker purchased by legal_ai", time: "8h ago" },
];

function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,"")+"K" : n.toString(); }
function usd(n) { return "$"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); }

const STATUS_MAP = {
  published: { label: "Live", color: "var(--color-text-success)", bg: "var(--color-background-success)" },
  review: { label: "In review", color: "var(--color-text-warning)", bg: "var(--color-background-warning)" },
  draft: { label: "Draft", color: "var(--color-text-tertiary)", bg: "var(--color-background-tertiary)" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status];
  return <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", padding:"3px 8px", borderRadius:4, background:s.bg, color:s.color, fontWeight:600, letterSpacing:"0.02em" }}>{s.label}</span>;
}

function ActivityIcon({ type }) {
  const map = { install:"↓", review:"★", revenue:"$", fork:"⑂", pr:"⤴" };
  return <span style={{ fontSize:12, width:22, height:22, borderRadius:6, display:"inline-flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.4)", flexShrink:0 }}>{map[type]}</span>;
}

export default function Publish() {
  const [tab, setTab] = useState("skills");
  const [dragOver, setDragOver] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const fileRef = useRef(null);

  const M = "'IBM Plex Mono', monospace";
  const S = "'Syne', sans-serif";

  const totalInstalls = MY_SKILLS.reduce((a,s)=>a+s.installs,0);
  const totalRevenue = MY_SKILLS.reduce((a,s)=>a+s.revenue,0);
  const avgRating = MY_SKILLS.filter(s=>s.rating>0).reduce((a,s)=>a+s.rating,0) / MY_SKILLS.filter(s=>s.rating>0).length;
  const totalRuns = MY_SKILLS.reduce((a,s)=>a+s.runs,0);

  return (
    <div style={{ background:"#000", color:"#fff", minHeight:"100vh", fontFamily:S }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        .row-item{transition:background .2s;cursor:pointer;position:relative}
        .row-item:hover{background:rgba(255,255,255,0.03)!important}
        .tab-btn{transition:all .2s;cursor:pointer;font-family:inherit;background:none;border:none;padding:8px 0;font-size:13px;position:relative}
        .tab-btn::after{content:'';position:absolute;bottom:0;left:0;width:0;height:1px;background:#fff;transition:width .3s}
        .tab-btn:hover::after{width:100%}
        .upload-zone{transition:all .3s;cursor:pointer}
        .upload-zone:hover{border-color:rgba(255,255,255,0.2)!important;background:rgba(255,255,255,0.03)!important}
        .action-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .action-btn:hover{background:#fff!important;color:#000!important}
        .ghost-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .ghost-btn:hover{border-color:rgba(255,255,255,0.3)!important;background:rgba(255,255,255,0.04)!important}
        .feed-item{transition:background .2s}
        .feed-item:hover{background:rgba(255,255,255,0.02)}
      `}</style>

      {/* NAV */}
      <nav style={{
        position:"sticky",top:0,zIndex:100,height:56,padding:"0 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"rgba(0,0,0,0.85)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <svg width="70" height="18" viewBox="0 0 70 18" style={{display:"block"}}>
            <line x1="3" y1="16" x2="11" y2="2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <text x="16" y="15" fontFamily="'Syne', sans-serif" fontSize="15" fontWeight="700" fill="#fff" letterSpacing="-0.4">skiyu</text>
          </svg>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.25)",fontFamily:M}}>/publish</span>
        </div>
        <div style={{display:"flex",gap:20,fontSize:13,color:"rgba(255,255,255,0.4)"}}>
          {["Explore","Publish","Docs","Pricing"].map(l=>(
            <span key={l} style={{cursor:"pointer",color:l==="Publish"?"#fff":undefined,fontWeight:l==="Publish"?600:400}}>{l}</span>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,fontFamily:M,color:"rgba(255,255,255,0.4)"}}>@synthwave_dev</span>
          <div style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>S</div>
        </div>
      </nav>

      <div style={{display:"flex",maxWidth:1200,margin:"0 auto"}}>

        {/* SIDEBAR */}
        <aside style={{
          width:220,flexShrink:0,
          borderRight:"1px solid rgba(255,255,255,0.04)",
          padding:"20px 16px",
          position:"sticky",top:56,height:"calc(100vh - 56px)",overflowY:"auto",
        }}>
          <button className="action-btn" onClick={()=>setShowUpload(true)} style={{
            width:"100%",padding:"10px 0",borderRadius:8,border:"none",
            background:"#fff",color:"#000",fontSize:13,fontWeight:700,marginBottom:20,
          }}>+ New Skill</button>

          {[
            {id:"skills",label:"My Skills",count:MY_SKILLS.length},
            {id:"analytics",label:"Analytics",count:null},
            {id:"revenue",label:"Revenue",count:usd(totalRevenue)},
            {id:"activity",label:"Activity",count:ACTIVITY.length},
            {id:"settings",label:"Settings",count:null},
          ].map(t=>(
            <div key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"8px 10px",borderRadius:6,marginBottom:2,cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center",
              background:tab===t.id?"rgba(255,255,255,0.06)":"transparent",
              color:tab===t.id?"#fff":"rgba(255,255,255,0.35)",
              fontSize:13,fontWeight:tab===t.id?600:400,
              transition:"all .2s",
            }}>
              <span>{t.label}</span>
              {t.count!==null&&<span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.15)"}}>{t.count}</span>}
            </div>
          ))}
        </aside>

        {/* MAIN */}
        <main style={{flex:1,minWidth:0}}>

          {/* STATS BAR */}
          <div style={{
            display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1px",
            background:"rgba(255,255,255,0.04)",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
          }}>
            {[
              {label:"Total installs",val:fmt(totalInstalls),trend:"+23 today"},
              {label:"Total runs",val:fmt(totalRuns),trend:"+412 today"},
              {label:"Avg rating",val:avgRating.toFixed(1)+" ★",trend:"790 reviews"},
              {label:"Revenue (30d)",val:usd(totalRevenue),trend:"85% to you"},
            ].map(s=>(
              <div key={s.label} style={{background:"#000",padding:"18px 20px"}}>
                <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.02em"}}>{s.val}</div>
                <div style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.2)",marginTop:4}}>{s.label}</div>
                <div style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.12)",marginTop:2}}>{s.trend}</div>
              </div>
            ))}
          </div>

          {/* TAB: MY SKILLS */}
          {tab==="skills" && (
            <>
              {/* column headers */}
              <div style={{
                display:"grid",
                gridTemplateColumns:"1fr 80px 80px 80px 80px 70px 70px",
                padding:"10px 24px",
                borderBottom:"1px solid rgba(255,255,255,0.06)",
                fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",
                letterSpacing:"0.08em",textTransform:"uppercase",
              }}>
                <span>Skill</span>
                <span style={{textAlign:"right"}}>Status</span>
                <span style={{textAlign:"right"}}>Installs</span>
                <span style={{textAlign:"right"}}>Runs</span>
                <span style={{textAlign:"right"}}>Rating</span>
                <span style={{textAlign:"right"}}>Revenue</span>
                <span style={{textAlign:"right"}}>Trend</span>
              </div>

              {MY_SKILLS.map(s=>(
                <div key={s.id} className="row-item" style={{
                  display:"grid",
                  gridTemplateColumns:"1fr 80px 80px 80px 80px 70px 70px",
                  padding:"14px 24px",alignItems:"center",
                  borderBottom:"1px solid rgba(255,255,255,0.03)",
                }}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:700}}>{s.name}</span>
                      <span style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.15)"}}>v{s.version}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.15)"}}>{s.price}</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.1)"}}>·</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.12)"}}>{s.license}</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.1)"}}>·</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.12)"}}>{s.size}</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.1)"}}>·</span>
                      <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.12)"}}>updated {s.updated}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}><StatusBadge status={s.status}/></div>
                  <div style={{textAlign:"right",fontSize:13,fontFamily:M,color:"rgba(255,255,255,0.5)"}}>{s.installs>0?fmt(s.installs):"—"}</div>
                  <div style={{textAlign:"right",fontSize:13,fontFamily:M,color:"rgba(255,255,255,0.5)"}}>{s.runs>0?fmt(s.runs):"—"}</div>
                  <div style={{textAlign:"right",fontSize:13,fontFamily:M,color:"rgba(255,255,255,0.5)"}}>{s.rating>0?s.rating+" ★":"—"}</div>
                  <div style={{textAlign:"right",fontSize:13,fontFamily:M,color:s.revenue>0?"#fff":"rgba(255,255,255,0.15)"}}>{s.revenue>0?usd(s.revenue):"—"}</div>
                  <div style={{textAlign:"right",fontSize:12,fontFamily:M,color:s.trend>0?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)"}}>
                    {s.trend>0?`+${s.trend}%`:"—"}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TAB: ACTIVITY */}
          {tab==="activity" && (
            <div style={{padding:"0"}}>
              <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                Recent activity
              </div>
              {ACTIVITY.map((a,i)=>(
                <div key={i} className="feed-item" style={{
                  padding:"12px 24px",display:"flex",alignItems:"center",gap:12,
                  borderBottom:"1px solid rgba(255,255,255,0.03)",
                }}>
                  <ActivityIcon type={a.type}/>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",flex:1}}>{a.text}</span>
                  <span style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.12)",flexShrink:0}}>{a.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: ANALYTICS */}
          {tab==="analytics" && (
            <div style={{padding:"24px"}}>
              <div style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>
                Installs — last 30 days
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,height:120,padding:"0 0 8px"}}>
                {[18,24,31,22,28,35,42,38,45,52,48,55,60,58,63,70,65,72,68,75,80,78,85,82,88,92,90,95,98,100].map((v,i)=>(
                  <div key={i} style={{
                    flex:1,height:`${v}%`,background:"rgba(255,255,255,0.08)",borderRadius:"2px 2px 0 0",
                    transition:"background .2s",cursor:"pointer",position:"relative",
                  }}
                  onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.25)"}
                  onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.08)"}
                  />
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.1)",marginTop:4}}>
                <span>Mar 5</span><span>Mar 12</span><span>Mar 19</span><span>Mar 26</span><span>Apr 4</span>
              </div>

              <div style={{marginTop:32,fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>
                Per-skill breakdown
              </div>
              {MY_SKILLS.filter(s=>s.status==="published").map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:600,width:140,flexShrink:0}}>{s.name}</span>
                  <div style={{flex:1,height:6,borderRadius:3,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(s.installs/totalInstalls)*100}%`,background:"rgba(255,255,255,0.2)",borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:12,fontFamily:M,color:"rgba(255,255,255,0.3)",width:50,textAlign:"right"}}>{fmt(s.installs)}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: REVENUE */}
          {tab==="revenue" && (
            <div style={{padding:"24px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:"rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden",marginBottom:24}}>
                {[
                  {label:"Total earned",val:usd(totalRevenue)},
                  {label:"Your share (85%)",val:usd(totalRevenue*0.85)},
                  {label:"Available to withdraw",val:usd(totalRevenue*0.85)},
                ].map(r=>(
                  <div key={r.label} style={{background:"#000",padding:"20px"}}>
                    <div style={{fontSize:24,fontWeight:700}}>{r.val}</div>
                    <div style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.2)",marginTop:4}}>{r.label}</div>
                  </div>
                ))}
              </div>
              <button className="action-btn" style={{
                background:"#fff",color:"#000",border:"none",padding:"10px 24px",
                borderRadius:8,fontSize:13,fontWeight:700,marginBottom:24,
              }}>Withdraw to Stripe →</button>

              <div style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>
                Transaction history
              </div>
              {[
                {skill:"Slide Deck Maker",buyer:"qa_forge",amount:5.99,date:"1h ago"},
                {skill:"Slide Deck Maker",buyer:"legal_ai",amount:5.99,date:"8h ago"},
                {skill:"Slide Deck Maker",buyer:"restful_ai",amount:5.99,date:"1d ago"},
                {skill:"Slide Deck Maker",buyer:"cloud_native",amount:5.99,date:"2d ago"},
                {skill:"Slide Deck Maker",buyer:"data_smith",amount:5.99,date:"3d ago"},
              ].map((tx,i)=>(
                <div key={i} style={{
                  display:"grid",gridTemplateColumns:"1fr 120px 80px 80px",
                  padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",
                  fontSize:13,alignItems:"center",
                }}>
                  <span style={{fontWeight:500}}>{tx.skill}</span>
                  <span style={{fontFamily:M,fontSize:12,color:"rgba(255,255,255,0.3)"}}>@{tx.buyer}</span>
                  <span style={{fontFamily:M,fontSize:12,color:"#fff",textAlign:"right"}}>{usd(tx.amount)}</span>
                  <span style={{fontFamily:M,fontSize:11,color:"rgba(255,255,255,0.12)",textAlign:"right"}}>{tx.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {tab==="settings" && (
            <div style={{padding:"24px",maxWidth:480}}>
              <div style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>Publisher profile</div>
              {[
                {label:"Display name",val:"synthwave_dev"},
                {label:"Email",val:"dev@synthwave.io"},
                {label:"Stripe connected",val:"✓ Connected"},
                {label:"Publisher since",val:"Jan 2026"},
                {label:"Trust score",val:"94 / 100"},
              ].map(f=>(
                <div key={f.label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:13}}>
                  <span style={{color:"rgba(255,255,255,0.35)"}}>{f.label}</span>
                  <span style={{fontFamily:M,fontSize:12}}>{f.val}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div style={{
          position:"fixed",inset:0,zIndex:200,
          background:"rgba(0,0,0,0.8)",backdropFilter:"blur(12px)",
          display:"flex",alignItems:"center",justifyContent:"center",
        }} onClick={()=>{setShowUpload(false);setUploadStep(0)}}>
          <div onClick={e=>e.stopPropagation()} style={{
            width:520,background:"#0a0a0a",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:16,overflow:"hidden",
          }}>
            {/* modal header */}
            <div style={{padding:"20px 24px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:16,fontWeight:700}}>Publish a skill</span>
              <span onClick={()=>{setShowUpload(false);setUploadStep(0)}} style={{cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:18}}>×</span>
            </div>

            {/* steps indicator */}
            <div style={{padding:"16px 24px",display:"flex",gap:8,alignItems:"center"}}>
              {["Upload","Configure","Review"].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{
                    width:22,height:22,borderRadius:6,fontSize:11,fontWeight:700,fontFamily:M,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    background:i<=uploadStep?"#fff":"rgba(255,255,255,0.06)",
                    color:i<=uploadStep?"#000":"rgba(255,255,255,0.2)",
                    transition:"all .3s",
                  }}>{i+1}</div>
                  <span style={{fontSize:12,color:i<=uploadStep?"#fff":"rgba(255,255,255,0.2)",fontWeight:i===uploadStep?600:400}}>{s}</span>
                  {i<2&&<div style={{width:24,height:1,background:"rgba(255,255,255,0.06)"}}/>}
                </div>
              ))}
            </div>

            {/* step content */}
            <div style={{padding:"8px 24px 24px"}}>

              {uploadStep===0 && (
                <>
                  <div className="upload-zone"
                    onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                    onDragLeave={()=>setDragOver(false)}
                    onDrop={e=>{e.preventDefault();setDragOver(false);setUploadStep(1)}}
                    onClick={()=>setUploadStep(1)}
                    style={{
                      border:`1px dashed ${dragOver?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)"}`,
                      borderRadius:12,padding:"40px 24px",textAlign:"center",
                      background:dragOver?"rgba(255,255,255,0.03)":"transparent",
                    }}>
                    <div style={{fontSize:28,marginBottom:12,opacity:0.15}}>/</div>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Drop your .skill file here</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>or click to browse — ZIP, .skill, or folder</div>
                  </div>
                  <div style={{textAlign:"center",marginTop:16,fontSize:12,color:"rgba(255,255,255,0.15)"}}>
                    or
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button className="ghost-btn" style={{
                      flex:1,padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",
                      background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,
                    }}>Import from GitHub</button>
                    <button className="ghost-btn" onClick={()=>setUploadStep(1)} style={{
                      flex:1,padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",
                      background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,
                    }}>Start from scratch</button>
                  </div>
                </>
              )}

              {uploadStep===1 && (
                <>
                  {[
                    {label:"Skill name",placeholder:"e.g. Invoice Generator",type:"text"},
                    {label:"Description",placeholder:"One-line description of what your skill does",type:"text"},
                    {label:"Category",placeholder:"Select...",type:"select"},
                  ].map(f=>(
                    <div key={f.label} style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.25)",marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>{f.label}</div>
                      <input placeholder={f.placeholder} style={{
                        width:"100%",padding:"10px 12px",borderRadius:8,fontSize:13,
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
                        color:"#fff",outline:"none",fontFamily:S,
                      }}/>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:12,marginBottom:14}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.25)",marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>Pricing</div>
                      <div style={{display:"flex",gap:6}}>
                        {["Free","One-time","Per-run","Subscription"].map(p=>(
                          <button key={p} className="ghost-btn" style={{
                            padding:"7px 12px",borderRadius:6,fontSize:11,fontWeight:600,
                            border:"1px solid rgba(255,255,255,0.08)",background:"transparent",
                            color:"rgba(255,255,255,0.35)",
                          }}>{p}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontFamily:M,color:"rgba(255,255,255,0.25)",marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>License</div>
                      <div style={{display:"flex",gap:6}}>
                        {["MIT","Apache-2.0","Proprietary"].map(l=>(
                          <button key={l} className="ghost-btn" style={{
                            padding:"7px 12px",borderRadius:6,fontSize:11,fontWeight:600,
                            border:"1px solid rgba(255,255,255,0.08)",background:"transparent",
                            color:"rgba(255,255,255,0.35)",
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {uploadStep===2 && (
                <>
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"16px",marginBottom:16}}>
                    <div style={{fontSize:10,fontFamily:M,color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Validation</div>
                    {[
                      {label:"SKILL.md found",ok:true},
                      {label:"Frontmatter valid",ok:true},
                      {label:"Scripts scanned — no issues",ok:true},
                      {label:"Test suite — 4/4 passing",ok:true},
                      {label:"Quality score",ok:true,val:"A (87/100)"},
                    ].map(v=>(
                      <div key={v.label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:12}}>
                        <span style={{color:"rgba(255,255,255,0.4)"}}>{v.label}</span>
                        <span style={{fontFamily:M,fontSize:11,color:v.ok?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.15)"}}>{v.val||"✓ pass"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",marginBottom:16,lineHeight:1.6}}>
                    Your skill will be reviewed within 24 hours. Free skills from trusted publishers are auto-approved.
                  </div>
                </>
              )}
            </div>

            {/* modal footer */}
            <div style={{
              padding:"16px 24px",borderTop:"1px solid rgba(255,255,255,0.06)",
              display:"flex",justifyContent:"space-between",alignItems:"center",
            }}>
              <button className="ghost-btn" onClick={()=>{
                if(uploadStep===0){setShowUpload(false)}else{setUploadStep(uploadStep-1)}
              }} style={{
                padding:"8px 16px",borderRadius:6,fontSize:12,fontWeight:600,
                border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.35)",
              }}>{uploadStep===0?"Cancel":"Back"}</button>
              <button className="action-btn" onClick={()=>{
                if(uploadStep<2){setUploadStep(uploadStep+1)}else{setShowUpload(false);setUploadStep(0)}
              }} style={{
                padding:"8px 20px",borderRadius:6,fontSize:12,fontWeight:700,
                border:"none",background:"#fff",color:"#000",
              }}>{uploadStep===2?"Submit for Review":"Continue"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
