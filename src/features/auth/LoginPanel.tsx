import { useState } from 'react';

import { prepareAuthLogin } from './authLoginService';
import type { AuthLoginServiceInput, AuthLoginServiceResult } from './authLoginServiceTypes';

type LoginPanelState = AuthLoginServiceInput & AuthLoginServiceResult;

const initialLoginPanelState: LoginPanelState = {
  username: '',
  password: '',
  status: 'disabled',
  message: 'Vul je gebruikersnaam en wachtwoord in om de toekomstige login-flow visueel voor te bereiden.',
  authTargetPrepared: false,
  loginExecuted: false,
};

const authServiceStatusLabels: Record<LoginPanelState['status'], string> = {
  disabled: 'Uitgeschakeld',
  ready_for_later: 'Klaar voor latere activatie',
  failed: 'Niet klaar',
  authenticated: 'Ingelogd',
};

export function LoginPanel() {
  const [formState, setFormState] = useState<LoginPanelState>(initialLoginPanelState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof AuthLoginServiceInput, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const prepareLogin = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormState((currentState) => ({
      ...currentState,
      message: 'Login wordt gecontroleerd.',
    }));

    try {
      const loginResult = await prepareAuthLogin({
        username: formState.username,
        password: formState.password,
      });

      setFormState((currentState) => ({
        ...currentState,
        ...loginResult,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="login-panel" aria-labelledby="login-panel-title">
      <p className="eyebrow">Login voorbereiding</p>
      <h2 id="login-panel-title">Login UI klaarzetten</h2>
      <p>
        Deze interface activeert alleen voor bekende gebruikersnamen een gecontroleerde Supabase Auth login-call.
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

        <button type="button" onClick={prepareLogin} disabled={isSubmitting}>
          {isSubmitting ? 'Login wordt gecontroleerd' : 'Login controleren'}
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
          <dd>{formState.loginExecuted ? 'Uitgevoerd' : 'Niet uitgevoerd'}</dd>
        </div>
        <div>
          <dt>Auth-service</dt>
          <dd>{authServiceStatusLabels[formState.status]}</dd>
        </div>
        <div>
          <dt>Sessie</dt>
          <dd>{formState.sessionPresent ? 'Actief' : 'Niet bevestigd'}</dd>
        </div>
        <div>
          <dt>Profieldata</dt>
          <dd>Niet geladen</dd>
        </div>
        <div>
          <dt>Collectiegegevens</dt>
          <dd>Niet geladen</dd>
        </div>
      </dl>
    </section>
  );
}
