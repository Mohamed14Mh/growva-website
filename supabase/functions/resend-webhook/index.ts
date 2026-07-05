// resend-webhook - Supabase Edge Function
// Receives Resend delivery lifecycle webhooks and updates cms_notification_log.
//
// Required secrets:
//   RESEND_WEBHOOK_SECRET      - shared secret sent as x-resend-webhook-secret
//
// Built-in:
//   SUPABASE_URL               - Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  - service-role key for server-side log updates

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonMap = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is JsonMap {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): JsonMap {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const found = stringValue(value);
    if (found) return found;
  }
  return null;
}

function truncate(value: unknown, max = 500): string | null {
  const str = stringValue(value);
  if (!str) return null;
  return str.length > max ? str.slice(0, max) : str;
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function normalizeEventType(rawEventType: string | null): string {
  return (rawEventType || '')
    .trim()
    .toLowerCase()
    .replace(/^resend\./, '')
    .replace(/_/g, '.')
    .replace(/\s+/g, '.');
}

function mapStatus(rawEventType: string | null): string {
  const normalized = normalizeEventType(rawEventType);
  const direct: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.failed': 'failed',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    sent: 'sent',
    delivered: 'delivered',
    bounced: 'bounced',
    bounce: 'bounced',
    complained: 'complained',
    complaint: 'complained',
    failed: 'failed',
    failure: 'failed',
    opened: 'opened',
    open: 'opened',
    clicked: 'clicked',
    click: 'clicked',
  };
  return direct[normalized] || 'unknown';
}

function extractProviderMessageId(payload: JsonMap): string | null {
  const data = asRecord(payload.data);
  const email = asRecord(data.email);

  return firstString(
    data.email_id,
    data.emailId,
    data.message_id,
    data.messageId,
    data.provider_message_id,
    data.id,
    email.email_id,
    email.id,
    payload.email_id,
    payload.emailId,
    payload.message_id,
    payload.messageId,
    payload.provider_message_id,
    payload.emailId,
    payload.id,
  );
}

function extractEventType(payload: JsonMap): string | null {
  const data = asRecord(payload.data);
  return firstString(
    payload.type,
    payload.event,
    payload.event_type,
    data.type,
    data.event,
    data.event_type,
  );
}

function appendEvent(existing: unknown, event: JsonMap): JsonMap[] {
  const previous = Array.isArray(existing)
    ? existing.filter(isRecord)
    : [];
  return [event, ...previous].slice(0, 10);
}

function safeProviderDetails(payload: JsonMap): JsonMap {
  const data = asRecord(payload.data);
  const bounce = asRecord(data.bounce);
  const complaint = asRecord(data.complaint);
  const click = asRecord(data.click);
  const open = asRecord(data.open);

  const details: JsonMap = {};
  const pairs: Array<[string, unknown]> = [
    ['provider_event_id', payload.id],
    ['email_id', data.email_id ?? data.emailId],
    ['message_id', data.message_id ?? data.messageId],
    ['created_at', data.created_at ?? payload.created_at],
    ['from', data.from],
    ['to', data.to],
    ['subject', data.subject],
    ['reason', data.reason ?? bounce.reason ?? complaint.reason],
    ['bounce_type', bounce.type],
    ['bounce_subtype', bounce.subtype],
    ['complaint_type', complaint.type],
    ['clicked_link', click.link],
    ['opened_ip', open.ip],
  ];

  for (const [key, value] of pairs) {
    if (Array.isArray(value)) {
      details[key] = value.map((item) => truncate(item, 320)).filter(Boolean).slice(0, 5);
    } else {
      const str = truncate(value, key === 'subject' ? 500 : 320);
      if (str) details[key] = str;
    }
  }

  return details;
}

function errorReasonForStatus(status: string, details: JsonMap): string | null {
  if (!['failed', 'bounced', 'complained'].includes(status)) return null;
  return truncate(
    details.reason ||
      details.bounce_type ||
      details.complaint_type ||
      `Resend event: ${status}`,
    1000,
  );
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const configuredSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!configuredSecret) {
    return json({ error: 'Webhook secret not configured' }, 500);
  }

  const requestSecret = req.headers.get('x-resend-webhook-secret') || '';
  if (!requestSecret || !constantTimeEqual(requestSecret, configuredSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: JsonMap;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed)) {
      return json({ error: 'Invalid webhook payload' }, 400);
    }
    payload = parsed;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const rawEventType = extractEventType(payload);
  const status = mapStatus(rawEventType);
  const providerMessageId = extractProviderMessageId(payload);

  if (!providerMessageId) {
    return json({
      ok: true,
      ignored: true,
      reason: 'missing_provider_message_id',
      status,
      raw_event_type: rawEventType,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service credentials not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: selectError } = await admin
    .from('cms_notification_log')
    .select('id,metadata')
    .eq('provider_message_id', providerMessageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    console.error('[resend-webhook] Lookup error:', selectError.message);
    return json({ error: 'Failed to lookup notification log' }, 500);
  }

  if (!existing?.id) {
    return json({
      ok: true,
      ignored: true,
      reason: 'no_matching_notification_log',
      provider_message_id: providerMessageId,
      status,
      raw_event_type: rawEventType,
    });
  }

  const now = new Date().toISOString();
  const details = safeProviderDetails(payload);
  const previousMetadata = asRecord(existing.metadata);
  const latestEvent: JsonMap = {
    status,
    raw_event_type: rawEventType || 'unknown',
    normalized_event_type: normalizeEventType(rawEventType),
    provider_message_id: providerMessageId,
    webhook_received_at: now,
    provider_event_at: firstString(asRecord(payload.data).created_at, payload.created_at),
    details,
  };

  const metadata = {
    ...previousMetadata,
    latest_resend_event: latestEvent,
    raw_event_type: rawEventType || 'unknown',
    webhook_received_at: now,
    provider_details: details,
    resend_events: appendEvent(previousMetadata.resend_events, latestEvent),
  };

  const update: JsonMap = {
    status,
    metadata,
    last_event_at: now,
  };

  if (status === 'delivered') update.delivered_at = now;
  if (status === 'bounced') update.bounced_at = now;
  if (status === 'complained') update.complained_at = now;
  if (status === 'opened') update.opened_at = now;
  if (status === 'clicked') update.clicked_at = now;

  const reason = errorReasonForStatus(status, details);
  if (reason) update.error_message = reason;

  const { error: updateError } = await admin
    .from('cms_notification_log')
    .update(update)
    .eq('id', existing.id);

  if (updateError) {
    console.error('[resend-webhook] Update error:', updateError.message);
    return json({ error: 'Failed to update notification log' }, 500);
  }

  return json({
    ok: true,
    updated: true,
    status,
    raw_event_type: rawEventType,
    provider_message_id: providerMessageId,
  });
});
