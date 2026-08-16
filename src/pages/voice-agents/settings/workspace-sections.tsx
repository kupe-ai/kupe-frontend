"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/workspace-context";
import { TelephonyAccountsCard } from "@/TelephonyAccountsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Member } from "@/types";

const ROLES = ["member", "admin", "owner"] as const;

const COUNTRY_OPTIONS = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["IN", "India"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["SG", "Singapore"],
  ["AE", "United Arab Emirates"],
] as const;

export function KupeWorkspaceSettings() {
  const {
    orgs,
    org,
    projects,
    project,
    membership,
    selectOrg,
    selectProject,
    refresh,
  } = useWorkspace();
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [country, setCountry] = useState(org?.country ?? "US");
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("member");
  const [inviteProjects, setInviteProjects] = useState<string[]>([]);

  useEffect(() => {
    if (!org) return;
    setCountry(org.country ?? "US");
    setLoadingMembers(true);
    api
      .listMembers(org.id, { limit: 100 })
      .then((page) => setMembers(page.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingMembers(false));
  }, [org?.id, org?.country]);

  if (!org) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm font-medium">Create an organization</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Kupe scopes agents, keys, and calls to an org and project.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            className="min-w-[200px] flex-1"
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <Button
            className="rounded-full"
            onClick={async () => {
              if (!orgName.trim()) return;
              const created = await api.createOrg(orgName.trim());
              selectOrg(created.id);
            }}
          >
            Create org
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-elevated">
        <h2 className="text-sm font-semibold tracking-tight">Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization, project, and calling country for this console.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Organization</Label>
            <Select value={org.id} onValueChange={selectOrg}>
              <SelectTrigger className="w-full">
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
          <div className="flex flex-col gap-1.5">
            <Label>Project</Label>
            <Select
              value={project?.id}
              onValueChange={(id) => {
                const next = projects.find((p) => p.id === id);
                if (next) selectProject(next);
              }}
            >
              <SelectTrigger className="w-full">
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
        </div>
        {isAdmin && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[180px] flex-1"
                placeholder="New organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Button
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  if (!orgName.trim()) return;
                  const created = await api.createOrg(orgName.trim());
                  setOrgName("");
                  selectOrg(created.id);
                }}
              >
                Create org
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[180px] flex-1"
                placeholder="New project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <Button
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  if (!projectName.trim()) return;
                  const created = await api.createProject(org.id, projectName.trim());
                  setProjectName("");
                  refresh();
                  selectProject(created);
                }}
              >
                Create project
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Country</Label>
              <Select
                value={country}
                onValueChange={async (v) => {
                  setCountry(v);
                  try {
                    await api.updateOrgCountry(org.id, v);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <SelectTrigger className="w-full max-w-xs">
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
              <p className="text-xs text-muted-foreground">
                Used to interpret local phone numbers in call-transfer settings.
              </p>
            </div>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-elevated">
          <h2 className="text-sm font-semibold tracking-tight">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite an existing Kupe user by email. Members need a project allowlist.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof ROLES)[number])}>
                <SelectTrigger className="w-full">
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
              <div className="flex flex-col gap-2 sm:col-span-2">
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
            <Button
              className="rounded-full sm:col-span-2"
              onClick={async () => {
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
                  toast.error((e as Error).message);
                }
              }}
            >
              Add member
            </Button>
          </div>
          {loadingMembers ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <TelephonyAccountsCard orgId={org.id} isAdmin={Boolean(isAdmin)} />
    </div>
  );
}
