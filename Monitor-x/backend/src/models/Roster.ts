import { Schema, model, Types } from 'mongoose';

export interface RosterDoc {
  employeeId: Types.ObjectId;
  date: string;
  tripType: string; // 'pickup' | 'drop'
  timing: string;
  rosterType: string;
  status: string; // 'pending' | 'approved' | 'completed'
}

const rosterSchema = new Schema<RosterDoc>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true, index: true },
  tripType: { type: String, enum: ['pickup', 'drop'], default: 'pickup' },
  timing: { type: String, default: '' },
  rosterType: { type: String, default: 'Regular' },
  status: { type: String, enum: ['pending', 'approved', 'completed'], default: 'pending', index: true },
});

export const Roster = model<RosterDoc>('Roster', rosterSchema);
