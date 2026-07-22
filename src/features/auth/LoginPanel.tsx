import { useState } from 'react';

import { prepareAuthLogin } from './authLoginService';
import type { AuthLoginServiceInput, AuthLoginServiceResult } from './authLoginServiceTypes';

type LoginPanelState = AuthLoginServiceInput & AuthLoginServiceResult;

const initialLoginPanelState: LoginPanelState = {
  username: '',
  password: '',
  status: 'disabled',
  message: 'Vul je gebruikersnaam en wachtwoord in.',
  authTargetPrepared: false,
  loginExecuted: false,
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
      <p className="eyebrow">Welkom terug</p>
      <h2 id="login-panel-title">Log in</h2>
      <p>Open je eigen verzameling met je gebruikersnaam en wachtwoord.</p>

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

    </section>
  );
}
