'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const SECTIONS = [
  {
    title: 'Escopo de Serviços',
    subtitle: 'Defina os limites de atuação da sua empresa',
    questions: [
      'Quais são os principais produtos/serviços que sua empresa oferece hoje?',
      'Existe algum tipo de produto/serviço que a empresa prefere não atender?',
      'Qual o perfil de cliente ideal (porte, segmento, localização)?',
      'Existem pacotes ou serviços específicos para cada perfil de cliente?',
    ],
  },
  {
    title: 'Diferenciação',
    subtitle: 'O que torna sua empresa única',
    questions: [
      'Qual o principal diferencial da sua empresa frente aos concorrentes?',
      'Como funciona a entrega completa do seu serviço/produto (do início ao fim)?',
      'O que sua empresa NÃO oferece ou faz?',
      'Como a IA deve lidar com pedidos fora do escopo da empresa?',
    ],
  },
  {
    title: 'Primeiro Contato',
    subtitle: 'Como a IA recepciona o cliente',
    questions: [
      'Como é feito o primeiro atendimento hoje (presencial, online, telefone)?',
      'Quais informações são coletadas no primeiro contato com o cliente?',
      'Como é feita a qualificação do lead (interesse real vs. curiosidade)?',
      'Existe algum atendimento que só pode ser realizado por um humano?',
    ],
  },
  {
    title: 'Processos: Do Contato ao Fechamento',
    subtitle: 'Fluxo de vendas e proposta',
    questions: [
      'Como é o processo atual de envio de propostas/orçamentos?',
      'Quais informações são ESSENCIAIS para elaborar uma proposta?',
      'Existe um valor ou pedido mínimo para aceitar um cliente?',
      'Quais são as formas e condições de pagamento aceitas?',
    ],
  },
  {
    title: 'Identidade Visual e Posicionamento',
    subtitle: 'A personalidade da sua marca',
    questions: [
      'Como você descreveria a identidade visual e o posicionamento da empresa?',
      'Existe algum estilo ou abordagem que a empresa prefere evitar?',
      'Como o portfólio/catálogo é apresentado hoje aos clientes?',
      'Quais as principais referências ou inspirações da marca?',
    ],
  },
  {
    title: 'Área de Atendimento e Capacidade',
    subtitle: 'Alcance e limitações operacionais',
    questions: [
      'Qual é a área geográfica de atendimento da empresa?',
      'Como funcionam os custos para atendimentos fora da área habitual?',
      'Qual a capacidade máxima de atendimentos simultâneos?',
      'Como é feita a gestão de demanda em períodos de alta procura?',
    ],
  },
  {
    title: 'Regras de Atendimento da IA',
    subtitle: 'Como a IA deve conduzir cada conversa',
    questions: [
      'Qual a sequência ideal de perguntas para qualificar um cliente?',
      'Quais informações a IA deve priorizar para ser mais eficiente?',
      'Como a IA deve lidar com clientes que dão respostas incompletas?',
      'A IA deve insistir, oferecer opções ou acionar um humano?',
    ],
  },
  {
    title: 'Transição: Quando o Humano Deve Assumir?',
    subtitle: 'Sinais de alerta e handoff',
    questions: [
      'Quais são os "sinais de alerta" para acionar um atendente humano?',
      'Em quais situações o atendimento deve ser transferido imediatamente?',
      'Existe um limite de mensagens antes de transferir para um humano?',
      'Como a IA deve se despedir ao transferir o atendimento?',
    ],
  },
  {
    title: 'Autonomia da IA',
    subtitle: 'O que a IA pode resolver sozinha',
    questions: [
      'Quais informações a IA pode fornecer sem auxílio humano (FAQs, prazos, disponibilidade)?',
      'A IA pode enviar catálogos ou portfólios no WhatsApp?',
      'A IA pode falar sobre preços ou deve aguardar o humano?',
      'Como esses materiais devem ser apresentados para encantar o cliente?',
    ],
  },
  {
    title: 'Pós-Venda e Fidelização',
    subtitle: 'Relacionamento além da venda',
    questions: [
      'Como é feito o acompanhamento após a venda ou entrega do serviço?',
      'Existem programas de fidelidade ou benefícios para indicações?',
      'Como a IA pode coletar feedback e depoimentos dos clientes?',
      'Quais diferenciais a IA deve reforçar frente aos concorrentes?',
    ],
  },
  {
    title: 'Tom de Voz e Personalidade da IA',
    subtitle: 'A identidade da sua IA',
    questions: [
      'Qual o tom de voz ideal para a IA da sua empresa (formal, amigável, descontraído)?',
      'A IA deve usar emojis? Com que frequência e estilo?',
      'Existem palavras ou termos técnicos que a IA deve ou não usar?',
      'A IA deve se apresentar com um nome próprio? Se sim, qual?',
    ],
  },
  {
    title: 'Visão de Futuro',
    subtitle: 'Objetivos com a automação',
    questions: [
      'Quais os principais objetivos com a automação do atendimento?',
      'Existe alguma preocupação ética ou de privacidade com os dados?',
      'Como você visualiza o sucesso desse projeto daqui a um ano?',
      'Alguma informação importante sobre sua empresa que ainda não foi mencionada?',
    ],
  },
]

type Status = 'loading' | 'not_found' | 'already_answered' | 'form' | 'submitting' | 'done'

