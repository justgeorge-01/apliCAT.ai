import type { Partner } from "./partner"

/** The public build: no lead, no popup, plain Abitura header. */
export const DEFAULT_PARTNER_SLUG = "abitura"

/**
 * Registry of partner configs. A partner's brand is shown only when its slug is
 * explicitly selected (`?partner=` or `VITE_PARTNER`), never by default.
 *
 * `demo` is the partner config: the Telegram link is the partner's own handle,
 * replaces once the partner has agreed; the copy is deliberately neutral and
 * makes no claims about the partner's results.
 */
export const PARTNERS: Record<string, Partner> = {
  abitura: {
    slug: "abitura",
    name: "Abitura",
    tagline: "Поступление в Китай: проверенные факты с официальных страниц вузов",
  },
  demo: {
    slug: "demo",
    name: "Демо-агентство",
    tagline: "Наставник по поступлению в вузы Китая",
    lead: {
      label: "Обсудить с наставником",
      // Placeholder – the owner replaces it with the partner's real Telegram.
      url: "https://t.me/example_handle",
    },
    expertPage: {
      title: "Демо-агентство разбирает такие кейсы",
      paragraphs: [
        "Витрина показывает только формальные условия с официальных страниц вузов. Какой вуз выбрать, как собрать документы и в какой раунд подаваться – это разбирает наставник.",
        "Напишите в Телеграм: коротко о себе, какие вузы добавили в план и что вызывает вопросы.",
      ],
    },
  },
}
