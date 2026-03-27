// Netlify Serverless Function — CORS Proxy for external APIs
// Routes: /.netlify/functions/proxy?url=<encoded_url>

export default async (request) => {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=120, stale-while-revalidate=60',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Allowlist: only proxy known data sources
  const allowed = [
    'api.gdeltproject.org',
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
    'news.google.com',
    'www.aljazeera.com',
    'feeds.bbci.co.uk',
    'aljazeera.com',
  ];

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!allowed.some(h => targetUrl.hostname === h || targetUrl.hostname.endsWith('.' + h))) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const resp = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IranCrisisTracker/1.0)',
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(15000),
    });

    const body = await resp.text();
    const contentType = resp.headers.get('content-type') || 'text/plain';

    return new Response(body, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/.netlify/functions/proxy',
};
