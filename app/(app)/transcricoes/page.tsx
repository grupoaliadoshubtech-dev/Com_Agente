'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AtendimentoRecord } from '@/types'

function fmtDT(iso?:string){if(!iso)return'—';try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return iso}}
function fmtDur(ini:string,fim?:string){if(!ini||!fim)return'—';const m=Math.round((new Date(fim).getTime()-new Date(ini).getTime())/60000);if(isNaN(m)||m<0)return'—';return m<60?`${m}min`:`${Math.floor(m/60)}h ${m%60}min`}
function Stars({n}:{n?:number}){if(!n)return <span style={{color:'var(--txt-3)',fontSize:12}}>—</span>;return <span style={{fontSize:13}}>{[1,2,3,4,5].map(i=><span key={i} style={{color:i<=n?'#F59E0B':'var(--txt-3)'}}>★</span>)}</span>}

export default function TranscricoesPage(){
  const sp     = useSearchParams()
  const pre    = sp.get('telefone')??''
  const [records,setRecords]= useState<AtendimentoRecord[]>([])
  const [loading,setLoading]= useState(true)
  const [error,  setError]  = useState('')
  const [search, setSearch] = useState(pre)
  const [tipo,   setTipo]   = useState<'todos'|'bot'|'humano'>('todos')
  const [sel,    setSel]    = useState<AtendimentoRecord|null>(null)

  async function load(){
    setLoading(true)
    try{
      const r=await fetch(`/api/transcricoes${pre?`?telefone=${pre}`:''}`,{cache:'no-store'})
      const d=await r.json()
      if(d.success) setRecords([...(Array.isArray(d.data)?d.data:[])].sort((a:AtendimentoRecord,b:AtendimentoRecord)=>new Date(b.inicio).getTime()-new Date(a.inicio).getTime()))
      else setError(d.error)
    }catch{setError('Erro ao carregar')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>records.filter(r=>{
    const ms=!search||r.nome.toLowerCase().includes(search.toLowerCase())||r.telefone.includes(search)
    const mt=tipo==='todos'?true:tipo==='bot'?(r.atendente==='Bot'||!r.atendente):(r.atendente!=='Bot'&&!!r.atendente)
    return ms&&mt
  }),[records,search,tipo])

  const S={
    wrap:{display:'flex',height:'100%',overflow:'hidden'},
    main:{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden'},
    toolbar:{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,flexWrap:'wrap' as const,background:'var(--bg-card)'},
    title:{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:'var(--txt)',flex:1},
    sub:{fontSize:11,color:'var(--txt-2)',marginTop:2},
    inp:{padding:'8px 12px',borderRadius:8,fontSize:13,width:220},
    th:{padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)'},
    td:{padding:'11px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const},
    detail:{width:290,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column' as const,background:'var(--bg-card)',flexShrink:0},
    dhead:{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'},
    dbody:{padding:16,overflowY:'auto' as const,flex:1},
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando transcrições...</span></div>
  if(error)   return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10}}><p style={{color:'var(--danger)',fontSize:14}}>{error}</p><button className="btn-outline" onClick={load} style={{padding:'8px 16px',fontSize:13}}>Tentar novamente</button></div>

  return (
    <div style={S.wrap}>
      <div style={S.main}>
        <div style={S.toolbar}>
          <div><div style={S.title}>Transcrições</div><div style={S.sub}>{records.length} atendimentos · somente leitura</div></div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome ou número..." style={S.inp}/>
          <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid var(--border)'}}>
            {(['todos','bot','humano'] as const).map(t=>(
              <button key={t} onClick={()=>setTipo(t)} style={{padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',background:tipo===t?'var(--neon-dim)':'transparent',color:tipo===t?'var(--neon)':'var(--txt-2)',border:'none',fontFamily:"'Plus Jakarta Sans',sans-serif",textTransform:'capitalize'}}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={load} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>↻</button>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.length===0?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'var(--txt-3)'}}>
              <span style={{fontSize:32}}>📝</span><p style={{fontSize:13}}>Nenhum atendimento encontrado</p>
            </div>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Cliente','Início','Duração','Atendente','Satisfação'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r,i)=>{
                  const isBot=r.atendente==='Bot'||!r.atendente
                  const active=sel?.id===r.id
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:active?'var(--neon-dim)':'transparent',transition:'background .12s'}}
                      onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                      onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}
                      onClick={()=>setSel(r)}>
                      <td style={S.td}><div style={{fontWeight:500,color:'var(--txt)'}}>{r.nome||r.telefone}</div><div style={{fontSize:11,color:'var(--txt-3)',fontFamily:'monospace'}}>{r.telefone}</div></td>
                      <td style={{...S.td,fontSize:12}}>{fmtDT(r.inicio)}</td>
                      <td style={S.td}>{fmtDur(r.inicio,r.fim)}</td>
                      <td style={S.td}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:100,background:isBot?'rgba(139,92,246,.12)':'var(--neon-dim)',border:`1px solid ${isBot?'rgba(139,92,246,.25)':'var(--neon-border)'}`,color:isBot?'#A78BFA':'var(--neon)'}}>
                          {isBot?'🤖 Bot':`👤 ${r.atendente.slice(0,10)}`}
                        </span>
                      </td>
                      <td style={S.td}><Stars n={r.satisfacao}/></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {sel && (
        <div style={S.detail}>
          <div style={S.dhead}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>Resumo</span>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'var(--txt-2)',lineHeight:1}}>×</button>
          </div>
          <div style={S.dbody}>
            <p style={{fontSize:10,fontFamily:'monospace',color:'var(--txt-3)',marginBottom:16,wordBreak:'break-all'}}># {sel.id}</p>
            {[['Cliente',sel.nome||'—'],['Telefone',sel.telefone],['Início',fmtDT(sel.inicio)],['Fim',fmtDT(sel.fim)],['Duração',fmtDur(sel.inicio,sel.fim)]].map(([l,v])=>(
              <div key={l} style={{marginBottom:12}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:3}}>{l}</p>
                <p style={{fontSize:13,color:'var(--txt-2)'}}>{v}</p>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:6}}>Atendente</p>
              <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:100,background:(sel.atendente==='Bot'||!sel.atendente)?'rgba(139,92,246,.12)':'var(--neon-dim)',border:`1px solid ${(sel.atendente==='Bot'||!sel.atendente)?'rgba(139,92,246,.25)':'var(--neon-border)'}`,color:(sel.atendente==='Bot'||!sel.atendente)?'#A78BFA':'var(--neon)'}}>
                {(sel.atendente==='Bot'||!sel.atendente)?'🤖 Bot':`👤 ${sel.atendente}`}
              </span>
            </div>
            <div style={{marginBottom:16}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:6}}>Satisfação</p>
              {sel.satisfacao?<div style={{display:'flex',alignItems:'center',gap:8}}><Stars n={sel.satisfacao}/><span style={{fontSize:13,color:'var(--txt-2)'}}>{['','Péssimo','Ruim','Regular','Bom','Ótimo'][sel.satisfacao]}</span></div>:<p style={{fontSize:12,color:'var(--txt-3)'}}>Não avaliado</p>}
            </div>
            <div style={{background:'var(--bg-input)',borderRadius:8,padding:12,fontSize:12,color:'var(--txt-2)',lineHeight:1.6}}>
              <p style={{fontWeight:600,color:'var(--txt)',marginBottom:4}}>Autoria</p>
              <p>{(sel.atendente==='Bot'||!sel.atendente)?'Encerrado pela IA — atendente = "Bot"':`Encerrado por ${sel.atendente}`}</p>
            </div>
            <p style={{textAlign:'center',fontSize:10,color:'var(--txt-3)',marginTop:20}}>🔒 Somente leitura</p>
          </div>
        </div>
      )}
    </div>
  )
}
