const origin = 'https://flapsandseals.com';

async function jfetch(path, opts={}){
  const url = origin + path;
  const res = await fetch(url, {
    redirect: 'follow',
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers||{}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { _nonJson: true, text }; }
  return { url, status: res.status, ok: res.ok, data, text: text.slice(0,500) };
}

const email = `test-${Date.now()}@example.com`;

const create = await jfetch('/api/booking/create', {
  method: 'POST',
  body: JSON.stringify({
    scenario_type: 'scenario-1',
    group_name: 'Test Group',
    lead_name: 'Test User',
    lead_email: email,
    lead_phone: '555-555-5555',
    player_count: 2,
    notes: 'Automated checkout test',
  })
});
console.log('CREATE', create.status, create.data);
if(!create.ok) process.exit(1);

const id = create.data?.booking?.id;
if(!id) { console.error('No booking id'); process.exit(1); }

const waiver = await jfetch(`/api/booking/${id}/waiver`, {
  method: 'POST',
  body: JSON.stringify({ waiver_version: 'v1.0-draft', signature_name: 'Test User' })
});
console.log('WAIVER', waiver.status, waiver.data);

const checkout = await jfetch(`/api/booking/${id}/checkout`, {
  method: 'POST',
  body: JSON.stringify({})
});
console.log('CHECKOUT', checkout.status, checkout.data);
