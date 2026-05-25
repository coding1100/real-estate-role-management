export const PERMISSIONS = {
  PLATFORM_LOGIN: "platform:login",
  PLATFORM_LOGOUT: "platform:logout",

  TEAM_LIST: "team:list",
  TEAM_CREATE: "team:create",
  TEAM_UPDATE: "team:update",
  TEAM_REMOVE: "team:remove",
  TEAM_ASSIGN_ROLE: "team:assign_role",

  TENANT_ROLES_LIST: "tenant:roles:list",
  TENANT_ROLES_CREATE: "tenant:roles:create",
  TENANT_ROLES_UPDATE: "tenant:roles:update",
  TENANT_ROLES_DELETE: "tenant:roles:delete",

  DOMAIN_LIST: "domain:list",
  DOMAIN_READ: "domain:read",
  DOMAIN_CREATE: "domain:create",
  DOMAIN_DELETE: "domain:delete",
  DOMAIN_UPDATE_SETTINGS: "domain:update_settings",
  DOMAIN_UPDATE_HOSTNAME: "domain:update_hostname",
  DOMAIN_VERIFY: "domain:verify",
  DOMAIN_STATUS_READ: "domain:status_read",
  DOMAIN_DEFAULT_HOMEPAGE_WRITE: "domain:default_homepage_write",
  DOMAIN_DEFAULT_HOMEPAGE_BACKFILL: "domain:default_homepage_backfill",

  PAGES_LIST_ALL: "pages:list_all_statuses",
  PAGES_LIST_PUBLISHED: "pages:list_published_only",
  PAGES_LIST_ARCHIVED: "pages:list_archived",
  PAGES_CREATE: "pages:create",
  PAGES_DUPLICATE: "pages:duplicate",
  PAGES_REORDER: "pages:reorder",
  PAGES_VIEW_DRAFT: "pages:view_draft_preview",
  PAGES_VIEW_LIVE: "pages:view_live",
  PAGES_EDIT_METADATA: "pages:edit_metadata",
  PAGES_EDIT_CONTENT: "pages:edit_content",
  PAGES_EDIT_LAYOUT: "pages:edit_layout",
  PAGES_EDIT_FORM: "pages:edit_form",
  PAGES_EDIT_SEO: "pages:edit_seo",
  PAGES_EDIT_BRANDING: "pages:edit_branding_override",
  PAGES_EDIT_CTA: "pages:edit_cta",
  PAGES_EDIT_TOAST: "pages:edit_toast_override",
  PAGES_EDIT_MULTISTEP: "pages:edit_multistep_notify",
  PAGES_PUBLISH: "pages:publish",
  PAGES_ARCHIVE: "pages:archive",
  PAGES_RESTORE: "pages:restore",
  PAGES_DELETE_PERMANENT: "pages:delete_permanent",
  PAGES_MULTISTEP_PICKER: "pages:multistep_picker",

  LEADS_LIST: "leads:list",

  MEDIA_UPLOAD: "media:upload",
  MEDIA_UPLOAD_SIGNATURE: "media:upload_signature",

  TEMPLATES_LIST: "templates:list",
  TEMPLATES_CREATE_PAGE: "templates:create_page",
  TEMPLATES_SYNC_MASTER: "templates:sync_master",

  WEBHOOKS_LIST: "webhooks:list",
  WEBHOOKS_CREATE: "webhooks:create",
  WEBHOOKS_UPDATE: "webhooks:update",
  WEBHOOKS_DELETE: "webhooks:delete",

  SETTINGS_GLOBAL_READ: "settings:global_read",
  SETTINGS_GLOBAL_WRITE: "settings:global_write",
  SETTINGS_PAGE_CTA: "settings:page_cta",

  INTEGRATIONS_RESEND_TEMPLATES: "integrations:resend_templates",

  CACHE_REVALIDATE: "cache:revalidate",

  DASHBOARD_VIEW: "dashboard:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Human-readable labels for admin UI (roles editor, etc.). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.PLATFORM_LOGIN]: "Log in",
  [PERMISSIONS.PLATFORM_LOGOUT]: "Log out",

  [PERMISSIONS.TEAM_LIST]: "View team",
  [PERMISSIONS.TEAM_CREATE]: "Create team members",
  [PERMISSIONS.TEAM_UPDATE]: "Edit team members",
  [PERMISSIONS.TEAM_REMOVE]: "Remove team members",
  [PERMISSIONS.TEAM_ASSIGN_ROLE]: "Assign team roles",

  [PERMISSIONS.TENANT_ROLES_LIST]: "View roles",
  [PERMISSIONS.TENANT_ROLES_CREATE]: "Create roles",
  [PERMISSIONS.TENANT_ROLES_UPDATE]: "Edit roles",
  [PERMISSIONS.TENANT_ROLES_DELETE]: "Delete roles",

  [PERMISSIONS.DOMAIN_LIST]: "View domains",
  [PERMISSIONS.DOMAIN_READ]: "View domain details",
  [PERMISSIONS.DOMAIN_CREATE]: "Create domains",
  [PERMISSIONS.DOMAIN_DELETE]: "Delete domains",
  [PERMISSIONS.DOMAIN_UPDATE_SETTINGS]: "Edit domain settings",
  [PERMISSIONS.DOMAIN_UPDATE_HOSTNAME]: "Change domain hostname",
  [PERMISSIONS.DOMAIN_VERIFY]: "Verify domains",
  [PERMISSIONS.DOMAIN_STATUS_READ]: "View domain status",
  [PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_WRITE]: "Set default homepage",
  [PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_BACKFILL]: "Backfill default homepages",

  [PERMISSIONS.PAGES_LIST_ALL]: "List all pages (any status)",
  [PERMISSIONS.PAGES_LIST_PUBLISHED]: "List published pages only",
  [PERMISSIONS.PAGES_LIST_ARCHIVED]: "List archived pages",
  [PERMISSIONS.PAGES_CREATE]: "Create pages",
  [PERMISSIONS.PAGES_DUPLICATE]: "Duplicate pages",
  [PERMISSIONS.PAGES_REORDER]: "Reorder pages",
  [PERMISSIONS.PAGES_VIEW_DRAFT]: "Preview draft pages",
  [PERMISSIONS.PAGES_VIEW_LIVE]: "View live pages",
  [PERMISSIONS.PAGES_EDIT_METADATA]: "Edit page metadata",
  [PERMISSIONS.PAGES_EDIT_CONTENT]: "Edit page content",
  [PERMISSIONS.PAGES_EDIT_LAYOUT]: "Edit page layout",
  [PERMISSIONS.PAGES_EDIT_FORM]: "Edit page forms",
  [PERMISSIONS.PAGES_EDIT_SEO]: "Edit page SEO",
  [PERMISSIONS.PAGES_EDIT_BRANDING]: "Edit page branding overrides",
  [PERMISSIONS.PAGES_EDIT_CTA]: "Edit page call-to-action",
  [PERMISSIONS.PAGES_EDIT_TOAST]: "Edit page toast messages",
  [PERMISSIONS.PAGES_EDIT_MULTISTEP]: "Edit multistep notifications",
  [PERMISSIONS.PAGES_PUBLISH]: "Publish pages",
  [PERMISSIONS.PAGES_ARCHIVE]: "Archive pages",
  [PERMISSIONS.PAGES_RESTORE]: "Restore archived pages",
  [PERMISSIONS.PAGES_DELETE_PERMANENT]: "Permanently delete pages",
  [PERMISSIONS.PAGES_MULTISTEP_PICKER]: "Use multistep page picker",

  [PERMISSIONS.LEADS_LIST]: "View leads",

  [PERMISSIONS.MEDIA_UPLOAD]: "Upload media",
  [PERMISSIONS.MEDIA_UPLOAD_SIGNATURE]: "Sign media uploads",

  [PERMISSIONS.TEMPLATES_LIST]: "View templates",
  [PERMISSIONS.TEMPLATES_CREATE_PAGE]: "Create pages from templates",
  [PERMISSIONS.TEMPLATES_SYNC_MASTER]: "Sync master templates",

  [PERMISSIONS.WEBHOOKS_LIST]: "View webhooks",
  [PERMISSIONS.WEBHOOKS_CREATE]: "Create webhooks",
  [PERMISSIONS.WEBHOOKS_UPDATE]: "Edit webhooks",
  [PERMISSIONS.WEBHOOKS_DELETE]: "Delete webhooks",

  [PERMISSIONS.SETTINGS_GLOBAL_READ]: "View global settings",
  [PERMISSIONS.SETTINGS_GLOBAL_WRITE]: "Edit global settings",
  [PERMISSIONS.SETTINGS_PAGE_CTA]: "Edit page CTA settings",

  [PERMISSIONS.INTEGRATIONS_RESEND_TEMPLATES]: "Manage Resend email templates",

  [PERMISSIONS.CACHE_REVALIDATE]: "Revalidate site cache",

  [PERMISSIONS.DASHBOARD_VIEW]: "View dashboard",
};

