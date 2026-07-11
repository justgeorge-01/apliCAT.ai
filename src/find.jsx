// Find Program tab — universities, grants, internships

const UniCard = ({ u, saved, prio, toggleSave, togglePrio, onOpen }) => {
  const dp = deadlinePill(u.deadlineDays);
  const isUni = !!u.program;
  const isGrant = !!u.funding;
  return (
    <div className="u-card">
      <div className="u-head">
        <div className="u-logo" style={{ background: u.color }}>{u.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="u-name">{u.name}</div>
          <div className="u-program">
            {isUni ? u.program : isGrant ? u.org : u.role}
          </div>
        </div>
        <button className={`u-heart ${saved ? 'on' : ''}`} onClick={() => toggleSave(u.id)} title={saved ? 'В избранном' : 'Сохранить'}>
          <Ico.heart w={20} on={saved} />
        </button>
      </div>

      <div className="u-meta-row">
        <span className="mt"><Ico.pin w={13} /> {u.flag} {u.city || u.country}</span>
        {u.degree && <span className="mt"><Ico.cap w={13} /> {u.degree}</span>}
        {u.duration && <span className="mt"><Ico.cal w={13} /> {u.duration}</span>}
        <span className="mt"><Ico.cash w={13} /> {u.tuition || u.amount || u.stipend}</span>
      </div>

      <div className="u-tags">
        <span className="tag">{u.field || u.industry}</span>
        {u.language && <span className="tag">{u.language}</span>}
        {u.scholarship && <span className="pill pill-teal">Гранты</span>}
        {u.format && <span className="tag">{u.format}</span>}
      </div>

      <div className="u-desc">{u.desc}</div>

      <div className="u-foot">
        <span className={dp.cls}>
          <Ico.cal w={11} />{dp.txt}
        </span>
        <div className="row gap-8">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => togglePrio(u.id)}
            style={prio ? { color: 'var(--amber)', borderColor: 'var(--amber)' } : {}}
          >
            <Ico.star w={13} on={prio} />
            {prio ? 'Приоритет' : 'В приоритеты'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onOpen(u)}>
            Подробнее <Ico.arrowRight w={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ kind, filters, setFilters, countries, fields }) => {
  const update = (key, val) => setFilters({ ...filters, [key]: val });
  const toggle = (key, val) => {
    const cur = filters[key] || [];
    update(key, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  };

  return (
    <div className="card filter-panel">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}><Ico.filter w={14} /> Фильтры</strong>
        <button className="filter-clear" onClick={() => setFilters({})}>Сбросить</button>
      </div>

      <div className="filter-h">Страна</div>
      <select
        className="filter-sel"
        value={filters.country || ''}
        onChange={(e) => update('country', e.target.value || null)}
      >
        <option value="">Все страны</option>
        {countries.slice(0, 20).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <div className="filter-h">Направление</div>
      <select
        className="filter-sel"
        value={filters.field || ''}
        onChange={(e) => update('field', e.target.value || null)}
      >
        <option value="">Все направления</option>
        {fields.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      {kind === 'uni' && (
        <>
          <div className="filter-h">Уровень</div>
          {['Бакалавриат', 'Магистратура', 'PhD'].map((d) => (
            <label key={d} className="filter-check">
              <input type="checkbox" checked={(filters.degree || []).includes(d)} onChange={() => toggle('degree', d)} />
              {d}
            </label>
          ))}

          <div className="filter-h">Стоимость до (€/год)</div>
          <input
            type="range" min="0" max="50000" step="1000"
            value={filters.maxTuition || 50000}
            onChange={(e) => update('maxTuition', +e.target.value)}
          />
          <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
            до €{(filters.maxTuition || 50000).toLocaleString()}
          </div>
        </>
      )}

      {kind === 'grant' && (
        <>
          <div className="filter-h">Уровень покрытия</div>
          {['Полное', 'Частичное'].map((f) => (
            <label key={f} className="filter-check">
              <input type="checkbox" checked={(filters.funding || []).includes(f)} onChange={() => toggle('funding', f)} />
              {f}
            </label>
          ))}
        </>
      )}

      {kind === 'intern' && (
        <>
          <div className="filter-h">Формат</div>
          {['Очно', 'Гибрид', 'Очно / Гибрид'].map((f) => (
            <label key={f} className="filter-check">
              <input type="checkbox" checked={(filters.format || []).includes(f)} onChange={() => toggle('format', f)} />
              {f}
            </label>
          ))}
        </>
      )}

      <div className="filter-h">Дополнительно</div>
      <div className="filter-toggle">
        <span>Только со стипендиями</span>
        <div className={`switch ${filters.onlyScholarship ? 'on' : ''}`} onClick={() => update('onlyScholarship', !filters.onlyScholarship)}></div>
      </div>
      <div className="filter-toggle">
        <span>Скрыть с истёкшим дедлайном</span>
        <div className={`switch ${filters.hideExpired ? 'on' : ''}`} onClick={() => update('hideExpired', !filters.hideExpired)}></div>
      </div>
    </div>
  );
};

const Find = ({ saved, priorities, toggleSave, togglePrio, openDetail }) => {
  const [kind, setKind] = useState('uni');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('deadline');

  const dataMap = {
    uni: AdmiticaData.universities,
    grant: AdmiticaData.grants,
    intern: AdmiticaData.internships,
  };

  let items = dataMap[kind].filter((it) => {
    if (q && !(it.name + ' ' + (it.program || '') + ' ' + (it.field || it.industry || '') + ' ' + it.country).toLowerCase().includes(q.toLowerCase())) return false;
    if (filters.country && it.country !== filters.country) return false;
    if (filters.field && (it.field || it.industry) !== filters.field) return false;
    if (filters.degree && filters.degree.length && !filters.degree.includes(it.degree)) return false;
    if (filters.funding && filters.funding.length && !filters.funding.includes(it.funding)) return false;
    if (filters.format && filters.format.length && !filters.format.includes(it.format)) return false;
    if (filters.maxTuition && (it.tuitionMax || 0) > filters.maxTuition) return false;
    if (filters.onlyScholarship && !it.scholarship) return false;
    if (filters.hideExpired && it.deadlineDays <= 0) return false;
    return true;
  });

  if (sort === 'deadline') items = [...items].sort((a, b) => a.deadlineDays - b.deadlineDays);
  if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'tuition') items = [...items].sort((a, b) => (a.tuitionMax || 0) - (b.tuitionMax || 0));

  return (
    <div className="fade-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Подобрать программу</h1>
          <div className="page-sub">35 университетов · 35 грантов · 35 стажировок в Европе</div>
        </div>
      </div>

      <div className="subtabs">
        <button className={`subtab ${kind === 'uni' ? 'active' : ''}`} onClick={() => { setKind('uni'); setFilters({}); }}>
          <Ico.cap w={14} /> Университеты
        </button>
        <button className={`subtab ${kind === 'grant' ? 'active' : ''}`} onClick={() => { setKind('grant'); setFilters({}); }}>
          <Ico.bolt w={14} /> Гранты
        </button>
        <button className={`subtab ${kind === 'intern' ? 'active' : ''}`} onClick={() => { setKind('intern'); setFilters({}); }}>
          <Ico.briefcase w={14} /> Стажировки
        </button>
      </div>

      <div className="row gap-12 mb-24 find-search-row" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--stone-2)' }}>
            <Ico.search w={16} />
          </div>
          <input
            className="ob-input"
            style={{ paddingLeft: 40, fontSize: 14, padding: '11px 14px 11px 40px', width: '100%' }}
            placeholder={`Поиск ${kind === 'uni' ? 'университета' : kind === 'grant' ? 'гранта' : 'стажировки'}...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="ob-input"
          style={{ width: 'auto', minWidth: 150, maxWidth: 220, flexShrink: 1, fontSize: 13 }}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="deadline">По дедлайну</option>
          <option value="name">По названию</option>
          {kind === 'uni' && <option value="tuition">По стоимости</option>}
        </select>
      </div>

      <div className="find-layout">
        <FilterPanel
          kind={kind}
          filters={filters}
          setFilters={setFilters}
          countries={AdmiticaData.countries}
          fields={[...new Set(AdmiticaData.universities.map((u) => u.field))].sort()}
        />

        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Найдено: <b style={{ color: 'var(--stone)', fontWeight: 500 }}>{items.length}</b>
            {q && <> по запросу «{q}»</>}
          </div>
          <div className="find-cards">
            {items.map((u) => (
              <UniCard
                key={u.id}
                u={u}
                saved={saved.includes(u.id)}
                prio={priorities.includes(u.id)}
                toggleSave={toggleSave}
                togglePrio={togglePrio}
                onOpen={openDetail}
              />
            ))}
          </div>
          {items.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--stone-2)' }}>
              Ничего не найдено. Попробуйте изменить фильтры.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.Find = Find;
window.UniCard = UniCard;
