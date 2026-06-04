import mongoose, { Document, Schema } from 'mongoose';

export type TaskStatus = 'pending' | 'in-progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ITaskAttachment {
  _id?: mongoose.Types.ObjectId;
  filename: string;
  url: string;
  addedBy: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  dueDate?: Date;
  completedAt?: Date;
  notes?: string;
  attachments: ITaskAttachment[];
  tags: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<ITaskAttachment>(
  {
    filename: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    addedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const taskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'review', 'done', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '', trim: true },
    attachments: [attachmentSchema],
    tags: [{ type: String, trim: true }],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

taskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? new Date() : undefined;
  }
  next();
});

taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });

export default mongoose.model<ITask>('Task', taskSchema);
