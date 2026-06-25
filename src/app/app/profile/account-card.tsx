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
    <div className="grid gap-1 border-b border-gray-200 py-3 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-4">
      <dt className="text-[13px] font-medium text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-[14px] font-semibold text-slate-900">
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
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-[16px] font-semibold text-slate-900">Akun</h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          Ringkasan identitas dan sesi pengguna.
        </p>
      </div>
      <dl className="px-5 py-2">
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
