# Paddie's Verjaardag Frituur

Bestelpagina voor een frietjestraktatie (menu van Frituur De Wijngaard) met adminpaneel.

## Starten

```bash
curl -O https://raw.githubusercontent.com/mbols2510/Friet-Traktatie/main/docker-compose.yml
ADMIN_PASSWORD=kies-een-wachtwoord docker compose up -d
```

- Collega's bestellen op `http://<server>:3000/`
- Jij beheert op `http://<server>:3000/admin` (gebruiker `admin`, wachtwoord uit `ADMIN_PASSWORD`, verplicht in te stellen)
  - *Per persoon*: wie wat besteld heeft
  - *Totaaloverzicht*: samengeteld per product en opties, om door te geven aan de frituur

Bestellingen staan in een SQLite-bestand in de volume `friet-data`; er is geen aparte database nodig.
De image komt van `ghcr.io/mbols2510/friet-traktatie` (gebouwd door GitHub Actions). Is die nog niet beschikbaar of niet publiek, dan bouwt compose hem lokaal: clone de repo en run `docker compose up -d --build`.

## Ontwikkelen

`npm start` (Node 22+) en `npm test`. Het menu staat in `data/menu.json`.
