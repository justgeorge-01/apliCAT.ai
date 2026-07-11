// Essay editor: «Мои эссе» (стартовые задания) + «Банк эссе» (вузы из приоритетов)
// Requirements per university/program come from window.getEssayRequirements (src/essayReqs.js)
const ESSAY_PROMPTS = [
  { id: 'ps_bocconi', uniId: 'u1', target: 'Bocconi · Personal Statement' },
  { id: 'sop_lse', uniId: 'u2', target: 'LSE · Statement of Purpose' },
  { id: 'mot_hec', uniId: 'u3', target: 'HEC · Motivation Letter' },
];

const SAMPLE_ESSAY = `My fascination with economics did not start in a lecture hall. It began on a Saturday afternoon in my mother's small bakery in Tashkent, watching her decide whether to raise the price of a loaf by twenty cents. I was eleven, and I already understood that this number could feed my brother for a week — or send our regular customer back home empty-handed. That moment planted a question I have been chasing ever since: how do markets, so abstract on paper, translate into the everyday choices of real families?

At Lyceum №1, I built my schedule around this question. I won the regional Olympiad in Mathematics, took two extracurricular courses in microeconomics through a partnership with HSE, and led a research project on inflation expectations among small business owners in our city. I learned that good economics requires not just elegant equations but also the humility to listen to the people behind the data.`;

const essayUniById = (id) => AdmiticaData.universities.find((u) => u.id === id);

// Build initial drafts map: migrate legacy per-key storage, default Bocconi to sample.
const initialDrafts = () => {
  const map = {};
  ESSAY_PROMPTS.forEach((p) => {
    let saved = null;
    try {
      const s = localStorage.getItem('admitica.essay_' + p.id);
      if (s != null) saved = JSON.parse(s);
    } catch {}
    const isBocconi = p.id === ESSAY_PROMPTS[0].id;
    if (saved != null && !(isBocconi && !String(saved).trim())) map[p.id] = saved;
    else if (isBocconi) map[p.id] = SAMPLE_ESSAY;
    else map[p.id] = '';
  });
  return map;
};

// Requirements panel: the task itself + what this exact university expects
const EssayReqsPanel = ({ uni }) => {
  if (!uni || !window.getEssayRequirements) return null;
  const req = window.getEssayRequirements(uni);
  return (
    <div className="essay-prompt">
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Задача · {req.type} · до {req.wordLimit} слов
      </div>
      <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{req.prompt}</p>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 6px' }}>
        Требования {uni.name}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6, fontSize: 12.5 }}>
        {req.requirements.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      {req.tips && req.tips.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 6px' }}>
            Советы
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6, fontSize: 12.5, color: 'var(--stone-2)' }}>
            {req.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </>
      )}
    </div>
  );
};

