import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
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

// Resolve a document that belongs to the employee named in the path, or 404.
// Scoping by employeeId (not docId alone) stops one employee's id being used to
// reach another's documents; an invalid docId is a 404, never a 500.
async function loadOwnedDoc(empId: string, docId: string) {
  if (!isValidObjectId(docId)) throw new HttpError(404, 'Document not found');
  const emp = await Employee.findOne({ empId });
  if (!emp) throw new HttpError(404, 'Employee not found');
  const doc = await EmployeeDocument.findOne({ _id: docId, employeeId: emp._id });
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

// GET /api/employees/:id/documents/:docId — fetch single doc with base64
employeeDocumentsRouter.get(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.params.id, req.params.docId);
    res.json({ ...toEmployeeDocDTO(doc), base64: doc.base64 });
  })
);

// DELETE /api/employees/:id/documents/:docId
employeeDocumentsRouter.delete(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.params.id, req.params.docId);
    await doc.deleteOne();
    res.json({ ok: true });
  })
);
