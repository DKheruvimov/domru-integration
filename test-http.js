
async function testDomain(domain) {
  try {
    const res = await fetch(`https://${domain}/api/modules/me/schema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer mod_ea7db04f382abb599c47251f771aa6c38f9f6eacd772ea27`
      },
      body: JSON.stringify({ fields: [] })
    });
    console.log(`${domain}: HTTP ${res.status}`);
    const text = await res.text();
    console.log(`Response:`, text);
  } catch(e) {
    console.log(`${domain}: ERROR`, e.message);
  }
}
async function run() {
  await testDomain("kheruvimov.ru");
  await testDomain("api.kheruvimov.ru");
}
run();

