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
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [uploadResult, setUploadResult] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, [currentPage, searchTerm]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeApi.getAll({
        page: currentPage,
        limit: 20,
        search: searchTerm
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
      const result = await employeeApi.uploadExcel(file, duplicateAction, (progress) => {
        setUploadProgress(progress);
      });

      setUploadResult(result);

      // Show success message
      if (result.imported > 0 || result.updated > 0) {
        toast.success(result.message || 'Employees processed successfully!');
      }

      // Show warnings for duplicates
      if (result.duplicates && result.duplicates.length > 0) {
        if (duplicateAction === 'skip') {
          toast.warning(`${result.skipped} duplicate(s) were skipped`);
        } else {
          toast.success(`${result.updated} duplicate(s) were updated`);
        }
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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedEmployees(employees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId) => {
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

        {/* Duplicate Handling Option */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How to handle duplicate Employee IDs:
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="duplicateAction"
                value="skip"
                checked={duplicateAction === 'skip'}
                onChange={(e) => setDuplicateAction(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Skip duplicates (keep existing)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="duplicateAction"
                value="update"
                checked={duplicateAction === 'update'}
                onChange={(e) => setDuplicateAction(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Update existing employees</span>
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
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Upload Summary</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>✅ New employees imported: <strong>{uploadResult.imported}</strong></p>
              {uploadResult.updated > 0 && (
                <p>🔄 Existing employees updated: <strong>{uploadResult.updated}</strong></p>
              )}
              {uploadResult.skipped > 0 && (
                <p>⏭️ Duplicates skipped: <strong>{uploadResult.skipped}</strong></p>
              )}
              {uploadResult.duplicates && uploadResult.duplicates.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">
                    View {uploadResult.duplicates.length} duplicate(s)
                  </summary>
                  <ul className="mt-2 ml-4 space-y-1">
                    {uploadResult.duplicates.map((dup, idx) => (
                      <li key={idx}>
                        {dup.employee_id} - {dup.name} ({dup.email})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
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
                      <input
                        type="checkbox"
                        checked={selectedEmployees.length === employees.length && employees.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
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
                      Policy Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coverage
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
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {employee.policy_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${employee.coverage_limit?.toLocaleString()}
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
