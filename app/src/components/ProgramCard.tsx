import { motion } from "framer-motion"
import { ArrowRight, Banknote, Calendar, GraduationCap, Heart, MapPin, Star } from "lucide-react"

import { ProgramLogo } from "@/components/ProgramLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { deadlineLabel } from "@/lib/roadmap"
import type { AnyProgram, Grant, Internship, University } from "@/legacy"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}

/** Единый дедлайн-бейдж (всегда с иконкой календаря). */
export function DeadlineBadge({ days }: { days: number }) {
  const d = deadlineLabel(days)
  const variant =
    d.tone === "danger" ? "destructive" : d.tone === "warn" ? "warning" : d.tone === "info" ? "default" : "secondary"
  return (
    <Badge variant={variant}>
      <Calendar className="size-3" />
      {d.txt}
    </Badge>
  )
}

/* Свободный взгляд на union – все поля опциональны */
type LooseItem = AnyProgram & Partial<University> & Partial<Grant> & Partial<Internship>

/**
 * Карточка программы – ОДНА реализация для каталога (Найти)
 * и для сохранённых (Мои программы). Канон дизайн-системы:
 * p-5 sm:p-6 · логотип size-10 · заголовок 15px medium (переносится) ·
 * подзаголовок 13px · футер pt-3 gap-2 · иконки кнопок – системные size-4.
 */
export function ProgramCard({
  u,
  saved,
  prio,
  toggleSave,
  togglePrio,
  onOpen,
}: {
  u: AnyProgram
  saved: boolean
  prio: boolean
  toggleSave: (id: string) => void
  togglePrio: (id: string) => void
  onOpen: (item: AnyProgram) => void
}) {
  const it = u as LooseItem
  const isUni = Boolean(it.program)
  const isGrant = Boolean(it.funding)

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }} className="h-full">
      <Card
        className="h-full cursor-pointer gap-4 p-5 sm:p-6"
        onClick={() => onOpen(u)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(u)}
      >
        {/* head */}
        <div className="flex items-start gap-3">
          <ProgramLogo item={u} className="size-10 rounded-xl text-base font-semibold" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-snug font-medium break-words">{u.name}</div>
            <div className="mt-0.5 text-[13px] break-words text-fg-muted">
              {isUni ? it.program : isGrant ? it.org : it.role}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0", saved ? "text-accent-text hover:text-accent-text" : "hover:text-accent-text")}
            title={saved ? "В избранном" : "Сохранить"}
            aria-pressed={saved}
            aria-label={saved ? "Убрать из сохранённых" : "Сохранить"}
            onClick={(e) => {
              e.stopPropagation()
              toggleSave(u.id)
            }}
          >
            <Heart className={cn("size-4.5", saved && "fill-current")} />
          </Button>
        </div>

        {/* meta */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-fg-muted">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" /> {it.city || u.country}
          </span>
          {it.degree && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <GraduationCap className="size-3.5 shrink-0" /> {it.degree}
            </span>
          )}
          {it.duration && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Calendar className="size-3.5 shrink-0" /> {it.duration}
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-1">
            <Banknote className="size-3.5 shrink-0" /> {it.tuition || it.amount || it.stipend}
          </span>
        </div>

        {/* tags */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{it.field || it.industry}</Badge>
          {it.language && <Badge variant="secondary">{it.language}</Badge>}
          {it.scholarship && <Badge>Гранты</Badge>}
          {it.format && <Badge variant="secondary">{it.format}</Badge>}
        </div>

        {/* description */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-fg-muted">{u.desc}</p>

        {/* footer */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <DeadlineBadge days={u.deadlineDays} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(prio && "text-warning hover:text-warning")}
              onClick={(e) => {
                e.stopPropagation()
                togglePrio(u.id)
              }}
            >
              <Star className={cn(prio && "fill-current")} />
              {prio ? "Приоритет" : "В приоритеты"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onOpen(u)
              }}
            >
              Подробнее <ArrowRight />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
