import { motion } from "framer-motion"
import { Download, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Switch } from "@/components/ui/switch"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import type { RoadmapEntry } from "@/legacy"
import { FEATURES } from "@/lib/features"
import { cn } from "@/lib/utils"

export interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  name: string
  setName: (n: string) => void
  plan: string
  setPlan: (p: string) => void
  theme: "dark" | "light"
  onToggleTheme: () => void
  savedIds: string[]
  priorities: string[]
  roadmaps: RoadmapEntry[]
  onReset: () => void
}

/* ---------- shared motion presets (ease-out, 200–300ms) ---------- */
const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}

const PLANS = ["Free", "Pro", "Premium"]

/* Notification rows – static "on/off" demo switches, как в легаси */
const NOTIFICATIONS: { label: string; on: boolean }[] = [
  { label: "Дедлайны программ", on: true },
  { label: "Напоминание заходить каждый день", on: true },
  { label: "Новые гранты", on: false },
]

/* The kicker sits on an inner span: index.css styles h3 outside a cascade
   layer, so the body-font utility on the heading itself would be overridden. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3">
      <Kicker as="span">{children}</Kicker>
    </h3>
  )
}

export default function SettingsDialog({
  open,
  onClose,
  name,
  setName,
  plan,
  setPlan,
  theme,
  onToggleTheme,
  savedIds,
  priorities,
  roadmaps,
  onReset,
}: SettingsDialogProps) {
  // The «Китай» storefront collects no name and sells nothing: only the
  // appearance and the data sections are shown. The legacy sections stay for
  // the European market (VITE_MARKET=europe).
  const legacy = FEATURES.market === "europe"
  const stats: { label: string; value: React.ReactNode }[] = [
    { label: "Сохранено программ", value: savedIds.length },
    { label: "Приоритетов", value: priorities.length },
    { label: "Дорожных карт", value: roadmaps.length },
    { label: "В Admitica с", value: "октября 2024" },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col px-6 py-5"
        >
          {/* Профиль – legacy only (COLLECT_NAME=false in the storefront) */}
          {legacy && (
            <motion.section variants={fadeUp}>
              <SectionTitle>Профиль</SectionTitle>
              <div className="flex items-center gap-3">
                <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent font-display text-[22px] font-bold text-accent-fg">
                  {(name || "У").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Имя" />
                  <div className="mt-1 text-xs text-fg-muted">Имя для приветствия</div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Внешний вид */}
          <motion.section variants={fadeUp} className={cn(legacy && "mt-6 border-t border-border pt-5")}>
            <SectionTitle>Внешний вид</SectionTitle>
            <div className="flex items-center justify-between py-1">
              <span className="text-[13px]">Тема оформления</span>
              <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
            </div>
          </motion.section>

          {/* Подписка – legacy only */}
          {legacy && (
            <motion.section variants={fadeUp} className="mt-6 border-t border-border pt-5">
              <SectionTitle>Подписка</SectionTitle>
              <div className="mb-3 flex gap-2">
                {PLANS.map((p) => (
                  <Button
                    key={p}
                    variant={plan === p ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => setPlan(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">
                Pro: разбор эссе, экспорт в PDF, дополнительные фильтры. Premium: личные
                консультации с ментором и проверка эссе экспертом.
              </p>
            </motion.section>
          )}

          {/* Уведомления – legacy only */}
          {legacy && (
            <motion.section variants={fadeUp} className="mt-6 border-t border-border pt-5">
              <SectionTitle>Уведомления</SectionTitle>
              <div className="flex flex-col">
                {NOTIFICATIONS.map((n) => (
                  <div key={n.label} className="flex items-center justify-between py-2">
                    <span className="text-[13px]">{n.label}</span>
                    <Switch defaultChecked={n.on} aria-label={n.label} />
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Статистика – legacy only */}
          {legacy && (
            <motion.section variants={fadeUp} className="mt-6 border-t border-border pt-5">
              <SectionTitle>Статистика</SectionTitle>
              <div className="rounded-lg border border-border bg-card-2 p-4">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className={cn("flex items-center justify-between text-[13px]", i > 0 && "mt-1.5")}
                  >
                    <span className="text-fg-muted">{s.label}</span>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Данные */}
          <motion.section variants={fadeUp} className="mt-6 border-t border-border pt-5">
            <SectionTitle>Данные</SectionTitle>
            {legacy ? (
              <Button variant="ghost" className="w-full justify-start">
                <Download /> Экспортировать всё в JSON
              </Button>
            ) : (
              <p className="mb-2 text-xs leading-relaxed text-fg-muted">
                Профиль и план хранятся только в этом браузере. Резервная копия плана – на странице «Мой план».
              </p>
            )}
            <Button
              variant="ghost"
              className="mt-1.5 w-full justify-start border border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => {
                if (confirm(legacy ? "Сбросить всё?" : "Удалить профиль и план из этого браузера?")) onReset()
              }}
            >
              <Trash2 /> {legacy ? "Сбросить аккаунт" : "Очистить данные"}
            </Button>
          </motion.section>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
