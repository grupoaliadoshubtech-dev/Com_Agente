'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan } from '@/types'
import { IcoCheckCircle, IcoClipboard } from '@/components/icons'

type Step = 'form' | 'loading' | 'success'

export default function CadastroPage(){
  const router = useRouter()
  const [step,    setStep]    =useState<Step>('form')
  const [plans,   setPlans]   =useState<Plan[]>([])
  const [planLoad,setPlanLoad]=useState(true)
  const [selPlan, setSelPlan] =useState<Plan|null>(null)
  const [error,   setError]   =useState('')
  const [name,    setName]    =useState('')
  const [email,   setEmail]   =useState('')
  const [phone,   setPhone]   =useState('')
  const [company, setCompany] =useState('')

  useEffect(()=>{
    const saved=localStorage.getItem('aad-theme')?? 'dark'
    document.documentElement.setAttribute('data-theme',saved)
    fetch('/api/plans').then(r=>r.json()).then(d=>{if(d.success)setPlans(d.data)}).finally(()=>setPlanLoad(false))
  },[])

  async function submit(e:React.FormEvent){
    e.preventDefault();setError('')
    if(!selPlan){setError('Selecione um plano para continuar.');return}
    setStep('loading')
    try{
      const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,phone,company,planId:selPlan.id})})
      const d=await r.json()
      if(!d.success){setError(d.error??'Erro ao enviar');setStep('form');return}
      setStep('success')
    }catch{setError('Erro de conexão');setStep('form')}
  }

  function fmtPrice(p:Plan){return p.price===0?'Sob consulta':`R$ ${(p.price/100).toLocaleString('pt-BR',{minimumFractionDigits:2})}`}

  const labelStyle={display:'block',fontSize:12,fontWeight:600,color:'var(--txt-2)',marginBottom:5} as const
  const inputStyle={width:'100%',padding:'10px 14px'} as const

  if(step==='success') return (
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:'var(--bg)'}}>
      <div style={{textAlign:'center',maxWidth:480,animation:'slideUp .3s ease'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'var(--neon-dim)',border:'1px solid var(--neon-border)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',color:'var(--neon)'}}><IcoCheckCircle size={32}/></div>
        <h2 className="font-display" style={{fontSize:24,fontWeight:800,color:'var(--txt)',marginBottom:8}}>Solicitação recebida!</h2>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',borderRadius:100,background:'var(--neon-dim)',border:'1px solid var(--neon-border)',color:'var(--neon)',fontSize:13,fontWeight:600,marginBottom:20}}>
          Plano {selPlan?.name}
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--neon-border)',borderRadius:14,padding:24,marginBottom:20,textAlign:'left'}}>
          <strong style={{color:'var(--neon)'}}>O seu atendimento personalizado está sendo construído.</strong>
          <br/><br/>
          <span style={{color:'var(--txt-2)',fontSize:14,lineHeight:1.7}}>Em breve entraremos em contato para te passar mais informações e definirmos juntos os próximos passos da sua operação digital.</span>
        </div>
        <button onClick={()=>router.push('/login')} className="btn-outline" style={{padding:'10px 24px',fontSize:14}}>← Voltar ao início</button>
      </div>
    </main>
  )

  return (
    <main style={{minHeight:'100vh',background:'var(--bg)',padding:24,overflowY:'auto'}}>
      <div style={{maxWidth:660,margin:'0 auto',paddingTop:32}}>
        <button onClick={()=>router.push('/login')} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--txt-2)',background:'none',border:'none',cursor:'pointer',marginBottom:24,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>← Voltar</button>

        {/* Header */}
        <div style={{marginBottom:28}}>
          <h1 className="font-display" style={{fontSize:24,fontWeight:800,color:'var(--txt)',marginBottom:6}}>Comece agora sua jornada</h1>
          <p style={{fontSize:14,color:'var(--txt-2)'}}>Preencha seus dados e escolha o plano ideal para sua operação.</p>
        </div>

        <form onSubmit={submit}>
          {/* Dados */}
          <div className="card" style={{padding:24,marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:16,display:'flex',alignItems:'center',gap:6}}><IcoClipboard size={13}/> Dados do lead</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Nome completo</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="João da Silva" required style={inputStyle}/></div>
              <div><label style={labelStyle}>Empresa</label><input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Sua empresa" required style={inputStyle}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>E-mail profissional</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="joao@empresa.com.br" required style={inputStyle}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>WhatsApp / Telefone</label><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(71) 99999-9999" required style={inputStyle}/></div>
            </div>
          </div>

          {/* Plans */}
          <div style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)'}}>Escolha seu plano</p>
              <div style={{flex:1,height:1,background:'var(--border)'}}/>
            </div>

            {planLoad ? (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'32px',color:'var(--txt-2)',justifyContent:'center'}}>
                <span className="spinner" style={{width:18,height:18}}/><span style={{fontSize:13}}>Carregando planos...</span>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                {plans.map(p=>{
                  const active=selPlan?.id===p.id
                  return (
                    <button key={p.id} type="button" onClick={()=>setSelPlan(p)} style={{
                      textAlign:'left',padding:18,borderRadius:14,cursor:'pointer',position:'relative',
                      border:`1px solid ${active?'var(--neon-border)':'var(--border)'}`,
                      background:active?'var(--neon-dim)':'var(--bg-card)',
                      transition:'all .15s',
                    }}>
                      {active&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'var(--neon)',borderRadius:'14px 14px 0 0'}}/>}
                      {active&&<div style={{position:'absolute',top:10,right:10,width:18,height:18,borderRadius:'50%',background:'var(--neon)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#0a0a0a'}}>✓</div>}
                      <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt-3)',marginBottom:6}}>
                        {p.price===0?'Enterprise':p.maxAttendants>5?'Popular':p.maxInstances===1?'Básico':'Pro'}
                      </p>
                      <p className="font-display" style={{fontSize:16,fontWeight:700,color:'var(--txt)',marginBottom:4}}>{p.name}</p>
                      <p className="font-display" style={{fontSize:22,fontWeight:700,color:'var(--neon)',marginBottom:8}}>
                        {fmtPrice(p)}{p.price>0&&<span style={{fontSize:13,fontWeight:400,color:'var(--txt-3)'}}>/mês</span>}
                      </p>
                      <ul style={{listStyle:'none'}}>
                        {p.features.slice(0,3).map((f,i)=>(
                          <li key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--txt-2)',marginBottom:3}}>
                            <span style={{width:4,height:4,borderRadius:'50%',background:'var(--neon)',flexShrink:0}}/>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error&&<div style={{fontSize:13,color:'var(--danger)',background:'var(--danger-dim)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>{error}</div>}

          <div className="card" style={{padding:20}}>
            <button type="submit" disabled={step==='loading'} className="btn-neon" style={{width:'100%',padding:'13px 20px',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {step==='loading'?<><span className="spinner" style={{width:16,height:16}}/>Enviando...</>:'Solicitar acesso gratuito →'}
            </button>
            <p style={{textAlign:'center',fontSize:11,color:'var(--txt-3)',marginTop:10}}>Sem compromisso. Nossa equipe entrará em contato em até 24h.</p>
          </div>
        </form>
      </div>
    </main>
  )
}
