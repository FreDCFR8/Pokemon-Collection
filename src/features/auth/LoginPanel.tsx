import { useState } from 'react';
import { prepareLoginAction } from './loginActionBoundary';

type LoginPanelStatus = 'idle' | 'not_enabled';

type LoginPanelState = {
  username: string;
  password: string;
  status: LoginPanelStatus;
  message: string;
};

const initialLoginPanelState: LoginPanelState = {
  username: '',
  password: '',
  status: 'idle',
  message: 'Vul je gegevens in om de toekomstige login-flow visueel voor te bereiden.',
};

export function LoginPanel() {
  const [formState, setFormState] = useState<LoginPanelState>(initialLoginPanelState);

  const updateField = (field: 'username' | 'password', value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const prepareLogin = () => {
    setFormState((currentState) => {
      const loginAction = prepareLoginAction({
        username: currentState.username,
        password: currentState.password,
      });

      return {
        ...currentState,
        status: loginAction.prepared ? 'not_enabled' : 'idle',
        message: loginAction.message,
      };
    });
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
            placeholder="lars"
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
          <dd>{formState.status === 'not_enabled' ? 'Niet geactiveerd' : 'Idle'}</dd>
        </div>
      </dl>
    </section>
  );
}
