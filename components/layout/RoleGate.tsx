"use client";

import { UserRole } from "@/types";
import { getPermissions } from "@/lib/permissions";

interface RoleGateProps {
  role: UserRole;
  permission: keyof ReturnType<typeof getPermissions>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({ role, permission, fallback = null, children }: RoleGateProps) {
  const permissions = getPermissions(role);
  if (!permissions[permission]) return <>{fallback}</>;
  return <>{children}</>;
}
