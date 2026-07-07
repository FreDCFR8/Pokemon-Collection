import { useState } from 'react';

import { prepareLoginAction } from './loginActionBoundary';
import type { LoginActionInput, LoginActionResult } from './loginActionTypes';

type LoginPanelState = LoginActionInput & LoginActionResult;

const initialLoginPanelState: LoginPanelState = {
  username: '',
  password: '',
  status: 'idle',
  message: 'Vul je gebruikersnaam en wachtwoord in om de toekomstige login-flow visueel voor te bereiden.',
};

const loginStatusLabels: Record<LoginPanelState['status'], string> = {
  ready_for_later: 'Klaar voor latere activatie',
  failed: 'Validatie mislukt',
  idle: 'Idle',
  disabled: 'Niet geactiveerd',
};

export function LoginPanel() {
  const [formState, setFormState] = useState<LoginPanelState>(initialLoginPanelState);

  const updateField = (field: keyof LoginActionInput, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const prepareLogin = () => {
    setFormState((currentState) => ({
      ...currentState,
      ...prepareLoginAction({
        username: currentState.username,
        password: currentState.password,
      }),
    }));
  };

  return (
    <section className="login-panel" aria-labelledby="login-panel-title">
      <p className="eyebrow">Login voorbereiding</p>
      <h2 id="login-panel-title">Login UI klaarzetten</h2>
      <p>
        Deze interface verzamelt alleen lokale formulierstaat. De knop voert nog geen Supabase login uit.
      </p>

      <form className="login-form" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="login-username">
          Gebruikersnaam
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            value={formState.username}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="trainernaam"
          />
        </label>

        <label htmlFor="login-password">
          Wachtwoord
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={formState.password}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="••••••••"
          />
        </label>

        <button type="button" onClick={prepareLogin}>
          Login voorbereiden
        </button>
      </form>

      <p className="login-message" role="status">
        {formState.message}
      </p>

      <dl className="status-list">
        <div>
          <dt>Auth-target</dt>
          <dd>{formState.authTargetPrepared ? 'Voorbereid' : 'Niet voorbereid'}</dd>
        </div>
        <div>
          <dt>Login-call</dt>
          <dd>Niet uitgevoerd</dd>
        </div>
        <div>
          <dt>Profieldata</dt>
          <dd>Niet geladen</dd>
        </div>
        <div>
          <dt>Collectiegegevens</dt>
          <dd>Niet geladen</dd>
        </div>
        <div>
          <dt>Formulierstatus</dt>
          <dd>{loginStatusLabels[formState.status]}</dd>
        </div>
      </dl>
    </section>
  );
}
