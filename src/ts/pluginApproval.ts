export interface PluginApprovalTarget {
  id?: string | null;
  version?: string | null;
  permissions?: unknown;
}

export interface PluginApprovalRecord {
  pluginId: string;
  version: string;
  permissionsHash: string;
  approvedAt?: string;
}

export function normalizePluginPermissions(rawPermissions: unknown): string[] {
  if (!Array.isArray(rawPermissions)) {
    return [];
  }

  const normalized = new Set<string>();
  for (const permission of rawPermissions) {
    if (typeof permission !== "string") {
      continue;
    }

    const nextPermission = permission.trim().toLowerCase();
    if (nextPermission) {
      normalized.add(nextPermission);
    }
  }

  return Array.from(normalized).sort();
}

const PERMISSION_LABELS: Record<string, { label: string; icon: string }> = {
  net: { label: "Network access", icon: "fa-solid fa-network-wired" },
  network: { label: "Network access", icon: "fa-solid fa-network-wired" },
  env: { label: "Environment variables", icon: "fa-solid fa-terminal" },
  read: { label: "File system read", icon: "fa-solid fa-folder-open" },
  write: { label: "File system write", icon: "fa-solid fa-pen-to-square" },
  run: { label: "Run subprocesses", icon: "fa-solid fa-play" },
  ffi: { label: "Native library access (FFI)", icon: "fa-solid fa-plug" },
  sys: { label: "System information", icon: "fa-solid fa-desktop" },
  hrtime: { label: "High-resolution timers", icon: "fa-solid fa-clock" },
  all: { label: "Full system access", icon: "fa-solid fa-unlock" },
};

/** Labels and icons for the permissions a user approves before a plugin can run. */
export function describePluginPermissions(rawPermissions: unknown) {
  return normalizePluginPermissions(rawPermissions).map((key) => ({
    key,
    ...(PERMISSION_LABELS[key] || { label: key, icon: "fa-solid fa-shield" }),
  }));
}

export function hashNormalizedPermissions(permissions: string[]): string {
  const normalizedPermissions = normalizePluginPermissions(permissions);
  const input = normalizedPermissions.join("\n");
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createPluginApprovalRecord(
  target: PluginApprovalTarget,
): PluginApprovalRecord | null {
  const pluginId = typeof target?.id === "string" ? target.id.trim() : "";
  if (!pluginId) {
    return null;
  }

  const version = typeof target?.version === "string" ? target.version.trim() : "";
  const permissions = normalizePluginPermissions(target?.permissions);

  return {
    pluginId,
    version,
    permissionsHash: hashNormalizedPermissions(permissions),
  };
}

export function getPluginApprovalKey(record: PluginApprovalRecord | null): string | null {
  if (!record?.pluginId) {
    return null;
  }

  return `${record.pluginId}::${record.permissionsHash}`;
}

function isPluginApprovalRecord(value: unknown): value is PluginApprovalRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.pluginId === "string" &&
    typeof candidate.version === "string" &&
    typeof candidate.permissionsHash === "string"
  );
}

export function sanitizeStoredApprovalRecords(value: unknown): {
  records: PluginApprovalRecord[];
  changed: boolean;
} {
  if (!Array.isArray(value)) {
    return {
      records: [],
      changed: false,
    };
  }

  const deduped = new Map<string, PluginApprovalRecord>();
  let changed = false;

  for (const entry of value) {
    if (!isPluginApprovalRecord(entry)) {
      changed = true;
      continue;
    }

    const pluginId = entry.pluginId.trim();
    if (!pluginId) {
      changed = true;
      continue;
    }

    const normalizedEntry: PluginApprovalRecord = {
      pluginId,
      version: entry.version.trim(),
      permissionsHash: entry.permissionsHash.trim(),
      approvedAt: typeof entry.approvedAt === "string" ? entry.approvedAt : undefined,
    };

    if (!normalizedEntry.permissionsHash) {
      changed = true;
      continue;
    }

    const key = getPluginApprovalKey(normalizedEntry);
    if (!key) {
      changed = true;
      continue;
    }

    if (!deduped.has(key)) {
      deduped.set(key, normalizedEntry);
    } else {
      changed = true;
    }
  }

  return {
    records: Array.from(deduped.values()),
    changed,
  };
}
