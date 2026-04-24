import type { AppRole } from "@/auth";

export function getRoleHome(role: AppRole) {
  switch (role) {
    case "FO":
      return "/app/fo";
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