/** Grouped permissions for the roles editor UI. */
export const PERMISSION_UI_GROUPS: { label: string; perms: Permission[] }[] = [
  {
    label: "Platform",
    perms: [PERMISSIONS.PLATFORM_LOGIN, PERMISSIONS.PLATFORM_LOGOUT],
  },
  {
    label: "Dashboard",
    perms: [PERMISSIONS.DASHBOARD_VIEW],
  },
  {
    label: "Team",
    perms: [
      PERMISSIONS.TEAM_LIST,
      PERMISSIONS.TEAM_CREATE,
      PERMISSIONS.TEAM_UPDATE,
      PERMISSIONS.TEAM_REMOVE,
      PERMISSIONS.TEAM_ASSIGN_ROLE,
    ],
  },
  {
    label: "Roles",
    perms: [
      PERMISSIONS.TENANT_ROLES_LIST,
      PERMISSIONS.TENANT_ROLES_CREATE,
      PERMISSIONS.TENANT_ROLES_UPDATE,
      PERMISSIONS.TENANT_ROLES_DELETE,
    ],
  },
  {
    label: "Domains",
    perms: [
      PERMISSIONS.DOMAIN_LIST,
      PERMISSIONS.DOMAIN_READ,
      PERMISSIONS.DOMAIN_CREATE,
      PERMISSIONS.DOMAIN_DELETE,
      PERMISSIONS.DOMAIN_UPDATE_SETTINGS,
      PERMISSIONS.DOMAIN_UPDATE_HOSTNAME,
      PERMISSIONS.DOMAIN_VERIFY,
      PERMISSIONS.DOMAIN_STATUS_READ,
      PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_WRITE,
      PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_BACKFILL,
    ],
  },
  {
    label: "Pages",
    perms: [
      PERMISSIONS.PAGES_LIST_ALL,
      PERMISSIONS.PAGES_LIST_PUBLISHED,
      PERMISSIONS.PAGES_LIST_ARCHIVED,
      PERMISSIONS.PAGES_CREATE,
      PERMISSIONS.PAGES_DUPLICATE,
      PERMISSIONS.PAGES_REORDER,
      PERMISSIONS.PAGES_VIEW_DRAFT,
      PERMISSIONS.PAGES_VIEW_LIVE,
      PERMISSIONS.PAGES_EDIT_METADATA,
      PERMISSIONS.PAGES_EDIT_CONTENT,
      PERMISSIONS.PAGES_EDIT_LAYOUT,
      PERMISSIONS.PAGES_EDIT_FORM,
      PERMISSIONS.PAGES_EDIT_SEO,
      PERMISSIONS.PAGES_EDIT_BRANDING,
      PERMISSIONS.PAGES_EDIT_CTA,
      PERMISSIONS.PAGES_EDIT_TOAST,
      PERMISSIONS.PAGES_EDIT_MULTISTEP,
      PERMISSIONS.PAGES_PUBLISH,
      PERMISSIONS.PAGES_ARCHIVE,
      PERMISSIONS.PAGES_RESTORE,
      PERMISSIONS.PAGES_DELETE_PERMANENT,
      PERMISSIONS.PAGES_MULTISTEP_PICKER,
    ],
  },
  {
    label: "Leads",
    perms: [PERMISSIONS.LEADS_LIST],
  },
  {
    label: "Media",
    perms: [PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_UPLOAD_SIGNATURE],
  },
  {
    label: "Templates",
    perms: [
      PERMISSIONS.TEMPLATES_LIST,
      PERMISSIONS.TEMPLATES_CREATE_PAGE,
      PERMISSIONS.TEMPLATES_SYNC_MASTER,
    ],
  },
  {
    label: "Webhooks",
    perms: [
      PERMISSIONS.WEBHOOKS_LIST,
      PERMISSIONS.WEBHOOKS_CREATE,
      PERMISSIONS.WEBHOOKS_UPDATE,
      PERMISSIONS.WEBHOOKS_DELETE,
    ],
  },
  {
    label: "Settings",
    perms: [
      PERMISSIONS.SETTINGS_GLOBAL_READ,
      PERMISSIONS.SETTINGS_GLOBAL_WRITE,
      PERMISSIONS.SETTINGS_PAGE_CTA,
    ],
  },
  {
    label: "Integrations",
    perms: [PERMISSIONS.INTEGRATIONS_RESEND_TEMPLATES],
  },
  {
    label: "Cache",
    perms: [PERMISSIONS.CACHE_REVALIDATE],
  },
];

