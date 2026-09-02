/**
 * Built-in DEMO catalog – served only when `public/data/china.json` is missing.
 *
 * Rules of this file:
 *  - only values from the 31.08.2026 research that the spec (§1) lists, with the
 *    official page as `source_url`, `origin: "demo"` and `verified_at: "2026-08-31"`;
 *    NO invented numbers – a value we are not sure about is simply absent;
 *  - the other universities of the 20 are cards with no facts and
 *    `last_checked_at: null`, so the UI shows «не опубликовано»;
 *  - `display` strings are hand-written here because the pipeline's renderer
 *    has not run; a real export replaces them wholesale.
 *
 * A tuition RANGE is stored as the pipeline's entity-level money range
 * (`amount_minor_min` / `amount_minor_max`); filters and matching use the minimum.
 * `quote` is null where we have no verbatim text (the CERNET sites are not
 * reachable from abroad – see task 26 §3); the badge then shows only the link.
 */
import type { Catalog, Fact, University } from "./china.types"

const VERIFIED_AT = "2026-08-31"
/** Number of card keys v1 the exporter counts coverage against (spec: «7 из 8»). */
export const CARD_EXPECTED = 8

type DemoFact = Omit<Fact, "origin" | "certainty" | "snapshot" | "verified_at" | "quote" | "academic_year"> &
  Partial<Pick<Fact, "quote" | "academic_year">>

function demo(f: DemoFact): Fact {
  return {
    academic_year: null,
    quote: null,
    ...f,
    verified_at: VERIFIED_AT,
    origin: "demo",
    certainty: "verified",
    snapshot: null,
  }
}

interface Card {
  id: string
  name: string
  name_ru: string
  city: string
  website: string
  facts?: Fact[]
}

function uni(c: Card): University {
  const facts = c.facts ?? []
  return {
    id: c.id,
    name: c.name,
    name_ru: c.name_ru,
    city: c.city,
    country: "CN",
    website: c.website,
    last_checked_at: facts.length ? VERIFIED_AT : null,
    facts,
    coverage: { published: facts.length, expected: CARD_EXPECTED },
  }
}

/* ---------- source pages (official) ---------- */

const TSINGHUA_INTL = "https://international.join-tsinghua.edu.cn/"
const ZJU_INTL = "https://iczu.zju.edu.cn/"
const SJTU_INTL = "https://isc.sjtu.edu.cn/EN/"
const XJTLU_FEES = "https://www.xjtlu.edu.cn/en/admissions/global/fees-and-scholarships"
const XJTLU_ENTRY = "https://www.xjtlu.edu.cn/en/admissions/ug/global/entry-requirements"

const TUITION_LABEL = "Стоимость обучения в год (иностранцы)"
const DEADLINE_LABEL = "Дедлайн подачи (иностранцы)"

