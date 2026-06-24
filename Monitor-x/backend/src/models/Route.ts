import { Schema, model } from 'mongoose';

export interface RouteDoc {
  routeId: number;
  name: string;
  type: string;
}

const routeSchema = new Schema<RouteDoc>({
  routeId: { type: Number, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  type: { type: String, default: 'Both' },
});

export const Route = model<RouteDoc>('Route', routeSchema);
