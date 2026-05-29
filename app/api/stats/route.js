export async function GET(req) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001';
  const url = new URL(req.url);

  const res = await fetch(`${backendUrl}/api/stats?${url.searchParams.toString()}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' }
  });
}

