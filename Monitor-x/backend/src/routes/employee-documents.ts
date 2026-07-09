import { Router } from 'express';
import { Types } from 'mongoose';
import { Employee } from '../models/Employee.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { toEmployeeDocDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

export const employeeDocumentsRouter = Router();

// GET /api/employees/:id/documents — list docs (no base64)
employeeDocumentsRouter.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const emp = await Employee.findOne({ empId: req.params.id });
    if (!emp) throw new HttpError(404, 'Employee not found');
    const docs = await EmployeeDocument.find({ employeeId: emp._id }).sort({ uploadedAt: -1 });
    res.json(docs.map(toEmployeeDocDTO));
  })
);

// POST /api/employees/:id/documents — upload document
employeeDocumentsRouter.post(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const { name, mimeType, base64 } = req.body as {
      name?: string;
      mimeType?: string;
      base64?: string;
    };
    if (!name || !base64) throw new HttpError(400, 'name and base64 are required');

    const emp = await Employee.findOne({ empId: req.params.id });
    if (!emp) throw new HttpError(404, 'Employee not found');

    const doc = await EmployeeDocument.create({
      employeeId: emp._id,
      name: name.trim(),
      mimeType: mimeType ?? 'application/octet-stream',
      base64,
      uploadedAt: new Date(),
    });
    res.status(201).json(toEmployeeDocDTO(doc));
  })
);

// GET /api/employees/:id/documents/:docId — fetch single doc with base64
employeeDocumentsRouter.get(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    const doc = await EmployeeDocument.findById(new Types.ObjectId(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document not found');
    res.json({ ...toEmployeeDocDTO(doc), base64: doc.base64 });
  })
);

// DELETE /api/employees/:id/documents/:docId
employeeDocumentsRouter.delete(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    const doc = await EmployeeDocument.findByIdAndDelete(new Types.ObjectId(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document not found');
    res.json({ ok: true });
  })
);
