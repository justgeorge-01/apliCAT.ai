// Admitica – дорожная карта поступления: данные и логика этапов
// Обычный JS без JSX и модульного синтаксиса: подключается через <script src>
// ДО Babel-скомпилированных JSX-файлов.
// Глобали: window.buildRoadmapStages(u), window.ROADMAP_STAGE_COUNT

(function () {
  'use strict';

  // ===== Даты =====

  const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const parseDeadline = (str) => {
    if (typeof str !== 'string') return null;
    const m = str.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return null;
    const day = +m[1];
    const month = +m[2];
    const year = +m[3];
    const d = new Date(year, month - 1, day);
    const valid = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
    return valid ? d : null;
  };

  const addDays = (base, days) => {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + days);
    return d;
  };

  const formatRu = (d) => d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear();

  // Подсказки по срокам. Смещения от дедлайна:
  // research -180, lang -120, docs -90, essay -60, apply 0, wait +60, visa +120
  const buildDates = (u) => {
    const deadline = parseDeadline(u.deadline);
    const farAway = typeof u.deadlineDays === 'number' && u.deadlineDays > 900;
    if (!deadline || farAway) {
      return {
        rolling: true,
        research: 'за ~6 мес. до подачи',
        lang: 'за ~4 мес. до подачи',
        docs: 'за ~3 мес. до подачи',
        essay: 'за ~2 мес. до подачи',
        apply: 'rolling – подача круглый год',
        wait: '~2 мес. после подачи',
        visa: '~4 мес. после подачи',
      };
    }
    return {
      rolling: false,
      deadlineText: formatRu(deadline),
      research: 'до ' + formatRu(addDays(deadline, -180)),
      lang: 'до ' + formatRu(addDays(deadline, -120)),
      docs: 'до ' + formatRu(addDays(deadline, -90)),
      essay: 'до ' + formatRu(addDays(deadline, -60)),
      apply: 'дедлайн ' + formatRu(deadline),
      wait: 'к ' + formatRu(addDays(deadline, 60)),
      visa: 'к ' + formatRu(addDays(deadline, 120)),
    };
  };

  // ===== Языковой экзамен =====

  const getLangPlan = (ielts) => {
    const raw = String(ielts || '').trim();
    if (/portfolio/i.test(raw)) {
      return { portfolio: true, short: 'портфолио' };
    }
    if (raw.indexOf('DE') !== -1) {
      return {
        test: 'TestDaF (4×4) или Goethe-Zertifikat C1',
        short: 'TestDaF / Goethe C1',
        target: 'TestDaF 4×4 или Goethe-Zertifikat C1',
      };
    }
    if (raw.indexOf('FR') !== -1) {
      return {
        test: 'DELF B2 / DALF C1',
        short: 'DELF B2 / DALF C1',
        target: 'DELF B2, лучше DALF C1',
      };
    }
    if (raw.indexOf('NL') !== -1) {
      return {
        test: 'NT2 Programma II',
        short: 'NT2 II',
        target: 'NT2 Programma II',
      };
    }
    if (raw.indexOf('DK') !== -1) {
      return {
        test: 'Studieprøven',
        short: 'Studieprøven',
        target: 'Studieprøven (датский)',
      };
    }
    const score = raw || '6.5+';
    return {
      test: 'IELTS ' + score + ' / TOEFL iBT (эквивалент)',
      short: 'IELTS ' + score,
      target: 'IELTS ' + score + ' или эквивалент TOEFL iBT',
    };
  };

  // ===== Страновые особенности =====
  // Каждая запись: portal, statusPlace (предложный падеж), заметки и пункты
  // чек-листов для этапов docs / apply / visa.

  const COUNTRY_INFO = {
    'Германия': (u) => {
      const needsAps = /APS/i.test(String(u.gpa || ''));
      return {
        portal: 'uni-assist',
        statusPlace: 'uni-assist',
        docsNote: 'Документы в немецкие вузы идут через uni-assist: загрузите заверенные копии с переводами и получите VPD – предварительную оценку.' + (needsAps ? ' Для ' + u.name + ' также обязателен APS-сертификат: подайте на проверку заранее, она занимает 4-6 недель.' : ''),
        docsItems: [
          'Зарегистрироваться на uni-assist и запросить VPD',
          needsAps ? 'Подать документы на APS-сертификат' : null,
        ],
        applyNote: 'Заявка в ' + u.name + ' подаётся через uni-assist; после проверки документы уходят в вуз автоматически.',
        applyItems: ['Оплатить сбор uni-assist'],
        visaNote: 'Для учёбы в Германии оформляется национальная виза D. Ключевое финансовое требование – блокированный счёт примерно на 11 900 EUR в год.',
        visaItems: [
          'Открыть блокированный счёт (~11 900 EUR/год)',
          'Записаться на подачу на национальную визу D',
        ],
      };
    },

    'Великобритания': (u) => {
      const bachelor = String(u.degree || '').indexOf('Бакалавриат') !== -1;
      return {
        portal: bachelor ? 'UCAS' : 'портал вуза (' + u.site + ')',
        statusPlace: bachelor ? 'UCAS Hub' : 'личном кабинете на ' + u.site,
        docsNote: bachelor
          ? 'Бакалавриат в Великобритании подаётся через UCAS: одна заявка покрывает до пяти вузов, поэтому personal statement пишется без привязки к конкретному университету.'
          : 'Магистерские программы в Великобритании принимают документы напрямую – через портал на ' + u.site + ', без UCAS.',
        docsItems: bachelor
          ? ['Создать заявку в UCAS', 'Договориться с referee о рекомендации']
          : ['Создать аккаунт на портале ' + u.site],
        applyNote: bachelor
          ? 'Заявка в ' + u.name + ' отправляется через UCAS вместе с personal statement и рекомендацией.'
          : 'Заявка в ' + u.name + ' подаётся напрямую через ' + u.site + '.',
        applyItems: ['Оплатить application fee'],
        visaNote: 'После подтверждения места ' + u.name + ' выпустит CAS – без него нельзя подать на Student visa. Вместе с визовым сбором оплачивается IHS (медицинский сбор) за весь срок обучения.',
        visaItems: [
          'Получить CAS от вуза',
          'Оплатить визовый сбор и IHS-сбор',
          'Подать на Student visa онлайн',
        ],
      };
    },

    'Нидерланды': (u) => ({
      portal: 'Studielink',
      statusPlace: 'Studielink и портале вуза',
      docsNote: 'Регистрация на программу идёт через национальную систему Studielink, после чего документы загружаются в личный кабинет вуза. Оценку иностранного диплома при необходимости выполняет Nuffic.',
      docsItems: [
        'Зарегистрироваться в Studielink',
        'Уточнить, нужна ли оценка диплома через Nuffic',
      ],
      applyNote: 'Заявка в ' + u.name + ' стартует в Studielink, а досье с документами добирается в портале вуза.',
      applyItems: [],
      visaNote: 'Визу MVV и вид на жительство VVR для студентов запрашивает сам вуз: после зачисления ' + u.name + ' пришлёт инструкции и счёт на визовый сбор.',
      visaItems: [
        'Отправить вузу документы для MVV/VVR',
        'Оплатить визовый сбор по счёту вуза',
        'Получить MVV-стикер в консульстве',
      ],
    }),

    'Франция': (u) => ({
      portal: 'Campus France («Études en France»)',
      statusPlace: 'личном кабинете «Études en France»',
      docsNote: 'Досье собирается в системе «Études en France» (Campus France): туда загружаются документы с переводами, там же назначается собеседование.',
      docsItems: [
        'Создать досье в «Études en France»',
        'Пройти процедуру и собеседование Campus France',
      ],
      applyNote: 'Для ' + u.name + ' досье оформляется через Campus France; параллельно сверьте требования программы на ' + u.site + '.',
      applyItems: ['Оплатить сбор Campus France'],
      visaNote: 'После одобрения досье Campus France подаётся заявление на долгосрочную студенческую визу (оплачивается визовый сбор). После приезда во Францию визу нужно валидировать через OFII.',
      visaItems: [
        'Подать на студенческую визу после Campus France',
        'Оплатить визовый сбор',
        'Валидировать визу через OFII после приезда',
      ],
    }),

    'Италия': (u) => ({
      portal: 'Universitaly и портал вуза (' + u.site + ')',
      statusPlace: 'личном кабинете вуза и на Universitaly',
      docsNote: 'Для Италии оформляется pre-enrolment на портале Universitaly – без него консульство не примет визовое заявление. Документы понадобятся с переводом и легализацией.',
      docsItems: [
        'Оформить pre-enrolment на Universitaly',
        'Перевести и легализовать аттестат/диплом',
      ],
      applyNote: 'Сначала заявка в ' + u.name + ' через ' + u.site + ', затем pre-enrolment на Universitaly.',
      applyItems: ['Сверить статус pre-enrolment на Universitaly'],
      visaNote: 'Для учёбы в Италии оформляется национальная виза D – с подтверждением pre-enrolment из Universitaly. После приезда получите codice fiscale: он нужен для аренды, банка и вуза.',
      visaItems: [
        'Подать на визу D с подтверждением Universitaly',
        'Получить codice fiscale после приезда',
      ],
    }),

    'Швейцария': (u) => ({
      portal: 'сайт вуза (' + u.site + ')',
      statusPlace: 'личном кабинете на ' + u.site,
      docsNote: 'В Швейцарии единого национального портала нет: заявка в ' + u.name + ' подаётся напрямую на ' + u.site + '. Внимательно сверьте список документов – у вуза свои требования к заверению.',
      docsItems: ['Сверить список документов на ' + u.site],
      applyNote: 'Заявка в ' + u.name + ' подаётся напрямую на ' + u.site + '.',
      applyItems: ['Оплатить регистрационный сбор вуза'],
      visaNote: 'Оформляется национальная виза D, а решение о пребывании принимает кантон – дождитесь кантонального разрешения. Закладывайте 8-12 недель на согласование.',
      visaItems: [
        'Подать на визу D в посольстве',
        'Дождаться кантонального разрешения на пребывание',
        'Подготовить подтверждение финансов',
      ],
    }),

    'Швеция': (u) => ({
      portal: 'universityadmissions.se',
      statusPlace: 'аккаунте universityadmissions.se',
      docsNote: 'Заявки в шведские вузы идут через единый портал universityadmissions.se: до четырёх программ в одной заявке, документы загружаются туда же.',
      docsItems: ['Создать аккаунт на universityadmissions.se'],
      applyNote: 'Заявка в ' + u.name + ' подаётся на universityadmissions.se – проверьте порядок приоритетов программ.',
      applyItems: ['Оплатить application fee (~900 SEK)'],
      visaNote: 'Вместо визы оформляется residence permit для учёбы: заявление подаётся онлайн на сайте Migrationsverket после зачисления и оплаты первого взноса за обучение.',
      visaItems: [
        'Подать на residence permit для учёбы (Migrationsverket)',
        'Показать средства на весь период обучения',
      ],
    }),

    'Дания': (u) => ({
      portal: 'optagelse.dk',
      statusPlace: 'личном кабинете optagelse.dk',
      docsNote: 'Заявки на программы в Дании подаются через национальный портал optagelse.dk – до восьми приоритетов в одной заявке.',
      docsItems: ['Создать заявку на optagelse.dk'],
      applyNote: 'Заявка в ' + u.name + ' оформляется на optagelse.dk; проверьте, что программа стоит верным приоритетом.',
      applyItems: [],
      visaNote: 'Для учёбы в Дании оформляется residence permit по схеме ST1: часть формы заполняет вуз, часть – вы. Понадобится оплата сбора и сдача биометрии.',
      visaItems: [
        'Заполнить свою часть формы ST1',
        'Оплатить сбор и сдать биометрию',
      ],
    }),

    'Финляндия': (u) => ({
      portal: 'studyinfo.fi',
      statusPlace: 'личном кабинете studyinfo.fi',
      docsNote: 'Заявки в финские вузы подаются через национальный портал studyinfo.fi; туда же загружаются дипломы и сертификаты.',
      docsItems: ['Создать заявку на studyinfo.fi'],
      applyNote: 'Заявка в ' + u.name + ' подаётся на studyinfo.fi.',
      applyItems: [],
      visaNote: 'Оформляется студенческий residence permit через сервис Enter Finland (Migri). Понадобятся подтверждение средств и медицинская страховка.',
      visaItems: [
        'Подать на residence permit (Enter Finland / Migri)',
        'Оформить страховку и подтверждение средств',
      ],
    }),

    'Австрия': (u) => ({
      portal: 'портал вуза (' + u.site + ')',
      statusPlace: 'личном кабинете вуза',
      docsNote: 'В Австрии заявка подаётся напрямую в вуз – процедура и сроки описаны на ' + u.site + '. Уточните требования к заверению и переводам.',
      docsItems: ['Сверить список документов на ' + u.site],
      applyNote: 'Заявка в ' + u.name + ' подаётся напрямую через ' + u.site + '.',
      applyItems: [],
      visaNote: 'Для учёбы дольше шести месяцев оформляется Aufenthaltsbewilligung Studierende – вид на жительство для студентов. Подавайте сразу после зачисления: рассмотрение занимает до 90 дней.',
      visaItems: [
        'Подать на Aufenthaltsbewilligung Studierende',
        'Подтвердить финансы и страховку',
      ],
    }),

    'Испания': (u) => ({
      portal: 'портал вуза (' + u.site + ')',
      statusPlace: 'личном кабинете вуза',
      docsNote: 'Для Испании школьный аттестат проходит омологацию либо оформляется credencial UNED – процедура небыстрая, начните заранее.',
      docsItems: ['Запустить омологацию аттестата / credencial UNED'],
      applyNote: 'Заявка в ' + u.name + ' подаётся напрямую через ' + u.site + '.',
      applyItems: [],
      visaNote: 'Оформляется национальная виза D для учёбы: понадобятся подтверждение зачисления, средства и медицинская страховка.',
      visaItems: [
        'Подать на визу D в консульстве',
        'Подготовить страховку и подтверждение средств',
      ],
    }),

    'Эстония': (u) => ({
      portal: 'DreamApply',
      statusPlace: 'DreamApply',
      docsNote: 'Заявки в эстонские вузы подаются через DreamApply – все документы загружаются в электронном виде.',
      docsItems: ['Создать заявку в DreamApply'],
      applyNote: 'Заявка в ' + u.name + ' подаётся через DreamApply.',
      applyItems: [],
      visaNote: 'После зачисления оформляется временный вид на жительство (TRP) для учёбы. На первое время можно въехать по визе D и подать на TRP уже в Эстонии.',
      visaItems: [
        'Подать на TRP после зачисления',
        'При необходимости – виза D на первый въезд',
      ],
    }),
  };

  const defaultCountry = (u) => ({
    portal: 'портал вуза (' + u.site + ')',
    statusPlace: 'личном кабинете вуза',
    docsNote: 'Точный список документов и формат подачи проверьте на ' + u.site + '.',
    docsItems: [],
    applyNote: 'Заявка в ' + u.name + ' подаётся через ' + u.site + '.',
    applyItems: [],
    visaNote: 'После получения оффера уточните визовые требования страны на сайте консульства.',
    visaItems: ['Уточнить визовые требования в консульстве'],
  });

  // ===== Вспомогательное =====

  const cleanList = (items) => items.filter(Boolean).slice(0, 6);

  const normalize = (raw) => {
    const u = raw || {};
    return {
      name: u.name || 'университет',
      program: u.program || 'выбранная программа',
      degree: u.degree || '',
      country: u.country || '',
      city: u.city || 'город обучения',
      tuition: u.tuition || 'уточните на сайте',
      deadline: u.deadline,
      deadlineDays: u.deadlineDays,
      scholarship: !!u.scholarship,
      ielts: u.ielts || '',
      gpa: u.gpa || 'см. сайт вуза',
      site: u.site || 'сайте вуза',
    };
  };

  // ===== Сборка дорожной карты =====

  window.buildRoadmapStages = function (university) {
    const u = normalize(university);
    const dates = buildDates(u);
    const country = (COUNTRY_INFO[u.country] || defaultCountry)(u);
    const lang = getLangPlan(u.ielts);
    const needsPortfolio = !!lang.portfolio || /portfolio/i.test(String(u.gpa));
    const location = [u.city, u.country].filter(Boolean).join(', ');

    const research = {
      id: 'research',
      name: 'Исследование',
      date: dates.research,
      desc: 'Изучите программу, требования и бюджет',
      details: 'Познакомьтесь с программой «' + u.program + '» в ' + u.name + ' (' + location + '): учебный план, требования к поступающим, карьерные треки. Обучение стоит ' + u.tuition + (u.scholarship ? ', при этом у вуза есть стипендии – изучите условия сразу.' : '.') + ' Официальная информация – на ' + u.site + '.',
      checklist: cleanList([
        'Изучить страницу программы на ' + u.site,
        'Проверить требования: ' + lang.short + ' и ' + u.gpa,
        'Посчитать бюджет: ' + u.tuition + ' плюс проживание (' + u.city + ')',
        u.scholarship
          ? 'Составить список стипендий ' + u.name + ' и внешних грантов'
          : 'Сравнить программу с 2-3 альтернативами',
        'Завести таблицу дедлайнов и документов',
      ]),
    };

    const langStage = lang.portfolio
      ? {
          id: 'lang',
          name: 'Портфолио',
          date: dates.lang,
          desc: 'Главный отбор – по портфолио, а не по тесту',
          details: 'Отбор на «' + u.program + '» в ' + u.name + ' строится вокруг портфолио – оно весит больше любого теста. Изучите требования к формату и числу работ на ' + u.site + ' и собирайте проекты, которые показывают ход мысли, а не только результат. Параллельно уточните, нужен ли формальный сертификат английского.',
          checklist: [
            'Изучить требования к портфолио на ' + u.site,
            'Отобрать 8-12 сильных проектов',
            'Описать задачу, процесс и свою роль в каждом',
            'Показать подборку ментору или преподавателю',
            'Уточнить, нужен ли сертификат английского',
          ],
        }
      : {
          id: 'lang',
          name: 'Языковой экзамен',
          date: dates.lang,
          desc: 'Сдать ' + lang.short,
          details: 'Для программы «' + u.program + '» в ' + u.name + ' понадобится ' + lang.test + '. Записывайтесь заранее: места на удобные даты разбирают за 1-2 месяца, а результатов ждут до двух недель. Заложите запас на пересдачу до дедлайна.',
          checklist: [
            'Записаться на экзамен: ' + lang.short,
            'Целевой результат: ' + lang.target,
            'Пройти 2-3 пробных теста с таймером',
            'Заложить время на возможную пересдачу',
            'Отправить результат в ' + u.name,
          ],
        };

    const docs = {
      id: 'docs',
      name: 'Сбор документов',
      date: dates.docs,
      desc: 'Переводы, заверения и справки',
      details: 'Соберите базовый пакет: аттестат или диплом с транскриптом оценок, паспорт, сертификаты. ' + country.docsNote,
      checklist: cleanList([
        'Заказать транскрипт и копии аттестата/диплома',
        ...country.docsItems,
        'Сделать заверенные переводы документов',
        'Сверить оценки с требованием: ' + u.gpa,
        'Собрать сканы в PDF в одну папку',
      ]),
    };

    const essay = {
      id: 'essay',
      name: 'Мотивационное письмо',
      date: dates.essay,
      desc: needsPortfolio ? 'Эссе, рекомендации и портфолио' : 'Эссе, рекомендации и CV',
      details: 'Пишите мотивационное письмо под конкретную программу: почему «' + u.program + '», почему именно ' + u.name + ' и как это связано с вашими планами. Общие фразы комиссия видит сотнями – опирайтесь на факты из собственного опыта. Рекомендации запрашивайте за несколько недель: преподавателям нужно время на сильное письмо.' + (needsPortfolio ? ' Финальную версию портфолио тоже готовьте на этом этапе.' : ''),
      checklist: cleanList([
        'Написать черновик письма под ' + u.name,
        'Связать мотивацию с программой «' + u.program + '»',
        'Запросить 1-2 рекомендательных письма',
        'Отдать текст на вычитку ментору или носителю языка',
        needsPortfolio
          ? 'Финализировать портфолио по требованиям вуза'
          : 'Обновить CV в академическом формате',
      ]),
    };

    const apply = {
      id: 'apply',
      name: 'Подача заявки',
      date: dates.apply,
      desc: dates.rolling
        ? 'Приём круглый год – подавайте, когда готовы'
        : 'Отправить заявку до дедлайна',
      details: country.applyNote + ' ' + (dates.rolling
        ? 'Формальный дедлайн гибкий, но места и стипендии разбирают – отправляйте заявку, как только пакет готов.'
        : 'Жёсткий дедлайн – ' + dates.deadlineText + ': не откладывайте отправку на последний день, порталы часто виснут под нагрузкой.'),
      checklist: cleanList([
        'Заполнить заявку: ' + country.portal,
        'Загрузить все документы и сертификаты',
        ...country.applyItems,
        'Перепроверить каждое поле перед отправкой',
        'Сохранить подтверждение подачи (PDF или скрин)',
      ]),
    };

    const wait = {
      id: 'wait',
      name: 'Ожидание решения',
      date: dates.wait,
      desc: 'Ответ комиссии и подтверждение места',
      details: 'Решение по заявке обычно приходит в течение 4-8 недель. Следите за статусом в ' + country.statusPlace + ' и не пропускайте письма, включая папку «Спам»: ' + u.name + ' может запросить документы или пригласить на интервью.' + (u.scholarship ? ' Решение по стипендии часто приходит отдельно – проверьте, не нужна ли для неё своя заявка.' : ''),
      checklist: cleanList([
        'Проверять статус заявки раз в несколько дней',
        'Отвечать на запросы комиссии в течение 1-2 дней',
        'Подготовиться к возможному интервью',
        'Получив оффер – подтвердить место в срок',
        u.scholarship ? 'Уточнить статус заявки на стипендию' : null,
      ]),
    };

    const visa = {
      id: 'visa',
      name: 'Виза и переезд',
      date: dates.visa,
      desc: 'Оформление визы и подготовка к переезду',
      details: country.visaNote + ' Параллельно занимайтесь жильём (' + u.city + '): у студенческих резиденций свои дедлайны.',
      checklist: cleanList([
        ...country.visaItems,
        'Собрать визовый пакет: оффер, финансы, страховка',
        'Найти жильё (' + u.city + ')',
        'Спланировать приезд и купить билеты',
      ]),
    };

    return [research, langStage, docs, essay, apply, wait, visa];
  };

  window.ROADMAP_STAGE_COUNT = 7;
})();
