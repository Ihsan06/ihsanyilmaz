// NUR ZUR FEHLERSUCHE – wird gleich wieder entfernt.
// Meldet, WIE die Produktionsumgebung ein Multipart-Feld "datei" parst
// (Datei oder Text). Speichert nichts, liest nichts aus der Umgebung.
export async function onRequestPost({ request }) {
  let d = null, fehler = null;
  try {
    const f = await request.formData();
    d = f.get('datei');
  } catch (err) {
    fehler = String(err && err.message || err);
  }
  return new Response(JSON.stringify({
    fehler,
    typ: typeof d,
    istDatei: !!(d && typeof d === 'object' && typeof d.arrayBuffer === 'function'),
    name: (d && d.name) || null,
    groesse: (d && d.size) ?? (typeof d === 'string' ? d.length : null),
    contentType: request.headers.get('content-type')
  }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
