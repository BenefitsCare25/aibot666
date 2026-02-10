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

// Default export for backward compatibility
import { searchKnowledgeBase, addKnowledgeEntry, addKnowledgeEntriesBatch, updateKnowledgeEntry, deleteKnowledgeEntry } from './knowledgeService.js';
import { addEmployee, addEmployeesBatch, updateEmployeesBatch, getEmployeeByEmployeeId, getEmployeeByUserId, getEmployeeByEmail, getEmployeeByIdentifier, updateEmployee, deactivateEmployee, reactivateEmployee, deactivateEmployeesBulk } from './employeeService.js';

export default {
  searchKnowledgeBase,
  addKnowledgeEntry,
  addKnowledgeEntriesBatch,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  addEmployee,
  addEmployeesBatch,
  updateEmployee,
  updateEmployeesBatch,
  getEmployeeByEmployeeId,
  getEmployeeByUserId,
  getEmployeeByEmail,
  getEmployeeByIdentifier,
  deactivateEmployee,
  reactivateEmployee,
  deactivateEmployeesBulk
};
