import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { Roster, type RosterDoc } from '../models/Roster.js';
import { Employee } from '../models/Employee.js';
import { toRosterDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { localToday } from '../lib/statusBuckets.js';

export const rostersRouter = Router();

type Populated = Parameters<typeof toRosterDTO>[0];

rostersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, fromDate, toDate, status, tripType } = req.query as Record<string, string | undefined>;
    const query: FilterQuery<RosterDoc> = {};
    if (date) query.date = date;
    else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    if (status) query.status = status;
    if (tripType) query.tripType = tripType;
    const docs = await Roster.find(query).populate('employeeId');
    res.json(docs.map((d) => toRosterDTO(d as unknown as Populated)));
  })
);

// Bulk upsert: one roster per employee per date per tripType.
rostersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const entries = req.body as {
      empId: string;
      date?: string;
      tripType?: string;
      timing?: string;
      rosterType?: string;
      status?: string;
    }[];
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new HttpError(400, 'Body must be a non-empty array of roster entries');
    }

    const results = [];
    for (const entry of entries) {
      const employee = await Employee.findOne({ empId: entry.empId });
      if (!employee) throw new HttpError(422, `Employee ${entry.empId} does not exist`);
      const date = entry.date ?? localToday();
      const tripType = entry.tripType === 'drop' ? 'drop' : 'pickup';
      const doc = await Roster.findOneAndUpdate(
        { employeeId: employee._id, date, tripType },
        {
          employeeId: employee._id,
          date,
          tripType,
          timing: entry.timing ?? '',
          rosterType: entry.rosterType ?? 'Regular',
          status: entry.status ?? 'pending',
        },
        { new: true, upsert: true }
      );
      await doc.populate('employeeId');
      results.push(toRosterDTO(doc as unknown as Populated));
    }
    res.status(201).json(results);
  })
);

rostersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !['pending', 'approved', 'completed'].includes(status)) {
      throw new HttpError(400, 'status must be pending, approved or completed');
    }
    const doc = await Roster.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(
      'employeeId'
    );
    if (!doc) throw new HttpError(404, 'Roster entry not found');
    res.json(toRosterDTO(doc as unknown as Populated));
  })
);
