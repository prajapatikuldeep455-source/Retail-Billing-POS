(async () => {
  const url = "https://script.google.com/macros/s/AKfycbx5WoMQ0XKJTsDzmQutDoLJkFVHfr0il0ljpvVyXLtCPAr3R2l2ieb_yhQOWhrFCTCI/exec";
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: "REGISTER_TRIAL", hd_id: "TEST-12345", owner_name: "Test Owner", shop_name: "Test Shop" })
  });
  const text = await res.text();
  console.log(text);
})();