export function getPermissionLabel(perm: Permission | string): string {
  if (perm in PERMISSION_LABELS) {
    return PERMISSION_LABELS[perm as Permission];
  }
  const [resource, action] = perm.split(":");
  if (!action) return perm;
  const words = action.replace(/_/g, " ").split(" ");
  const verb = words[0];
  const rest = words.slice(1).join(" ");
  const verbMap: Record<string, string> = {
    list: "View",
    create: "Create",
    update: "Edit",
    delete: "Delete",
    read: "View",
    upload: "Upload",
    publish: "Publish",
    archive: "Archive",
    restore: "Restore",
    verify: "Verify",
    revalidate: "Revalidate",
  };
  const v = verbMap[verb] ?? verb.charAt(0).toUpperCase() + verb.slice(1);
  const noun = (rest || resource).replace(/_/g, " ");
  return `${v} ${noun}`.trim();
}

export type AdminDomainRole = "admin" | "executive" | "member" | "explorer";

export const ROLE_RANK: Record<AdminDomainRole, number> = {
  explorer: 1,
  member: 2,
  executive: 3,
  admin: 4,
};

/** Legacy: no tenant-scoped routes use this set in Phase 2. */
export const GLOBAL_PERMISSIONS = new Set<Permission>([]);

const ADMIN_PERMS: Permission[] = [
  PERMISSIONS.PLATFORM_LOGIN,
  PERMISSIONS.PLATFORM_LOGOUT,
  PERMISSIONS.TEAM_LIST,
  PERMISSIONS.TEAM_CREATE,
  PERMISSIONS.TEAM_UPDATE,
  PERMISSIONS.TEAM_REMOVE,
  PERMISSIONS.TEAM_ASSIGN_ROLE,
  PERMISSIONS.DOMAIN_LIST,
  PERMISSIONS.DOMAIN_READ,
  PERMISSIONS.DOMAIN_CREATE,
  PERMISSIONS.DOMAIN_DELETE,
  PERMISSIONS.DOMAIN_UPDATE_SETTINGS,
  PERMISSIONS.DOMAIN_UPDATE_HOSTNAME,
  PERMISSIONS.DOMAIN_VERIFY,
  PERMISSIONS.DOMAIN_STATUS_READ,
  PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_WRITE,
  PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_BACKFILL,
  PERMISSIONS.PAGES_LIST_ALL,
  PERMISSIONS.PAGES_LIST_PUBLISHED,
  PERMISSIONS.PAGES_LIST_ARCHIVED,
  PERMISSIONS.PAGES_CREATE,
  PERMISSIONS.PAGES_DUPLICATE,
  PERMISSIONS.PAGES_REORDER,
  PERMISSIONS.PAGES_VIEW_DRAFT,
  PERMISSIONS.PAGES_VIEW_LIVE,
  PERMISSIONS.PAGES_EDIT_METADATA,
  PERMISSIONS.PAGES_EDIT_CONTENT,
  PERMISSIONS.PAGES_EDIT_LAYOUT,
  PERMISSIONS.PAGES_EDIT_FORM,
  PERMISSIONS.PAGES_EDIT_SEO,
  PERMISSIONS.PAGES_EDIT_BRANDING,
  PERMISSIONS.PAGES_EDIT_CTA,
  PERMISSIONS.PAGES_EDIT_TOAST,
  PERMISSIONS.PAGES_EDIT_MULTISTEP,
  PERMISSIONS.PAGES_PUBLISH,
  PERMISSIONS.PAGES_ARCHIVE,
  PERMISSIONS.PAGES_RESTORE,
  PERMISSIONS.PAGES_DELETE_PERMANENT,
  PERMISSIONS.PAGES_MULTISTEP_PICKER,
  PERMISSIONS.LEADS_LIST,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_UPLOAD_SIGNATURE,
  PERMISSIONS.TEMPLATES_LIST,
  PERMISSIONS.TEMPLATES_CREATE_PAGE,
  PERMISSIONS.TEMPLATES_SYNC_MASTER,
  PERMISSIONS.WEBHOOKS_LIST,
  PERMISSIONS.WEBHOOKS_CREATE,
  PERMISSIONS.WEBHOOKS_UPDATE,
  PERMISSIONS.WEBHOOKS_DELETE,
  PERMISSIONS.SETTINGS_GLOBAL_READ,
  PERMISSIONS.SETTINGS_GLOBAL_WRITE,
  PERMISSIONS.SETTINGS_PAGE_CTA,
  PERMISSIONS.INTEGRATIONS_RESEND_TEMPLATES,
  PERMISSIONS.CACHE_REVALIDATE,
  PERMISSIONS.DASHBOARD_VIEW,
];

