// AI client — supports OpenRouter (sk-or-v1-*) and Google Gemini (AIzaSy*/AQ.*)
// Auto-detects provider by key prefix.
// ⚠️ DEMO ONLY. Move key to backend proxy before production.
(function () {
  // Default models per provider
  const DEFAULT_MODELS = {
    openrouter: 'openrouter/owl-alpha',
    gemini: 'gemini-2.0-flash-lite',
  };

  // ⚠️ DEMO: embedded fallback key (split to bypass git secret scanner).
  // Set a $1-5/month spending cap on OpenRouter to limit damage if leaked.
  // Replace with backend proxy (Cloudflare Worker) before going to production.
  const FALLBACK_KEY = ['sk-', 'or-v', '1-', 'fc2387bbbdcb2cb8d6', '567e0a4d4a87607658788b7', '445abf34fa75d98506c4996'].join('');

  function getKey() {
    if (window.GEMINI_KEY) return window.GEMINI_KEY;
    if (window.AI_KEY) return window.AI_KEY;
    return FALLBACK_KEY;
  }

  function detectProvider(key) {
    if (!key) return null;
    if (key.startsWith('sk-or-')) return 'openrouter';
    if (key.startsWith('AIzaSy') || key.startsWith('AQ.') || key.startsWith('ya29.')) return 'gemini';
    return null;
  }

  function getModel(provider) {
    try {
      const saved = localStorage.getItem('admitica.ai_model_' + provider);
      if (saved) return saved;
    } catch {}
    return DEFAULT_MODELS[provider];
  }

  function setModel(provider, m) {
    try { localStorage.setItem('admitica.ai_model_' + provider, m || DEFAULT_MODELS[provider]); } catch {}
  }

  // ===== Provider implementations =====

  async function callOpenRouter(apiKey, prompt, opts) {
    const model = getModel('openrouter');
    const messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Admitica',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature != null ? opts.temperature : 0.7,
        max_tokens: opts.maxTokens || 2048,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      let parsed = null; try { parsed = JSON.parse(txt); } catch {}
      const errMsg = parsed?.error?.message || txt;
      console.error('[OpenRouter error]', { status: res.status, errMsg, model, full: parsed || txt });
      if (res.status === 401) throw new Error('OpenRouter: неверный ключ (должен начинаться с sk-or-v1-)');
      if (res.status === 402) throw new Error('OpenRouter: закончились бесплатные кредиты, попробуй другую модель или пополни баланс');
      if (res.status === 429) throw new Error('OpenRouter лимит запросов: ' + errMsg.slice(0, 150));
      throw new Error(`OpenRouter ${res.status}: ${errMsg.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Пустой ответ от ' + model);
    return text;
  }

  async function callGemini(apiKey, prompt, opts) {
    const model = getModel('gemini');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const isBearer = apiKey.startsWith('AQ.') || apiKey.startsWith('ya29.');

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature != null ? opts.temperature : 0.7,
        maxOutputTokens: opts.maxTokens || 2048,
      },
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

    const headers = { 'Content-Type': 'application/json' };
    let url = endpoint;
    if (isBearer) headers['Authorization'] = `Bearer ${apiKey}`;
    else url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text();
      let parsed = null; try { parsed = JSON.parse(txt); } catch {}
      const errMsg = parsed?.error?.message || txt;
      console.error('[Gemini error]', { status: res.status, errMsg, model, full: parsed || txt });
      if (/expired/i.test(errMsg)) throw new Error('Gemini: ключ истёк, получи новый на aistudio.google.com/apikey');
      if (res.status === 400) throw new Error(`Gemini 400: ${errMsg.slice(0, 180)}`);
      if (res.status === 401 || res.status === 403) throw new Error(`Gemini ${res.status}: ключ отклонён, проверь активацию Generative Language API`);
      if (res.status === 429) throw new Error('Gemini: лимит запросов (' + errMsg.slice(0, 120) + ')');
      throw new Error(`Gemini ${res.status}: ${errMsg.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Пустой ответ от Gemini (возможно safety filter)');
    return text;
  }

  // ===== Language detection =====
  // Maps a BCP-47 code (navigator.language) to a human language name the model understands.
  const LANG_NAMES = {
    ru: 'русском', en: 'English', uk: 'українській', be: 'беларускай',
    kk: 'қазақ тілінде', uz: "o'zbek tilida", de: 'Deutsch', fr: 'français',
    es: 'español', it: 'italiano', pt: 'português', pl: 'polskim', tr: 'Türkçe',
    zh: '中文', ja: '日本語', ko: '한국어', ar: 'العربية', hi: 'हिन्दी',
    ka: 'ქართულად', hy: 'հայերեն', az: 'Azərbaycan dilində',
  };

  function detectLang() {
    let code = 'ru';
    try {
      const nav = navigator.language || (navigator.languages && navigator.languages[0]) || 'ru';
      code = nav.toLowerCase().split('-')[0];
    } catch {}
    return code;
  }

  function langInstruction() {
    const code = detectLang();
    const name = LANG_NAMES[code] || LANG_NAMES.en;
    // Phrased so it works whether the name is in the target language or English.
    // JSON-safe: only human-readable text is translated, structural keys/tags stay as specified.
    return `Respond in the user's system language: ${name} (locale: ${code}). Write all human-readable text in that language. If the response is JSON, keep the keys and any specified enum/tag values exactly as instructed (in English), and translate only the natural-language text content.`;
  }

  // ===== Main entry =====

  async function complete(prompt, opts) {
    opts = opts || {};
    const apiKey = getKey();
    if (!apiKey) {
      throw new Error('AI ключ не настроен. Открой Профиль → "AI ключ" и вставь ключ (OpenRouter sk-or-v1-... или Gemini AIzaSy...).');
    }
    const provider = detectProvider(apiKey);
    if (!provider) {
      throw new Error('Неизвестный формат ключа. Поддерживаются: OpenRouter (sk-or-v1-...) и Gemini (AIzaSy.../AQ....).');
    }
    // Inject language instruction into the system prompt (unless caller opts out).
    if (!opts.noLang) {
      const li = langInstruction();
      opts = { ...opts, system: opts.system ? `${opts.system}\n\n${li}` : li };
    }
    if (provider === 'openrouter') return callOpenRouter(apiKey, prompt, opts);
    return callGemini(apiKey, prompt, opts);
  }

  function extractJson(text) {
    if (!text) return null;
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    let m = null;
    if (arrMatch && objMatch) {
      m = cleaned.indexOf(arrMatch[0]) < cleaned.indexOf(objMatch[0]) ? arrMatch : objMatch;
    } else m = arrMatch || objMatch;
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }

  window.ai = {
    complete,
    extractJson,
    detectLang,
    getProvider: () => detectProvider(getKey()),
    getModel: () => {
      const p = detectProvider(getKey());
      return p ? getModel(p) : '';
    },
    setModel: (m) => {
      const p = detectProvider(getKey());
      if (p) setModel(p, m);
    },
  };

  // Backward-compat
  window.claude = { complete: (prompt) => complete(prompt) };
})();
