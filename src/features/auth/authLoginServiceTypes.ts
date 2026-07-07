export type AuthLoginServiceStatus = 'disabled' | 'ready_for_later' | 'failed';

export type AuthLoginServiceInput = {
  username: string;
  password: string;
};

export type AuthLoginServiceResult = {
  status: AuthLoginServiceStatus;
  message: string;
  errorMessage?: string;
  resolvedUsername?: string;
  authTargetPrepared?: boolean;
  loginExecuted: boolean;
};
