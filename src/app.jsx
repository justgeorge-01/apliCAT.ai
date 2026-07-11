// App root
const App = () => {
  const [name, setName] = usePersist('name', '');
  const [plan, setPlan] = usePersist('plan', 'Free');
  const [tab, setTab] = useState('home');
  const [detail, setDetail] = useState(null);
  const [savedIds, setSavedIds] = usePersist('savedIds', ['u1', 'u2', 'g1', 'g2', 'i1']);
  const [priorities, setPriorities] = usePersist('priorities', ['u1', 'u2', 'g1']);
  const [roadmaps, setRoadmaps] = usePersist('roadmaps', [
    { id: 'rm1', itemId: 'u1', step: 2 },
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [postOnboarding, setPostOnboarding] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  // Onboarding done?
  const onboarded = !!name;

  const toggleSave = (id) => {
    setSavedIds(savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id]);
  };
  const togglePrio = (id) => {
    if (priorities.includes(id)) {
      setPriorities(priorities.filter((x) => x !== id));
    } else {
      setPriorities([...priorities, id]);
      if (!savedIds.includes(id)) setSavedIds([...savedIds, id]);
    }
  };
  const openDetail = (item) => {
    setDetail(item);
    window.scrollTo(0, 0);
  };
  const addRoadmap = (it) => {
    // Roadmaps live inside Priorities now — make sure the item is there
    if (!priorities.includes(it.id)) setPriorities([...priorities, it.id]);
    if (!savedIds.includes(it.id)) setSavedIds([...savedIds, it.id]);
    if (roadmaps.find((r) => r.itemId === it.id)) return;
    setRoadmaps([...roadmaps, { id: 'rm' + Date.now(), itemId: it.id, step: 0, checks: {} }]);
  };
  const reset = () => {
    Object.keys(localStorage).filter((k) => k.startsWith('admitica.')).forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  useEffect(() => {
    if (postOnboarding && !animIn) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
      const t = setTimeout(() => setPostOnboarding(false), 1500);
      return () => { cancelAnimationFrame(r); clearTimeout(t); };
    }
  }, [postOnboarding, animIn]);

  if (!onboarded) {
    return (
      <Onboarding onDone={(n) => {
        setPostOnboarding(true);
        setName(n);
      }} />
    );
  }

  const sidebarSlide = postOnboarding ? `slide-in ${animIn ? 'in' : ''}` : '';
  const mainFade = postOnboarding ? `fade-in ${animIn ? 'in' : ''}` : '';

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        setTab={(t) => { setTab(t); setDetail(null); }}
        name={name}
        plan={plan}
        slideIn={sidebarSlide}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className={`main ${mainFade}`}>
        <div className="main-narrow">
          {detail ? (
            <Detail
              item={detail}
              onBack={() => setDetail(null)}
              saved={savedIds.includes(detail.id)}
              prio={priorities.includes(detail.id)}
              toggleSave={toggleSave}
              togglePrio={togglePrio}
              addRoadmap={addRoadmap}
              hasRoadmap={roadmaps.some((r) => r.itemId === detail.id)}
              openDetail={openDetail}
            />
          ) : (
            <>
              {tab === 'home' && (
                <Home
                  name={name}
                  priorities={priorities}
                  savedIds={savedIds}
                  roadmaps={roadmaps}
                  setTab={setTab}
                  openDetail={openDetail}
                />
              )}
              {tab === 'find' && (
                <Find
                  saved={savedIds}
                  priorities={priorities}
                  toggleSave={toggleSave}
                  togglePrio={togglePrio}
                  openDetail={openDetail}
                />
              )}
              {tab.startsWith('p_') && (
                <ProgramsTab
                  subTab={tab}
                  savedIds={savedIds}
                  priorities={priorities}
                  setPriorities={setPriorities}
                  toggleSave={toggleSave}
                  togglePrio={togglePrio}
                  roadmaps={roadmaps}
                  setRoadmaps={setRoadmaps}
                  openDetail={openDetail}
                />
              )}
              {tab === 'essay' && <Essay priorities={priorities} />}
              {tab === 'resume' && <Resume />}
            </>
          )}
        </div>
      </main>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        name={name}
        setName={setName}
        plan={plan}
        setPlan={setPlan}
        savedIds={savedIds}
        priorities={priorities}
        roadmaps={roadmaps}
        onReset={reset}
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider><App /></ToastProvider>
);
