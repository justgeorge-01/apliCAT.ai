/**
 * The student's cabinet as one object for the tree (context) and the hook that
 * builds it in the shell. Guests get the local stores (exactly the old
 * behaviour plus tasks in `admitica.cn.tasks`); a signed-in user gets the
 * remote stores, their organization (→ brand), tasks, mentor notes and the
 * one-button transfer of the browser plan.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import {
  errorMessageRu,
  orgToPartner,
  shouldTouchLastSeen,
  type MentorNote,
  type Membership,
  type Mentorship,
  type Organization,
  type Profile,
} from "@/lib/cabinet"
import type { ChinaProfile } from "@/lib/match"
import { setOrgPartner } from "@/lib/partner"
import { emptyPlan, type Plan } from "@/lib/plan"
import { localPlanStore, remotePlanStore, type PlanStore } from "@/lib/planStore"
import {
  localTaskStore,
  patchTask,
  remoteTaskStore,
  removeTask,
  sortTasks,
  upsertTask,
  LOCAL_STUDENT_ID,
  type Task,
  type TaskInput,
  type TaskPatch,
  type TaskStore,
  type TaskViewer,
} from "@/lib/tasks"
import type { AuthUser, Backend, ProfilePatch } from "./api"
import { clearLocalCabinetKeys, localSnapshot, transferLocal, transferOffer } from "./transfer"
import { redirectUrl } from "./url"
import type { SessionState } from "./useSession"

export interface TransferState {
  /** null – nothing to offer. */
  offer: { universities: number; tasks: number } | null
  running: boolean
  run(): Promise<void>
}

export interface Cabinet {
  backend: Backend | null
  session: SessionState
  /** FEATURES.accounts and a backend exist. */
  enabled: boolean
  signed: boolean
  user: AuthUser | null
  loading: boolean
  profile: Profile | null
  org: Organization | null
  mentorship: Mentorship | null
  memberships: Membership[]
  isMember: boolean
  notes: MentorNote[]
  tasks: Task[]
  taskViewer: TaskViewer
  planStore: PlanStore
  addTask(input: TaskInput): Promise<boolean>
  toggleTask(id: string): Promise<void>
  editTask(id: string, patch: TaskPatch): Promise<boolean>
  deleteTask(id: string): Promise<void>
  joinOrg(code: string): Promise<Organization | null>
  updateProfile(patch: ProfilePatch): Promise<boolean>
  signOut(): Promise<void>
  /** Sends the «удалить аккаунт» e-mail (a magic link back to `?confirm=delete`). */
  requestDeleteLink(): Promise<boolean>
  /** `delete_own_account()` → sign out → local keys cleared. */
  deleteAccount(): Promise<boolean>
  transfer: TransferState
  reload(): Promise<void>
}

const GUEST_VIEWER: TaskViewer = { kind: "student", uid: LOCAL_STUDENT_ID }

function guestCabinet(backend: Backend | null, session: SessionState): Cabinet {
  const none = async () => false
  return {
    backend,
    session,
    enabled: backend !== null,
    signed: false,
    user: null,
    loading: false,
    profile: null,
    org: null,
    mentorship: null,
    memberships: [],
    isMember: false,
    notes: [],
    tasks: [],
    taskViewer: GUEST_VIEWER,
    planStore: localPlanStore,
    addTask: none,
    toggleTask: async () => {},
    editTask: none,
    deleteTask: async () => {},
    joinOrg: async () => null,
    updateProfile: none,
    signOut: async () => {},
    requestDeleteLink: none,
    deleteAccount: none,
    transfer: { offer: null, running: false, run: async () => {} },
    reload: async () => {},
  }
}

export const CabinetCtx = createContext<Cabinet>(guestCabinet(null, { status: "off" }))

export function useCabinet(): Cabinet {
  return useContext(CabinetCtx)
}

export interface UseStudentCabinetOptions {
  backend: Backend | null
  session: SessionState
  toast: (msg: string) => void
  /** The shell's plan state: replaced after a store switch, a reload or the transfer. */
  onPlanLoaded: (plan: Plan) => void
  /** The shell's onboarding answers (admitica.cn.profile) – mirrored from / to the account. */
  onOnboardingLoaded: (p: ChinaProfile | null) => void
}

interface Loaded {
  uid: string
  profile: Profile
  org: Organization | null
  mentorship: Mentorship | null
  memberships: Membership[]
  notes: MentorNote[]
  tasks: Task[]
  plan: Plan
}

/**
 * Builds the cabinet for the shell. Rules of hooks: always called; when there
 * is no backend / session it returns the guest cabinet with local stores.
 */
