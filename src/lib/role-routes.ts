import type { AppRole } from "@/auth";

export function getRoleHome(role: AppRole) {
  switch (role) {
    case "GM":
      return "/app/fo/reservasi";
    case "FO":
      return "/app/fo/reservasi";
    case "HK":
      return "/app/hk";
    case "FB":
      return "/app/fb";
    case "ACC":
      return "/app/acc";
    case "ADMIN":
      return "/app/admin/users";
  }
}
