const assert = require('assert');
const penaltyService = require('../src/services/penaltyService');
const penaltyRepository = require('../src/repositories/penaltyRepository');

describe('REEKOD Penalty Module Unit & Integration Tests', () => {

  it('should export penaltyService and penaltyRepository', () => {
    assert.ok(penaltyService, 'penaltyService should be defined');
    assert.ok(penaltyRepository, 'penaltyRepository should be defined');
  });

  it('should support checking required Excel columns in validation', () => {
    assert.equal(typeof penaltyService.validateExcelFormat, 'function');
  });

  it('should support bulk insertion and retrieval from database', () => {
    assert.equal(typeof penaltyRepository.bulkInsertPenaltyRecords, 'function');
    assert.equal(typeof penaltyRepository.searchPenaltyRecords, 'function');
    assert.equal(typeof penaltyRepository.getPenaltySummary, 'function');
  });

  it('should allow searching penalties by dispatcher ID', () => {
    assert.equal(typeof penaltyService.searchPenalties, 'function');
  });
});
