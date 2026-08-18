'use client'
import { useEffect, useState, useMemo } from 'react'
import type { SatisfacaoRecord } from '@/types'
import { IcoStar, IcoBot, IcoUser } from '@/components/icons'

interface Metrics { media:number; total:number; distribuicao:Record<number,number>; tendencia:Array<{data:string;media:number}> }
const EMOJI:Record<number,string>={1:'😡',2:'😕',3:'😐',4:'🙂',5:'😀'}
const LABEL:Record<number,string>={1:'Péssimo',2:'Ruim',3:'Regular',4:'Bom',5:'Ótimo'}
function nColor(n:number){return n>=4?'var(--neon)':n===3?'var(--warning)':'var(--danger)'}
function fmtDT(iso:string){if(!iso)return'—';try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return iso}}

function ScoreRing({v}:{v:number}){
  const r=44,c=2*Math.PI*r,d=(v/5)*c,clr=v>=4?'#A3E635':v>=3?'#F59E0B':'#EF4444'
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <svg width={100} height={100} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border-md)" strokeWidth={8}/>
        <circle cx={55} cy={55} r={r} fill="none" stroke={clr} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${d} ${c}`} transform="rotate(-90 55 55)" style={{transition:'stroke-dasharray 1s ease'}}/>
      </svg>
      <div style={{position:'absolute',textAlign:'center'}}>
        <div style={{fontSize:20,fontWeight:700,fontFamily:"'Syne',sans-serif",color:'var(--txt)',lineHeight:1}}>{v>0?v.toFixed(1):'—'}</div>
        <div style={{fontSize:10,color:'var(--txt-3)'}}>/5.0</div>
      </div>
    </div>
  )
}

export default function SatisfacaoPage(){
  const [records,setRecords]=useState<SatisfacaoRecord[]>([])
  const [metrics,setMetrics]=useState<Metrics|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,  setError]  =useState('')
  const [filterN,setFilterN]=useState<number|null>(null)

  async function load(){
    setLoading(true)
    try{
      const r=await fetch('/api/satisfacao',{cache:'no-store'})
      const d=await r.json()
      if(d.success){
        setRecords([...(d.data.records??[])].sort((a:SatisfacaoRecord,b:SatisfacaoRecord)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()))
        setMetrics(d.data.metrics)
      } else setError(d.error)
    }catch{setError('Erro ao carregar')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>filterN===null?records:records.filter(r=>Math.round(r.nota)===filterN),[records,filterN])
  const dist=metrics?.distribuicao??{}
  const tot =metrics?.total??0

  const S={
    th:{padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)'},
    td:{padding:'11px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const},
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando avaliações...</span></div>
  if(error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:24}}>
      <div className="card" style={{maxWidth:440,width:'100%',padding:'36px 32px',textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:16}}>🗄️</div>
        <div className="font-display" style={{fontSize:17,fontWeight:700,color:'var(--txt)',marginBottom:10}}>Banco de dados não configurado</div>
        <p style={{fontSize:13,color:'var(--txt-2)',lineHeight:1.7,marginBottom:24}}>
          Os dados de Satisfação ainda não estão disponíveis para sua empresa.<br/>
          Entre em contato com a{' '}
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--txt)'}}>
            Com<span style={{color:'var(--neon)'}}>Agente</span>
          </span>
          {' '}para solicitar o cadastramento do seu banco de dados.
        </p>
        <button className="btn-outline" onClick={load} style={{padding:'9px 20px',fontSize:13}}>↻ Tentar novamente</button>
      </div>
    </div>
  )

  return (
    <div style={{height:'100%',overflowY:'auto'}}>
      <div style={{padding:24,maxWidth:960,margin:'0 auto'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 className="font-display" style={{fontSize:20,fontWeight:700,color:'var(--txt)'}}>Satisfação</h1>
            <p style={{fontSize:12,color:'var(--txt-2)',marginTop:2}}>{tot} avaliações · somente leitura</p>
          </div>
          <button onClick={load} className="btn-outline" style={{padding:'7px 12px',fontSize:14,marginLeft:'auto'}}>↻</button>
        </div>

        {/* Score + distribuição */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginBottom:20}}>

          {/* Score card */}
          <div className="card" style={{padding:20}}>
            <div style={{display:'flex',alignItems:'center',gap:20}}>
              <ScoreRing v={metrics?.media??0}/>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:'var(--txt)',marginBottom:4}}>
                  {(metrics?.media??0)>=4.5?'Excelente':(metrics?.media??0)>=3.5?'Bom':(metrics?.media??0)>=2.5?'Regular':tot===0?'Sem dados':'Atenção'}
                </p>
                <p style={{fontSize:12,color:'var(--txt-2)'}}>{tot} avaliações</p>
                {tot>0&&<p style={{fontSize:11,color:'var(--txt-3)',marginTop:4}}>Notas 4-5: {((((dist[4]??0)+(dist[5]??0))/tot)*100).toFixed(0)}% dos clientes</p>}
              </div>
            </div>
          </div>

          {/* Distribuição */}
          <div className="card" style={{padding:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>Por nota</p>
              {filterN!==null&&<button onClick={()=>setFilterN(null)} style={{fontSize:11,color:'var(--neon)',background:'none',border:'none',cursor:'pointer'}}>Limpar filtro</button>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[5,4,3,2,1].map(n=>{
                const count=dist[n]??0,pct=tot>0?(count/tot)*100:0,active=filterN===n
                return (
                  <button key={n} onClick={()=>setFilterN(filterN===n?null:n)} style={{display:'flex',alignItems:'center',gap:8,background:active?'var(--bg-hover)':'transparent',border:`1px solid ${active?nColor(n)+'40':'transparent'}`,borderRadius:8,padding:'4px 6px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                    <span style={{fontSize:15,width:22,textAlign:'center'}}>{EMOJI[n]}</span>
                    <span style={{fontSize:11,color:'var(--txt-2)',width:52,textAlign:'left'}}>{LABEL[n]}</span>
                    <div style={{flex:1,height:6,borderRadius:3,background:'var(--bg-input)',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,background:nColor(n),width:`${pct}%`,transition:'width .7s ease'}}/>
                    </div>
                    <span style={{fontSize:11,color:'var(--txt-3)',width:22,textAlign:'right'}}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tendência */}
        {metrics&&metrics.tendencia.length>1&&(
          <div className="card" style={{padding:20,marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>Tendência diária</p>
              <span style={{fontSize:11,color:'var(--txt-3)'}}>últimos 14 dias</span>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:3,height:56,marginBottom:6}}>
              {metrics.tendencia.map((d,i)=>(
                <div key={i} title={`${d.data.slice(5)} · ${d.media}`}
                  style={{flex:1,borderRadius:3,minHeight:4,background:nColor(Math.round(d.media)),height:`${(d.media/5)*100}%`,opacity:.85,transition:'height .5s ease',cursor:'default'}}/>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:10,color:'var(--txt-3)'}}>{metrics.tendencia[0]?.data.slice(5)}</span>
              <span style={{fontSize:10,color:'var(--txt-3)'}}>{metrics.tendencia.at(-1)?.data.slice(5)}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card" style={{overflow:'hidden',marginBottom:16}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:13,fontWeight:600,color:'var(--txt)'}}>
              Registros {filterN!==null?`— nota ${filterN} (${LABEL[filterN]})`:''}
            </p>
            <span style={{fontSize:12,color:'var(--txt-3)'}}>{filtered.length} registros</span>
          </div>
          <div style={{overflowX:'auto'}}>
            {filtered.length===0?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 0',gap:8,color:'var(--txt-3)'}}>
                <IcoStar size={32}/><p style={{fontSize:13}}>Nenhuma avaliação encontrada</p>
              </div>
            ):(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Data','Telefone','Nota','Atendente','ID Atendimento'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const isBot=r.atendente==='Bot'||!r.atendente,n=Math.round(r.nota)
                    return (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)',transition:'background .12s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>
                        <td style={{...S.td,fontSize:12}}>{fmtDT(r.timestamp)}</td>
                        <td style={{...S.td,fontFamily:'monospace',fontSize:12}}>{r.telefone}</td>
                        <td style={S.td}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:15}}>{EMOJI[n]}</span>
                            <span style={{fontWeight:700,color:nColor(n)}}>{r.nota}</span>
                            <span style={{fontSize:11,color:'var(--txt-3)'}}>{LABEL[n]}</span>
                          </div>
                        </td>
                        <td style={S.td}>
                          <span style={{fontSize:11,fontWeight:600,color:isBot?'#A78BFA':'var(--neon)',display:'inline-flex',alignItems:'center',gap:4}}>{isBot?<><IcoBot size={11}/>Bot</>:<><IcoUser size={11}/>{r.atendente.slice(0,12)}</>}</span>
                        </td>
                        <td style={{...S.td,fontFamily:'monospace',fontSize:11,color:'var(--txt-3)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.atendimentoId||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <p style={{textAlign:'center',fontSize:11,color:'var(--txt-3)',paddingBottom:8}}>🔒 Somente leitura · clique em uma nota para filtrar</p>
      </div>
    </div>
  )
}
