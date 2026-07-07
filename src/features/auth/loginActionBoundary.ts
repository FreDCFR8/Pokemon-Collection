export type LoginActionInput = {
  username: string;
  password: string;
};

export type LoginActionBoundaryResult = {
  prepared: boolean;
  message: string;
};

export function prepareLoginAction(input: LoginActionInput): LoginActionBoundaryResult {
  const username = input.username.trim();
  const password = input.password.trim();

  if (!username && !password) {
    return {
      prepared: false,
      message: 'Gebruikersnaam en wachtwoord zijn verplicht om de login action boundary voor te bereiden.',
    };
  }

  if (!username) {
    return {
      prepared: false,
      message: 'Gebruikersnaam is verplicht om de login action boundary voor te bereiden.',
    };
  }

  if (!password) {
    return {
      prepared: false,
      message: 'Wachtwoord is verplicht om de login action boundary voor te bereiden.',
    };
  }

  return {
    prepared: true,
    message: 'Login UI is voorbereid. Echte login wordt in een volgende fase geactiveerd.',
  };
}
