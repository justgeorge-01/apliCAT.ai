/**
 * The backend the cabinet talks to. Two implementations:
 *  - `supabaseBackend.ts` – the real one (Supabase Auth + PostgREST, RLS);
 *  - `fakeBackend.ts`     – in-memory, for unit tests and the dev preview
 *    (`VITE_CABINET_FAKE=1`); never part of a production build.
 * Everything above this line (stores, hooks, screens) sees only these types.
 */
import type { ChinaProfile } from "@/lib/match"
import type { MentorNote, Membership, Mentorship, Organization, OrgMember, OrgRole, Profile, StudentBundle } from "@/lib/cabinet"
import type { Plan } from "@/lib/plan"
import type { PlanOp } from "@/lib/planStore"
import type { NewTask, Task, TaskPatch } from "@/lib/tasks"

export interface AuthUser {
  id: string
  email: string | null
}

export interface MagicLinkOptions {
  /** Where the e-mail link returns to (must be in the project's Redirect URLs). */
  redirectTo: string
  /** ISO timestamp of the consent checkbox – stored with the account by the trigger. */
  consentAt: string
}

export interface AuthApi {
  /** The current user (null – guest). Also resolves the session from the URL after a magic link. */
  getUser(): Promise<AuthUser | null>
  /** Subscribe to sign-in / sign-out; returns the unsubscribe function. */
  onChange(cb: (user: AuthUser | null) => void): () => void
  sendMagicLink(email: string, opts: MagicLinkOptions): Promise<void>
  signOut(): Promise<void>
}

export interface ProfilePatch {
  nick?: string | null
  onboarding?: ChinaProfile | null
  lastSeenAt?: string
}

export interface OrgPatch {
  name?: string
  tagline?: string | null
  telegram?: string | null
}

export interface CabinetApi {
  /* ----- the student ----- */
  getProfile(uid: string): Promise<Profile>
  updateProfile(uid: string, patch: ProfilePatch): Promise<void>
  /** The student's active organization, null when there is none. */
  getMyOrg(uid: string): Promise<{ org: Organization; mentorship: Mentorship } | null>
  /** `join_org(code)` – throws CabinetError(invalid_code | already_in_org). */
  joinOrg(code: string): Promise<Organization>
  loadPlan(studentId: string): Promise<Plan>
  applyPlanOps(studentId: string, ops: PlanOp[]): Promise<void>
  listTasks(studentId: string): Promise<Task[]>
  insertTask(task: NewTask): Promise<Task>
  updateTask(id: string, patch: TaskPatch): Promise<void>
  deleteTask(id: string): Promise<void>
  listNotes(studentId: string): Promise<MentorNote[]>
  /** `delete_own_account()` – the caller signs out and clears local keys afterwards. */
  deleteOwnAccount(): Promise<void>

  /* ----- the mentor ----- */
  listMemberships(uid: string): Promise<Membership[]>
  listStudents(orgId: string): Promise<StudentBundle[]>
  getStudent(orgId: string, studentId: string): Promise<StudentBundle | null>
  /** `org_remove_student` – true when the student was active. */
  removeStudent(orgId: string, studentId: string): Promise<boolean>
  upsertNote(note: Omit<MentorNote, "updatedAt">): Promise<MentorNote>
  deleteNote(orgId: string, studentId: string, universityId: string): Promise<void>
  getInviteCode(orgId: string): Promise<string | null>
  reissueInvite(orgId: string): Promise<string>
  listMembers(orgId: string): Promise<OrgMember[]>
  /** `org_add_member_by_email` – throws CabinetError(user_not_found | not_an_admin). */
  addMemberByEmail(orgId: string, email: string, role: OrgRole): Promise<void>
  updateOrg(orgId: string, patch: OrgPatch): Promise<void>
}

export interface Backend {
  auth: AuthApi
  data: CabinetApi
  /** True for the in-memory dev backend – the UI labels sign-in «без письма». */
  fake: boolean
}
