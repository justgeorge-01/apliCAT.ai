// Home tab
const QUOTES = [
  { t: 'Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.', a: 'Китайская пословица' },
  { t: 'Вы становитесь тем, во что верите.', a: 'Опра Уинфри' },
  { t: 'Образование — это самое мощное оружие, которым вы можете изменить мир.', a: 'Нельсон Мандела' },
  { t: 'Не бойтесь медленно идти — бойтесь стоять на месте.', a: 'Конфуций' },
  { t: 'Качество — это не действие, это привычка.', a: 'Аристотель' },
  { t: 'Дисциплина — это мост между целями и достижениями.', a: 'Джим Рон' },
];

const Streak = ({ streak }) => {
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  return (
    <div className="card card-pad-lg">
      <div className="row-between mb-16">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500 }}>
            Ежедневный стрик
          </h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд — продолжайте!
          </div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 500, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.flame w={28} />{streak}
        </div>
      </div>
      <div className="streak-row">
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div className={`streak-day ${i < today ? 'done' : ''} ${i === today ? 'done today' : ''}`}>
              {i <= today ? <Ico.check w={14} /> : i + 1}
            </div>
            <div style={{ fontSize: 11, color: 'var(--stone-2)', marginTop: 6 }}>{d}</div>
          </div>
        ))}
      </div>
      <div className="streak-msg">
        <span className="flame">🔥</span>
        <div>
          <b style={{ fontWeight: 500 }}>Вы пропустили вчера.</b>{' '}
          <span className="muted">Сегодняшняя сессия защитит ваш стрик.</span>
        </div>
      </div>
    </div>
  );
};

const GoalTracker = ({ roadmaps, savedIds, setTab }) => {
  // Find item by id across all data
  const findItem = (id) =>
    AdmiticaData.universities.find((u) => u.id === id) ||
    AdmiticaData.grants.find((g) => g.id === id) ||
    AdmiticaData.internships.find((i) => i.id === id);

  // Average checklist-based progress across all roadmaps
  const progs = roadmaps
    .map((r) => ({ r, item: findItem(r.itemId) }))
    .filter((x) => x.item)
    .map((x) => ({ ...x, p: roadmapProgress(x.r, x.item) }));
  const pct = progs.length
    ? Math.round(progs.reduce((s, x) => s + x.p.pct, 0) / progs.length)
    : 0;
  const current = progs[0] || null;
  const currentItem = current ? current.item : null;

  return (
    <div
      className="card card-pad-lg"
      style={{
        background: 'linear-gradient(140deg, var(--mid-blue-dark) 0%, var(--mid-blue) 100%)',
        color: 'white',
        border: 'none',
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Цель — поступление
      </div>
      <div className="goal-pct" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {pct}<span style={{ fontSize: 22, opacity: 0.7, fontWeight: 400 }}>%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal-light)', borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, opacity: 0.95 }}>
          {currentItem ? (
            <>
              Сейчас: <b style={{ fontWeight: 600 }}>{currentItem.name}</b>
              <br />
              <span style={{ opacity: 0.8 }}>
                Этап {Math.min(current.p.done + 1, current.p.total)} из {current.p.total}
                {current.p.currentName ? ` — ${current.p.currentName}` : ' — всё выполнено'}
              </span>
            </>
          ) : (
            <>
              Добавь вуз в приоритеты, чтобы начать отслеживать прогресс по роадмапу.
            </>
          )}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => setTab(currentItem ? 'p_priority' : 'find')}
          style={{ background: 'rgba(255,255,255,0.18)', color: 'white', flexShrink: 0 }}
        >
          {currentItem ? 'Открыть' : 'Найти'}
        </button>
      </div>
    </div>
  );
};

const Quote = () => {
  const [i, setI] = usePersist('quoteIdx', 0);
  const q = QUOTES[i % QUOTES.length];
  return (
    <div className="quote-card">
      <button className="quote-refresh" onClick={() => setI(i + 1)} title="Другая цитата">
        <Ico.refresh w={16} />
      </button>
      <div className="quote-label">Цитата дня</div>
      <div className="quote-text">«{q.t}»</div>
      <div className="quote-author">— {q.a}</div>
    </div>
  );
};

