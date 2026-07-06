import { getEnvConfigReadiness } from './envConfigReadiness';

export function EnvConfigStatusCard() {
  const readiness = getEnvConfigReadiness();
  const label = readiness.status === 'present' ? 'Aanwezig' : 'Ontbreekt';

  return (
    <section className="env-config-card" aria-labelledby="env-config-title">
      <p className="eyebrow">Config readiness</p>
      <h2 id="env-config-title">{readiness.title}</h2>
      <p>{readiness.description}</p>
      <dl className="status-list">
        <div>
          <dt>Publieke project-url</dt>
          <dd>{label}</dd>
        </div>
        <div>
          <dt>Publieke browser-token</dt>
          <dd>{label}</dd>
        </div>
        <div>
          <dt>Netwerkrequest</dt>
          <dd>Niet uitgevoerd</dd>
        </div>
      </dl>
    </section>
  );
}
