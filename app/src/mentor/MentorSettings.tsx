import { useEffect, useState, type FormEvent } from "react"
import { motion } from "framer-motion"
import { UserPlus } from "lucide-react"

import { fadeUp } from "@/lib/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import type { CabinetApi } from "@/auth/api"
import { errorMessageRu, type Organization, type OrgMember, type OrgRole } from "@/lib/cabinet"

export interface MentorSettingsProps {
  api: CabinetApi
  org: Organization
  isAdmin: boolean
  onOrgChanged: (org: Organization) => void
}

const ROLE_RU: Record<OrgRole, string> = { admin: "администратор", mentor: "наставник" }

/**
 * Организация (cabinet spec §5, admin only): name, tagline, Telegram – the
 * brand the students see – and the members: list, add by e-mail (the person
 * must have signed in at least once; otherwise the database says so).
 */
export function MentorSettings({ api, org, isAdmin, onOrgChanged }: MentorSettingsProps) {
  const toast = useToast()
  const [name, setName] = useState(org.name)
  const [tagline, setTagline] = useState(org.tagline ?? "")
  const [telegram, setTelegram] = useState(org.telegram ?? "")
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<OrgMember[] | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("mentor")
  const [adding, setAdding] = useState(false)

  const [prevOrg, setPrevOrg] = useState(org)
  if (prevOrg !== org) {
    setPrevOrg(org)
    setName(org.name)
    setTagline(org.tagline ?? "")
    setTelegram(org.telegram ?? "")
  }

  useEffect(() => {
    let alive = true
    api
      .listMembers(org.id)
      .then((m) => alive && setMembers(m))
      .catch((e: unknown) => alive && toast(errorMessageRu(e)))
    return () => {
      alive = false
    }
  }, [api, org.id, toast])

  const tgClean = telegram.trim().replace(/^@/, "")
  const dirty = name.trim() !== org.name || tagline.trim() !== (org.tagline ?? "") || tgClean !== (org.telegram ?? "")
  const tgValid = tgClean === "" || /^[A-Za-z0-9_]{1,64}$/.test(tgClean)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || !name.trim() || !tgValid) return
    setSaving(true)
    const patch = { name: name.trim().slice(0, 80), tagline: tagline.trim().slice(0, 160) || null, telegram: tgClean || null }
    try {
      await api.updateOrg(org.id, patch)
      onOrgChanged({ ...org, ...patch })
      toast("Организация сохранена")
    } catch (err) {
      toast(errorMessageRu(err))
    } finally {
      setSaving(false)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    try {
      await api.addMemberByEmail(org.id, email.trim(), role)
      setMembers(await api.listMembers(org.id))
      setEmail("")
      toast("Участник добавлен")
    } catch (err) {
      toast(errorMessageRu(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-4">
      <Card className="gap-0 p-5">
        <Kicker as="h2">Бренд для учеников</Kicker>
        <p className="mt-1 text-xs text-fg-muted">Название и слоган ученики видят в шапке, Телеграм – в кнопке «Написать наставнику».</p>
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="org-name" className="mb-1.5">
              Название
            </Label>
            <Input id="org-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required />
          </div>
          <div>
            <Label htmlFor="org-tagline" className="mb-1.5">
              Слоган
            </Label>
            <Input id="org-tagline" value={tagline} maxLength={160} onChange={(e) => setTagline(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label htmlFor="org-telegram" className="mb-1.5">
              Телеграм (без @)
            </Label>
            <Input id="org-telegram" value={telegram} maxLength={64} onChange={(e) => setTelegram(e.target.value)} disabled={!isAdmin} placeholder="zhuiqiu_yu" />
            {!tgValid && <p className="mt-1 text-xs text-danger">Латиница, цифры и подчёркивание.</p>}
          </div>
          {isAdmin ? (
            <div>
              <Button type="submit" disabled={!dirty || saving || !name.trim() || !tgValid}>
                Сохранить
              </Button>
            </div>
          ) : (
            <p className="text-xs text-fg-faint">Менять бренд может администратор организации.</p>
          )}
        </form>
      </Card>

      <Card className="gap-0 p-5">
        <Kicker as="h2">Участники</Kicker>
        {members === null ? (
          <p className="mt-3 text-sm text-fg-muted">Загружаем участников</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 break-all">{m.email}</span>
                <Badge variant={m.role === "admin" ? "default" : "outline"}>{ROLE_RU[m.role]}</Badge>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form onSubmit={add} className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="member-email" className="mb-1.5">
                Email участника
              </Label>
              <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mentor@example.com" required />
            </div>
            <div className="sm:w-44">
              <Label htmlFor="member-role" className="mb-1.5">
                Роль
              </Label>
              <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                <option value="mentor">наставник</option>
                <option value="admin">администратор</option>
              </Select>
            </div>
            <Button type="submit" disabled={adding || !email.trim()}>
              <UserPlus />
              Добавить
            </Button>
          </form>
        )}
        <p className="mt-3 text-xs text-fg-faint">Добавить можно только человека, который уже входил на сайт по своему email.</p>
      </Card>
    </motion.div>
  )
}
