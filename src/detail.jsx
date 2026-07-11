// Grants relevant to a specific university: named awards > same country > EU-wide > field match
const grantsForUni = (u) => {
  const uniWord = (u.name || '').split(/\s+/).find((w) => w.length > 4) || u.name;
  const generic = /все|любые|200\+|программ/i;
  return AdmiticaData.grants
    .map((g) => {
      let score = 0;
      if (g.name.toLowerCase().includes(uniWord.toLowerCase()) || (g.desc || '').toLowerCase().includes(uniWord.toLowerCase())) score += 5;
      if (g.country === u.country) score += 3;
      if (g.country === 'ЕС') score += 2;
      if (generic.test(g.field || '')) score += 1;
      else if (u.field && (g.field || '').toLowerCase().includes(u.field.split(/[,\s]/)[0].toLowerCase())) score += 2;
      if (u.degree && (g.degree || '').toLowerCase().includes(u.degree.split(/[\s/]/)[0].toLowerCase())) score += 1;
      return { g, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.g);
};

// Detail page for university / grant / internship
const Detail = ({ item, onBack, saved, prio, toggleSave, togglePrio, addRoadmap, hasRoadmap, openDetail }) => {
  const it = item;
  const isUni = !!it.program;
  const isGrant = !!it.funding;
  const isIntern = !!it.role;
  const dp = deadlinePill(it.deadlineDays);
  const uniGrants = isUni ? grantsForUni(it) : [];

  const reqs = isUni
    ? [
        { k: 'Язык', v: it.language },
        { k: 'IELTS / Lang', v: it.ielts },
        { k: 'Оценки', v: it.gpa },
        { k: 'Дедлайн', v: it.deadline },
      ]
    : isGrant
    ? [
        { k: 'Кому', v: it.eligibility },
        { k: 'Уровень', v: it.degree },
        { k: 'Финансирование', v: it.funding },
        { k: 'Дедлайн', v: it.deadline },
      ]
    : [
        { k: 'Требования', v: it.requirements },
        { k: 'Длительность', v: it.duration },
        { k: 'Формат', v: it.format },
        { k: 'Дедлайн', v: it.deadline },
      ];

  const facts = isUni
    ? [
        { k: 'Город', v: `${it.flag} ${it.city}, ${it.country}` },
        { k: 'Программа', v: it.program },
        { k: 'Степень', v: it.degree },
        { k: 'Направление', v: it.field },
        { k: 'Стоимость', v: it.tuition },
        { k: 'Стипендии', v: it.scholarship ? 'Доступны' : '—' },
      ]
    : isGrant
    ? [
        { k: 'Страна', v: `${it.flag} ${it.country}` },
        { k: 'Организация', v: it.org },
        { k: 'Размер', v: it.amount },
        { k: 'Покрытие', v: it.funding },
        { k: 'Уровень', v: it.degree },
        { k: 'Направление', v: it.field },
      ]
    : [
        { k: 'Город', v: `${it.flag} ${it.city}` },
        { k: 'Роль', v: it.role },
        { k: 'Индустрия', v: it.industry },
        { k: 'Стипендия', v: it.stipend },
        { k: 'Длительность', v: it.duration },
        { k: 'Формат', v: it.format },
      ];

  return (
    <div className="fade-page">
      <span className="detail-back" onClick={onBack}>
        <Ico.arrowLeft w={14} /> Назад к подбору
      </span>

      <div className="detail-head">
        <div className="detail-logo" style={{ background: it.color }}>{it.initial}</div>
        <div style={{ flex: 1 }}>
          <div className="row gap-12" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 className="detail-title">{it.name}</h1>
            <span className={dp.cls}><Ico.cal w={11} /> {dp.txt}</span>
          </div>
          <div className="detail-program">
            {isUni ? it.program : isGrant ? `${it.org} · ${it.country}` : `${it.role} · ${it.industry}`}
          </div>
          <div className="row gap-12" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => addRoadmap(it)} disabled={hasRoadmap}>
              {hasRoadmap ? <><Ico.check w={14} /> В дорожной карте</> : <>Создать дорожную карту <Ico.arrowRight w={13} /></>}
            </button>
            <button className={`btn ${saved ? 'btn-outline' : 'btn-ghost'}`} onClick={() => toggleSave(it.id)}>
              <Ico.heart w={14} on={saved} /> {saved ? 'Сохранено' : 'Сохранить'}
            </button>
            <button className={`btn ${prio ? 'btn-outline' : 'btn-ghost'}`} onClick={() => togglePrio(it.id)} style={prio ? { color: 'var(--amber)', borderColor: 'var(--amber)' } : {}}>
              <Ico.star w={14} on={prio} /> {prio ? 'В приоритетах' : 'Приоритет'}
            </button>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card mb-24">
            <h3 className="section-h">О программе</h3>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--stone)' }}>{it.desc}</p>

            {isUni && (
              <div style={{ marginTop: 20 }}>
                <h3 className="section-h">Почему это сильный выбор</h3>
                <ul style={{ paddingLeft: 18, lineHeight: 1.7, fontSize: 14, color: 'var(--stone-2)' }}>
                  <li>Международная среда и сильное alumni-сообщество</li>
                  <li>Англоязычная программа с европейской аккредитацией</li>
                  <li>Возможности exchange и стажировок в топ-компаниях</li>
                  <li>Конкурентоспособная стоимость обучения для региона</li>
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="section-h">Требования к поступлению</h3>
            <dl className="kv">
              {reqs.map((r) => r.v && (
                <React.Fragment key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>

        <div>
          <div className="card mb-24">
            <h3 className="section-h">Ключевые факты</h3>
            <dl className="kv">
              {facts.map((f) => f.v && (
                <React.Fragment key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>

          {uniGrants.length > 0 && (
            <div className="card mb-24">
              <h3 className="section-h">Гранты по этому вузу</h3>
              <div className="col" style={{ gap: 4 }}>
                {uniGrants.map((g) => (
                  <div
                    key={g.id}
                    className="prio-item"
                    style={{ padding: '10px 4px' }}
                    onClick={() => openDetail && openDetail(g)}
                  >
                    <div className="u-logo" style={{ background: g.color, width: 34, height: 34, fontSize: 14 }}>{g.initial}</div>
                    <div className="prio-info">
                      <div className="prio-title" style={{ fontSize: 13 }}>{g.name}</div>
                      <div className="prio-prog" style={{ fontSize: 12 }}>{g.amount}</div>
                    </div>
                    <Pill kind={/полное/i.test(g.funding) ? 'teal' : ''}>{g.funding}</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}

          {it.site && (
            <div className="card mb-24">
              <h3 className="section-h">Официальный сайт</h3>
              <a href="#" style={{ color: 'var(--mid-blue-dark)', fontWeight: 500 }}>{it.site} →</a>
            </div>
          )}

          <div className="card" style={{ background: 'rgba(60,52,137,0.04)', border: '1px solid rgba(60,52,137,0.15)' }}>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <Ico.sparkle w={16} />
              <strong style={{ fontSize: 13, color: 'var(--purple-dark)' }}>AI-совет</strong>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--stone)' }}>
              Учитывая ваш профиль (GPA 4.7/5, IELTS 7.0), у вас сильные шансы. Начните Personal Statement за 2-3 месяца до дедлайна и параллельно подайте заявку на грант.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Detail = Detail;
