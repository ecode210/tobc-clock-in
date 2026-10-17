export type WorkerItem = {
  id: string;
  name: string;
  department: string;
  username: string;
  setupCode: string;
  locked: boolean;
  macAddress: string | null;
  registeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};
