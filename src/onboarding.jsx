// Onboarding screen with letter-fly animation
const { useState, useEffect, useRef } = React;

const Onboarding = ({ onDone }) => {
  const [phase, setPhase] = useState(0); // 0 letters, 1 input, 2 fly
  const [name, setName] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1700);
    return () => clearTimeout(t1);
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) return;
    setPhase(2);
    // Animate title flying to corner
    setTimeout(() => onDone(name.trim()), 900);
  };

  const letters = 'Admitica'.split('');

  return (
    <div className="onboarding">
      <div className="ob-stage">
        <div
          ref={titleRef}
          className={`ob-title ${phase === 2 ? 'flying' : ''}`}
          style={
            phase === 2
              ? {
                  transform: 'translate(-46vw, -42vh) scale(0.4)',
                  fontSize: '32px',
                  color: 'var(--mid-blue-dark)',
                }
              : {}
          }
        >
          {letters.map((l, i) => (
            <span
              key={i}
              className="letter"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {l}
            </span>
          ))}
        </div>

        <div className={`ob-input-wrap ${phase >= 1 ? 'show' : ''}`}>
          <div className="ob-label">Как вас зовут?</div>
          <input
            type="text"
            className="ob-input"
            autoFocus={phase === 1}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Имя"
          />
        </div>
        <div className={`ob-cta ${phase === 1 && name.trim() ? 'show' : ''}`}>
          <button className="btn btn-primary" onClick={handleSubmit} style={{ marginTop: 16 }}>
            Войти в Admitica <Ico.arrowRight w={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

window.Onboarding = Onboarding;
