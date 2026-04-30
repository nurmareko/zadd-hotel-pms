import { prisma } from "@/lib/prisma";
import { roleCodes, type RoleCode } from "./schema";
import { UserTable } from "./user-table";

function toRoleCode(role: string | undefined): RoleCode {
  return roleCodes.find((roleCode) => roleCode === role) ?? "FO";
}

export default async function UserManagementPage() {
  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      isActive: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  return (
    <main className="p-4 sm:p-6">
      <UserTable
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: toRoleCode(user.roles[0]?.role.code),
          isActive: user.isActive,
        }))}
      />
    </main>
  );
}