const EXECUTIVE_PERMS: Permission[] = [
  PERMISSIONS.PLATFORM_LOGIN,
  PERMISSIONS.PLATFORM_LOGOUT,
  PERMISSIONS.DOMAIN_LIST,
  PERMISSIONS.DOMAIN_READ,
  PERMISSIONS.DOMAIN_UPDATE_SETTINGS,
  PERMISSIONS.DOMAIN_VERIFY,
  PERMISSIONS.DOMAIN_STATUS_READ,
  PERMISSIONS.DOMAIN_DEFAULT_HOMEPAGE_WRITE,
  PERMISSIONS.PAGES_LIST_ALL,
  PERMISSIONS.PAGES_LIST_PUBLISHED,
  PERMISSIONS.PAGES_LIST_ARCHIVED,
  PERMISSIONS.PAGES_CREATE,
  PERMISSIONS.PAGES_DUPLICATE,
  PERMISSIONS.PAGES_REORDER,
  PERMISSIONS.PAGES_VIEW_DRAFT,
  PERMISSIONS.PAGES_VIEW_LIVE,
  PERMISSIONS.PAGES_EDIT_METADATA,
  PERMISSIONS.PAGES_EDIT_CONTENT,
  PERMISSIONS.PAGES_EDIT_LAYOUT,
  PERMISSIONS.PAGES_EDIT_FORM,
  PERMISSIONS.PAGES_EDIT_SEO,
  PERMISSIONS.PAGES_EDIT_BRANDING,
  PERMISSIONS.PAGES_EDIT_CTA,
  PERMISSIONS.PAGES_EDIT_TOAST,
  PERMISSIONS.PAGES_EDIT_MULTISTEP,
  PERMISSIONS.PAGES_PUBLISH,
  PERMISSIONS.PAGES_ARCHIVE,
  PERMISSIONS.PAGES_RESTORE,
  PERMISSIONS.PAGES_MULTISTEP_PICKER,
  PERMISSIONS.LEADS_LIST,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_UPLOAD_SIGNATURE,
  PERMISSIONS.TEMPLATES_LIST,
  PERMISSIONS.TEMPLATES_CREATE_PAGE,
  PERMISSIONS.SETTINGS_PAGE_CTA,
  PERMISSIONS.INTEGRATIONS_RESEND_TEMPLATES,
  PERMISSIONS.CACHE_REVALIDATE,
  PERMISSIONS.DASHBOARD_VIEW,
];

