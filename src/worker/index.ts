import { createClient } from '@supabase/supabase-js';

type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type Env = {
  ASSETS: AssetsBinding;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type OrganizerRole = 'owner' | 'organizer';

type OrganizerSession = {
  id: string;
  email: string;
  displayName: string | null;
  role: OrganizerRole;
};

const ADMIN_SESSION_COOKIE = 'devcon_admin';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const ORGANIZER_BASE_PATH = '/organizer-console';
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...headers,
    },
  });
}

function readCookie(request: Request, name: string): string | null {
  const prefix = `${name}=`;
  const value = request.headers.get('Cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return value ? value.slice(prefix.length) : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isOrganizerRole(value: unknown): value is OrganizerRole {
  return value === 'owner' || value === 'organizer';
}

function authIsConfigured(env: Env): env is Env & Required<Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'>> {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
}

function safeOrganizerPath(value: string | null): string {
  if (
    !value
    || (value !== ORGANIZER_BASE_PATH && !value.startsWith(`${ORGANIZER_BASE_PATH}/`))
    || value.startsWith('//')
  ) {
    return ORGANIZER_BASE_PATH;
  }

  return value;
}

function requestOriginIsValid(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}

function sessionCookie(request: Request, token: string): string {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (new URL(request.url).protocol === 'https:') attributes.push('Secure');
  return attributes.join('; ');
}

function expiredSessionCookie(request: Request): string {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (new URL(request.url).protocol === 'https:') attributes.push('Secure');
  return attributes.join('; ');
}

function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function tokenHash(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function requestIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;
}

function adminClient(env: Env & Required<Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>>) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function authClient(env: Env & Required<Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>>) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getOrganizerSession(request: Request, env: Env): Promise<OrganizerSession | null> {
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (!token || !authIsConfigured(env)) return null;

  const { data, error } = await adminClient(env)
    .from('admin_sessions')
    .select('id, email, expires_at, revoked_at, admin_memberships!inner(display_name, status, role)')
    .eq('token_hash', await tokenHash(token))
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !data || new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const membership = Array.isArray(data.admin_memberships)
    ? data.admin_memberships[0]
    : data.admin_memberships;

  if (!membership || membership.status !== 'active' || !isOrganizerRole(membership.role)) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: membership.display_name ?? null,
    role: membership.role,
  };
}

async function recordAuditEvent(
  request: Request,
  env: Env & Required<Pick<Env, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>>,
  input: {
    action: string;
    session?: OrganizerSession;
    targetId?: string | null;
  },
): Promise<void> {
  const { error } = await adminClient(env)
    .from('admin_audit_log')
    .insert({
      actor_email: input.session?.email ?? null,
      actor_role: input.session?.role ?? null,
      action: input.action,
      target_type: 'admin_session',
      target_id: input.targetId ?? input.session?.id ?? null,
      ip_address: requestIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
      request_method: request.method,
      request_path: new URL(request.url).pathname,
    });

  if (error) {
    console.warn('Unable to write organizer audit event.');
  }
}

