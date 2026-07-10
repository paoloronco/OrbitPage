(async () => {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const base = 'http://localhost:3001';

  try {
    console.log('Fetching links...');
    let r = await fetch(base + '/api/links');
    let links = await r.json();
    console.log('Links count:', links.length);
    if (links.length === 0) {
      console.error('No links to update');
      return;
    }

    // modify first link
    links[0].titleFontSize = '22px';
    links[0].titleFontFamily = "Courier New, monospace";
    links[0].alignment = 'center';

    console.log('Attempting login...');
    r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'ChangeMe123!' }) });
    const loginResp = await r.json();
    console.log('Login status', r.status, loginResp.success ? 'OK' : 'FAIL');
    if (!loginResp.token) { console.error('No token returned', loginResp); return; }
    const token = loginResp.token;

    console.log('Sending PUT /api/links with modified first link...');
    r = await fetch(base + '/api/links', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(links) });
    const putResp = await r.json().catch(() => null);
    console.log('PUT status', r.status, putResp);

    console.log('Re-fetching links...');
    r = await fetch(base + '/api/links');
    const after = await r.json();
    console.log(JSON.stringify(after.map(l => ({ id: l.id, title: l.title, titleFontFamily: l.titleFontFamily, titleFontSize: l.titleFontSize, descriptionFontSize: l.descriptionFontSize, alignment: l.alignment })), null, 2));

  } catch (e) {
    console.error('ERROR', e);
  }
})();
