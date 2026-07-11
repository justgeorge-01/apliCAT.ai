// Sidebar navigation
const Sidebar = ({ tab, setTab, name, plan, slideIn, onSettings }) => {
  const [progExpanded, setProgExpanded] = useState(tab.startsWith('p_'));

  const items = [
    { id: 'home', label: 'Главная', icon: 'home' },
    { id: 'find', label: 'Подобрать программу', icon: 'search' },
    {
      id: 'programs',
      label: 'Мои программы',
      icon: 'bookmark',
      sub: [
        { id: 'p_saved', label: 'Сохранённые' },
        { id: 'p_priority', label: 'Приоритеты и роадмап' },
      ],
    },
    { id: 'essay', label: 'Редактор эссе', icon: 'pen' },
    { id: 'resume', label: 'Сборка резюме', icon: 'briefcase' },
  ];

  const initial = (name || 'У').charAt(0).toUpperCase();

  return (
    <aside className={`sidebar ${slideIn}`}>
      <div className="sb-logo">
        <span className="sb-logo-mark">A</span>
        <span className="lbl">Admitica</span>
      </div>
      <nav className="sb-nav">
        {items.map((it) => {
          const Icon = Ico[it.icon];
          const isActive = tab === it.id || (it.sub && it.sub.some((s) => s.id === tab));
          return (
            <div key={it.id}>
              <div
                className={`sb-item ${isActive ? 'active' : ''} ${it.sub && progExpanded ? 'expanded' : ''}`}
                onClick={() => {
                  if (it.sub) {
                    setProgExpanded(!progExpanded);
                    if (!isActive) setTab(it.sub[0].id);
                  } else {
                    setTab(it.id);
                  }
                }}
              >
                <span className="ico"><Icon /></span>
                <span className="lbl">{it.label}</span>
                {it.sub && <span className="chev"><Ico.chev w={14} /></span>}
              </div>
              {it.sub && progExpanded && (
                <div className="sb-sub">
                  {it.sub.map((s) => (
                    <div
                      key={s.id}
                      className={`sb-sub-item ${tab === s.id ? 'active' : ''}`}
                      onClick={() => setTab(s.id)}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sb-socials">
        <div className="sb-socials-h">Мы в соцсетях</div>
        <a className="sb-social" href="https://t.me/admitica" target="_blank" rel="noopener noreferrer">
          <span className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3c.3-1.2-.4-1.7-1.2-1.4L2.7 9.9c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 10.7-6.7c.5-.3 1-.2.6.2l-8.7 7.8-.3 4.8c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3-14.6z"/></svg>
          </span>
          <span className="lbl">Telegram</span>
        </a>
        <a className="sb-social" href="https://instagram.com/admitica" target="_blank" rel="noopener noreferrer">
          <span className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/></svg>
          </span>
          <span className="lbl">Instagram</span>
        </a>
        <a className="sb-social" href="https://facebook.com/admitica" target="_blank" rel="noopener noreferrer">
          <span className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.5-3h-3V8.6c0-.9.3-1.6 1.7-1.6H17V4.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H8v3h2.5V21h3z"/></svg>
          </span>
          <span className="lbl">Facebook</span>
        </a>
        <a className="sb-social" href="https://tiktok.com/@admitica" target="_blank" rel="noopener noreferrer">
          <span className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2 1.8 3.5 3.9 3.8v3c-1.5 0-2.9-.5-3.9-1.3v6.2c0 3.7-2.7 6.3-6.2 6.3-3.4 0-6-2.5-6-5.8 0-3.4 2.8-6 6.5-5.8v3.1c-.3-.1-.6-.1-.9-.1-1.6 0-2.8 1.2-2.8 2.8 0 1.6 1.2 2.8 2.7 2.8 1.7 0 3-1.3 3-3.2V3h3.7z"/></svg>
          </span>
          <span className="lbl">TikTok</span>
        </a>
      </div>

      <div className="sb-user" onClick={onSettings}>
        <div className="sb-avatar">{initial}</div>
        <div className="sb-user-meta" style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-user-name">{name || 'Пользователь'}</div>
          <div className="sb-user-plan">{plan}</div>
        </div>
        <span className="sb-user-cog"><Ico.cog w={16} /></span>
      </div>
    </aside>
  );
};

window.Sidebar = Sidebar;
