// Settings drawer
const Settings = ({ open, onClose, name, setName, plan, setPlan, savedIds, priorities, roadmaps, onReset }) => {
  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose}></div>
      <aside className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-h">
          <h2>Настройки</h2>
          <button className="drawer-close" onClick={onClose}><Ico.close w={18} /></button>
        </div>

        <div className="drawer-section">
          <h4>Профиль</h4>
          <div className="row gap-12" style={{ marginBottom: 14 }}>
            <div className="sb-avatar" style={{ width: 56, height: 56, fontSize: 22 }}>
              {(name || 'У').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <input
                className="ob-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: 14, padding: '8px 12px' }}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Имя для приветствия</div>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <h4>Подписка</h4>
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            {['Free', 'Pro', 'Premium'].map((p) => (
              <button
                key={p}
                className={`btn ${plan === p ? 'btn-blue' : 'btn-ghost'}`}
                onClick={() => setPlan(p)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Pro: безлимитный AI-фидбэк по эссе, экспорт PDF, расширенные фильтры.
            Premium: 1:1 консультации с ментором, проверка эссе экспертом.
          </div>
        </div>

        <div className="drawer-section">
          <h4>Уведомления</h4>
          <div className="drawer-row">
            <span style={{ fontSize: 13 }}>Дедлайны программ</span>
            <div className="switch on"></div>
          </div>
          <div className="drawer-row">
            <span style={{ fontSize: 13 }}>Ежедневный стрик</span>
            <div className="switch on"></div>
          </div>
          <div className="drawer-row">
            <span style={{ fontSize: 13 }}>Новые гранты</span>
            <div className="switch"></div>
          </div>
        </div>

        <div className="drawer-section">
          <h4>Статистика</h4>
          <div className="card card-surface" style={{ padding: 16 }}>
            <div className="row-between" style={{ fontSize: 13, marginBottom: 6 }}>
              <span className="muted">Сохранено программ</span>
              <b>{savedIds.length}</b>
            </div>
            <div className="row-between" style={{ fontSize: 13, marginBottom: 6 }}>
              <span className="muted">Приоритетов</span>
              <b>{priorities.length}</b>
            </div>
            <div className="row-between" style={{ fontSize: 13, marginBottom: 6 }}>
              <span className="muted">Дорожных карт</span>
              <b>{roadmaps.length}</b>
            </div>
            <div className="row-between" style={{ fontSize: 13 }}>
              <span className="muted">В Admitica с</span>
              <b>октября 2024</b>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <h4>Данные</h4>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <Ico.dl w={14} /> Экспортировать всё в JSON
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', marginTop: 6, color: 'var(--red)', borderColor: 'rgba(176,65,62,0.3)' }}
            onClick={() => { if (confirm('Сбросить всё?')) onReset(); }}
          >
            <Ico.trash w={14} /> Сбросить аккаунт
          </button>
        </div>
      </aside>
    </>
  );
};

window.Settings = Settings;
