'use strict';

/**
 * Generic CRUD factory for Expense and Income models.
 * Both models share the same shape, so we generate controllers
 * dynamically to avoid code repetition.
 *
 * @param {mongoose.Model} Model
 * @param {string} entityName  – used in error messages e.g. 'Expense'
 */
const createFinancialController = (Model, entityName) => {
  const getPaginationOptions = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  };

  /**
   * GET /api/<entity>
   * Query: page, limit, startDate, endDate, category
   */
  const getAll = async (req, res, next) => {
    try {
      const { page, limit, skip } = getPaginationOptions(req);

      const filter = {};

      if (req.query.startDate || req.query.endDate) {
        filter.date = {};
        if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
        if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
      }

      if (req.query.category) {
        filter.category = { $regex: req.query.category, $options: 'i' };
      }

      const [items, total] = await Promise.all([
        Model.find(filter)
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email'),
        Model.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          [entityName.toLowerCase() + 's']: items,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/<entity>/:id
   */
  const getOne = async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found.`,
        });
      }

      res.json({ success: true, data: { [entityName.toLowerCase()]: item } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/<entity>
   */
  const create = async (req, res, next) => {
    try {
      const item = await Model.create({ ...req.body, createdBy: req.user._id });
      res.status(201).json({
        success: true,
        data: { [entityName.toLowerCase()]: item },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/<entity>/:id
   */
  const update = async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found.`,
        });
      }

      const allowedFields = ['date', 'category', 'description', 'amountQris', 'amountTunai', 'amount', 'currency', 'notes'];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) item[field] = req.body[field];
      });

      item.updatedBy = req.user._id;
      await item.save();

      res.json({ success: true, data: { [entityName.toLowerCase()]: item } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/<entity>/:id  (superadmin only in router)
   */
  const remove = async (req, res, next) => {
    try {
      const item = await Model.findByIdAndDelete(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found.`,
        });
      }

      res.json({ success: true, message: `${entityName} deleted successfully.` });
    } catch (err) {
      next(err);
    }
  };

  return { getAll, getOne, create, update, remove };
};

module.exports = createFinancialController;