export const FIXTURE_CATALOG: Catalog = {
  generated_at: "2026-08-31T00:00:00Z",
  prompt_version: 0,
  demo: true,
  universities: [
    uni({
      id: "tsinghua",
      name: "Tsinghua University",
      name_ru: "Университет Цинхуа",
      city: "Beijing",
      website: "https://www.tsinghua.edu.cn/",
      facts: [
        demo({
          key: "fees.tuition_year_non_eu",
          label_ru: TUITION_LABEL,
          value: { amount_minor_min: 2_600_000, amount_minor_max: 4_000_000, currency: "CNY" },
          display: "26 000 – 40 000 ¥ в год",
          academic_year: "2026/2027",
          source_url: TSINGHUA_INTL,
        }),
        demo({
          key: "requirements.hsk_min",
          label_ru: "Минимальный HSK",
          value: { value: 5 },
          display: "HSK 5",
          academic_year: "2026/2027",
          source_url: TSINGHUA_INTL,
        }),
        demo({
          key: "deadline.fall.application_non_eu",
          label_ru: DEADLINE_LABEL,
          value: { date_min: "2025-11-28", date_max: "2026-02-28" },
          display: "два раунда: 30 сентября – 28 ноября 2025 и 29 ноября 2025 – 28 февраля 2026",
          academic_year: "2026/2027",
          source_url: TSINGHUA_INTL,
        }),
      ],
    }),
    uni({
      id: "pku",
      name: "Peking University",
      name_ru: "Пекинский университет",
      city: "Beijing",
      website: "https://www.pku.edu.cn/",
    }),
    uni({
      id: "fudan",
      name: "Fudan University",
      name_ru: "Фуданьский университет",
      city: "Shanghai",
      website: "https://www.fudan.edu.cn/",
    }),
    uni({
      id: "sjtu",
      name: "Shanghai Jiao Tong University",
      name_ru: "Шанхайский университет Цзяотун",
      city: "Shanghai",
      website: "https://www.sjtu.edu.cn/",
      facts: [
        demo({
          key: "fees.tuition_year_non_eu",
          label_ru: TUITION_LABEL,
          value: { amount_minor: 12_000_000, currency: "CNY" },
          display: "120 000 ¥ в год (англоязычный бакалавриат)",
          academic_year: "2026/2027",
          source_url: SJTU_INTL,
        }),
        demo({
          key: "deadline.fall.application_non_eu",
          label_ru: DEADLINE_LABEL,
          value: { date: "2026-03-31" },
          display: "31 марта 2026",
          academic_year: "2026/2027",
          source_url: SJTU_INTL,
        }),
      ],
    }),
    uni({
      id: "zju",
      name: "Zhejiang University",
      name_ru: "Чжэцзянский университет",
      city: "Hangzhou",
      website: "https://www.zju.edu.cn/",
      facts: [
        demo({
          key: "fees.tuition_year_non_eu",
          label_ru: TUITION_LABEL,
          value: { amount_minor_min: 1_980_000, amount_minor_max: 4_280_000, currency: "CNY" },
          display: "19 800 – 42 800 ¥ в год",
          academic_year: "2026/2027",
          source_url: ZJU_INTL,
        }),
        demo({
          key: "deadline.fall.application_non_eu",
          label_ru: DEADLINE_LABEL,
          value: { date: "2026-02-28" },
          display: "28 февраля 2026 (приём заявок с 1 декабря 2025)",
          academic_year: "2026/2027",
          source_url: ZJU_INTL,
        }),
        demo({
          key: "requirements.csca_required",
          label_ru: "Требуется CSCA",
          value: { value: true },
          display: "требуется с 2026/27",
          academic_year: "2026/2027",
          source_url: ZJU_INTL,
        }),
      ],
    }),
    uni({
      id: "ustc",
      name: "University of Science and Technology of China",
      name_ru: "Университет науки и технологий Китая",
      city: "Hefei",
      website: "https://www.ustc.edu.cn/",
    }),
    uni({
      id: "nju",
      name: "Nanjing University",
      name_ru: "Нанкинский университет",
      city: "Nanjing",
      website: "https://www.nju.edu.cn/",
    }),
    uni({
      id: "hit",
      name: "Harbin Institute of Technology",
      name_ru: "Харбинский политехнический университет",
      city: "Harbin",
      website: "https://www.hit.edu.cn/",
    }),
    uni({
      id: "xjtu",
      name: "Xi'an Jiaotong University",
      name_ru: "Сианьский университет Цзяотун",
      city: "Xi'an",
      website: "https://www.xjtu.edu.cn/",
    }),
    uni({
      id: "hust",
      name: "Huazhong University of Science and Technology",
      name_ru: "Хуачжунский университет науки и технологий",
      city: "Wuhan",
      website: "https://www.hust.edu.cn/",
    }),
    uni({
      id: "bnu",
      name: "Beijing Normal University",
      name_ru: "Пекинский педагогический университет",
      city: "Beijing",
      website: "https://www.bnu.edu.cn/",
    }),
    uni({
      id: "hohai",
      name: "Hohai University",
      name_ru: "Хохайский университет",
      city: "Nanjing",
      website: "https://www.hhu.edu.cn/",
    }),
    uni({
      id: "xjtlu",
      name: "Xi'an Jiaotong-Liverpool University",
      name_ru: "Сианьский университет Цзяотун-Ливерпуль",
      city: "Suzhou",
      website: "https://www.xjtlu.edu.cn/",
      facts: [
        demo({
          key: "fees.tuition_year_non_eu",
          label_ru: TUITION_LABEL,
          value: { amount_minor: 9_300_000, currency: "CNY" },
          display: "93 000 ¥ в год",
          academic_year: "2025/2026",
          quote: "International Students: RMB 93,000 per academic year.",
          source_url: XJTLU_FEES,
        }),
        demo({
          key: "requirements.ielts_min",
          label_ru: "Минимальный IELTS",
          value: { value: 5 },
          display: "IELTS 5.0 на первый курс, 6.5 при поступлении сразу на второй",
          academic_year: "2026/2027",
          quote: "IELTS: 5.0 (min 4.5 in all sections)",
          source_url: XJTLU_ENTRY,
        }),
      ],
    }),
    uni({
      id: "smbu",
      name: "Shenzhen MSU-BIT University",
      name_ru: "Университет МГУ-ППИ в Шэньчжэне",
      city: "Shenzhen",
      website: "https://smbu.edu.cn/",
    }),
    uni({
      id: "tongji",
      name: "Tongji University",
      name_ru: "Университет Тунцзи",
      city: "Shanghai",
      website: "https://www.tongji.edu.cn/",
    }),
    uni({
      id: "whu",
      name: "Wuhan University",
      name_ru: "Уханьский университет",
      city: "Wuhan",
      website: "https://www.whu.edu.cn/",
    }),
    uni({
      id: "sysu",
      name: "Sun Yat-sen University",
      name_ru: "Университет Сунь Ятсена",
      city: "Guangzhou",
      website: "https://www.sysu.edu.cn/",
    }),
    uni({
      id: "sustech",
      name: "Southern University of Science and Technology",
      name_ru: "Южный университет науки и технологий",
      city: "Shenzhen",
      website: "https://www.sustech.edu.cn/",
    }),
    uni({
      id: "shu",
      name: "Shanghai University",
      name_ru: "Шанхайский университет",
      city: "Shanghai",
      website: "https://www.shu.edu.cn/",
    }),
    uni({
      id: "bit",
      name: "Beijing Institute of Technology",
      name_ru: "Пекинский технологический институт",
      city: "Beijing",
      website: "https://www.bit.edu.cn/",
    }),
  ],
}