const Home = ({ name, priorities, savedIds, roadmaps, setTab, openDetail }) => {
  const today = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  })();

  // Top priorities = first 3 saved with priority
  const topPrio = priorities.slice(0, 3).map((id) => {
    return AdmiticaData.universities.find((u) => u.id === id) ||
           AdmiticaData.grants.find((g) => g.id === id) ||
           AdmiticaData.internships.find((i) => i.id === id);
  }).filter(Boolean);

  // Closest deadlines
  const allItems = [
    ...AdmiticaData.universities.filter((u) => savedIds.includes(u.id)),
    ...AdmiticaData.grants.filter((g) => savedIds.includes(g.id)),
    ...AdmiticaData.internships.filter((i) => savedIds.includes(i.id)),
  ].sort((a, b) => a.deadlineDays - b.deadlineDays);
  const upcoming = allItems.filter((x) => x.deadlineDays > 0 && x.deadlineDays < 900).slice(0, 3);

  return (
    <div className="fade-page">
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{today}</div>
          <h1 className="page-title">{greeting}, {name} 👋</h1>
        </div>
        <button className="btn btn-blue" onClick={() => setTab('find')}>
          <Ico.add w={14} /> Подобрать программу
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <Streak streak={4} />
        <GoalTracker roadmaps={roadmaps} savedIds={savedIds} setTab={setTab} />
        <Quote />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad-lg">
          <div className="row-between mb-16">
            <h3 style={{ fontSize: 16, fontWeight: 500 }}>Ваши приоритеты</h3>
            <button className="btn-link" onClick={() => setTab('p_priority')}>Все →</button>
          </div>
          {topPrio.length === 0 ? (
            <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
              Сохраните программу и отметьте её как приоритетную, чтобы она появилась здесь
            </div>
          ) : (
            <div className="prio-list">
              {topPrio.map((p, i) => (
                <div className="prio-item" key={p.id} onClick={() => openDetail(p)}>
                  <div className="prio-num">{i + 1}</div>
                  <div className="prio-info">
                    <div className="prio-title">{p.name}</div>
                    <div className="prio-prog">{p.program || p.role || p.org}</div>
                  </div>
                  <div className="prio-meta">
                    <span className={deadlinePill(p.deadlineDays).cls}>{deadlinePill(p.deadlineDays).txt}</span>
                  </div>
                  <span className="prio-arrow"><Ico.chev w={14} /></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad-lg">
          <div className="row-between mb-16">
            <h3 style={{ fontSize: 16, fontWeight: 500 }}>Ближайшие дедлайны</h3>
            <Pill kind="amber">{upcoming.length} активных</Pill>
          </div>
          {upcoming.length === 0 ? (
            <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
              Нет приближающихся дедлайнов
            </div>
          ) : (
            <div className="prio-list">
              {upcoming.map((p) => (
                <div className="prio-item" key={p.id} onClick={() => openDetail(p)}>
                  <div className="prio-num" style={{ background: 'var(--amber)' }}>
                    <Ico.cal w={14} />
                  </div>
                  <div className="prio-info">
                    <div className="prio-title">{p.name}</div>
                    <div className="prio-prog">{p.deadline}</div>
                  </div>
                  <span className={deadlinePill(p.deadlineDays).cls}>{deadlinePill(p.deadlineDays).txt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Section title="Прогресс по этапам">
        <div className="grid-3">
          <div className="card summary-card">
            <span className="label">Поиск программ</span>
            <div className="lead">{savedIds.length} сохранено</div>
            <div className="body">
              {savedIds.length < 5
                ? 'Рекомендуем сохранить 8–12 программ для shortlist'
                : 'Хороший shortlist — теперь приоритизируйте'}
            </div>
            <div className="progress"><span style={{ width: Math.min(100, savedIds.length * 10) + '%' }}></span></div>
          </div>
          <div className="card summary-card">
            <span className="label">Эссе</span>
            <div className="lead">2 черновика</div>
            <div className="body">Personal Statement для Bocconi — 760/1000 слов. Откройте редактор, чтобы продолжить.</div>
            <button className="btn-link" onClick={() => setTab('essay')}>Открыть редактор →</button>
          </div>
          <div className="card summary-card">
            <span className="label">Резюме</span>
            <div className="lead">2 достижения</div>
            <div className="body">AI-помощник поможет оформить опыт в bullet points для европейских CV.</div>
            <button className="btn-link" onClick={() => setTab('resume')}>Открыть конструктор →</button>
          </div>
        </div>
      </Section>
    </div>
  );
};

window.Home = Home;
