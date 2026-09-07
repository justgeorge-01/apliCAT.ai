import type { Partner } from "./partner"

/** The public build: no lead, no popup, plain Abitura header. */
export const DEFAULT_PARTNER_SLUG = "abitura"

/**
 * Registry of partner configs. A partner's brand is shown only when its slug is
 * explicitly selected (`?partner=` or `VITE_PARTNER`), never by default.
 *
 * `zhuiqiu` is the partner config: the Telegram link is the partner's own
 * handle (@zhuiqiu_yu); the copy is deliberately neutral and makes no claims
 * about the partner's results.
 */
export const PARTNERS: Record<string, Partner> = {
  abitura: {
    slug: "abitura",
    name: "Abitura",
    tagline: "Поступление в Китай: проверенные факты с официальных страниц вузов",
  },
  zhuiqiu: {
    slug: "zhuiqiu",
    name: "Zhuiqiu",
    tagline: "Наставник по поступлению в вузы Китая",
    lead: {
      label: "Обсудить с наставником",
      // The partner's Telegram, set by the owner on 07.09.2026.
      url: "https://t.me/zhuiqiu_yu",
    },
    expertPage: {
      title: "Zhuiqiu разбирает такие кейсы",
      paragraphs: [
        "Витрина показывает только формальные условия с официальных страниц вузов. Какой вуз выбрать, как собрать документы и в какой раунд подаваться – это разбирает наставник.",
        "Напишите в Телеграм: коротко о себе, какие вузы добавили в план и что вызывает вопросы.",
      ],
    },
  },
}
