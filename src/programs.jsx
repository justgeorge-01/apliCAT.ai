// My Programs: Saved, Priority, Roadmaps
const lookupItem = (id) =>
  AdmiticaData.universities.find((u) => u.id === id) ||
  AdmiticaData.grants.find((g) => g.id === id) ||
  AdmiticaData.internships.find((i) => i.id === id);

const Saved = ({ savedIds, priorities, toggleSave, togglePrio, openDetail }) => {
  const [filter, setFilter] = useState('all');
  let items = savedIds.map(lookupItem).filter(Boolean);
  if (filter === 'uni') items = items.filter((i) => i.program);
  if (filter === 'grant') items = items.filter((i) => i.funding);
  if (filter === 'intern') items = items.filter((i) => i.role);

  return (
    <div>
      <div className="subtabs">
        {[
          { id: 'all', label: 'Все' },
          { id: 'uni', label: 'Университеты' },
          { id: 'grant', label: 'Гранты' },
          { id: 'intern', label: 'Стажировки' },
        ].map((t) => (
          <button key={t.id} className={`subtab ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <Ico.heart w={36} />
          <h3 style={{ marginTop: 16, fontSize: 18 }}>Ничего не сохранено</h3>
          <p className="muted" style={{ marginTop: 8 }}>Найдите программы и нажмите ❤️ на карточке, чтобы они появились здесь</p>
        </div>
      ) : (
        <div className="grid-2">
          {items.map((u) => (
            <UniCard
              key={u.id}
              u={u}
              saved={true}
              prio={priorities.includes(u.id)}
              toggleSave={toggleSave}
              togglePrio={togglePrio}
              onOpen={openDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Priorities merged with per-university roadmaps:
// click a university row -> inline roadmap with dates; click a stage -> details + checklist
const Priority = ({ priorities, setPriorities, togglePrio, roadmaps, setRoadmaps, openDetail }) => {
  const items = priorities.map(lookupItem).filter(Boolean);
  const [expandedId, setExpandedId] = useState(null);
  const [activeStage, setActiveStage] = useState(null); // stage id within expanded roadmap

  const move = (i, dir) => {
    const arr = [...priorities];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPriorities(arr);
  };

  const rmFor = (itemId) => roadmaps.find((r) => r.itemId === itemId);

  const toggleExpand = (p) => {
    if (!p.program) { openDetail(p); return; } // grants/internships: no roadmap, open detail
    if (expandedId === p.id) { setExpandedId(null); return; }
    if (!rmFor(p.id)) {
      setRoadmaps([...roadmaps, { id: 'rm' + Date.now(), itemId: p.id, step: 0, checks: {} }]);
    }
    setExpandedId(p.id);
    setActiveStage(null);
  };

  const toggleCheck = (itemId, stageId, idx) => {
    setRoadmaps(roadmaps.map((r) => {
      if (r.itemId !== itemId) return r;
      const checks = { ...(r.checks || {}) };
      const arr = [...(checks[stageId] || [])];
      arr[idx] = !arr[idx];
      checks[stageId] = arr;
      return { ...r, checks };
    }));
  };

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 60 }}>
        <Ico.star w={36} />
        <h3 style={{ marginTop: 16, fontSize: 18 }}>Список приоритетов пуст</h3>
        <p className="muted" style={{ marginTop: 8 }}>Отметьте программу как приоритетную (звёздочка), чтобы она появилась здесь и в дашборде</p>
      </div>
    );
  }

  return (
    <div>
      <div className="muted mb-16" style={{ fontSize: 13 }}>
        Нажмите на вуз, чтобы раскрыть его роадмап. Стрелками меняйте порядок — топ-3 видны на главной.
      </div>
      <div className="col gap-12">
        {items.map((p, i) => {
          const dp = deadlinePill(p.deadlineDays);
          const isOpen = expandedId === p.id;
          const rm = rmFor(p.id);
          const prog = rm && p.program ? roadmapProgress(rm, p) : null;
          const stages = isOpen && p.program ? buildRoadmapStages(p) : null;
          const stage = stages ? (stages.find((s) => s.id === activeStage) || stages.find((s) => s.name === (prog && prog.currentName)) || stages[0]) : null;

          return (
            <div className="card" style={{ padding: 0 }} key={p.id}>
              <div className="prio-item" style={{ padding: 16, gap: 16 }} onClick={() => toggleExpand(p)}>
                <div className="col gap-8" onClick={(e) => e.stopPropagation()}>
                  <button className="prio-edit" style={{ width: 24, height: 22, padding: 0 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="prio-edit" style={{ width: 24, height: 22, padding: 0 }} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
                </div>
                <div className="prio-num" style={{ background: i < 3 ? 'var(--amber)' : 'var(--mid-blue-dark)' }}>{i + 1}</div>
                <div className="u-logo" style={{ background: p.color, width: 38, height: 38, fontSize: 15 }}>{p.initial}</div>
                <div className="prio-info">
                  <div className="prio-title">{p.name}</div>
                  <div className="prio-prog">{p.program || p.role || p.org} · {p.flag} {p.country}</div>
                  {prog && (
                    <div className="row gap-8" style={{ marginTop: 6, alignItems: 'center' }}>
                      <div className="progbar" style={{ width: 120 }}><span style={{ width: prog.pct + '%' }}></span></div>
                      <span className="muted" style={{ fontSize: 11 }}>{prog.pct}% · этап {Math.min(prog.done + 1, prog.total)}/{prog.total}</span>
                    </div>
                  )}
                </div>
                <span className={dp.cls}>{dp.txt}</span>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(p); }}>Детали</button>
                {p.program && (
                  <span className="prio-arrow" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                    <Ico.chev w={14} />
                  </span>
                )}
                <button className="u-heart" onClick={(e) => { e.stopPropagation(); togglePrio(p.id); }}><Ico.close w={16} /></button>
              </div>

              {isOpen && stages && (
                <div className="rm-expand">
                  <div className="rm-rail">
                    {stages.map((s, si) => {
                      const st = (rm && rm.checks && rm.checks[s.id]) || [];
                      const full = s.checklist.length > 0 && s.checklist.every((_, ci) => st[ci]);
                      const isActive = stage && stage.id === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`rm-chip ${full ? 'done' : ''} ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveStage(s.id)}
                        >
                          <span className="rm-chip-num">{full ? <Ico.check w={11} /> : si + 1}</span>
                          <span>
                            <span className="rm-chip-name">{s.name}</span>
                            <span className="rm-chip-date">{s.date}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {stage && (
                    <div className="rm-stage-detail">
                      <div className="row-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{stage.name}</strong>
                        <Pill kind="blue">{stage.date}</Pill>
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--stone-2)', margin: '0 0 12px' }}>{stage.details}</p>
                      <div className="col" style={{ gap: 2 }}>
                        {stage.checklist.map((c, ci) => {
                          const st = (rm && rm.checks && rm.checks[stage.id]) || [];
                          const on = !!st[ci];
                          return (
                            <label className={`chk-row ${on ? 'checked' : ''}`} key={ci}>
                              <input type="checkbox" checked={on} onChange={() => toggleCheck(p.id, stage.id, ci)} />
                              <span>{c}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProgramsTab = ({ subTab, savedIds, priorities, setPriorities, toggleSave, togglePrio, roadmaps, setRoadmaps, openDetail }) => {
  const showPriority = subTab === 'p_priority' || subTab === 'p_roadmap'; // p_roadmap merged into priorities
  return (
    <div className="fade-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Мои программы</h1>
          <div className="page-sub">
            {savedIds.length} сохранено · {priorities.length} приоритетов
          </div>
        </div>
      </div>

      {subTab === 'p_saved' && <Saved savedIds={savedIds} priorities={priorities} toggleSave={toggleSave} togglePrio={togglePrio} openDetail={openDetail} />}
      {showPriority && <Priority priorities={priorities} setPriorities={setPriorities} togglePrio={togglePrio} roadmaps={roadmaps} setRoadmaps={setRoadmaps} openDetail={openDetail} />}
    </div>
  );
};

window.ProgramsTab = ProgramsTab;