const MEMBER_PERMS: Permission[] = [
  PERMISSIONS.PLATFORM_LOGIN,
  PERMISSIONS.PLATFORM_LOGOUT,
  PERMISSIONS.DOMAIN_LIST,
  PERMISSIONS.DOMAIN_READ,
  PERMISSIONS.DOMAIN_STATUS_READ,
  PERMISSIONS.PAGES_LIST_PUBLISHED,
  PERMISSIONS.PAGES_VIEW_LIVE,
  PERMISSIONS.PAGES_EDIT_METADATA,
  PERMISSIONS.PAGES_EDIT_CONTENT,
  PERMISSIONS.PAGES_EDIT_LAYOUT,
  PERMISSIONS.PAGES_EDIT_FORM,
  PERMISSIONS.PAGES_EDIT_SEO,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_UPLOAD_SIGNATURE,
  PERMISSIONS.DASHBOARD_VIEW,
];

const EXPLORER_PERMS: Permission[] = [
  PERMISSIONS.PLATFORM_LOGIN,
  PERMISSIONS.PLATFORM_LOGOUT,
  PERMISSIONS.DOMAIN_LIST,
  PERMISSIONS.DOMAIN_READ,
  PERMISSIONS.DOMAIN_STATUS_READ,
  PERMISSIONS.PAGES_LIST_PUBLISHED,
  PERMISSIONS.PAGES_VIEW_LIVE,
  PERMISSIONS.DASHBOARD_VIEW,
];

export const ROLE_PERMISSIONS: Record<
  AdminDomainRole,
  ReadonlySet<Permission>
> = {
  admin: new Set(ADMIN_PERMS),
  executive: new Set(EXECUTIVE_PERMS),
  member: new Set(MEMBER_PERMS),
  explorer: new Set(EXPLORER_PERMS),
};

export function roleHasPermission(
  role: AdminDomainRole,
  perm: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].has(perm);
}

export function maxRole(
  roles: AdminDomainRole[],
): AdminDomainRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((best, r) =>
    ROLE_RANK[r] > ROLE_RANK[best] ? r : best,
  );
}

export function canAssignRole(
  callerMaxRole: AdminDomainRole,
  targetRole: AdminDomainRole,
): boolean {
  return ROLE_RANK[callerMaxRole] >= ROLE_RANK[targetRole];
}

export type AuthContextLike = {
  allDomainsRole: AdminDomainRole | null;
  assignments: { domainId: string; role: AdminDomainRole }[];
};

export function hasPlatformAdmin(ctx: AuthContextLike): boolean {
  if (ctx.allDomainsRole === "admin") return true;
  return ctx.assignments.some((a) => a.role === "admin");
}
