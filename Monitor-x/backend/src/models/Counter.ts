import { Schema, model } from 'mongoose';

// Named atomic sequence. Used to hand out gap-free, collision-free ids (e.g. the
// per-day trip sequence) via a single $inc, instead of a racy "max + 1" read.
export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model<CounterDoc>('Counter', counterSchema);