async function handleAuthConfig(env: Env): Promise<Response> {
  if (!authIsConfigured(env)) {
    return json({ error: 'Organizer sign-in is not configured.' }, 503);
  }

  return json({
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const session = await getOrganizerSession(request, env);
  if (!session) return json({ authenticated: false });

  return json({
    authenticated: true,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
  });
}

async function handleAuthCallback(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const callbackUrl = new URL(`${ORGANIZER_BASE_PATH}/auth/callback`, requestUrl.origin);
  const next = safeOrganizerPath(requestUrl.searchParams.get('next'));
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error_description') ?? requestUrl.searchParams.get('error');

  callbackUrl.searchParams.set('next', next);
  if (code) callbackUrl.searchParams.set('code', code);
  if (error) callbackUrl.searchParams.set('error', error);

  return new Response(null, {
    status: 302,
    headers: {
      Location: callbackUrl.toString(),
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

async function handleTokenExchange(request: Request, env: Env): Promise<Response> {
  if (!requestOriginIsValid(request)) {
    return json({ error: 'Invalid request origin.' }, 403);
  }

  if (!authIsConfigured(env)) {
    return json({ error: 'Organizer sign-in is not configured.' }, 503);
  }

  let accessToken = '';
  try {
    const body = await request.json() as { access_token?: unknown };
    accessToken = typeof body.access_token === 'string' ? body.access_token : '';
  } catch {
    return json({ error: 'Invalid sign-in response.' }, 400);
  }

  if (!accessToken || accessToken.length > 16_384) {
    return json({ error: 'Google organizer sign-in could not be completed. Please try again.' }, 401);
  }

  const { data, error } = await authClient(env).auth.getUser(accessToken);
  const email = normalizeEmail(data.user?.email ?? '');
  const provider = String(data.user?.app_metadata.provider ?? '');

  if (error || !data.user || !email || provider !== 'google') {
    return json({ error: 'Google organizer sign-in could not be completed. Please try again.' }, 401);
  }

  const supabase = adminClient(env);
  const { data: membership, error: membershipError } = await supabase
    .from('admin_memberships')
    .select('id, display_name, role, status')
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return json({ error: 'Unable to verify organizer access. Please try again.' }, 500);
  }

  if (!membership || !isOrganizerRole(membership.role)) {
    return json({ error: 'This Google account has not been approved for the organizer console.' }, 403);
  }

  const sessionToken = newSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { data: insertedSession, error: sessionError } = await supabase
    .from('admin_sessions')
    .insert({
      token_hash: await tokenHash(sessionToken),
      user_id: data.user.id,
      membership_id: membership.id,
      email,
      role: membership.role,
      expires_at: expiresAt,
      user_agent: request.headers.get('user-agent') ?? null,
      ip_address: requestIp(request),
    })
    .select('id')
    .single();

  if (sessionError || !insertedSession) {
    return json({ error: 'Unable to create organizer session. Please try again.' }, 500);
  }

  await supabase
    .from('admin_memberships')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', membership.id);

  await recordAuditEvent(request, env, {
    action: 'admin.login',
    session: {
      id: insertedSession.id,
      email,
      displayName: membership.display_name ?? null,
      role: membership.role,
    },
    targetId: membership.id,
  });

  return json({ authenticated: true }, 200, {
    'Set-Cookie': sessionCookie(request, sessionToken),
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  if (!requestOriginIsValid(request)) {
    return json({ error: 'Invalid request origin.' }, 403);
  }

  const session = await getOrganizerSession(request, env);
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (token && authIsConfigured(env)) {
    await adminClient(env)
      .from('admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', await tokenHash(token));
  }

  if (session && authIsConfigured(env)) {
    await recordAuditEvent(request, env, {
      action: 'admin.logout',
      session,
    });
  }

  return json({ authenticated: false }, 200, {
    'Set-Cookie': expiredSessionCookie(request),
  });
}

async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'GET' && pathname === '/api/auth/config') {
    return handleAuthConfig(env);
  }

  if (request.method === 'GET' && pathname === '/api/auth/session') {
    return handleSession(request, env);
  }

  if (request.method === 'GET' && pathname === '/api/auth/admin/callback') {
    return handleAuthCallback(request);
  }

  if (request.method === 'POST' && pathname === '/api/auth/admin/exchange') {
    return handleTokenExchange(request, env);
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    return handleLogout(request, env);
  }

  return json({ error: 'Not found.' }, 404);
}

async function handleOrganizerPage(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname.replace(/\/+$/, '') || '/';
  const isPublicAuthPage = pathname === `${ORGANIZER_BASE_PATH}/login`
    || pathname === `${ORGANIZER_BASE_PATH}/auth/callback`;

  if (isPublicAuthPage) {
    return env.ASSETS.fetch(request);
  }

  const session = await getOrganizerSession(request, env);
  if (session) {
    return env.ASSETS.fetch(request);
  }

  const loginUrl = new URL(`${ORGANIZER_BASE_PATH}/login`, requestUrl.origin);
  loginUrl.searchParams.set('next', safeOrganizerPath(`${requestUrl.pathname}${requestUrl.search}`));
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl.toString(),
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (pathname.startsWith('/api/auth/')) {
      return handleAuthRequest(request, env);
    }

    if (pathname === ORGANIZER_BASE_PATH || pathname.startsWith(`${ORGANIZER_BASE_PATH}/`)) {
      return handleOrganizerPage(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
