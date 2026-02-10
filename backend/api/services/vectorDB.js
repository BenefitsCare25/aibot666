// Re-export all from both services for backward compatibility
export {
  searchKnowledgeBase,
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry
} from './knowledgeService.js';

export {
  addEmployee,
  addEmployeesBatch,
  updateEmployeesBatch,
  getEmployeeByEmployeeId,
  getEmployeeByEmail,
  getEmployeeByUserId,
  getEmployeeByIdentifier,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  deactivateEmployeesBulk
} from './employeeService.js';
