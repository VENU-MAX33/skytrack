import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Employee } from '../models/Employee.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { toEmployeeDocDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requirePermission } from '../middleware/auth.js';

export const employeeDocumentsRouter = Router();

const ALLOWED_DOCUMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

function validateDocument(name: string, mimeType: string, base64: string): Buffer {
  if (!ALLOWED_DOCUMENT_TYPES.has(mimeType)) throw new HttpError(415, 'Unsupported document type');
  if (name.length > 120 || /[\\/\0]/.test(name)) throw new HttpError(400, 'Invalid document name');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new HttpError(400, 'Invalid base64 document data');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'Document must be 3 MB or smaller');
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isPdf = bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  const isOle = bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isZip = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const signatureMatches = mimeType === 'image/jpeg' ? isJpeg
    : mimeType === 'image/png' ? isPng
    : mimeType === 'application/pdf' ? isPdf
    : mimeType === 'application/msword' ? isOle
    : isZip;
  if (!signatureMatches) throw new HttpError(415, 'Document content does not match its declared type');
  return bytes;
}

// GET /api/employees/:id/documents — list docs (no base64)
employeeDocumentsRouter.get(
  '/:id/documents',
  requirePermission((role) => role === 'admin' || role === 'platform-owner'),
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
  requirePermission((role) => role === 'admin' || role === 'platform-owner'),
  asyncHandler(async (req, res) => {
    const { name, mimeType, base64 } = req.body as {
      name?: string;
      mimeType?: string;
      base64?: string;
    };
    if (!name || !base64) throw new HttpError(400, 'name and base64 are required');
    const safeName = name.trim();
    const safeMimeType = mimeType ?? 'application/octet-stream';
    validateDocument(safeName, safeMimeType, base64);

    const emp = await Employee.findOne({ empId: req.params.id });
    if (!emp) throw new HttpError(404, 'Employee not found');

    const doc = await EmployeeDocument.create({
      employeeId: emp._id,
      name: safeName,
      mimeType: safeMimeType,
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
  requirePermission((role) => role === 'admin' || role === 'platform-owner'),
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.params.id, req.params.docId);
    res.json({ ...toEmployeeDocDTO(doc), base64: doc.base64 });
  })
);

// DELETE /api/employees/:id/documents/:docId
employeeDocumentsRouter.delete(
  '/:id/documents/:docId',
  requirePermission((role) => role === 'admin' || role === 'platform-owner'),
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.params.id, req.params.docId);
    await doc.deleteOne();
    res.json({ ok: true });
  })
);
