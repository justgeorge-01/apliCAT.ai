import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"
import { getPartner, hasLead } from "@/lib/partner"

/* ---------- shared motion presets (ease-out, 200–300ms) ---------- */
const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

/** Date of the last wording change – shown at the top of the page. */
export const POLICY_UPDATED_AT = "2 сентября 2026"

interface Section {
  title: string
  paragraphs?: string[]
  bullets?: string[]
  after?: string[]
}

/**
 * The policy text (spec §3.8) – one place, reused by the page and by the
 * onboarding dialog. Plain strings, no markup, en-dashes only.
 */
function policySections(): Section[] {
  const partner = getPartner()
  const leadLine = hasLead(partner)
    ? `Кнопка «${partner.lead.label}» ведёт в Телеграм независимого консультанта (${partner.name}). Переход – ваше решение; мы ничего туда не передаём, вы пишете сами.`
    : "Если на сайте появится кнопка «Обсудить с наставником», она будет вести в Телеграм независимого консультанта. Переход – ваше решение; мы ничего туда не передаём."

  return [
    {
      title: "Что мы храним",
      paragraphs: [
        "Только в вашем браузере, на этом устройстве (localStorage). У витрины нет сервера, аккаунтов и базы пользователей – ничего не отправляется наружу.",
      ],
      bullets: [
        "Ответы онбординга: степень, год подачи, направление, язык обучения, уровень HSK или IELTS, бюджет в год.",
        "Мой план: выбранные вузы, статусы по ним и отметки о документах.",
        "Тема оформления и служебные отметки – например, показывали ли мы уже окно с предложением наставника.",
      ],
      after: [
        "Удалить всё можно в Настройках (кнопка сброса) или очистив данные сайта в браузере. Экспорт плана в JSON – ваша личная копия, к нам она не попадает.",
      ],
    },
    {
      title: "Чего мы не собираем",
      bullets: [
        "Имя, e-mail, телефон и любые контакты – их негде ввести.",
        "Файлы и документы – загрузки на сайте нет.",
        "Аналитику, счётчики и рекламные cookies – их на сайте нет.",
        "Оценку ваших шансов – мы её не считаем и не храним.",
      ],
    },
    {
      title: "Откуда данные о вузах",
      paragraphs: [
        "Каждый факт в карточке взят с официальной страницы вуза и показан со ссылкой на источник и датой проверки. Если у факта нет источника или даты, витрина его не показывает.",
        "Если вуз что-то не публикует, мы так и пишем: «вуз не публикует», а не подставляем значение. Демо-данные, которые не прошли автоматическую проверку, помечены серым бейджем «демо».",
      ],
    },
    {
      title: "Дедлайны и требования нужно сверять",
      paragraphs: [
        "Вузы меняют условия, а проверка не мгновенна. Перед подачей откройте официальную страницу по ссылке в карточке и сверьте дедлайн, стоимость, языковые требования и CSCA.",
        "Общие даты (сессии CSCA, окно стипендии CSC) даны с точностью до месяца – точный день смотрите на csca.cn и campuschina.org.",
      ],
    },
    {
      title: "Мы не консультируем и не сотрудничаем с вузами",
      paragraphs: [
        "Abitura – справочная витрина. Мы не представляем вузы, не принимаем заявки, не обещаем поступление и не оцениваем шансы.",
        leadLine,
      ],
    },
    {
      title: "Внешние ссылки и ресурсы",
      paragraphs: [
        "Внешние ссылки на сайте – официальные страницы вузов и Телеграм наставника, если он подключён. Шрифт Inter загружается с Google Fonts – это единственный сторонний ресурс, который использует сайт.",
      ],
    },
    {
      title: "Изменения",
      paragraphs: [`Текст может уточняться. Дата последнего изменения: ${POLICY_UPDATED_AT}.`],
    },
  ]
}

/** The sections as plain typography – used inside the page and the onboarding dialog. */
export function PolicyContent({ compact = false }: { compact?: boolean }) {
  const sections = policySections()
  return (
    <div className={compact ? "flex flex-col gap-5" : "flex flex-col gap-6"}>
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>{s.title}</h3>
          {s.paragraphs?.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-fg-muted">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fg-muted">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {s.after?.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-fg-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

export interface PolicyProps {
  onBack: () => void
}

/** «Политика и дисклеймер» – the page behind the footer link (spec §3.8). */
export default function Policy({ onBack }: PolicyProps) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-3xl">
      <motion.div variants={fadeUp}>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          Назад
        </Button>
        <Kicker className="mt-4">Abitura</Kicker>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">Политика и дисклеймер</h1>
        <p className="mt-2 text-sm text-fg-muted">Обновлено {POLICY_UPDATED_AT}</p>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6">
        <Card className="p-6 sm:p-8">
          <PolicyContent />
        </Card>
      </motion.div>
    </motion.div>
  )
}
