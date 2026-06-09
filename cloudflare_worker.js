export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://schneidjii.github.io/bank-of-dad',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { kid, desc, amount, action, id, reason } = body;

      const GITHUB_TOKEN = env.GITHUB_TOKEN;
      const REPO = 'schneidjii/bank-of-dad';
      const FILE = 'bod_requests.json';
      const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
      const HEADERS = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BOD-Worker'
      };

      const getRes = await fetch(API, { headers: HEADERS });
      const meta = await getRes.json();
      let existing = [];
      let sha = meta.sha;
      try {
        const decoded = atob(meta.content.replace(/\n/g, ''));
        existing = JSON.parse(decoded).requests || [];
      } catch(e) {}

      if (action === 'submit') {
        if (!kid || !desc || amount === undefined) {
          return new Response(JSON.stringify({ error: 'Missing fields' }),
            { status: 400, headers: corsHeaders });
        }
        existing.push({
          id: id || (Date.now() + '' + Math.floor(Math.random() * 9999)),
          kid, desc,
          amount: parseFloat(amount),
          status: 'pending',
          submittedAt: new Date().toISOString(),
          resolvedAt: null,
          reason: ''
        });

      } else if (action === 'cancel') {
        existing = existing.map(function(r) {
          if (r.id === id && r.kid === kid) {
            r.status = 'cancelled';
            r.resolvedAt = new Date().toISOString();
          }
          return r;
        });

      } else {
        return new Response(JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders });
      }

      const encoded = btoa(unescape(encodeURIComponent(
        JSON.stringify({ requests: existing }, null, 2)
      )));
      const putRes = await fetch(API, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          message: `BOD ${action} from ${kid} ${new Date().toISOString()}`,
          content: encoded,
          sha: sha,
          branch: 'main'
        })
      });
      const putData = await putRes.json();
      if (!putData.content) {
        return new Response(JSON.stringify({ error: 'GitHub write failed', detail: putData }),
          { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};