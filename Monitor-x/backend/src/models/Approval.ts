import { Schema, model, Types } from 'mongoose';

export interface ApprovalDoc {
  category: string; // 'employeeAddressChange' | 'workspaceBooking'
  status: string; // 'pending' | 'approved'
  employeeId: Types.ObjectId | null;
  detail: string;
  requestedAt: string;
}

const approvalSchema = new Schema<ApprovalDoc>({
  category: { type: String, enum: ['employeeAddressChange', 'workspaceBooking'], required: true },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  detail: { type: String, default: '' },
  requestedAt: { type: String, default: '' },
});

export const Approval = model<ApprovalDoc>('Approval', approvalSchema);
