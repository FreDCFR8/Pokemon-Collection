const setsPageStatusItems = [
  'Read-only foundation klaar',
  'Canonical set catalog nog niet gekoppeld',
  'Collection set-filter blijft uitgesteld',
] as const;

const futureSetsPageOptions = [
  'Alle sets bekijken',
  'Set-detail openen',
  'Voortgang per set bekijken',
  'Later Collection filteren op set',
] as const;

export function SetsPage() {
  return (
    <section className="sets-page" aria-labelledby="sets-page-title">
      <div className="sets-page-hero">
        <p className="eyebrow">Phase 4A</p>
        <h2 id="sets-page-title">Sets</h2>
        <p>Hier komt later de volledige Pokémon set-catalog.</p>
      </div>

      <section className="sets-page-card" aria-labelledby="sets-page-status-title">
        <h3 id="sets-page-status-title">Foundation status</h3>
        <ul className="sets-page-status-list">
          {setsPageStatusItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="sets-page-card sets-page-future-card" aria-labelledby="sets-page-future-title">
        <h3 id="sets-page-future-title">Toekomstige mogelijkheden</h3>
        <ul className="sets-page-future-list">
          {futureSetsPageOptions.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
