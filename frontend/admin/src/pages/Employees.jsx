import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { employeeApi } from '../api/employees';
import toast from 'react-hot-toast';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [syncMode, setSyncMode] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [uploadResult, setUploadResult] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [selectAllMode, setSelectAllMode] = useState(false); // true = all records, false = current page
  const [showSelectMenu, setShowSelectMenu] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, [currentPage, searchTerm, statusFilter]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeApi.getAll({
        page: currentPage,
        limit: 20,
        search: searchTerm,
        status: statusFilter
      });

      setEmployees(response.data.employees);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load employees');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const result = await employeeApi.uploadExcel(file, 'update', syncMode, (progress) => {
        setUploadProgress(progress);
      });

      setUploadResult(result);

      // Show success message
      if (result.imported > 0 || result.updated > 0 || result.deactivated > 0) {
        toast.success(result.message || 'Employees processed successfully!');
      }

      // Show update results for existing employees
      if (result.updated > 0) {
        toast.success(`${result.updated} existing employee(s) updated`);
      }

      // Show sync mode results
      if (syncMode && result.deactivated > 0) {
        toast.info(`${result.deactivated} employee(s) deactivated (not in file)`);
      }

      loadEmployees();
    } catch (error) {
      toast.error(error.message || 'Failed to upload employees');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  const handleDownloadTemplate = async () => {
    try {
      await employeeApi.downloadTemplate();
      toast.success('Template downloaded!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleEditClick = (employee) => {
    setEditingEmployee({ ...employee });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await employeeApi.update(editingEmployee.id, editingEmployee);
      toast.success('Employee updated successfully!');
      setShowEditModal(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to update employee');
      console.error(error);
    }
  };

  const handleDeleteClick = (employee) => {
    setEmployeeToDelete(employee);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await employeeApi.delete(employeeToDelete.id);
      toast.success('Employee deleted successfully!');
      setShowDeleteConfirm(false);
      setEmployeeToDelete(null);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to delete employee');
      console.error(error);
    }
  };

  const handleDeactivateClick = async (employee) => {
    if (!window.confirm(`Deactivate employee ${employee.name}? They will not be able to access the chatbot.`)) {
      return;
    }

    try {
      await employeeApi.deactivate(employee.id, 'Manually deactivated by admin', 'admin');
      toast.success(`Employee ${employee.name} deactivated successfully!`);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to deactivate employee');
      console.error(error);
    }
  };

  const handleActivateClick = async (employee) => {
    try {
      await employeeApi.reactivate(employee.id);
      toast.success(`Employee ${employee.name} activated successfully!`);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to activate employee');
      console.error(error);
    }
  };

  const handleSelectAllCurrentPage = () => {
    setSelectedEmployees(employees.map(emp => emp.id));
    setSelectAllMode(false);
  };

  const handleSelectAllRecords = async () => {
    try {
      const response = await employeeApi.getAllIds({ search: searchTerm });
      setSelectedEmployees(response.data.employeeIds);
      setSelectAllMode(true);
      toast.success(`Selected all ${response.data.employeeIds.length} employee(s)`);
    } catch (error) {
      toast.error('Failed to select all employees');
      console.error(error);
    }
  };

  const handleDeselectAll = () => {
    setSelectedEmployees([]);
    setSelectAllMode(false);
  };

  const handleSelectEmployee = (employeeId) => {
    setSelectAllMode(false); // Exit "select all" mode when manually toggling
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleBulkDeleteClick = () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select employees to delete');
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      await employeeApi.bulkDelete(selectedEmployees);
      toast.success(`${selectedEmployees.length} employee(s) deleted successfully!`);
      setShowBulkDeleteConfirm(false);
      setSelectedEmployees([]);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to delete employees');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-1">Manage employee data and policies</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <span>📥</span>
          Download Template
        </button>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Employee Data</h2>

        {/* Upload Options */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-900">Update existing employees (Add new employees + update existing employee data)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncMode}
                onChange={(e) => setSyncMode(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-900">Sync mode (Deactivate employees not in file - historical data preserved)</span>
            </label>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-600">Uploading... {uploadProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📁</div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                {isDragActive ? 'Drop the file here' : 'Drag & drop Excel file here'}
              </p>
              <p className="text-sm text-gray-600">or click to browse (.xlsx, .xls)</p>
            </>
          )}
        </div>

        {/* Upload Result Summary */}
        {uploadResult && (
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-green-900 text-lg">✅ Upload Complete</h3>
              <button
                onClick={() => setUploadResult(null)}
                className="text-gray-500 hover:text-gray-700"
                title="Close"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              {/* New Employees */}
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <div className="text-xs text-gray-600 mb-1">New Employees</div>
                <div className="text-2xl font-bold text-green-700">
                  {uploadResult.imported || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Added to system</div>
              </div>

              {/* Updated Employees */}
              <div className="bg-white p-3 rounded-lg border border-blue-200">
                <div className="text-xs text-gray-600 mb-1">Updated</div>
                <div className="text-2xl font-bold text-blue-700">
                  {uploadResult.updated || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Data refreshed</div>
              </div>

              {/* Deactivated Employees */}
              <div className="bg-white p-3 rounded-lg border border-orange-200">
                <div className="text-xs text-gray-600 mb-1">Deactivated</div>
                <div className="text-2xl font-bold text-orange-700">
                  {uploadResult.deactivated || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Not in file</div>
              </div>

              {/* Total Processed */}
              <div className="bg-white p-3 rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">Total Processed</div>
                <div className="text-2xl font-bold text-purple-700">
                  {(uploadResult.imported || 0) + (uploadResult.updated || 0) + (uploadResult.deactivated || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">All changes</div>
              </div>
            </div>

            {/* Summary Message */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700">
                <strong className="text-gray-900">Summary:</strong> {uploadResult.message || 'Upload completed successfully'}
              </p>
            </div>

            {/* Duplicates Details (if any) */}
            {uploadResult.duplicates && uploadResult.duplicates.length > 0 && (
              <details className="mt-3 bg-white p-3 rounded-lg border border-gray-200">
                <summary className="cursor-pointer font-medium text-sm text-gray-700">
                  📋 View {uploadResult.duplicates.length} processed duplicate(s)
                </summary>
                <ul className="mt-2 ml-4 space-y-1 text-sm text-gray-600">
                  {uploadResult.duplicates.map((dup, idx) => (
                    <li key={idx} className="border-b border-gray-100 pb-1">
                      <strong>{dup.employee_id}</strong> - {dup.name} ({dup.email})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="active">Active Employees</option>
            <option value="inactive">Inactive Employees</option>
            <option value="all">All Employees</option>
          </select>
          <input
            type="text"
            placeholder="Search by name, email, employee ID, or user ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {selectedEmployees.length > 0 && (
            <button
              onClick={handleBulkDeleteClick}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <span>🗑️</span>
              Delete Selected ({selectedEmployees.length})
            </button>
          )}
        </div>
      </div>

      {/* Selection Banner */}
      {selectedEmployees.length > 0 && selectAllMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            <strong>All {selectedEmployees.length} employee(s)</strong> are selected across all pages
            {searchTerm && <span> (matching search: "{searchTerm}")</span>}
          </p>
          <button
            onClick={handleDeselectAll}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No employees found</p>
            <p className="text-sm text-gray-400 mt-1">Upload an Excel file to get started</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleSelectAllCurrentPage();
                            } else {
                              handleDeselectAll();
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="relative">
                          <button
                            onClick={() => setShowSelectMenu(!showSelectMenu)}
                            className="text-gray-500 hover:text-gray-700"
                            title="Selection options"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {showSelectMenu && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowSelectMenu(false)}
                              ></div>
                              <div className="absolute left-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-56">
                                <button
                                  onClick={() => {
                                    handleSelectAllCurrentPage();
                                    setShowSelectMenu(false);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                                >
                                  Select page ({employees.length})
                                </button>
                                <button
                                  onClick={() => {
                                    handleSelectAllRecords();
                                    setShowSelectMenu(false);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
                                >
                                  Select all records
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeselectAll();
                                    setShowSelectMenu(false);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t rounded-b-lg"
                                >
                                  Deselect all
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleSelectEmployee(employee.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.employee_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.user_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {employee.is_active ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(employee)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Edit employee"
                          >
                            Edit
                          </button>
                          {employee.is_active ? (
                            <button
                              onClick={() => handleDeactivateClick(employee)}
                              className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                              title="Deactivate employee"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateClick(employee)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              title="Reactivate employee"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(employee)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            title="Delete employee"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Employee</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={editingEmployee.employee_id || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input
                  type="text"
                  value={editingEmployee.user_id || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingEmployee.name || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingEmployee.email || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
                <input
                  type="text"
                  value={editingEmployee.policy_type || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, policy_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Limit</label>
                <input
                  type="number"
                  value={editingEmployee.coverage_limit || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, coverage_limit: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{employeeToDelete.name}</strong> ({employeeToDelete.employee_id})?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEmployeeToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Bulk Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedEmployees.length} employee(s)</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
