/**
 * Russian names and cities of the catalog universities, keyed by `University.id`.
 *
 * The export carries `name_ru: null` and no city: the pipeline's `entities`
 * have neither column yet. Until they do, the storefront fills the gap from
 * this table on load (`normalizeUniversity`), and a value the export does
 * carry always wins – so the day the pipeline starts exporting names, this
 * file simply stops being read for them.
 */
export interface UniversityNames {
  name_ru: string
  city: string
}

export const UNIVERSITY_NAMES_RU: Readonly<Record<string, UniversityNames>> = {
  "beijing-institute-of-technology": { name_ru: "Пекинский политехнический университет", city: "Пекин" },
  "beijing-normal-university": { name_ru: "Пекинский педагогический университет", city: "Пекин" },
  "fudan-university": { name_ru: "Университет Фудань", city: "Шанхай" },
  "harbin-institute-of-technology": { name_ru: "Харбинский политехнический университет", city: "Харбин" },
  "hohai-university": { name_ru: "Университет Хохай", city: "Нанкин" },
  "huazhong-university-of-science-and-technology": {
    name_ru: "Хуачжунский университет науки и технологии",
    city: "Ухань",
  },
  "nanjing-university": { name_ru: "Нанкинский университет", city: "Нанкин" },
  "peking-university": { name_ru: "Пекинский университет", city: "Пекин" },
  "shanghai-jiao-tong-university": { name_ru: "Шанхайский университет Цзяотун", city: "Шанхай" },
  "shanghai-university": { name_ru: "Шанхайский университет", city: "Шанхай" },
  "shenzhen-msu-bit-university": { name_ru: "Университет МГУ–ППИ в Шэньчжэне", city: "Шэньчжэнь" },
  "southern-university-of-science-and-technology": {
    name_ru: "Южный университет науки и технологий",
    city: "Шэньчжэнь",
  },
  "sun-yat-sen-university": { name_ru: "Университет Сунь Ятсена", city: "Гуанчжоу" },
  "tongji-university": { name_ru: "Университет Тунцзи", city: "Шанхай" },
  "tsinghua-university": { name_ru: "Университет Цинхуа", city: "Пекин" },
  "university-of-science-and-technology-of-china": {
    name_ru: "Научно-технический университет Китая",
    city: "Хэфэй",
  },
  "wuhan-university": { name_ru: "Уханьский университет", city: "Ухань" },
  "xi-an-jiaotong-liverpool-university": {
    name_ru: "Университет Сиань Цзяотун – Ливерпуль",
    city: "Сучжоу",
  },
  "xi-an-jiaotong-university": { name_ru: "Сианьский университет Цзяотун", city: "Сиань" },
  "zhejiang-university": { name_ru: "Чжэцзянский университет", city: "Ханчжоу" },
}
