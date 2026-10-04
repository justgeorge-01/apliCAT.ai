import { HanziKicker } from "@/components/ui/hanzi-kicker"
import type { GuideData } from "@/data/guide"

const SECTIONS: readonly { title: string; paragraphs: readonly string[] }[] = [
  {
    title: "Что это",
    paragraphs: [
      "Путеводитель по вузам Китая для тех, кто выбирает, куда поступать. По каждому вузу – короткое описание, несколько официальных условий и подборка ссылок: что пишут и снимают студенты, особенно иностранные и русскоязычные.",
    ],
  },
  {
    title: "Как собираются ссылки",
    paragraphs: [
      "Мы ищем открытые материалы на китайском, русском и английском: страницы вузов для иностранных студентов, видео, посты и статьи. Заголовок переводим на русский, пересказ в одно предложение пишем своими словами. Перед публикацией каждую ссылку смотрит человек.",
      "Тексты Xiaohongshu, Zhihu и других площадок, которые запрещают автоматический сбор, мы не скачиваем: даём ссылку и пересказ по её описанию в поиске. Чужие посты целиком на сайт не попадают, имён и ников авторов в пересказах нет.",
    ],
  },
  {
    title: "Откуда официальные условия",
    paragraphs: [
      "Язык обучения, стоимость, общежитие и дедлайны берутся только с официальных страниц вуза. У каждого значения есть цитата, ссылка и дата проверки. Если вуз ещё не опубликовал даты нового набора, мы показываем прошлогодние и помечаем их как прошлый цикл.",
    ],
  },
  {
    title: "Обсуждение",
    paragraphs: [
      "На странице каждого вуза можно задать вопрос или рассказать о своём опыте. Регистрации нет: сайт выдаёт анонимный ник вроде «Анонимная лягушка», и он привязан к случайному ключу в вашем браузере. По этому ключу вы можете удалить своё сообщение.",
      "Мы храним только текст сообщения, ник и хэш ключа браузера. Для защиты от спама сутки хранится хэш IP-адреса, сам адрес не записывается. Телефоны, почту и @ники сервер вычёркивает из текста до сохранения.",
      "Правила простые: без имён и контактов, без рекламы и оскорблений. Сообщения со ссылками появляются после проверки, сообщение с тремя жалобами скрывается до проверки.",
    ],
  },
  {
    title: "Чего здесь нет",
    paragraphs: [
      "Мы не продаём поступление, не берём комиссий с вузов и не оцениваем шансы. На сайте нет аккаунтов и счётчиков посещений. В браузере хранятся только выбранная тема оформления и ключ для обсуждения.",
    ],
  },
]

export function GuideAbout({ guide }: { guide: GuideData | null }) {
  const channel = guide?.telegram_channel ?? null
  return (
    <article className="flex max-w-prose flex-col gap-8">
      <header className="flex flex-col gap-4">
        <HanziKicker hanzi="关于">О проекте</HanziKicker>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">Abitura – вузы Китая глазами студентов</h1>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-fg-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
      {channel && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Нашли ошибку или битую ссылку</h2>
          <p className="text-[15px] leading-relaxed text-fg-muted">
            Напишите в комментариях нашего Telegram-канала{" "}
            <a href={`https://t.me/${channel}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-fg underline underline-offset-4">
              @{channel}
            </a>
            .
          </p>
        </section>
      )}
    </article>
  )
}
