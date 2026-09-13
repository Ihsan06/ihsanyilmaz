// aiy-www – schickt jeden Aufruf von www.ihsan-yilmaz.de dauerhaft (301) an
// dieselbe Adresse ohne www. Pfad und Parameter bleiben erhalten, damit auch
// alte Links auf Unterseiten richtig ankommen.

const ZIEL = 'ihsan-yilmaz.de';

export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = ZIEL;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
};