const Essay = ({ priorities = [] }) => {
  const [mode, setMode] = useState('mine'); // 'mine' | 'bank'
  const [activePromptId, setActivePromptId] = useState(ESSAY_PROMPTS[0].id);
  const [bankUniId, setBankUniId] = useState(null);
  const [drafts, setDrafts] = usePersist('essayDrafts', initialDrafts());
  const [feedback, setFeedback] = useState([
    { type: 'flow', txt: 'Сильное открывающее предложение с конкретной сценой. Это заметно выделяет вас среди абстрактных вступлений.' },
    { type: 'concrete', txt: 'Хороший переход от личной истории к академической мотивации. Можно усилить, добавив конкретный результат олимпиады (например, «вошёл в топ-5%»).' },
    { type: 'gap', txt: 'Не хватает связки с программой Bocconi. Какие конкретные курсы или преподаватели вас интересуют? Это покажет fit с программой.' },
  ]);
  const [loading, setLoading] = useState(false);
  const showToast = React.useContext(ToastCtx);

  // Active context: either a starter prompt or a bank university
  const activePrompt = ESSAY_PROMPTS.find((p) => p.id === activePromptId);
  const bankUni = bankUniId ? essayUniById(bankUniId) : null;
  const editingBank = mode === 'bank' && bankUni;
  const draftKey = editingBank ? 'uni_' + bankUni.id : activePromptId;
  const ctxUni = editingBank ? bankUni : essayUniById(activePrompt.uniId);
  const req = ctxUni && window.getEssayRequirements ? window.getEssayRequirements(ctxUni) : null;

  const text = drafts[draftKey] != null ? drafts[draftKey] : '';
  const setText = (val) => setDrafts((d) => ({ ...d, [draftKey]: val }));
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const target = req ? req.wordLimit : 1000;
  const exportTitle = editingBank ? `${bankUni.name} — ${req ? req.type : 'Essay'}` : activePrompt.target;

  // Priority universities for the bank
  const bankUnis = priorities.map(essayUniById).filter(Boolean);

  const askAI = async () => {
    setLoading(true);
    try {
      const taskText = req ? `${req.type} для ${ctxUni.name} (${ctxUni.program}). ${req.prompt}` : 'Admissions essay.';
      const reply = await window.ai.complete(
        `Ты редактор admissions essays. Дай 3 коротких практических замечания (по 1-2 предложения) к этому тексту с учётом требований конкретного вуза, в JSON-массиве с ключами "type" (flow/concrete/gap/grammar/fit) и "txt". Без markdown, только JSON.

Задание: ${taskText}

Текст:
${text}`
      );
      const arr = window.ai.extractJson(reply);
      if (Array.isArray(arr) && arr.length) {
        setFeedback(arr.slice(0, 4));
        showToast('AI-замечания обновлены');
      } else {
        showToast('Не удалось разобрать ответ AI');
      }
    } catch (e) {
      showToast('Ошибка AI: ' + (e.message || ''));
    }
    setLoading(false);
  };

  return (
    <div className="fade-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Редактор эссе</h1>
          <div className="page-sub">AI поможет с структурой, конкретикой и грамматикой. Черновики сохраняются автоматически.</div>
        </div>
        <div className="row gap-8">
          <button className="btn btn-ghost" onClick={() => window.downloadEssayDocx(exportTitle, text)}>
            <Ico.dl w={13} /> DOCX
          </button>
          <button className="btn btn-ghost" onClick={() => window.downloadEssayPdf(exportTitle, text)}>
            <Ico.dl w={13} /> PDF
          </button>
          <button className="btn btn-blue" onClick={askAI} disabled={loading}>
            <Ico.sparkle w={13} /> {loading ? 'AI думает…' : 'Запросить AI-фидбэк'}
          </button>
        </div>
      </div>

      <div className="subtabs">
        <button className={`subtab ${mode === 'mine' ? 'active' : ''}`} onClick={() => setMode('mine')}>Мои эссе</button>
        <button className={`subtab ${mode === 'bank' ? 'active' : ''}`} onClick={() => setMode('bank')}>Банк эссе</button>
      </div>

      {mode === 'bank' && !bankUni ? (
        bankUnis.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60 }}>
            <Ico.star w={36} />
            <h3 style={{ marginTop: 16, fontSize: 18 }}>В приоритетах пока нет вузов</h3>
            <p className="muted" style={{ marginTop: 8 }}>Добавьте университеты в приоритеты — для каждого здесь появится эссе с требованиями программы</p>
          </div>
        ) : (
          <>
            <div className="muted mb-16" style={{ fontSize: 13 }}>
              Эссе под каждый вуз из ваших приоритетов — с требованиями конкретной программы.
            </div>
            <div className="grid-3">
              {bankUnis.map((u) => {
                const dk = 'uni_' + u.id;
                const wc = (drafts[dk] || '').trim().split(/\s+/).filter(Boolean).length;
                const lim = window.getEssayRequirements ? window.getEssayRequirements(u).wordLimit : 1000;
                return (
                  <div key={u.id} className="card bank-card" onClick={() => setBankUniId(u.id)}>
                    <div className="row gap-12" style={{ alignItems: 'center' }}>
                      <div className="u-logo" style={{ background: u.color, width: 40, height: 40, fontSize: 16 }}>{u.initial}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{u.program}</div>
                      </div>
                    </div>
                    <div className="row-between" style={{ marginTop: 12 }}>
                      <span className="muted" style={{ fontSize: 12 }}>{wc} / {lim} слов</span>
                      <span className={deadlinePill(u.deadlineDays).cls}>{deadlinePill(u.deadlineDays).txt}</span>
                    </div>
                    <div className="progbar" style={{ marginTop: 8 }}>
                      <span style={{ width: Math.min(100, (wc / lim) * 100) + '%' }}></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        <div className="essay-grid">
          <div>
            {editingBank ? (
              <div className="card mb-16">
                <button className="btn-link" onClick={() => setBankUniId(null)} style={{ marginBottom: 10 }}>
                  ← Все вузы банка
                </button>
                <div className="row gap-12" style={{ alignItems: 'center' }}>
                  <div className="u-logo" style={{ background: bankUni.color, width: 40, height: 40, fontSize: 16 }}>{bankUni.initial}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{bankUni.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{bankUni.program} · дедлайн {bankUni.deadline}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card mb-16">
                <h3 className="section-h">Эссе</h3>
                <div className="col gap-8">
                  {ESSAY_PROMPTS.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setActivePromptId(p.id)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: activePromptId === p.id ? 'rgba(15,110,86,0.07)' : 'transparent',
                        border: '1px solid ' + (activePromptId === p.id ? 'var(--teal)' : 'var(--border)'),
                      }}
                    >
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.target}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {p.id === activePromptId ? `${wordCount} / ${target} слов` : 'Черновик'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <EssayReqsPanel uni={ctxUni} />
          </div>

          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="essay-toolbar">
                <button className="essay-tool"><Ico.bold w={14} /></button>
                <button className="essay-tool"><Ico.italic w={14} /></button>
                <button className="essay-tool"><Ico.list w={14} /></button>
                <div style={{ flex: 1 }}></div>
                <span className="muted" style={{ fontSize: 12, padding: '6px 10px' }}>
                  {wordCount} / {target} слов
                </span>
              </div>
              <textarea
                className="essay-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Начните печатать ваше эссе..."
              />
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, fontSize: 12, color: 'var(--stone-2)' }}>
                <span>Сохранено автоматически</span>
                <div className="progbar" style={{ flex: 1 }}>
                  <span style={{ width: Math.min(100, (wordCount / target) * 100) + '%' }}></span>
                </div>
              </div>
            </div>

            <div className="essay-feedback">
              <div className="row gap-8 mb-16">
                <Ico.sparkle w={14} />
                <strong style={{ fontSize: 13, color: 'var(--purple-dark)' }}>AI-замечания</strong>
              </div>
              {feedback.map((f, i) => (
                <div className="feedback-item" key={i}>
                  <span className="ai-tag">{f.type}</span>
                  {f.txt}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

window.Essay = Essay;