export default function DiagnosticoPage() {
  const { token } = useParams<{ token: string }>()
  const [status,    setStatus]    = useState<Status>('loading')
  const [name,      setName]      = useState('')
  const [company,   setCompany]   = useState('')
  const [current,   setCurrent]   = useState(0)
  const [answers,   setAnswers]   = useState<Record<string, string>>({})
  const [error,     setError]     = useState('')

  useEffect(() => {
    fetch(`/api/diagnostico/${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setStatus('not_found'); return }
        if (d.data.status === 'answered') { setStatus('already_answered'); return }
        setName(d.data.name)
        setCompany(d.data.company)
        setStatus('form')
      })
      .catch(() => setStatus('not_found'))
  }, [token])

  function key(sec: number, q: number) { return `${sec + 1}.${q + 1}` }

  function setAnswer(sec: number, q: number, val: string) {
    setAnswers(prev => ({ ...prev, [key(sec, q)]: val }))
  }

  function sectionComplete(sec: number): boolean {
    return SECTIONS[sec].questions.every((_, q) => (answers[key(sec, q)] ?? '').trim().length > 0)
  }

  async function submit() {
    setError('')
    if (!sectionComplete(current)) {
      setError('Por favor, responda todas as perguntas desta seção antes de continuar.')
      return
    }
    if (current < SECTIONS.length - 1) {
      setCurrent(c => c + 1)
      window.scrollTo(0, 0)
      return
    }
    setStatus('submitting')
    try {
      const r = await fetch(`/api/diagnostico/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: answers }),
      })
      const d = await r.json()
      if (!d.success) { setError(d.error ?? 'Erro ao enviar'); setStatus('form'); return }
      setStatus('done')
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setStatus('form')
    }
  }

  const base: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  }

  if (status === 'loading') return (
    <main style={base}>
      <div style={{ textAlign: 'center', color: 'var(--txt-2)', fontSize: 14 }}>
        <span className="spinner" style={{ width: 24, height: 24, display: 'block', margin: '0 auto 12px' }} />
        Carregando...
      </div>
    </main>
  )

  if (status === 'not_found') return (
    <main style={base}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>Link inválido</h2>
        <p style={{ fontSize: 14, color: 'var(--txt-2)', lineHeight: 1.6 }}>Este link de diagnóstico não existe ou já expirou. Entre em contato com a equipe ComAgente.</p>
      </div>
    </main>
  )

  if (status === 'already_answered') return (
    <main style={base}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>Diagnóstico já respondido</h2>
        <p style={{ fontSize: 14, color: 'var(--txt-2)', lineHeight: 1.6 }}>Você já preencheu este formulário. Nossa equipe está analisando suas respostas e em breve entrará em contato.</p>
      </div>
    </main>
  )

  if (status === 'done') return (
    <main style={base}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(163,230,53,.12)', border: '1px solid rgba(163,230,53,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
        <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', marginBottom: 8 }}>Diagnóstico concluído!</h2>
        <p style={{ fontSize: 14, color: 'var(--txt-2)', lineHeight: 1.7 }}>
          Obrigado, <strong style={{ color: 'var(--txt)' }}>{name.split(' ')[0]}</strong>! Recebemos todas as suas respostas.<br />
          Nossa equipe irá analisar o diagnóstico da <strong style={{ color: 'var(--txt)' }}>{company}</strong> e entrará em contato em breve para dar os próximos passos.
        </p>
      </div>
    </main>
  )

  const sec     = SECTIONS[current]
  const total   = SECTIONS.length
  const progress = Math.round(((current) / total) * 100)

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--txt)', marginBottom: 4 }}>
            Com<span style={{ color: 'var(--neon)' }}>Agente</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>Diagnóstico de Atendimento · {company}</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>Seção {current + 1} de {total}</span>
            <span style={{ fontSize: 12, color: 'var(--neon)', fontWeight: 600 }}>{progress}% concluído</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--neon)', borderRadius: 4, transition: 'width .3s ease' }} />
          </div>
        </div>

        {/* Section card */}
        <div className="card" style={{ padding: '28px 24px', marginBottom: 20 }}>
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--neon)' }}>
              Seção {current + 1}
            </span>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginTop: 4, marginBottom: 4 }}>
              {sec.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>{sec.subtitle}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sec.questions.map((q, qi) => (
              <div key={qi}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 8, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--neon)', marginRight: 6 }}>{current + 1}.{qi + 1}</span>
                  {q}
                </label>
                <textarea
                  value={answers[key(current, qi)] ?? ''}
                  onChange={e => setAnswer(current, qi, e.target.value)}
                  placeholder="Digite sua resposta aqui..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${(answers[key(current, qi)] ?? '').trim() ? 'rgba(163,230,53,.4)' : 'var(--border-md)'}`,
                    background: 'var(--bg-input)',
                    color: 'var(--txt)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    outline: 'none',
                    transition: 'border-color .15s',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          {current > 0 ? (
            <button
              onClick={() => { setCurrent(c => c - 1); window.scrollTo(0, 0) }}
              className="btn-outline"
              style={{ padding: '11px 20px', fontSize: 13 }}>
              ← Anterior
            </button>
          ) : <div />}
          <button
            onClick={submit}
            disabled={status === 'submitting'}
            className="btn-neon"
            style={{ padding: '11px 24px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'submitting'
              ? <><span className="spinner" style={{ width: 14, height: 14 }} />Enviando...</>
              : current < SECTIONS.length - 1
              ? 'Próxima seção →'
              : 'Concluir diagnóstico ✓'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt-3)', marginTop: 20 }}>
          Suas respostas são confidenciais e usadas exclusivamente para configurar seu agente de IA.
        </p>
      </div>
    </main>
  )
}
