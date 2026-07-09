import { Schema, model } from 'mongoose';

export interface RouteDoc {
  routeId: number;
  name: string;
  type: string;
  destLat: number | null;
  destLng: number | null;
}

const routeSchema = new Schema<RouteDoc>({
  routeId: { type: Number, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  type: { type: String, default: 'Both' },
  destLat: { type: Number, default: null },
  destLng: { type: Number, default: null },
});

export const Route = model<RouteDoc>('Route', routeSchema);
