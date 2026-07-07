export type AuthLoginServiceStatus = 'disabled' | 'ready_for_later' | 'failed' | 'authenticated';

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
  sessionPresent?: boolean;
};
