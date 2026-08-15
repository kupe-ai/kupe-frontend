import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiKey, CreatedApiKey, Member, Membership, Organization, Project } from "@/types";
import { TelephonyAccountsCard } from "@/TelephonyAccountsCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  orgs: Organization[];
  org: Organization;
  projects: Project[];
  project: Project | null;
  membership: Membership | null;
  onSelectOrg: (orgId: string) => void;
  onSelectProject: (project: Project) => void;
  onRefresh: () => void;
};

const ROLES = ["member", "admin", "owner"] as const;

const COUNTRY_OPTIONS = [
  ["US", "United States"], ["GB", "United Kingdom"], ["IN", "India"], ["CA", "Canada"],
  ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"],
  ["NL", "Netherlands"], ["SG", "Singapore"], ["AE", "United Arab Emirates"], ["PH", "Philippines"],
  ["MX", "Mexico"], ["BR", "Brazil"], ["ZA", "South Africa"], ["NZ", "New Zealand"],
  ["IE", "Ireland"], ["JP", "Japan"], ["SE", "Sweden"],
] as const;

export function SettingsPanel({
  orgs,
  org,
  projects,
  project,
  membership,
  onSelectOrg,
  onSelectProject,
  onRefresh,
}: Props) {
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("member");
  const [inviteProjects, setInviteProjects] = useState<string[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  const [country, setCountry] = useState(org.country ?? "US");

  useEffect(() => {
    api
      .listMembers(org.id, { limit: 100 })
      .then((page) => setMembers(page.items))
      .catch((e) => setError(e.message));
  }, [org.id]);

  useEffect(() => {
    setCountry(org.country ?? "US");
  }, [org.id, org.country]);

  useEffect(() => {
    if (!project) {
      setKeys([]);
      return;
    }
    api
      .listApiKeys(project.id, { limit: 100 })
      .then((page) => setKeys(page.items))
      .catch((e) => setError(e.message));
  }, [project?.id]);

  async function createOrg() {
    if (!orgName.trim()) return;
    try {
      const created = await api.createOrg(orgName.trim());
      setOrgName("");
      onSelectOrg(created.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveCountry(value: string) {
    setCountry(value);
    try {
      await api.updateOrgCountry(org.id, value);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createProject() {
    if (!projectName.trim()) return;
    try {
      const created = await api.createProject(org.id, projectName.trim());
      setProjectName("");
      onRefresh();
      onSelectProject(created);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function invite() {
    if (!inviteEmail.trim()) return;
    try {
      await api.addMember(org.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        project_ids: inviteRole === "member" ? inviteProjects : [],
      });
      setInviteEmail("");
      setInviteProjects([]);
      const page = await api.listMembers(org.id, { limit: 100 });
      setMembers(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveMember(member: Member, role: string, projectIds: string[]) {
    try {
      await api.updateMember(org.id, member.user_id, { role, project_ids: projectIds });
      const page = await api.listMembers(org.id, { limit: 100 });
      setMembers(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(userId: string) {
    try {
      await api.removeMember(org.id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createKey() {
    if (!project || !keyName.trim()) return;
    try {
      const created = await api.createApiKey(project.id, keyName.trim());
      setKeyName("");
      setNewKey(created);
      const page = await api.listApiKeys(project.id, { limit: 100 });
      setKeys(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function revoke(keyId: string) {
    if (!project) return;
    try {
      await api.revokeApiKey(project.id, keyId);
      const page = await api.listApiKeys(project.id, { limit: 100 });
      setKeys(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Switch between orgs you belong to, or create another.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current org</Label>
            <Select value={org.id} onValueChange={onSelectOrg}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1"
              placeholder="New organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <Button onClick={() => void createOrg()}>Create org</Button>
          </div>
          {membership && (
            <p className="text-xs text-muted-foreground">
              Your role here: {membership.role}
            </p>
          )}
          {isAdmin && (
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={(v) => void saveCountry(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Used to interpret phone numbers you type in call-transfer settings that aren't already in international format.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Members only see projects on their allowlist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accessible projects.</p>
          ) : (
            <div className="space-y-2">
              <Label>Current project</Label>
              <Select
                value={project?.id}
                onValueChange={(id) => {
                  const next = projects.find((p) => p.id === id);
                  if (next) onSelectProject(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[200px] flex-1"
                placeholder="New project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <Button onClick={() => void createProject()}>Create project</Button>
              {project && (
                <Button
                  variant="outline"
                  onClick={() => void api.archiveProject(project.id).then(onRefresh)}
                >
                  Archive current
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Invite an existing Kupe user by email. Members need a project allowlist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof ROLES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "member" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Projects</Label>
                  <div className="flex flex-wrap gap-3">
                    {projects.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={inviteProjects.includes(p.id)}
                          onCheckedChange={(checked) =>
                            setInviteProjects((prev) =>
                              checked === true ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            )
                          }
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button className="sm:col-span-2" onClick={() => void invite()}>
                Add member
              </Button>
            </div>

            <div className="space-y-3">
              {members.map((member) => (
                <MemberRow
                  key={member.user_id}
                  member={member}
                  projects={projects}
                  canEdit={member.user_id !== membership?.user_id}
                  onSave={saveMember}
                  onRemove={remove}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {project && (
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Project-scoped keys for creating sessions. The raw secret is shown once.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {newKey && (
              <Alert>
                <AlertDescription>
                  Copy this key now: <span className="font-mono text-xs">{newKey.api_key}</span>
                </AlertDescription>
              </Alert>
            )}
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[200px] flex-1"
                  placeholder="Key name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
                <Button onClick={() => void createKey()}>Create key</Button>
              </div>
            )}
            {keys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
            {keys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{key.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{key.key_prefix}…</div>
                </div>
                {key.revoked_at ? (
                  <span className="text-xs text-muted-foreground">Revoked</span>
                ) : (
                  isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => void revoke(key.id)}>
                      Revoke
                    </Button>
                  )
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <TelephonyAccountsCard orgId={org.id} isAdmin={Boolean(isAdmin)} />
    </div>
  );
}

function MemberRow({
  member,
  projects,
  canEdit,
  onSave,
  onRemove,
}: {
  member: Member;
  projects: Project[];
  canEdit: boolean;
  onSave: (member: Member, role: string, projectIds: string[]) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}) {
  const [role, setRole] = useState(member.role);
  const [projectIds, setProjectIds] = useState(member.project_ids);

  useEffect(() => {
    setRole(member.role);
    setProjectIds(member.project_ids);
  }, [member]);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{member.email}</div>
          <div className="text-xs text-muted-foreground">{member.role}</div>
        </div>
        {canEdit && (
          <>
            <Select value={role} onValueChange={(v) => setRole(v as Member["role"])}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void onSave(member, role, projectIds)}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void onRemove(member.user_id)}>
              Remove
            </Button>
          </>
        )}
      </div>
      {role === "member" && canEdit && (
        <div className="flex flex-wrap gap-3">
          {projects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={projectIds.includes(p.id)}
                onCheckedChange={(checked) =>
                  setProjectIds((prev) => (checked === true ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
