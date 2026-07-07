export type LoginActionStatus = 'idle' | 'disabled' | 'ready_for_later' | 'failed';

export type LoginActionInput = {
  username: string;
  password: string;
};

export type LoginActionResult = {
  status: LoginActionStatus;
  message: string;
  errorMessage?: string;
  resolvedUsername?: string;
  authTargetPrepared?: boolean;
};