export function useStudentCabinet({ backend, session, toast, onPlanLoaded, onOnboardingLoaded }: UseStudentCabinetOptions): Cabinet {
  const user = session.status === "signed" ? session.user : null
  const uid = user?.id ?? null
  const api = backend?.data ?? null

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [transferOfferState, setTransferOffer] = useState<TransferState["offer"]>(null)
  const [transferRunning, setTransferRunning] = useState(false)
  const lastSeenTouched = useRef<string | null>(null)

  // Stores follow the session.
  const planStore = useMemo<PlanStore>(() => (api && uid ? remotePlanStore(api, uid) : localPlanStore), [api, uid])
  const taskStore = useMemo<TaskStore>(
    () => (api && uid ? remoteTaskStore(api, { studentId: uid, authorId: uid, orgId: null }) : localTaskStore()),
    [api, uid],
  )

  /** Fetches everything of the signed-in student (no state changes here). */
  const fetchAll = useCallback(async (): Promise<Loaded | null> => {
    if (!api || !uid) return null
    const [profile, mine, memberships, notes, remoteTasks, plan] = await Promise.all([
      api.getProfile(uid),
      api.getMyOrg(uid),
      api.listMemberships(uid),
      api.listNotes(uid),
      api.listTasks(uid),
      planStore.load(),
    ])
    return { uid, profile, org: mine?.org ?? null, mentorship: mine?.mentorship ?? null, memberships, notes, tasks: remoteTasks, plan }
  }, [api, uid, planStore])

  /** Puts a fetched account (or the guest's local data) into state. */
  const apply = useCallback(
    (r: Loaded | null, localPlan?: Plan, localTasks?: Task[]) => {
      if (!r) {
        setOrgPartner(null)
        setLoaded(null)
        setTasks(localTasks ?? [])
        setTransferOffer(null)
        if (localPlan) onPlanLoaded(localPlan)
        return
      }
      setOrgPartner(r.org ? orgToPartner(r.org) : null)
      setLoaded(r)
      setTasks(r.tasks)
      onPlanLoaded(r.plan)
      if (r.profile.onboarding) onOnboardingLoaded(r.profile.onboarding)
      setTransferOffer(transferOffer(r.uid, r.plan))
      if (api && lastSeenTouched.current !== r.uid && shouldTouchLastSeen(r.profile.lastSeenAt, new Date())) {
        lastSeenTouched.current = r.uid
        void api.updateProfile(r.uid, { lastSeenAt: new Date().toISOString() }).catch(() => {})
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the shell callbacks are stable setters
    [api],
  )

  useEffect(() => {
    if (session.status === "loading") return
    let alive = true
    if (!api || !uid) {
      Promise.all([localPlanStore.load(), localTaskStore().list()]).then(([plan, list]) => {
        if (alive) apply(null, plan, list)
      })
    } else {
      fetchAll()
        .then((r) => alive && apply(r))
        .catch((e: unknown) => alive && toast(errorMessageRu(e)))
    }
    return () => {
      alive = false
    }
  }, [api, uid, session.status, fetchAll, apply, toast])

  const load = useCallback(async () => {
    try {
      apply(await fetchAll())
    } catch (e) {
      toast(errorMessageRu(e))
    }
  }, [fetchAll, apply, toast])

  const loading = Boolean(uid) && (loaded === null || loaded.uid !== uid)

  const fail = useCallback(
    (e: unknown) => {
      toast(errorMessageRu(e))
      return false
    },
    [toast],
  )

  /* ----- tasks (optimistic) ----- */

  const addTask = useCallback(
    async (input: TaskInput) => {
      try {
        const t = await taskStore.add(input)
        setTasks((list) => upsertTask(list, t))
        return true
      } catch (e) {
        return fail(e)
      }
    },
    [taskStore, fail],
  )

  const editTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      let before: Task[] = []
      setTasks((list) => {
        before = list
        return patchTask(list, id, patch)
      })
      try {
        await taskStore.update(id, patch)
        return true
      } catch (e) {
        setTasks(before)
        return fail(e)
      }
    },
    [taskStore, fail],
  )

  const toggleTask = useCallback(
    async (id: string) => {
      const t = tasks.find((x) => x.id === id)
      if (!t) return
      await editTask(id, { doneAt: t.doneAt ? null : new Date().toISOString() })
    },
    [tasks, editTask],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      let before: Task[] = []
      setTasks((list) => {
        before = list
        return removeTask(list, id)
      })
      try {
        await taskStore.remove(id)
      } catch (e) {
        setTasks(before)
        fail(e)
      }
    },
    [taskStore, fail],
  )

  /* ----- organization / profile / account ----- */

  const joinOrg = useCallback(
    async (code: string) => {
      if (!api) return null
      try {
        const org = await api.joinOrg(code)
        setOrgPartner(orgToPartner(org))
        await load()
        toast(`Ты подключён к ${org.name}`)
        return org
      } catch (e) {
        fail(e)
        return null
      }
    },
    [api, load, fail, toast],
  )

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!api || !uid) return false
      try {
        await api.updateProfile(uid, patch)
        setLoaded((l) =>
          l
            ? {
                ...l,
                profile: {
                  ...l.profile,
                  ...("nick" in patch ? { nick: patch.nick ?? null } : {}),
                  ...("onboarding" in patch ? { onboarding: patch.onboarding ?? null } : {}),
                },
              }
            : l,
        )
        return true
      } catch (e) {
        return fail(e)
      }
    },
    [api, uid, fail],
  )

  const signOut = useCallback(async () => {
    if (!backend) return
    try {
      await backend.auth.signOut()
      setOrgPartner(null)
    } catch (e) {
      fail(e)
    }
  }, [backend, fail])

  const requestDeleteLink = useCallback(async () => {
    if (!backend || !user?.email) return false
    try {
      await backend.auth.sendMagicLink(user.email, {
        redirectTo: redirectUrl(location.href, true),
        consentAt: loaded?.profile.consentAt ?? new Date().toISOString(),
      })
      return true
    } catch (e) {
      return fail(e)
    }
  }, [backend, user, loaded, fail])

  const deleteAccount = useCallback(async () => {
    if (!backend) return false
    try {
      await backend.data.deleteOwnAccount()
      clearLocalCabinetKeys()
      setOrgPartner(null)
      try {
        await backend.auth.signOut()
      } catch {
        /* the user is gone already */
      }
      return true
    } catch (e) {
      return fail(e)
    }
  }, [backend, fail])

  const runTransfer = useCallback(async () => {
    if (!api || !uid || !loaded) return
    setTransferRunning(true)
    try {
      const result = await transferLocal(api, uid, loaded.profile, localSnapshot())
      onPlanLoaded(result.plan)
      // the remote store must learn the new state
      await planStore.load()
      setTasks((list) => [...list, ...result.tasks])
      if (result.onboarding) onOnboardingLoaded(result.onboarding)
      setLoaded((l) => (l ? { ...l, profile: { ...l.profile, onboarding: result.onboarding } } : l))
      setTransferOffer(null)
      toast(`Перенесли в аккаунт: ${result.plan.universities.length} вуз(а/ов), задач ${result.tasks.length}`)
    } catch (e) {
      fail(e)
    } finally {
      setTransferRunning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shell callbacks are stable setters
  }, [api, uid, loaded, planStore, toast, fail])

  return useMemo<Cabinet>(() => {
    if (!backend || !uid) {
      const guest = guestCabinet(backend, session)
      return {
        ...guest,
        tasks: sortTasks(tasks),
        addTask,
        toggleTask,
        editTask,
        deleteTask,
        reload: load,
      }
    }
    return {
      backend,
      session,
      enabled: true,
      signed: true,
      user,
      loading,
      profile: loaded?.uid === uid ? loaded.profile : null,
      org: loaded?.uid === uid ? loaded.org : null,
      mentorship: loaded?.uid === uid ? loaded.mentorship : null,
      memberships: loaded?.uid === uid ? loaded.memberships : [],
      isMember: loaded?.uid === uid ? loaded.memberships.length > 0 : false,
      notes: loaded?.uid === uid ? loaded.notes : [],
      tasks: sortTasks(tasks),
      taskViewer: { kind: "student", uid },
      planStore,
      addTask,
      toggleTask,
      editTask,
      deleteTask,
      joinOrg,
      updateProfile,
      signOut,
      requestDeleteLink,
      deleteAccount,
      transfer: { offer: transferOfferState, running: transferRunning, run: runTransfer },
      reload: load,
    }
  }, [
    backend,
    session,
    uid,
    user,
    loading,
    loaded,
    tasks,
    planStore,
    addTask,
    toggleTask,
    editTask,
    deleteTask,
    joinOrg,
    updateProfile,
    signOut,
    requestDeleteLink,
    deleteAccount,
    transferOfferState,
    transferRunning,
    runTransfer,
    load,
  ])
}

/** The plan the guest cabinet starts with (before the first load). */
export const INITIAL_PLAN: Plan = emptyPlan()
