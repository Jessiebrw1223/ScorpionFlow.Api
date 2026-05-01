import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Validate caller JWT
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const user = userData.user

  let token: string | null = null
  let mode: 'lookup' | 'accept' = 'lookup'
  try {
    const body = await req.json()
    token = (body.token || '').toString().trim()
    mode = body.action === 'accept' ? 'accept' : 'lookup'
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400)
  }

  if (!token) return jsonResponse({ error: 'Token requerido' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  // Find invitation
  const { data: inv, error: invErr } = await admin
    .from('team_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (invErr || !inv) {
    return jsonResponse({ error: 'Invitación no encontrada' }, 404)
  }

  const expired = new Date(inv.expires_at).getTime() < Date.now()
  const isPending = inv.status === 'pending'
  const computedStatus = expired && isPending ? 'expired' : inv.status

  // Email match (case-insensitive)
  const userEmail = (user.email || '').toLowerCase()
  const invEmail = (inv.email || '').toLowerCase()
  const emailMatches = userEmail === invEmail

  if (mode === 'lookup') {
    return jsonResponse({
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: computedStatus,
        expires_at: inv.expires_at,
        invited_by_name: inv.invited_by_name,
        owner_id: inv.owner_id,
      },
      emailMatches,
      currentUserEmail: user.email,
    })
  }

  // ACCEPT
  if (computedStatus === 'expired') {
    await admin.from('team_invitations').update({ status: 'expired' }).eq('id', inv.id)
    return jsonResponse({ error: 'La invitación ha expirado' }, 410)
  }
  if (computedStatus !== 'pending') {
    return jsonResponse({ error: 'Esta invitación ya no está disponible' }, 409)
  }
  if (!emailMatches) {
    return jsonResponse(
      {
        error: 'email_mismatch',
        message: `Esta invitación es para ${inv.email}. Inicia sesión con esa cuenta.`,
      },
      403,
    )
  }

  // Already a member?
  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('owner_id', inv.owner_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    const { error: memberErr } = await admin.from('team_members').insert({
      owner_id: inv.owner_id,
      user_id: user.id,
      email: user.email,
      full_name:
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        null,
      role: inv.role,
      is_active: true,
    })
    if (memberErr) {
      console.error('insert team_members error', memberErr)
      return jsonResponse({ error: 'No se pudo unir al equipo' }, 500)
    }
  }

  await admin
    .from('team_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inv.id)

  return jsonResponse({ success: true, owner_id: inv.owner_id })
})
