'use strict';

/**
 * Shared route factory for /expenses and /incomes.
 * Both models are identical in shape so one factory covers both.
 *
 * @param {object} controller – result of createFinancialController()
 */
const createFinancialRouter = (controller) => {
  const express = require('express');
  const router = express.Router();

  const { protect, restrictTo } = require('../middlewares/auth');
  const { financialEntryValidator, mongoIdValidator, paginationValidator } = require('../middlewares/validators');

  router.use(protect);

  router.get('/', paginationValidator, controller.getAll);
  router.get('/:id', mongoIdValidator, controller.getOne);
  router.post('/', financialEntryValidator, controller.create);
  router.put('/:id', mongoIdValidator, financialEntryValidator, controller.update);
  router.delete('/:id', mongoIdValidator, controller.remove);

  return router;
};

module.exports = createFinancialRouter;
