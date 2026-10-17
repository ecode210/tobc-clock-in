export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  worker?: { name: string; username: string; setupCode: string };
};

export const initialActionState: ActionState = {};

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
