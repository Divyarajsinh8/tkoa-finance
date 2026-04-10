import { UserRole, Permissions } from "@/types";

export function getPermissions(role: UserRole): Permissions {
  const base: Permissions = {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSubscriptions: false,
    canSetBudgets: false,
    canExport: true,
    canViewAuditLog: false,
    canUseAI: true,
    canBundleInvoices: false,
    canGSTFiling: false,
  };

  if (role === "viewer") return base;

  if (role === "manager") {
    return {
      ...base,
      canCreate: true,
      canEdit: true,
      canBundleInvoices: true,
    };
  }

  // admin
  return {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canManageSubscriptions: true,
    canSetBudgets: true,
    canExport: true,
    canViewAuditLog: true,
    canUseAI: true,
    canBundleInvoices: true,
    canGSTFiling: true,
  };
}
