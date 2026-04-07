'use client'
import { useEffect, useState } from 'react'
import type { Tenant, Plan } from '@/types'

const ST_CLR:Record<string,string>={active:'#10B981',trial:'#F59E0B',inactive:'#EF4444'}
const ST_LBL:Record<string,string>={active:'Ativo',trial:'Trial',inactive:'Inativo'}
function fmtDate(iso:string){if(!iso)return'—';try{return new Date(iso).toLocaleDateString('pt-BR')}catch{return iso}}

function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="card animate-slide-up" style={{maxWidth:520,width:'100%',maxHeight:'90vh',overflowY:'auto',padding:0}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'var(--bg-card)',zIndex:1}}>
          <h2 className="font-display" style={{fontSize:15,fontWeight:700,color:'var(--txt)'}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--txt-2)',lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20}}>{children}</div>
      </div>
    </div>
  )
}

function Field({label,value,onChange,type='text',placeholder=''}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}){
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:'100%',padding:'9px 12px'}}/>
    </div>
  )
}

export default function EmpresasPage(){
  const [tenants,setTenants]=useState<Tenant[]>([])
  const [plans,  setPlans]  =useState<Plan[]>([])
  const [loading,setLoading]=useState(true)
  const [search, setSearch] =useState('')
  const [showNew,setShowNew]=useState(false)
  const [statusOf,setStatusOf]=useState<Tenant|null>(null)
  const [toast,  setToast]  =useState('')
  const [form,   setForm]   ]=useState({name:'',email:'',phone:'',planId:'',supervisorName:'',supervisorEmail:'',supervisorPassword:'',spreadsheetId:'',evolutionInstance:''})
  const [saving, setSaving] =useState(false)
  const [newStatus,setNewStatus]=useState<Tenant['status']>('trial')

  function F(k:string,v:string){setForm(f=>({...f,[k]:v}))}
  function showToast(m:string){setToast(m);setTimeout(()=>setToast(''),3500)}

  async function load(){
    setLoading(true)
    const [tr,pr]=await Promise.all([fetch('/api/tenants').then(r=>r.json()),fetch('/api/plans').then(r=>r.json())])
    if(tr.success)setTenants(tr.data)
    if(pr.success)setPlans(pr.data)
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  async function saveNew(e:React.FormEvent){
    e.preventDefault();setSaving(true)
    const r=await fetch('/api/tenants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const d=await r.json();setSaving(false)
    if(d.success){setShowNew(false);load();showToast('✓ Empresa provisionada!')}
    else showToast(`Erro: ${d.error}`)
  }

  async function saveStatus(){
    if(!statusOf)return
    await fetch(`/api/tenants/${statusOf.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:newStatus})})
    setStatusOf(null);load();showToast('✓ Status atualizado')
  }

  const filtered=tenants.filter(t=>!search||t.name.toLowerCase().includes(search.toLowerCase())||t.email.toLowerCase().includes(search.toLowerCase()))
  const planName=(id:string)=>plans.find(p=>p.id===id)?.name??'—'

  const th={padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'.07em',color:'var(--txt-3)',textAlign:'left' as const,background:'var(--bg-card)',position:'sticky' as const,top:0,zIndex:5,borderBottom:'1px solid var(--border)'}
  const td={padding:'12px 16px',fontSize:13,color:'var(--txt-2)',verticalAlign:'middle' as const}

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,flexShrink:0,background:'var(--bg-card)',flexWrap:'wrap'}}>
        <div style={{flex:1}}>
          <div className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)'}}>Empresas (Tenants)</div>
          <div style={{fontSize:11,color:'var(--txt-2)',marginTop:2}}>{tenants.length} empresas · {tenants.filter(t=>t.status==='active').length} ativas</div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empresa..." style={{padding:'8px 12px',borderRadius:8,fontSize:13,width:200}}/>
        <button onClick={()=>setShowNew(true)} className="btn-neon" style={{padding:'9px 16px',fontSize:13}}>+ Provisionar</button>
        <button onClick={load} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--txt-2)',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>↻</button>
      </div>

      {/* Stats */}
      <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:24,flexShrink:0,background:'var(--bg-card)'}}>
        {[['Total',tenants.length,'var(--txt)'],['Ativos',tenants.filter(t=>t.status==='active').length,'#10B981'],['Trial',tenants.filter(t=>t.status==='trial').length,'#F59E0B'],['Inativos',tenants.filter(t=>t.status==='inactive').length,'#EF4444']].map(([l,v,c])=>(
          <div key={String(l)} style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="font-display" style={{fontSize:22,fontWeight:700,color:String(c)}}>{v}</span>
            <span style={{fontSize:12,color:'var(--txt-3)'}}>{l}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{flex:1,overflowY:'auto'}}>
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:10,color:'var(--txt-2)'}}><span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando...</span></div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Empresa','Contato','Plano','Status','Instância WA','Criado','Ações'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id} style={{borderBottom:'1px solid var(--border)',transition:'background .12s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>
                  <td style={td}><div style={{fontWeight:500,color:'var(--txt)'}}>{t.name}</div><div style={{fontSize:11,color:'var(--txt-3)',fontFamily:'monospace'}}>{t.id.slice(0,14)}…</div></td>
                  <td style={td}><div>{t.email}</div><div style={{fontSize:11,color:'var(--txt-3)'}}>{t.phone}</div></td>
                  <td style={td}>{planName(t.planId)}</td>
                  <td style={td}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:100,background:`${ST_CLR[t.status]}18`,border:`1px solid ${ST_CLR[t.status]}40`,color:ST_CLR[t.status]}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:ST_CLR[t.status]}}/>{ST_LBL[t.status]}
                    </span>
                  </td>
                  <td style={{...td,fontFamily:'monospace',fontSize:11}}>{t.evolutionInstance||'—'}</td>
                  <td style={{...td,fontSize:12}}>{fmtDate(t.createdAt)}</td>
                  <td style={td}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setStatusOf(t);setNewStatus(t.status)}} className="btn-outline" style={{padding:'5px 10px',fontSize:11,borderRadius:6}}>Status</button>
                      <button onClick={async()=>{
                        if(!confirm(`Configurar webhook para ${t.name}?`))return
                        const r=await fetch('/api/evolution/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceName:t.evolutionInstance})})
                        const d=await r.json()
                        showToast(d.success?'✓ Webhook configurado':`Erro: ${d.error}`)
                      }} className="btn-outline" style={{padding:'5px 10px',fontSize:11,borderRadius:6}}>Webhook</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal provisionar */}
      {showNew&&(
        <Modal title="Provisionar nova empresa" onClose={()=>setShowNew(false)}>
          <form onSubmit={saveNew}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:12}}>🏢 Dados da empresa</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Field label="Nome da empresa" value={form.name} onChange={v=>F('name',v)} placeholder="TrackerMap"/>
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5}}>Plano</label>
                <select value={form.planId} onChange={e=>F('planId',e.target.value)} style={{width:'100%',padding:'9px 12px',borderRadius:8}}>
                  <option value="">Selecione...</option>
                  {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <Field label="E-mail" value={form.email} onChange={v=>F('email',v)} type="email"/>
              <Field label="Telefone" value={form.phone} onChange={v=>F('phone',v)} placeholder="5571999999999"/>
            </div>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:12,marginTop:8}}>👤 Supervisor</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Field label="Nome" value={form.supervisorName} onChange={v=>F('supervisorName',v)}/>
              <Field label="E-mail" value={form.supervisorEmail} onChange={v=>F('supervisorEmail',v)} type="email"/>
            </div>
            <Field label="Senha inicial" value={form.supervisorPassword} onChange={v=>F('supervisorPassword',v)} type="password"/>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:12,marginTop:8}}>⚙️ Infraestrutura</p>
            <Field label="ID da planilha do tenant" value={form.spreadsheetId} onChange={v=>F('spreadsheetId',v)} placeholder="1abc...xyz"/>
            <Field label="Instância Evolution API" value={form.evolutionInstance} onChange={v=>F('evolutionInstance',v)} placeholder="empresa-nome"/>
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button type="button" onClick={()=>setShowNew(false)} className="btn-outline" style={{flex:1,padding:'10px',fontSize:13}}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn-neon" style={{flex:1,padding:'10px',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {saving?<><span className="spinner" style={{width:14,height:14}}/>Provisionando...</>:'Provisionar →'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal status */}
      {statusOf&&(
        <Modal title={`Status — ${statusOf.name}`} onClose={()=>setStatusOf(null)}>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
            {(['active','trial','inactive'] as Tenant['status'][]).map(s=>(
              <label key={s} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,border:`1px solid ${newStatus===s?'var(--neon-border)':'var(--border)'}`,background:newStatus===s?'var(--neon-dim)':'transparent',cursor:'pointer',transition:'all .15s'}}>
                <input type="radio" name="st" value={s} checked={newStatus===s} onChange={()=>setNewStatus(s)} style={{accentColor:'var(--neon)'}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--txt)',textTransform:'capitalize'}}>{ST_LBL[s]}</div>
                  <div style={{fontSize:11,color:'var(--txt-3)'}}>{s==='active'?'Acesso completo':s==='trial'?'Período de avaliação':'Acesso bloqueado'}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setStatusOf(null)} className="btn-outline" style={{flex:1,padding:'10px',fontSize:13}}>Cancelar</button>
            <button onClick={saveStatus} className="btn-neon" style={{flex:1,padding:'10px',fontSize:13}}>Salvar</button>
          </div>
        </Modal>
      )}

      {toast&&<div className="toast-base">{toast}</div>}
    </div>
  )
}
