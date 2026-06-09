import type { AppRole } from "@/auth";

type AccountCardProps = {
  fullName: string;
  username: string;
  email: string | null;
  roleCode: string | null;
  roleName: string | null;
  createdAtLabel: string;
  lastLoginLabel: string;
};

const roleDisplayNames: Record<AppRole, string> = {
  FO: "Front Office",
  HK: "Housekeeping",
  FB: "Food & Beverage",
  ACC: "Accounting",
  ADMIN: "Administrator",
};

function displayRole(roleCode: string | null, roleName: string | null) {
  if (roleCode && roleCode in roleDisplayNames) {
    return roleDisplayNames[roleCode as AppRole];
  }

  return roleName ?? roleCode ?? "—";
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-console-border-soft py-2.5 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-[13px] font-medium text-console-ink">
        {value}
      </dd>
    </div>
  );
}

export function AccountCard({
  fullName,
  username,
  email,
  roleCode,
  roleName,
  createdAtLabel,
  lastLoginLabel,
}: AccountCardProps) {
  return (
    <section className="overflow-hidden border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"AKUN"}
      </div>
      <dl className="px-3.5 py-2">
        <InfoRow label="Nama Lengkap" value={fullName} />
        <InfoRow label="Username" value={username} />
        <InfoRow label="Email" value={email ?? "—"} />
        <InfoRow label="Role" value={displayRole(roleCode, roleName)} />
        <InfoRow label="Bergabung sejak" value={createdAtLabel} />
        <InfoRow label="Login terakhir" value={lastLoginLabel} />
      </dl>
    </section>
  );
}
