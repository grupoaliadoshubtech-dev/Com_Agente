'use client'
import { useEffect, useState } from 'react'
import type { Plan } from '@/types'

const PERIOD:Record<string,string>={monthly:'Mensal',yearly:'Anual',custom:'Customizado'}

function PlanModal({plan,onClose,onSaved}:{plan?:Plan;onClose:()=>void;onSaved:()=>void}){
  const [name,    setName]    =useState(plan?.name??'')
  const [price,   setPrice]   =useState(plan?String(plan.price/100):'')
  const [period,  setPeriod]  ]=useState<Plan['period']>(plan?.period??'monthly')
  const [maxI,    setMaxI]    =useState(String(plan?.maxInstances??1))
  const [maxA,    setMaxA]    =useState(String(plan?.maxAttendants??2))
  const [feats,   setFeats]   =useState(plan?.features.join('\n')??' ')
  const [loading, setLoading] =useState(false)
  const [error,   setError]   =useState('')

  async function save(e:React.FormEvent){
    e.preventDefault();setError('');setLoading(true)
    const body={name,price:Math.round(parseFloat(price)*100)||0,period,maxInstances:parseInt(maxI)||1,maxAttendants:parseInt(maxA)||2,features:feats.split('\n').map(f=>f.trim()).filter(Boolean),isActive:true}
    const url=plan?`/api/plans/${plan.id}`:'/api/plans'
    const r=await fetch(url,{method:plan?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const d=await r.json();setLoading(false)
    if(d.success)onSaved()
    else setError(d.error??'Erro')
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="card animate-slide-up" style={{maxWidth:440,width:'100%',maxHeight:'90vh',overflowY:'auto',padding:0}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'var(--bg-card)',zIndex:1}}>
          <h2 className="font-display" style={{fontSize:15,fontWeight:700,color:'var(--txt)'}}>{plan?'Editar plano':'Novo plano'}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--txt-2)',lineHeight:1}}>×</button>
        </div>
        <form onSubmit={save} style={{padding:20}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Nome do plano</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Professional" required style={{width:'100%',padding:'9px 12px'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Preço (R$) — 0 = sob consulta</label>
              <input value={price} onChange={e=>setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="497.00" style={{width:'100%',padding:'9px 12px'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Período</label>
              <select value={period} onChange={e=>setPeriod(e.target.value as Plan['period'])} style={{width:'100%',padding:'9px 12px',borderRadius:8}}>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
                <option value="custom">Customizado</option>
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Máx. instâncias WA</label>
              <input value={maxI} onChange={e=>setMaxI(e.target.value)} type="number" min="1" style={{width:'100%',padding:'9px 12px'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Máx. atendentes</label>
              <input value={maxA} onChange={e=>setMaxA(e.target.value)} type="number" min="1" style={{width:'100%',padding:'9px 12px'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Features <span style={{color:'var(--txt-3)',fontWeight:400}}>(uma por linha)</span></label>
              <textarea value={feats} onChange={e=>setFeats(e.target.value)} rows={4} placeholder={"3 instâncias WhatsApp\n10 atendentes\nCRM completo"} style={{width:'100%',padding:'9px 12px',resize:'none'}}/>
            </div>
          </div>
          {error&&<div style={{marginTop:10,fontSize:13,color:'var(--danger)',background:'var(--danger-dim)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8,padding:'8px 12px'}}>{error}</div>}
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button type="button" onClick={onClose} className="btn-outline" style={{flex:1,padding:'10px',fontSize:13}}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn-neon" style={{flex:1,padding:'10px',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading?<><span className="spinner" style={{width:14,height:14}}/>Salvando...</>:plan?'Salvar alterações':'Criar plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PlanosPage(){
  const [plans,  setPlans]  =useState<Plan[]>([])
  const [loading,setLoading]=useState(true)
  const [editing,setEditing]=useState<Plan|undefined>()
  const [showNew,setShowNew]=useState(false)
  const [toast,  setToast]  =useState('')

  function showToast(m:string){setToast(m);setTimeout(()=>setToast(''),3500)}
  async function load(){setLoading(true);const r=await fetch('/api/plans');const d=await r.json();if(d.success)setPlans(d.data);setLoading(false)}
  useEffect(()=>{load()},[])

  async function toggleActive(p:Plan){
    await fetch(`/api/plans/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:!p.isActive})})
    load();showToast(p.isActive?'✓ Plano desativado':'✓ Plano ativado')
  }

  function fmtPrice(p:Plan){return p.price===0?'Sob consulta':`R$ ${(p.price/100).toLocaleString('pt-BR',{minimumFractionDigits:2})}`}

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,background:'var(--bg-card)'}}>
        <div style={{flex:1}}>
          <div className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)'}}>Planos Master</div>
          <div style={{fontSize:11,color:'var(--txt-2)',marginTop:2}}>{plans.length} planos · exibidos na tela Cadastre-se</div>
        </div>
        <button onClick={()=>setShowNew(true)} className="btn-neon" style={{padding:'9px 16px',fontSize:13}}>+ Novo plano</button>
        <button onClick={load} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>↻</button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:20}}>
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando...</span></div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
            {plans.length===0&&(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'var(--txt-3)',gridColumn:'1/-1'}}>
                <span style={{fontSize:32}}>💎</span><p style={{fontSize:13}}>Nenhum plano cadastrado</p>
                <button onClick={()=>setShowNew(true)} style={{fontSize:13,color:'var(--neon)',background:'none',border:'none',cursor:'pointer'}}>Criar primeiro plano →</button>
              </div>
            )}
            {plans.map(p=>(
              <div key={p.id} className="card" style={{padding:20,opacity:p.isActive?1:.55,position:'relative',transition:'opacity .2s'}}>
                {/* Active indicator */}
                <div style={{position:'absolute',top:14,right:14,display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:p.isActive?'#10B981':'#EF4444'}}/>
                  <span style={{fontSize:10,color:'var(--txt-3)'}}>{p.isActive?'Ativo':'Inativo'}</span>
                </div>

                <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:8}}>{PERIOD[p.period]??p.period}</p>
                <p className="font-display" style={{fontSize:18,fontWeight:700,color:'var(--txt)',marginBottom:4}}>{p.name}</p>
                <p className="font-display" style={{fontSize:24,fontWeight:700,color:'var(--neon)',marginBottom:4}}>
                  {fmtPrice(p)}{p.price>0&&<span style={{fontSize:13,fontWeight:400,color:'var(--txt-3)'}}>/mês</span>}
                </p>
                <div style={{fontSize:11,color:'var(--txt-3)',marginBottom:12}}>
                  <div>↗ {p.maxInstances} instância{p.maxInstances!==1?'s':''} WhatsApp</div>
                  <div>↗ {p.maxAttendants===999?'Ilimitados':p.maxAttendants} atendentes</div>
                </div>
                <ul style={{listStyle:'none',marginBottom:16}}>
                  {p.features.slice(0,4).map((f,i)=>(
                    <li key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--txt-2)',marginBottom:4}}>
                      <span style={{width:4,height:4,borderRadius:'50%',background:'var(--neon)',flexShrink:0}}/>
                      {f}
                    </li>
                  ))}
                  {p.features.length>4&&<li style={{fontSize:11,color:'var(--txt-3)'}}>+{p.features.length-4} mais...</li>}
                </ul>
                <div style={{display:'flex',gap:8,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  <button onClick={()=>setEditing(p)} className="btn-outline" style={{flex:1,padding:'8px',fontSize:12}}>Editar</button>
                  <button onClick={()=>toggleActive(p)} style={{flex:1,padding:'8px',fontSize:12,borderRadius:8,border:`1px solid ${p.isActive?'rgba(239,68,68,.3)':'rgba(16,185,129,.3)'}`,background:p.isActive?'rgba(239,68,68,.08)':'rgba(16,185,129,.08)',color:p.isActive?'#FCA5A5':'#6EE7B7',cursor:'pointer',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}}>
                    {p.isActive?'Desativar':'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew&&<PlanModal onClose={()=>setShowNew(false)} onSaved={()=>{setShowNew(false);load();showToast('✓ Plano criado!')}}/>}
      {editing&&<PlanModal plan={editing} onClose={()=>setEditing(undefined)} onSaved={()=>{setEditing(undefined);load();showToast('✓ Plano atualizado!')}}/>}
      {toast&&<div className="toast-base">{toast}</div>}
    </div>
  )
}
